import { describe, expect, it } from "vitest";

import {
  EXPERIMENTAL_ULTIMATES,
  SHIELDS,
  WEAPONS,
  type ShieldEvent,
} from "../lib/game";
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  AudioActivationError,
  AudioDirector,
  CANONICAL_SOUND_PROFILES,
  DEFAULT_AUDIO_PREFERENCES,
  EXPERIMENTAL_SOUND_PROFILES,
  MUSIC_TEMPO_BPM,
  SOUND_PROFILES,
  audioPlanForEvent,
  configurePlaybackAudioSession,
  damageBucket,
  isAppleMobileWebKit,
  loadAudioPreferences,
  normalizeAudioPreferences,
  saveAudioPreferences,
  type AudioPreferences,
  type AudioMediaBridge,
  type AudioMediaBridgeState,
  type GameAudioEvent,
  type RuntimeAudioContextState,
} from "../app/game/audio-system";

const enabled: AudioPreferences = {
  ...DEFAULT_AUDIO_PREFERENCES,
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 50,
  sfxVolume: 70,
};

const timeline = (
  overrides: Partial<
    Extract<GameAudioEvent, { type: "weapon-timeline" }>
  > = {},
): Extract<GameAudioEvent, { type: "weapon-timeline" }> => ({
  type: "weapon-timeline",
  weaponId: "babyMissile",
  durationMs: 1_800,
  resolvedAtMs: 1_200,
  impactTimesMs: [1_200],
  fizzled: false,
  pan: 0.25,
  seed: 7_919,
  ...overrides,
});

const resolution = (
  shieldEvents: readonly ShieldEvent[] = [],
): Extract<GameAudioEvent, { type: "resolution" }> => ({
  type: "resolution",
  weaponId: "missile",
  material: "soil",
  damages: [],
  landings: [],
  criticalCrossings: [],
  shieldEvents,
  terrainCollapse: false,
  fizzled: false,
  pan: 0,
  seed: 41_705,
});

describe("typed weapon sound profiles", () => {
  it("covers exactly 33 canonical weapons and 10 Experimental Ultimates", () => {
    expect(Object.keys(CANONICAL_SOUND_PROFILES)).toHaveLength(33);
    expect(Object.keys(EXPERIMENTAL_SOUND_PROFILES)).toHaveLength(10);
    expect(Object.keys(SOUND_PROFILES)).toHaveLength(43);
    expect(Object.keys(CANONICAL_SOUND_PROFILES).sort()).toEqual(
      WEAPONS.map(({ id }) => id).sort(),
    );
    expect(Object.keys(EXPERIMENTAL_SOUND_PROFILES).sort()).toEqual(
      EXPERIMENTAL_ULTIMATES.map(({ id }) => id).sort(),
    );
  });

  it("gives every item a non-volume signature and bounded event budget", () => {
    const profiles = Object.values(SOUND_PROFILES);
    const fingerprints = profiles.map((profile) =>
      JSON.stringify({
        signature: profile.signature,
        motifHz: profile.motifHz,
        waves: profile.waves,
        attackMs: profile.attackMs,
        impactMs: profile.impactMs,
        tailMs: profile.tailMs,
        rhythmMs: profile.rhythmMs,
        stereoMotion: profile.stereoMotion,
      }),
    );

    expect(new Set(fingerprints).size).toBe(43);
    for (const profile of profiles) {
      expect(profile.phases).toContain("launch");
      expect(profile.phases).toContain("impact");
      expect(profile.voiceBudget).toBeGreaterThanOrEqual(4);
      expect(profile.voiceBudget).toBeLessThanOrEqual(12);
    }
  });
});

