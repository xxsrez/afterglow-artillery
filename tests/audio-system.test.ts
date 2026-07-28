import { describe, expect, it, vi } from "vitest";

import {
  EXPERIMENTAL_ULTIMATES,
  SHIELDS,
  WEAPONS,
  type ShieldEvent,
} from "../lib/game";
import {
  AUDIO_SAMPLE_IDS,
  AUDIO_SAMPLE_URLS,
  MUSIC_TRACK,
  createHttpAudioAssetLoader,
  type AudioAssetLoader,
  type AudioSampleId,
} from "../app/game/audio-assets";
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  AudioActivationError,
  AudioDirector,
  CANONICAL_SOUND_PROFILES,
  DEFAULT_AUDIO_PREFERENCES,
  EXPERIMENTAL_SOUND_PROFILES,
  SOUND_PROFILES,
  audioPlanForEvent,
  configureAutomaticAudioSession,
  configurePlaybackAudioSession,
  damageBucket,
  isAppleMobileWebKit,
  isDesktopSafariWebKit,
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
  it("maps physical effect scale instead of weapon-id variation", () => {
    expect(SOUND_PROFILES.babyMissile.impactScale).toBe("small");
    expect(SOUND_PROFILES.missile.impactScale).toBe("medium");
    expect(SOUND_PROFILES.babyNuke.impactScale).toBe("large");
    expect(SOUND_PROFILES.nuke.impactScale).toBe("ultimate");
    expect(SOUND_PROFILES.heliosSpire.archetype).toBe("laser");
    expect(SOUND_PROFILES.magmaForge.archetype).toBe("fire");
    expect(SOUND_PROFILES.faultChoir.archetype).toBe("terrain-cut");
    expect(MUSIC_TRACK.durationSeconds).toBeGreaterThan(70);
  });

  it("uses actual impact timestamps and caps one gameplay event at 12 total layers", () => {
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
    const impactLayers = [
      ...plan.voices.filter((voice) => voice.id.includes(":impact:")),
      ...plan.samples.filter((planned) =>
        planned.id.includes(":impact-sample:"),
      ),
    ];

    expect(plan.voices.length + plan.samples.length).toBeLessThanOrEqual(12);
    expect(impactLayers.length).toBeGreaterThan(1);
    expect(impactLayers.some(({ atMs }) => atMs === impactTimesMs[0])).toBe(
      true,
    );
    expect(
      impactLayers.every((planned) => impactTimesMs.includes(planned.atMs)),
    ).toBe(true);
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
    expect(
      plan.samples.some((planned) => planned.id.includes(":impact-sample:")),
    ).toBe(false);
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
    expect(
      variantPlan.samples.filter(
        (planned) => planned.sampleId === "shield-field",
      ),
    ).toHaveLength(5);

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
    expect(plan.samples.map(({ sampleId }) => sampleId)).toEqual(
      expect.arrayContaining(["impact-hull", "impact-rock"]),
    );
  });

  it("keeps SFX planning independent from the music switch", () => {
    const musicOff = { ...enabled, musicEnabled: false };
    const sfxOff = { ...enabled, sfxEnabled: false };
    expect(audioPlanForEvent(timeline(), musicOff).voices.length).toBeGreaterThan(
      0,
    );
    expect(audioPlanForEvent(timeline(), sfxOff).voices).toHaveLength(0);
    expect(audioPlanForEvent(timeline(), sfxOff).samples).toHaveLength(0);
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
    expect(quiet.samples.map(({ gain }) => gain)).toEqual(
      loud.samples.map(({ gain }) => gain),
    );
  });

  it("makes large blasts materially deeper and denser than small blasts", () => {
    const small = audioPlanForEvent(
      timeline({ weaponId: "babyMissile" }),
      enabled,
    );
    const ultimate = audioPlanForEvent(
      timeline({ weaponId: "nuke" }),
      enabled,
    );
    const smallImpact = small.samples.find((planned) =>
      planned.id.includes(":impact-sample:"),
    );
    const ultimateImpact = ultimate.samples.find((planned) =>
      planned.id.includes(":impact-sample:"),
    );

    expect(smallImpact?.sampleId).toBe("blast-small");
    expect(ultimateImpact?.sampleId).toBe("blast-large");
    expect(ultimateImpact?.gain ?? 0).toBeGreaterThan(smallImpact?.gain ?? 0);
    expect(
      ultimate.samples.some(
        (planned) => planned.sampleId === "blast-low",
      ),
    ).toBe(true);
    expect(
      ultimate.samples.some(
        (planned) => planned.sampleId === "blast-medium",
      ),
    ).toBe(true);
    expect(
      small.samples.some((planned) => planned.sampleId === "blast-low"),
    ).toBe(false);
  });

  it("gives fire, laser, terrain and mechanical weapons distinct samples", () => {
    const plannedSamples = (
      weaponId: Extract<
        GameAudioEvent,
        { type: "weapon-timeline" }
      >["weaponId"],
    ) =>
      audioPlanForEvent(timeline({ weaponId }), enabled).samples.map(
        ({ sampleId }) => sampleId,
      );

    expect(plannedSamples("hotNapalm")).toContain("fire-whoosh");
    expect(plannedSamples("laser")).toContain("laser-large");
    expect(plannedSamples("heavyDigger")).toContain("impact-rock");
    expect(plannedSamples("tonOfDirt")).toContain("impact-soil");
    expect(plannedSamples("heavyRoller")).toContain("impact-hull");
  });
});