describe("pure audio event planning", () => {
  it("keeps every procedural score state inside the 72–84 BPM brief", () => {
    expect(Object.keys(MUSIC_TEMPO_BPM)).toHaveLength(6);
    expect(Math.min(...Object.values(MUSIC_TEMPO_BPM))).toBe(72);
    expect(Math.max(...Object.values(MUSIC_TEMPO_BPM))).toBe(84);
  });

  it("uses actual impact timestamps and caps one gameplay event at 12 voices", () => {
    const impactTimesMs = Array.from(
      { length: 30 },
      (_, index) => 300 + index * 37,
    );
    const plan = audioPlanForEvent(
      timeline({
        weaponId: "deathsHead",
        impactTimesMs,
      }),
      enabled,
    );
    const impacts = plan.voices.filter((voice) =>
      voice.id.includes(":impact:"),
    );

    expect(plan.voices.length).toBeLessThanOrEqual(12);
    expect(impacts.length).toBeGreaterThan(1);
    expect(impacts[0]?.atMs).toBe(impactTimesMs[0]);
    expect(impacts.every((voice) => impactTimesMs.includes(voice.atMs))).toBe(
      true,
    );
  });

  it("plans fizzle without child-impact audio", () => {
    const plan = audioPlanForEvent(
      timeline({
        fizzled: true,
        impactTimesMs: [400, 600, 800],
      }),
      enabled,
    );

    expect(plan.voices.some((voice) => voice.id.endsWith(":fizzle"))).toBe(
      true,
    );
    expect(plan.voices.some((voice) => voice.id.includes(":impact:"))).toBe(
      false,
    );
  });

  it("maps all shield event variants and all five shield families", () => {
    const variants: readonly ShieldEvent[] = [
      {
        type: "absorb",
        shieldId: "shield",
        absorbed: 20,
        healthDamage: 0,
        remainingCapacity: 26,
      },
      {
        type: "break",
        shieldId: "heavy-shield",
        absorbed: 20,
        healthDamage: 20,
        remainingCapacity: 0,
      },
      {
        type: "deflect",
        shieldId: "mag-deflector",
        from: { x: 400, y: 200 },
        to: { x: 430, y: 160 },
        remainingCapacity: 28,
        broken: false,
      },
      {
        type: "bypass",
        shieldId: "force-shield",
        reason: "weapon",
        healthDamage: 18,
        remainingCapacity: 42,
      },
      {
        type: "laser-immunity",
        shieldId: "super-mag",
        remainingCapacity: 68,
      },
    ];
    const variantPlan = audioPlanForEvent(resolution(variants), enabled);
    const shieldVoices = variantPlan.voices.filter(
      (voice) => voice.bus === "shieldArmor",
    );

    expect(new Set(shieldVoices.map((voice) => voice.id.split(":")[2]))).toEqual(
      new Set(["absorb", "break", "deflect", "bypass", "laser-immunity"]),
    );

    const familyFingerprints = SHIELDS.slice(1).map((shield) => {
      const event: ShieldEvent = {
        type: "absorb",
        shieldId: shield.id,
        absorbed: 5,
        healthDamage: 0,
        remainingCapacity: 5,
      };
      const voice = audioPlanForEvent(resolution([event]), enabled).voices.find(
        (candidate) => candidate.id.startsWith("shield:"),
      );
      return `${voice?.frequencyHz}:${voice?.wave}`;
    });
    expect(new Set(familyFingerprints).size).toBe(5);
  });

  it("maps damage, landing, critical crossing and terrain collapse", () => {
    expect([
      damageBucket(5, 100),
      damageBucket(12, 100),
      damageBucket(28, 100),
      damageBucket(50, 100),
    ]).toEqual(["light", "medium", "heavy", "critical"]);

    const plan = audioPlanForEvent(
      {
        ...resolution(),
        material: "hull",
        terrainCollapse: true,
        damages: [
          {
            amount: 55,
            bucket: "critical",
            direct: true,
            destroyed: true,
            pan: 0.7,
          },
        ],
        landings: [
          {
            distance: 62,
            destroyed: false,
            pan: -0.4,
          },
        ],
        criticalCrossings: [{ pan: -0.4 }],
      },
      enabled,
    );
    expect(plan.voices.some((voice) => voice.id === "material:hull")).toBe(
      true,
    );
    expect(plan.voices.some((voice) => voice.id === "hull:critical:0")).toBe(
      true,
    );
    expect(plan.voices.some((voice) => voice.id === "terrain:collapse")).toBe(
      true,
    );
    expect(plan.voices.some((voice) => voice.id === "hull:landing:0")).toBe(
      true,
    );
    expect(
      plan.voices.some(
        (voice) => voice.id === "hull:critical-crossing:0",
      ),
    ).toBe(true);
  });

  it("keeps music and SFX switches independent", () => {
    const musicOff = { ...enabled, musicEnabled: false };
    const sfxOff = { ...enabled, sfxEnabled: false };
    expect(
      audioPlanForEvent({ type: "music", state: "aiming" }, musicOff).voices,
    ).toHaveLength(0);
    expect(audioPlanForEvent(timeline(), musicOff).voices.length).toBeGreaterThan(
      0,
    );
    expect(audioPlanForEvent(timeline(), sfxOff).voices).toHaveLength(0);
    expect(
      audioPlanForEvent({ type: "music", state: "aiming" }, sfxOff).voices
        .length,
    ).toBeGreaterThan(0);
  });

  it("keeps plan gains independent from the runtime volume bus", () => {
    const quiet = audioPlanForEvent(timeline(), {
      ...enabled,
      sfxVolume: 10,
    });
    const loud = audioPlanForEvent(timeline(), {
      ...enabled,
      sfxVolume: 100,
    });

    expect(quiet.voices.map(({ gain }) => gain)).toEqual(
      loud.voices.map(({ gain }) => gain),
    );
  });

  it("keeps the procedural score inside a phone-audible spectrum", () => {
    const plan = audioPlanForEvent(
      { type: "music", state: "round-result" },
      enabled,
    );
    expect(Math.min(...plan.voices.map(({ frequencyHz }) => frequencyHz))).toBe(
      196,
    );
    expect(Math.max(...plan.voices.map(({ frequencyHz }) => frequencyHz))).toBe(
      587.33,
    );
    expect(Math.max(...plan.voices.map(({ gain }) => gain))).toBe(0.04);
  });
});

describe("audio preference persistence", () => {
  it("normalizes malformed values, persists all four settings and migrates legacy mute", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const preferences = normalizeAudioPreferences({
      musicEnabled: false,
      sfxEnabled: true,
      musicVolume: -20,
      sfxVolume: 140,
    });
    expect(preferences).toEqual({
      musicEnabled: false,
      sfxEnabled: true,
      musicVolume: 0,
      sfxVolume: 100,
    });

    saveAudioPreferences(storage, preferences);
    expect(JSON.parse(values.get(AUDIO_PREFERENCES_STORAGE_KEY) ?? "")).toEqual(
      preferences,
    );
    expect(loadAudioPreferences(storage)).toEqual(preferences);

    values.delete(AUDIO_PREFERENCES_STORAGE_KEY);
    values.set("afterglow-artillery.audioEnabled", "false");
    expect(loadAudioPreferences(storage)).toMatchObject({
      musicEnabled: false,
      sfxEnabled: false,
    });
  });
});

class FakeAudioParam {
  public value = 0;

  public cancelScheduledValues(): void {}
  public setTargetAtTime(value: number): void {
    this.value = value;
  }
  public setValueAtTime(value: number): void {
    this.value = value;
  }
  public exponentialRampToValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeNode {
  public connect(): void {}
  public disconnect(): void {}
}

class FakeOscillator extends FakeNode {
  public type: OscillatorType = "sine";
  public readonly frequency = new FakeAudioParam();
  public readonly detune = new FakeAudioParam();
  public onended: (() => void) | null = null;

  public constructor(private readonly events: string[] = []) {
    super();
  }

  public start(): void {
    this.events.push("source-start");
  }
  public stop(): void {}
}

class FakeBufferSource extends FakeNode {
  public buffer: AudioBuffer | null = null;
  public onended: (() => void) | null = null;