describe("audio asset delivery adapter", () => {
  it("fetches versioned same-origin URLs and decodes music and samples", async () => {
    const decoded = { duration: 1 } as AudioBuffer;
    const decodeAudioData = vi.fn(async () => decoded);
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(new Uint8Array([82, 73, 70, 70]), {
          status: 200,
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const loader = createHttpAudioAssetLoader();
      const context = { decodeAudioData } as unknown as AudioContext;

      await expect(loader.loadMusic(context)).resolves.toBe(decoded);
      await expect(loader.loadSample(context, "blast-large")).resolves.toBe(
        decoded,
      );

      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        MUSIC_TRACK.url,
        AUDIO_SAMPLE_URLS["blast-large"],
      ]);
      expect(
        fetchMock.mock.calls.every(([, init]) => init?.credentials === "same-origin"),
      ).toBe(true);
      expect(decodeAudioData).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("rejects an HTTP error before attempting to decode", async () => {
    const decodeAudioData = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    try {
      const loader = createHttpAudioAssetLoader();
      await expect(
        loader.loadMusic({ decodeAudioData } as unknown as AudioContext),
      ).rejects.toThrow("returned HTTP 404");
      expect(decodeAudioData).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
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
  public loop = false;
  public readonly playbackRate = new FakeAudioParam();
  public onended: (() => void) | null = null;
  public started = false;
  public stopped = false;

  public constructor(private readonly events: string[] = []) {
    super();
  }

  public start(): void {
    this.started = true;
    this.events.push(this.loop ? "music-start" : "sample-start");
  }

  public stop(): void {
    this.stopped = true;
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
  public readonly bufferSources: FakeBufferSource[] = [];

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
    const source = new FakeBufferSource(this.events);
    this.bufferSources.push(source);
    return source as unknown as AudioBufferSourceNode;
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

class FakeAudioAssetLoader implements AudioAssetLoader {
  public readonly loadedSamples: AudioSampleId[] = [];
  public musicLoads = 0;

  public constructor(
    private readonly musicOutcome: "ready" | "reject" | "pending" = "ready",
    private readonly sampleOutcome: "ready" | "reject" = "ready",
  ) {}

  public loadMusic(): Promise<AudioBuffer> {
    this.musicLoads += 1;
    if (this.musicOutcome === "reject") {
      return Promise.reject(new Error("music decode failed"));
    }
    if (this.musicOutcome === "pending") {
      return new Promise<AudioBuffer>(() => undefined);
    }
    return Promise.resolve({ duration: MUSIC_TRACK.durationSeconds } as AudioBuffer);
  }

  public loadSample(
    _context: AudioContext,
    sampleId: AudioSampleId,
  ): Promise<AudioBuffer> {
    this.loadedSamples.push(sampleId);
    if (this.sampleOutcome === "reject") {
      return Promise.reject(new Error(`${sampleId} decode failed`));
    }
    return Promise.resolve({ duration: 0.4 } as AudioBuffer);
  }
}

class DeferredMusicAssetLoader implements AudioAssetLoader {
  private readonly music: Promise<AudioBuffer>;
  private resolveMusicPromise: (buffer: AudioBuffer) => void = () => undefined;

  public constructor() {
    this.music = new Promise<AudioBuffer>((resolve) => {
      this.resolveMusicPromise = resolve;
    });
  }

  public loadMusic(): Promise<AudioBuffer> {
    return this.music;
  }

  public loadSample(): Promise<AudioBuffer> {
    return Promise.resolve({ duration: 0.4 } as AudioBuffer);
  }

  public resolveMusic(): void {
    this.resolveMusicPromise({
      duration: MUSIC_TRACK.durationSeconds,
    } as AudioBuffer);
  }
}

class DeferredSamplesAssetLoader implements AudioAssetLoader {
  private readonly samples: Promise<AudioBuffer>;
  private resolveSamplesPromise: (buffer: AudioBuffer) => void =
    () => undefined;

  public constructor() {
    this.samples = new Promise<AudioBuffer>((resolve) => {
      this.resolveSamplesPromise = resolve;
    });
  }

  public loadMusic(): Promise<AudioBuffer> {
    return Promise.resolve({
      duration: MUSIC_TRACK.durationSeconds,
    } as AudioBuffer);
  }

  public loadSample(): Promise<AudioBuffer> {
    return this.samples;
  }

  public resolveSamples(): void {
    this.resolveSamplesPromise({ duration: 0.8 } as AudioBuffer);
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
  it("requests playback only for the selected Apple mobile audio session", () => {
    const audioSession = { type: "auto", state: "inactive" };
    expect(
      configurePlaybackAudioSession({ audioSession }),
    ).toBe("playback");
    expect(audioSession.type).toBe("playback");
    expect(configurePlaybackAudioSession({})).toBeNull();
  });

  it("separates iPhone/iPad WebKit from desktop Safari and Mac Chrome", () => {
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

    const desktopSafari = {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    };
    expect(isDesktopSafariWebKit(desktopSafari)).toBe(true);
    expect(
      isDesktopSafariWebKit({
        ...desktopSafari,
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      }),
    ).toBe(false);
    expect(
      isDesktopSafariWebKit({
        ...desktopSafari,
        maxTouchPoints: 5,
      }),
    ).toBe(false);
  });

  it("returns desktop Safari to automatic audio-session routing", () => {
    const audioSession = { type: "playback", state: "inactive" };
    const desktopSafari = {
      audioSession,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5.2 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    };

    expect(configureAutomaticAudioSession(desktopSafari)).toBe("auto");
    expect(audioSession.type).toBe("auto");
    expect(
      configureAutomaticAudioSession({
        ...desktopSafari,
        userAgent:
          "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140",
      }),
    ).toBeNull();
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
    const loader = new FakeAudioAssetLoader();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: loader },
    );
    await director.activate(enabled);
    expect(director.state).toBe("running");
    expect(director.activeVoiceCount).toBe(1);
    expect(director.debugSnapshot()).toMatchObject({
      contextState: "running",
      activated: true,
      musicAssetState: "playing",
      loadedSampleCount: AUDIO_SAMPLE_IDS.length,
      musicTargetGain: 0.5,
      sfxTargetGain: 0.7,
    });
    expect(context.bufferSources.at(-1)?.loop).toBe(true);
    expect(loader.loadedSamples.sort()).toEqual([...AUDIO_SAMPLE_IDS].sort());

    for (let index = 0; index < 40; index += 1) {
      director.play({
        type: "ui",
        cue: "toggle",
        seed: index,
      });
    }
    expect(director.activeVoiceCount).toBeLessThanOrEqual(24);

    director.setPaused(true);
    expect(director.activeVoiceCount).toBe(1);
    await director.setHidden(true);
    expect(director.activeVoiceCount).toBe(0);
    expect(director.state).toBe("suspended");

    await director.setHidden(false);
    expect(director.activeVoiceCount).toBe(0);
    await director.activate(enabled);
    expect(director.activeVoiceCount).toBe(1);
    expect(loader.musicLoads).toBe(1);
    await director.dispose();
    expect(director.activeVoiceCount).toBe(0);
    expect(context.state).toBe("closed");
  });

  it("plays decoded semantic samples while keeping the global source budget", async () => {
    const context = new FakeAudioContext();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: new FakeAudioAssetLoader() },
    );
    await director.activate(enabled);

    const plan = director.play(
      timeline({
        weaponId: "nuke",
        impactTimesMs: [120],
        resolvedAtMs: 120,
      }),
    );

    expect(plan.samples.map(({ sampleId }) => sampleId)).toEqual(
      expect.arrayContaining([
        "launch-thruster",
        "blast-large",
        "blast-low",
        "blast-medium",
      ]),
    );
    expect(context.events.filter((event) => event === "sample-start").length)
      .toBeGreaterThanOrEqual(3);
    expect(director.activeVoiceCount).toBeLessThanOrEqual(24);
    await director.dispose();
  });

  it("starts a future impact after a cold sample cache finishes decoding", async () => {
    const context = new FakeAudioContext();
    const loader = new DeferredSamplesAssetLoader();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: loader },
    );
    await director.activate(enabled);

    const before = context.events.length;
    director.play(
      timeline({
        weaponId: "nuke",
        impactTimesMs: [1_200],
        resolvedAtMs: 1_200,
      }),
    );
    expect(context.events.slice(before)).not.toContain("sample-start");

    loader.resolveSamples();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(context.events.slice(before)).toContain("sample-start");
    expect(director.debugSnapshot().loadedSampleCount).toBe(
      AUDIO_SAMPLE_IDS.length,
    );
    await director.dispose();
  });

  it("invalidates a cold-cache impact when the match cancels all audio", async () => {
    const context = new FakeAudioContext();
    const loader = new DeferredSamplesAssetLoader();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: loader },
    );
    await director.activate(enabled);
    director.play(
      timeline({
        weaponId: "nuke",
        impactTimesMs: [1_200],
        resolvedAtMs: 1_200,
      }),
    );

    director.cancelAll();
    const afterCancel = context.events.length;
    loader.resolveSamples();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(context.events.slice(afterCancel)).not.toContain("sample-start");
    expect(director.activeVoiceCount).toBe(0);
    await director.dispose();
  });

  it("reschedules future impact layers after pause and resume", async () => {
    const context = new FakeAudioContext();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: new FakeAudioAssetLoader() },
    );
    await director.activate(enabled);
    director.play(
      timeline({
        weaponId: "nuke",
        impactTimesMs: [1_200],
        resolvedAtMs: 1_200,
      }),
    );
    director.setPaused(true);
    const beforeResume = context.events.length;

    director.setPaused(false);

    expect(context.events.length).toBeGreaterThan(beforeResume);
    expect(context.events.slice(beforeResume)).toContain("sample-start");
    expect(context.events.slice(beforeResume)).toContain("source-start");
    await director.dispose();
  });

  it("isolates a music load failure so weapon SFX remain usable", async () => {
    const context = new FakeAudioContext();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: new FakeAudioAssetLoader("reject") },
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await director.activate(enabled);

    expect(director.debugSnapshot()).toMatchObject({
      contextState: "running",
      musicAssetState: "error",
      loadedSampleCount: AUDIO_SAMPLE_IDS.length,
    });
    const before = context.events.length;
    director.play(timeline({ weaponId: "missile" }));
    expect(context.events.slice(before)).toContain("sample-start");
    expect(context.events.slice(before)).toContain("source-start");

    await director.dispose();
    warn.mockRestore();
  });

  it("reserves procedural fallbacks when every sample decode fails", async () => {
    const context = new FakeAudioContext();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: new FakeAudioAssetLoader("ready", "reject") },
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await director.activate(enabled);
    expect(director.debugSnapshot().loadedSampleCount).toBe(0);

    const before = context.events.length;
    const plan = director.play(
      timeline({
        weaponId: "deathsHead",
        impactTimesMs: Array.from(
          { length: 20 },
          (_, index) => 240 + index * 35,
        ),
      }),
    );
    const emitted = context.events.slice(before);
    expect(plan.samples.length).toBeGreaterThan(0);
    expect(plan.voices.length).toBeGreaterThanOrEqual(6);
    expect(emitted.filter((event) => event === "source-start")).toHaveLength(
      plan.voices.length,
    );
    expect(emitted).not.toContain("sample-start");

    await director.dispose();
    warn.mockRestore();
  });

  it("stops only the loop when music is disabled and leaves SFX enabled", async () => {
    const context = new FakeAudioContext();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: new FakeAudioAssetLoader() },
    );
    await director.activate(enabled);
    expect(director.activeVoiceCount).toBe(1);

    director.updateSettings({ ...enabled, musicEnabled: false });
    expect(director.activeVoiceCount).toBe(0);
    expect(director.debugSnapshot().musicAssetState).toBe("ready");
    director.play(timeline({ weaponId: "laser" }));
    expect(context.events).toContain("sample-start");

    director.updateSettings({ ...enabled, musicEnabled: true });
    expect(director.activeVoiceCount).toBeGreaterThanOrEqual(1);
    expect(director.debugSnapshot().musicAssetState).toBe("playing");
    await director.dispose();
  });

  it("does not start a stale music source after the director is disposed", async () => {
    const context = new FakeAudioContext();
    const loader = new DeferredMusicAssetLoader();
    const director = new AudioDirector(
      context as unknown as AudioContext,
      () => undefined,
      { assetLoader: loader },
    );
    await director.activate(enabled);
    expect(director.debugSnapshot().musicAssetState).toBe("loading");

    await director.dispose();
    loader.resolveMusic();
    await Promise.resolve();
    await Promise.resolve();

    expect(context.bufferSources).toHaveLength(0);
    expect(director.activeVoiceCount).toBe(0);
    expect(context.state).toBe("closed");
  });
});