  public start(): void {
    this.onended?.();
  }
}

class FakeGain extends FakeNode {
  public readonly gain = new FakeAudioParam();
}

class FakeCompressor extends FakeNode {
  public readonly threshold = new FakeAudioParam();
  public readonly knee = new FakeAudioParam();
  public readonly ratio = new FakeAudioParam();
  public readonly attack = new FakeAudioParam();
  public readonly release = new FakeAudioParam();
}

class FakePanner extends FakeNode {
  public readonly pan = new FakeAudioParam();
}

class FakeAudioContext {
  public state: RuntimeAudioContextState;
  public readonly sampleRate = 48_000;
  public readonly destination = new FakeNode();
  private stateChangeListener: (() => void) | null = null;
  private runningSince = 0;
  public readonly events: string[] = [];

  public constructor(
    state: RuntimeAudioContextState = "suspended",
    private readonly resumeOutcome:
      | "running"
      | "frozen"
      | "unchanged"
      | "pending"
      | "reject" = "running",
  ) {
    this.state = state;
    if (state === "running") {
      this.runningSince = Date.now();
    }
  }

  public get currentTime(): number {
    return this.state === "running" && this.resumeOutcome !== "frozen"
      ? (Date.now() - this.runningSince) / 1_000
      : 0;
  }

  public createGain(): GainNode {
    return new FakeGain() as unknown as GainNode;
  }
  public createDynamicsCompressor(): DynamicsCompressorNode {
    return new FakeCompressor() as unknown as DynamicsCompressorNode;
  }
  public createOscillator(): OscillatorNode {
    return new FakeOscillator(this.events) as unknown as OscillatorNode;
  }
  public createStereoPanner(): StereoPannerNode {
    return new FakePanner() as unknown as StereoPannerNode;
  }
  public createBufferSource(): AudioBufferSourceNode {
    return new FakeBufferSource() as unknown as AudioBufferSourceNode;
  }
  public createBuffer(): AudioBuffer {
    return {} as AudioBuffer;
  }
  public addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === "statechange" && typeof listener === "function") {
      this.stateChangeListener = listener as () => void;
    }
  }
  public removeEventListener(type: string): void {
    if (type === "statechange") {
      this.stateChangeListener = null;
    }
  }
  public async resume(): Promise<void> {
    this.events.push("resume");
    if (this.resumeOutcome === "reject") {
      throw new Error("resume rejected");
    }
    if (this.resumeOutcome === "pending") {
      return new Promise<void>(() => undefined);
    }
    if (
      this.resumeOutcome === "running" ||
      this.resumeOutcome === "frozen"
    ) {
      this.state = "running";
      this.runningSince = Date.now();
      this.stateChangeListener?.();
    }
  }
  public async suspend(): Promise<void> {
    this.state = "suspended";
    this.stateChangeListener?.();
  }
  public async close(): Promise<void> {
    this.state = "closed";
    this.stateChangeListener?.();
  }
}

class FakeMediaBridge implements AudioMediaBridge {
  public state: AudioMediaBridgeState = "idle";

  public constructor(private readonly events: string[]) {}

  public async start(): Promise<void> {
    this.events.push("bridge-start");
    this.state = "playing";
  }

  public pause(): void {
    this.events.push("bridge-pause");
    this.state = "idle";
  }

  public dispose(): void {
    this.events.push("bridge-dispose");
    this.state = "idle";
  }
}

describe("AudioDirector lifecycle and budgets", () => {
  it("requests the playback audio session when Safari exposes AudioSession", () => {
    const audioSession = { type: "auto", state: "inactive" };
    expect(
      configurePlaybackAudioSession({ audioSession }),
    ).toBe("playback");
    expect(audioSession.type).toBe("playback");
    expect(configurePlaybackAudioSession({})).toBeNull();
  });

  it("detects native iPhone/iPad WebKit for the media-route fallback", () => {
    expect(
      isAppleMobileWebKit({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15",
      }),
    ).toBe(true);
    expect(
      isAppleMobileWebKit({
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
    expect(
      isAppleMobileWebKit({
        userAgent:
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140",
      }),
    ).toBe(false);
  });

  it("starts the unlock source and media route before awaiting resume", async () => {
    const context = new FakeAudioContext("suspended");
    const bridge = new FakeMediaBridge(context.events);
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      {
        mediaBridge: bridge,
        outputRoute: "media-element-fallback",
      },
    );

    const report = await director.activate(enabled);

    expect(context.events.indexOf("source-start")).toBeLessThan(
      context.events.indexOf("resume"),
    );
    expect(context.events.indexOf("bridge-start")).toBeLessThan(
      context.events.indexOf("resume"),
    );
    expect(report.outputRoute).toBe("media-element-fallback");
    expect(director.debugSnapshot().mediaBridgeState).toBe("playing");
    await director.dispose();
    expect(context.events).toContain("bridge-dispose");
  });

  it("times out a WebKit resume that never settles", async () => {
    const context = new FakeAudioContext("suspended", "pending");
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { activationTimeoutMs: 50 },
    );

    await expect(director.activate(enabled)).rejects.toThrow(
      "Audio activation timed out",
    );
    await director.dispose();
  });

  it.each(["suspended", "interrupted"] as const)(
    "resumes %s contexts and confirms running before activation",
    async (initialState) => {
      const context = new FakeAudioContext(initialState);
      const states: RuntimeAudioContextState[] = [];
      const director = new AudioDirector(
        context as unknown as AudioContext,
        (state) => states.push(state),
      );

      const report = await director.activate(enabled);

      expect(report.contextState).toBe("running");
      expect(director.state).toBe("running");
      expect(states).toContain("running");
      await director.dispose();
    },
  );

  it("rejects activation when resume rejects", async () => {
    const context = new FakeAudioContext("suspended", "reject");
    const director = new AudioDirector(
      context as unknown as AudioContext,
    );

    await expect(director.activate(enabled)).rejects.toThrow(
      "resume rejected",
    );
    await director.dispose();
  });

  it("rejects false-positive resume when state never becomes running", async () => {
    const context = new FakeAudioContext("interrupted", "unchanged");
    const director = new AudioDirector(
      context as unknown as AudioContext,
    );

    const activation = director.activate(enabled);
    await expect(activation).rejects.toBeInstanceOf(AudioActivationError);
    await expect(activation).rejects.toMatchObject({
      name: "AudioActivationError",
      contextState: "interrupted",
    });
    await director.dispose();
  });

  it("rejects a running context whose clock remains frozen", async () => {
    const context = new FakeAudioContext("suspended", "frozen");
    const director = new AudioDirector(
      context as unknown as AudioContext,
    );

    await expect(director.activate(enabled)).rejects.toMatchObject({
      name: "AudioActivationError",
      contextState: "running",
    });
    await director.dispose();
  });

  it("caps total voices and cancels scheduled audio on pause, hide and dispose", async () => {
    const context = new FakeAudioContext();
    const director = new AudioDirector(context as unknown as AudioContext);
    await director.activate(enabled);
    expect(director.state).toBe("running");
    expect(director.activeVoiceCount).toBe(4);
    expect(director.debugSnapshot()).toMatchObject({
      contextState: "running",
      activated: true,
      musicTargetGain: 0.5,
      sfxTargetGain: 0.7,
    });

    for (let index = 0; index < 40; index += 1) {
      director.play({
        type: "ui",
        cue: "toggle",
        seed: index,
      });
    }
    expect(director.activeVoiceCount).toBeLessThanOrEqual(24);

    director.setPaused(true);
    expect(director.activeVoiceCount).toBe(4);
    await director.setHidden(true);
    expect(director.activeVoiceCount).toBe(0);
    expect(director.state).toBe("suspended");

    await director.setHidden(false);
    expect(director.activeVoiceCount).toBe(0);
    await director.activate(enabled);
    expect(director.activeVoiceCount).toBe(4);
    await director.dispose();
    expect(director.activeVoiceCount).toBe(0);
    expect(context.state).toBe("closed");
  });
});
