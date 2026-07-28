import {
  EXPERIMENTAL_ULTIMATES,
  WEAPONS,
  type ExperimentalUltimateId,
  type ShieldEvent,
  type ShieldId,
  type WeaponFamily,
  type WeaponId,
} from "../../lib/game";
import {
  AUDIO_SAMPLE_IDS,
  createHttpAudioAssetLoader,
  type AudioAssetLoader,
  type AudioSampleId,
} from "./audio-assets";

export type PlayableSoundId = WeaponId | ExperimentalUltimateId;

export interface AudioPreferences {
  readonly musicEnabled: boolean;
  readonly sfxEnabled: boolean;
  readonly musicVolume: number;
  readonly sfxVolume: number;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = Object.freeze({
  musicEnabled: true,
  sfxEnabled: true,
  musicVolume: 42,
  sfxVolume: 68,
});

export const AUDIO_PREFERENCES_STORAGE_KEY =
  "afterglow-artillery.audio.v1";
const LEGACY_AUDIO_ENABLED_KEY = "afterglow-artillery.audioEnabled";

export type RuntimeAudioContextState =
  | AudioContextState
  | "interrupted";

export interface AudioActivationReport {
  readonly contextState: "running";
  readonly audioSessionType: string | null;
  readonly outputRoute: AudioOutputRoute;
  readonly userActivationIsActive: boolean | null;
}

export type AudioOutputRoute =
  | "audio-session"
  | "media-element-fallback"
  | "safari-media-stream"
  | "webaudio";

export type AudioMediaBridgeState =
  | "idle"
  | "starting"
  | "playing"
  | "blocked";

export type MusicAssetState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "error";

export interface AudioDebugSnapshot {
  readonly contextState: RuntimeAudioContextState;
  readonly currentTime: number;
  readonly activeVoiceCount: number;
  readonly activated: boolean;
  readonly audioSessionType: string | null;
  readonly audioSessionState: string | null;
  readonly outputRoute: AudioOutputRoute;
  readonly mediaBridgeState: AudioMediaBridgeState | null;
  readonly musicAssetState: MusicAssetState;
  readonly loadedSampleCount: number;
  readonly musicEnabled: boolean;
  readonly sfxEnabled: boolean;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly masterGain: number;
  readonly musicGain: number;
  readonly sfxGain: number;
  readonly musicTargetGain: number;
  readonly sfxTargetGain: number;
  readonly categoryGains: Readonly<Record<SfxBus, number>>;
}

export class AudioActivationError extends Error {
  public readonly contextState: RuntimeAudioContextState;

  public constructor(
    message: string,
    contextState: RuntimeAudioContextState,
  ) {
    super(message);
    this.name = "AudioActivationError";
    this.contextState = contextState;
  }
}

interface AudioSessionLike {
  type: string;
  readonly state?: string;
  addEventListener?(
    type: "statechange",
    listener: EventListenerOrEventListenerObject,
  ): void;
  removeEventListener?(
    type: "statechange",
    listener: EventListenerOrEventListenerObject,
  ): void;
}

interface NavigatorWithAudioSession {
  readonly audioSession?: AudioSessionLike;
  readonly maxTouchPoints?: number;
  readonly platform?: string;
  readonly userAgent?: string;
  readonly userActivation?: {
    readonly isActive: boolean;
  };
}

export interface AudioMediaBridge {
  readonly state: AudioMediaBridgeState;
  start(): Promise<void>;
  pause(): void;
  dispose(): void;
}

export interface AudioDirectorOptions {
  readonly activationTimeoutMs?: number;
  readonly assetLoader?: AudioAssetLoader | null;
  readonly audioSession?: AudioSessionLike | null;
  readonly mediaBridge?: AudioMediaBridge | null;
  readonly outputNode?: AudioNode | null;
  readonly outputRoute?: AudioOutputRoute;
}

const DEFAULT_ACTIVATION_TIMEOUT_MS = 1_800;

// A 50 ms, mono PCM WAV whose samples alternate between ±1 at 16-bit depth.
// It is effectively inaudible, but remains non-zero so WebKit treats the
// HTMLMediaElement as a real media route instead of optimizing it away.
const IOS_MEDIA_BRIDGE_WAV =
  "data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YSADAAABAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//wEA//8BAP//AQD//w==";

class HtmlMediaAudioBridge implements AudioMediaBridge {
  private bridgeState: AudioMediaBridgeState = "idle";

  public constructor(private readonly element: HTMLAudioElement) {}

  public get state(): AudioMediaBridgeState {
    return this.bridgeState;
  }

  public async start(): Promise<void> {
    if (!this.element.paused && !this.element.ended) {
      this.bridgeState = "playing";
      return;
    }
    this.bridgeState = "starting";
    try {
      await this.element.play();
      if (this.element.paused) {
        throw new Error("HTML media playback remained paused.");
      }
      this.bridgeState = "playing";
    } catch (error) {
      this.bridgeState = "blocked";
      throw error;
    }
  }

  public pause(): void {
    this.element.pause();
    this.bridgeState = "idle";
  }

  public dispose(): void {
    this.pause();
    this.element.removeAttribute("src");
    this.element.remove();
  }
}

interface AudioOutputBridge extends AudioMediaBridge {
  readonly outputNode: AudioNode;
}

class HtmlMediaStreamAudioBridge implements AudioOutputBridge {
  private bridgeState: AudioMediaBridgeState = "idle";

  public constructor(
    private readonly element: HTMLAudioElement,
    public readonly outputNode: MediaStreamAudioDestinationNode,
  ) {}

  public get state(): AudioMediaBridgeState {
    return this.bridgeState;
  }

  public async start(): Promise<void> {
    if (!this.element.paused && !this.element.ended) {
      this.bridgeState = "playing";
      return;
    }
    this.bridgeState = "starting";
    try {
      await this.element.play();
      if (this.element.paused) {
        throw new Error("Safari media-stream output remained paused.");
      }
      this.bridgeState = "playing";
    } catch (error) {
      this.bridgeState = "blocked";
      throw error;
    }
  }

  public pause(): void {
    this.element.pause();
    this.bridgeState = "idle";
  }

  public dispose(): void {
    this.pause();
    this.element.srcObject = null;
    this.element.removeAttribute("src");
    this.element.remove();
  }
}

export function isAppleMobileWebKit(
  navigatorLike: NavigatorWithAudioSession | null,
): boolean {
  if (!navigatorLike) {
    return false;
  }
  const userAgent = navigatorLike.userAgent ?? "";
  const nativeIos = /\b(iPad|iPhone|iPod)\b/i.test(userAgent);
  const touchIpad =
    navigatorLike.platform === "MacIntel" &&
    (navigatorLike.maxTouchPoints ?? 0) > 1;
  return nativeIos || touchIpad;
}

export function isDesktopSafariWebKit(
  navigatorLike: NavigatorWithAudioSession | null,
): boolean {
  if (!navigatorLike || isAppleMobileWebKit(navigatorLike)) {
    return false;
  }
  const userAgent = navigatorLike.userAgent ?? "";
  const macPlatform =
    navigatorLike.platform === "MacIntel" ||
    /\bMacintosh\b/i.test(userAgent);
  const safariEngine =
    /\bVersion\/[\d.]+.*\bSafari\/[\d.]+/i.test(userAgent);
  const alternateBrowser =
    /\b(?:Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|Firefox|FxiOS)\//i.test(
      userAgent,
    );
  return macPlatform && safariEngine && !alternateBrowser;
}

export function configureAutomaticAudioSession(
  navigatorLike: NavigatorWithAudioSession | null,
): string | null {
  if (!isDesktopSafariWebKit(navigatorLike)) {
    return null;
  }
  const session = navigatorLike?.audioSession;
  if (!session) {
    return null;
  }
  try {
    session.type = "auto";
    return session.type === "auto" ? session.type : null;
  } catch {
    return null;
  }
}

function createMediaAudioBridge(): AudioMediaBridge | null {
  if (
    typeof document === "undefined" ||
    typeof navigator === "undefined" ||
    !isAppleMobileWebKit(navigator as NavigatorWithAudioSession)
  ) {
    return null;
  }
  const element = document.createElement("audio");
  element.src = IOS_MEDIA_BRIDGE_WAV;
  element.loop = true;
  element.preload = "auto";
  element.volume = 1;
  element.setAttribute("playsinline", "");
  element.setAttribute("aria-hidden", "true");
  element.style.display = "none";
  document.body.appendChild(element);
  return new HtmlMediaAudioBridge(element);
}

function createDesktopSafariOutputBridge(
  context: AudioContext,
  navigatorLike: NavigatorWithAudioSession | null,
): AudioOutputBridge | null {
  if (
    typeof document === "undefined" ||
    !isDesktopSafariWebKit(navigatorLike) ||
    typeof context.createMediaStreamDestination !== "function"
  ) {
    return null;
  }
  try {
    const outputNode = context.createMediaStreamDestination();
    const element = document.createElement("audio");
    element.srcObject = outputNode.stream;
    element.preload = "auto";
    element.volume = 1;
    element.setAttribute("playsinline", "");
    element.setAttribute("aria-hidden", "true");
    element.style.display = "none";
    document.body.appendChild(element);
    return new HtmlMediaStreamAudioBridge(element, outputNode);
  } catch {
    return null;
  }
}

export function configurePlaybackAudioSession(
  navigatorLike: NavigatorWithAudioSession | null =
    typeof navigator === "undefined"
      ? null
      : (navigator as NavigatorWithAudioSession),
): string | null {
  const session = navigatorLike?.audioSession;
  if (!session) {
    return null;
  }
  try {
    session.type = "playback";
    return session.type === "playback" ? session.type : null;
  } catch {
    return null;
  }
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function boundedVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : fallback;
}

export function normalizeAudioPreferences(
  value: unknown,
): AudioPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }

  const candidate = value as Partial<AudioPreferences>;
  return {
    musicEnabled:
      typeof candidate.musicEnabled === "boolean"
        ? candidate.musicEnabled
        : DEFAULT_AUDIO_PREFERENCES.musicEnabled,
    sfxEnabled:
      typeof candidate.sfxEnabled === "boolean"
        ? candidate.sfxEnabled
        : DEFAULT_AUDIO_PREFERENCES.sfxEnabled,
    musicVolume: boundedVolume(
      candidate.musicVolume,
      DEFAULT_AUDIO_PREFERENCES.musicVolume,
    ),
    sfxVolume: boundedVolume(
      candidate.sfxVolume,
      DEFAULT_AUDIO_PREFERENCES.sfxVolume,
    ),
  };
}

export function loadAudioPreferences(
  storage: StorageLike | null,
): AudioPreferences {
  if (!storage) {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }

  try {
    const serialized = storage.getItem(AUDIO_PREFERENCES_STORAGE_KEY);
    if (serialized) {
      return normalizeAudioPreferences(JSON.parse(serialized));
    }
    const legacy = storage.getItem(LEGACY_AUDIO_ENABLED_KEY);
    if (legacy === "false") {
      return {
        ...DEFAULT_AUDIO_PREFERENCES,
        musicEnabled: false,
        sfxEnabled: false,
      };
    }
  } catch {
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }

  return { ...DEFAULT_AUDIO_PREFERENCES };
}

export function saveAudioPreferences(
  storage: StorageLike | null,
  preferences: AudioPreferences,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      AUDIO_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalizeAudioPreferences(preferences)),
    );
  } catch {
    // Local persistence is optional; gameplay and audio remain usable.
  }
}

export type SoundPhase =
  | "select"
  | "charge"
  | "launch"
  | "flight"
  | "secondary"
  | "impact"
  | "material"
  | "aftermath";

export type ImpactScale = "small" | "medium" | "large" | "ultimate";
export type SoundArchetype =
  | "blast"
  | "cluster"
  | "fire"
  | "laser"
  | "mechanical"
  | "terrain-cut"
  | "terrain-fill";

export interface SoundProfile {
  readonly weaponId: PlayableSoundId;
  readonly signature: string;
  readonly family: string;
  readonly archetype: SoundArchetype;
  readonly impactScale: ImpactScale;
  readonly phases: readonly SoundPhase[];
  readonly motifHz: readonly [number, number, number];
  readonly waves: readonly [OscillatorType, OscillatorType];
  readonly attackMs: number;
  readonly impactMs: number;
  readonly tailMs: number;
  readonly rhythmMs: number;
  readonly stereoMotion: -1 | 0 | 1;
  readonly voiceBudget: number;
}

interface FamilySoundSeed {
  readonly baseHz: number;
  readonly accentRatio: number;
  readonly waves: readonly [OscillatorType, OscillatorType];
  readonly attackMs: number;
  readonly impactMs: number;
  readonly tailMs: number;
  readonly rhythmMs: number;
  readonly phases: readonly SoundPhase[];
}

function impactScaleFor(scale: number): ImpactScale {
  if (scale >= 1.5) {
    return "ultimate";
  }
  if (scale >= 1.15) {
    return "large";
  }
  if (scale >= 0.85) {
    return "medium";
  }
  return "small";
}

function archetypeForFamily(family: WeaponFamily): SoundArchetype {
  switch (family) {
    case "missile":
    case "nuclear":
      return "blast";
    case "cluster":
      return "cluster";
    case "napalm":
      return "fire";
    case "tracer":
    case "energy":
      return "laser";
    case "roller":
    case "riot":
      return "mechanical";
    case "digger":
    case "sandhog":
    case "earth-disrupter":
      return "terrain-cut";
    case "dirt":
      return "terrain-fill";
  }
}

function experimentalArchetypeFor(
  weaponId: ExperimentalUltimateId,
): SoundArchetype {
  switch (weaponId) {
    case "heliosSpire":
    case "mirrorStorm":
    case "chronoEcho":
    case "auroraCage":
      return "laser";
    case "portalComet":
      return "cluster";
    case "crystalLattice":
      return "terrain-fill";
    case "magmaForge":
      return "fire";
    case "faultChoir":
      return "terrain-cut";
    case "gravityCathedral":
    case "novaRing":
      return "blast";
  }
}

const FAMILY_SOUND_SEEDS: Readonly<Record<WeaponFamily, FamilySoundSeed>> =
  Object.freeze({
    missile: {
      baseHz: 168,
      accentRatio: 1.62,
      waves: ["square", "triangle"],
      attackMs: 8,
      impactMs: 360,
      tailMs: 480,
      rhythmMs: 62,
      phases: ["select", "launch", "flight", "impact", "material", "aftermath"],
    },
    nuclear: {
      baseHz: 72,
      accentRatio: 2.18,
      waves: ["sawtooth", "sine"],
      attackMs: 22,
      impactMs: 760,
      tailMs: 1_650,
      rhythmMs: 128,
      phases: ["select", "charge", "launch", "impact", "material", "aftermath"],
    },
    cluster: {
      baseHz: 214,
      accentRatio: 1.47,
      waves: ["triangle", "square"],
      attackMs: 10,
      impactMs: 250,
      tailMs: 720,
      rhythmMs: 74,
      phases: ["select", "launch", "secondary", "impact", "material", "aftermath"],
    },
    napalm: {
      baseHz: 92,
      accentRatio: 3.65,
      waves: ["sawtooth", "sine"],
      attackMs: 32,
      impactMs: 620,
      tailMs: 1_250,
      rhythmMs: 96,
      phases: ["select", "launch", "flight", "impact", "material", "aftermath"],
    },
    tracer: {
      baseHz: 610,
      accentRatio: 1.28,
      waves: ["sine", "triangle"],
      attackMs: 4,
      impactMs: 120,
      tailMs: 260,
      rhythmMs: 48,
      phases: ["select", "launch", "flight", "impact", "aftermath"],
    },
    roller: {
      baseHz: 108,
      accentRatio: 1.83,
      waves: ["sawtooth", "triangle"],
      attackMs: 18,
      impactMs: 410,
      tailMs: 620,
      rhythmMs: 88,
      phases: ["select", "launch", "flight", "secondary", "impact", "material"],
    },
    riot: {
      baseHz: 128,
      accentRatio: 2.72,
      waves: ["square", "sine"],
      attackMs: 7,
      impactMs: 330,
      tailMs: 520,
      rhythmMs: 58,
      phases: ["select", "launch", "impact", "material", "aftermath"],
    },
    digger: {
      baseHz: 78,
      accentRatio: 2.35,
      waves: ["sawtooth", "square"],
      attackMs: 34,
      impactMs: 470,
      tailMs: 860,
      rhythmMs: 92,
      phases: ["select", "launch", "flight", "secondary", "impact", "material"],
    },
    sandhog: {
      baseHz: 68,
      accentRatio: 2.58,
      waves: ["square", "triangle"],
      attackMs: 28,
      impactMs: 390,
      tailMs: 940,
      rhythmMs: 82,
      phases: ["select", "launch", "flight", "secondary", "impact", "material"],
    },
    dirt: {
      baseHz: 142,
      accentRatio: 2.06,
      waves: ["triangle", "sine"],
      attackMs: 24,
      impactMs: 520,
      tailMs: 1_080,
      rhythmMs: 104,
      phases: ["select", "launch", "impact", "material", "aftermath"],
    },
    "earth-disrupter": {
      baseHz: 54,
      accentRatio: 4.2,
      waves: ["sine", "sawtooth"],
      attackMs: 48,
      impactMs: 720,
      tailMs: 1_320,
      rhythmMs: 130,
      phases: ["select", "charge", "launch", "impact", "material", "aftermath"],
    },
    energy: {
      baseHz: 370,
      accentRatio: 1.91,
      waves: ["sine", "sawtooth"],
      attackMs: 16,
      impactMs: 440,
      tailMs: 780,
      rhythmMs: 66,
      phases: ["select", "charge", "launch", "flight", "impact", "material"],
    },
  });

function canonicalSoundProfile(
  definition: (typeof WEAPONS)[number],
  index: number,
): SoundProfile {
  const seed = FAMILY_SOUND_SEEDS[definition.family];
  const tierOffset = definition.armsLevel * 11;
  const idOffset =
    [...definition.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    37;
  const base = seed.baseHz + tierOffset + idOffset;
  const contour = index % 2 === 0 ? 1 : -1;

  return Object.freeze({
    weaponId: definition.id,
    signature: `${definition.family}:${definition.id}:${index}`,
    family: definition.family,
    archetype: archetypeForFamily(definition.family),
    impactScale: impactScaleFor(definition.demoResolution.scale),
    phases: seed.phases,
    motifHz: Object.freeze([
      base,
      Math.round(base * seed.accentRatio + index * 3),
      Math.max(42, Math.round(base * (0.68 + (index % 5) * 0.07))),
    ]) as readonly [number, number, number],
    waves:
      index % 3 === 0
        ? ([seed.waves[1], seed.waves[0]] as const)
        : seed.waves,
    attackMs: seed.attackMs + (index % 4) * 5,
    impactMs: seed.impactMs + (index % 5) * 34,
    tailMs: seed.tailMs + (index % 6) * 73,
    rhythmMs: seed.rhythmMs + (index % 7) * 9,
    stereoMotion: contour as -1 | 1,
    voiceBudget: Math.min(
      12,
      Math.max(4, definition.demoResolution.count + 3),
    ),
  });
}

function experimentalSoundProfile(
  definition: (typeof EXPERIMENTAL_ULTIMATES)[number],
  index: number,
): SoundProfile {
  const [low, middle, high] = definition.audioMotif;
  return Object.freeze({
    weaponId: definition.id,
    signature: `experimental:${definition.strategy}:${definition.id}`,
    family: definition.strategy,
    archetype: experimentalArchetypeFor(definition.id),
    impactScale: "ultimate",
    phases: Object.freeze([
      "select",
      "charge",
      "launch",
      "flight",
      "secondary",
      "impact",
      "material",
      "aftermath",
    ]) as readonly SoundPhase[],
    motifHz: Object.freeze([low, middle, high]) as readonly [
      number,
      number,
      number,
    ],
    waves:
      index % 2 === 0
        ? (["sine", "triangle"] as const)
        : (["triangle", "sawtooth"] as const),
    attackMs: 18 + index * 3,
    impactMs: 540 + (index % 4) * 90,
    tailMs: 1_100 + index * 85,
    rhythmMs: 72 + (index % 5) * 17,
    stereoMotion: ((index % 3) - 1) as -1 | 0 | 1,
    voiceBudget: Math.min(12, definition.quality.full.audioVoices),
  });
}

export const CANONICAL_SOUND_PROFILES = Object.freeze(
  Object.fromEntries(
    WEAPONS.map((weapon, index) => [
      weapon.id,
      canonicalSoundProfile(weapon, index),
    ]),
  ),
) as Readonly<Record<WeaponId, SoundProfile>>;

export const EXPERIMENTAL_SOUND_PROFILES = Object.freeze(
  Object.fromEntries(
    EXPERIMENTAL_ULTIMATES.map((ultimate, index) => [
      ultimate.id,
      experimentalSoundProfile(ultimate, index),
    ]),
  ),
) as Readonly<Record<ExperimentalUltimateId, SoundProfile>>;

export const SOUND_PROFILES: Readonly<
  Record<PlayableSoundId, SoundProfile>
> = Object.freeze({
  ...CANONICAL_SOUND_PROFILES,
  ...EXPERIMENTAL_SOUND_PROFILES,
});

export function getSoundProfile(
  weaponId: PlayableSoundId,
): SoundProfile {
  return SOUND_PROFILES[weaponId];
}

export type AudioMaterial =
  | "air"
  | "soil"
  | "rock"
  | "liquid-fire"
  | "hull";
export type DamageBucket = "light" | "medium" | "heavy" | "critical";
export type MusicState =
  | "intro"
  | "aiming"
  | "flight"
  | "shop"
  | "round-result"
  | "match-end";
export type SfxBus = "weapon" | "shieldArmor" | "impactTerrain" | "ui";

export type UiAudioCue =
  | "mode-select"
  | "match-start"
  | "sound-check"
  | "weapon-select"
  | "shield-select"
  | "selector-open"
  | "selector-close"
  | "fire-ready"
  | "turn-change"
  | "purchase"
  | "sale"
  | "upgrade"
  | "unavailable"
  | "shop-open"
  | "round-start"
  | "round-end"
  | "victory"
  | "draw"
  | "match-end"
  | "pause"
  | "resume"
  | "toggle";

export interface AudioDamageOutcome {
  readonly amount: number;
  readonly bucket: DamageBucket;
  readonly direct: boolean;
  readonly destroyed: boolean;
  readonly pan: number;
}

export interface AudioLandingOutcome {
  readonly distance: number;
  readonly destroyed: boolean;
  readonly pan: number;
}

export type GameAudioEvent =
  | {
      readonly type: "weapon-timeline";
      readonly weaponId: PlayableSoundId;
      readonly durationMs: number;
      readonly resolvedAtMs: number;
      readonly impactTimesMs: readonly number[];
      readonly fizzled: boolean;
      readonly pan: number;
      readonly seed: number;
    }
  | {
      readonly type: "resolution";
      readonly weaponId: PlayableSoundId;
      readonly material: AudioMaterial;
      readonly damages: readonly AudioDamageOutcome[];
      readonly landings: readonly AudioLandingOutcome[];
      readonly criticalCrossings: readonly { readonly pan: number }[];
      readonly shieldEvents: readonly ShieldEvent[];
      readonly terrainCollapse: boolean;
      readonly fizzled: boolean;
      readonly pan: number;
      readonly seed: number;
    }
  | {
      readonly type: "ui";
      readonly cue: UiAudioCue;
      readonly pan?: number;
      readonly seed?: number;
    };

export interface AudioVoicePlan {
  readonly id: string;
  readonly bus: SfxBus;
  readonly atMs: number;
  readonly durationMs: number;
  readonly frequencyHz: number;
  readonly endFrequencyHz: number;
  readonly wave: OscillatorType;
  readonly gain: number;
  readonly pan: number;
  readonly priority: number;
}

export interface AudioSamplePlan {
  readonly id: string;
  readonly sampleId: AudioSampleId;
  readonly bus: SfxBus;
  readonly atMs: number;
  readonly gain: number;
  readonly pan: number;
  readonly playbackRate: number;
  readonly priority: number;
}

export interface AudioPlan {
  readonly voices: readonly AudioVoicePlan[];
  readonly samples: readonly AudioSamplePlan[];
  readonly duckDb: number;
  readonly durationMs: number;
}

const EMPTY_AUDIO_PLAN: AudioPlan = Object.freeze({
  voices: Object.freeze([]),
  samples: Object.freeze([]),
  duckDb: 0,
  durationMs: 0,
});

const UI_CUES: Readonly<
  Record<
    UiAudioCue,
    readonly [number, number, number, OscillatorType, number]
  >
> = Object.freeze({
  "mode-select": [360, 510, 120, "triangle", 4],
  "match-start": [220, 660, 280, "triangle", 8],
  "sound-check": [880, 1_320, 360, "triangle", 10],
  "weapon-select": [420, 620, 90, "sine", 4],
  "shield-select": [310, 760, 150, "triangle", 5],
  "selector-open": [260, 420, 100, "sine", 3],
  "selector-close": [410, 240, 90, "sine", 3],
  "fire-ready": [520, 720, 80, "triangle", 4],
  "turn-change": [280, 460, 160, "triangle", 5],
  purchase: [330, 720, 190, "sine", 6],
  sale: [460, 280, 160, "triangle", 5],
  upgrade: [180, 640, 240, "triangle", 7],
  unavailable: [170, 110, 160, "square", 6],
  "shop-open": [260, 520, 260, "sine", 5],
  "round-start": [240, 580, 260, "triangle", 7],
  "round-end": [360, 220, 320, "sine", 7],
  victory: [260, 780, 520, "triangle", 9],
  draw: [330, 330, 420, "sine", 7],
  "match-end": [210, 620, 680, "triangle", 9],
  pause: [320, 180, 180, "sine", 4],
  resume: [180, 360, 180, "sine", 4],
  toggle: [440, 540, 80, "sine", 3],
});

const MATERIAL_CUES: Readonly<
  Record<AudioMaterial, readonly [number, number, OscillatorType]>
> = Object.freeze({
  air: [690, 280, "sine"],
  soil: [118, 510, "sawtooth"],
  rock: [82, 640, "square"],
  "liquid-fire": [156, 920, "sawtooth"],
  hull: [96, 480, "square"],
});

const MATERIAL_SAMPLES: Readonly<
  Record<AudioMaterial, AudioSampleId | null>
> = Object.freeze({
  air: null,
  soil: "impact-soil",
  rock: "impact-rock",
  "liquid-fire": "fire-whoosh",
  hull: "impact-hull",
});

const DAMAGE_CUES: Readonly<
  Record<DamageBucket, readonly [number, number, number]>
> = Object.freeze({
  light: [310, 180, 6],
  medium: [220, 300, 7],
  heavy: [142, 520, 9],
  critical: [78, 860, 10],
});

const SHIELD_EVENT_FREQUENCIES: Readonly<
  Record<ShieldEvent["type"], number>
> = Object.freeze({
  absorb: 540,
  break: 128,
  deflect: 760,
  bypass: 280,
  "laser-immunity": 1_120,
});

const SHIELD_ID_OFFSETS: Readonly<Record<ShieldId, number>> = Object.freeze({
  none: -80,
  "mag-deflector": 90,
  shield: 25,
  "force-shield": 140,
  "heavy-shield": -25,
  "super-mag": 210,
});

function normalizedPan(value: number | undefined): number {
  return Math.max(-1, Math.min(1, value ?? 0));
}

function seededUnit(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
}

function voice(
  input: AudioVoicePlan,
  volume: number,
): AudioVoicePlan {
  return {
    ...input,
    atMs: Math.max(0, Math.round(input.atMs)),
    durationMs: Math.max(24, Math.round(input.durationMs)),
    frequencyHz: Math.max(30, input.frequencyHz),
    endFrequencyHz: Math.max(30, input.endFrequencyHz),
    gain: Math.max(0.0001, input.gain * volume),
    pan: normalizedPan(input.pan),
  };
}

function sample(
  input: AudioSamplePlan,
  volume = 1,
): AudioSamplePlan {
  return {
    ...input,
    atMs: Math.max(0, Math.round(input.atMs)),
    gain: Math.max(0.0001, Math.min(1.4, input.gain * volume)),
    pan: normalizedPan(input.pan),
    playbackRate: Math.max(0.75, Math.min(1.25, input.playbackRate)),
  };
}

function capPlanLayers(
  voices: readonly AudioVoicePlan[],
  samples: readonly AudioSamplePlan[],
  limit: number,
): Pick<AudioPlan, "voices" | "samples"> {
  const boundedLimit = Math.max(0, Math.min(24, limit));
  const rankedVoices = voices
    .map((planned, index) => ({
      kind: "voice" as const,
      index,
      priority: planned.priority,
      atMs: planned.atMs,
    }))
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.atMs - right.atMs;
    });
  // Reserve half of a bounded plan for synthesis. Samples carry realism, but
  // the deterministic signature must remain audible on a cold cache or after
  // an individual fetch/decode failure.
  const reservedVoiceCount = Math.min(
    voices.length,
    Math.ceil(boundedLimit / 2),
  );
  const reservedVoices = rankedVoices.slice(0, reservedVoiceCount);
  const reservedVoiceIndexes = new Set(
    reservedVoices.map(({ index }) => index),
  );
  const remaining = [
    ...rankedVoices.filter(
      ({ index }) => !reservedVoiceIndexes.has(index),
    ),
    ...samples.map((planned, index) => ({
      kind: "sample" as const,
      index,
      priority: planned.priority,
      atMs: planned.atMs,
    })),
  ]
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      return left.atMs - right.atMs;
    })
    .slice(0, Math.max(0, boundedLimit - reservedVoices.length));
  const capped = [...reservedVoices, ...remaining];
  const selectedVoices = new Set(
    capped
      .filter((entry) => entry.kind === "voice")
      .map((entry) => entry.index),
  );
  const selectedSamples = new Set(
    capped
      .filter((entry) => entry.kind === "sample")
      .map((entry) => entry.index),
  );
  return {
    voices: voices.filter((_, index) => selectedVoices.has(index)),
    samples: samples.filter((_, index) => selectedSamples.has(index)),
  };
}

const SCALE_GAIN: Readonly<Record<ImpactScale, number>> = Object.freeze({
  small: 0.72,
  medium: 0.9,
  large: 1.08,
  ultimate: 1.24,
});

function blastSampleFor(scale: ImpactScale): AudioSampleId {
  switch (scale) {
    case "small":
      return "blast-small";
    case "medium":
      return "blast-medium";
    case "large":
    case "ultimate":
      return "blast-large";
  }
}

function impactSampleFor(profile: SoundProfile): AudioSampleId {
  switch (profile.archetype) {
    case "blast":
    case "cluster":
      return blastSampleFor(profile.impactScale);
    case "fire":
      return "fire-whoosh";
    case "laser":
      return profile.impactScale === "small"
        ? "laser-small"
        : "laser-large";
    case "mechanical":
      return "impact-hull";
    case "terrain-cut":
      return "impact-rock";
    case "terrain-fill":
      return "impact-soil";
  }
}

function launchSampleFor(profile: SoundProfile): AudioSampleId {
  switch (profile.archetype) {
    case "fire":
      return "fire-whoosh";
    case "laser":
      return profile.impactScale === "small"
        ? "laser-small"
        : "laser-large";
    case "terrain-cut":
      return "impact-rock";
    case "terrain-fill":
      return "impact-soil";
    default:
      return "launch-thruster";
  }
}

function timelinePlan(
  event: Extract<GameAudioEvent, { type: "weapon-timeline" }>,
): AudioPlan {
  const profile = getSoundProfile(event.weaponId);
  const volume = 1;
  const variation = (seededUnit(event.seed, 1) - 0.5) * 0.08;
  const pan = normalizedPan(event.pan);
  const scaleGain = SCALE_GAIN[profile.impactScale];
  const voices: AudioVoicePlan[] = [
    voice(
      {
        id: `${profile.signature}:launch-core`,
        bus: "weapon",
        atMs: 0,
        durationMs: Math.max(100, profile.attackMs * 5 + 120),
        frequencyHz: profile.motifHz[0],
        endFrequencyHz: profile.motifHz[1],
        wave: profile.waves[0],
        gain: 0.11 + variation,
        pan,
        priority: 100,
      },
      volume,
    ),
    voice(
      {
        id: `${profile.signature}:launch-signature`,
        bus: "weapon",
        atMs: profile.attackMs + 28,
        durationMs: Math.max(90, profile.impactMs * 0.42),
        frequencyHz: profile.motifHz[1],
        endFrequencyHz: profile.motifHz[2],
        wave: profile.waves[1],
        gain: 0.065,
        pan: normalizedPan(
          pan + profile.stereoMotion * 0.12,
        ),
        priority: 92,
      },
      volume,
    ),
  ];
  const samples: AudioSamplePlan[] = [
    sample({
      id: `${profile.signature}:launch-sample`,
      sampleId: launchSampleFor(profile),
      bus: "weapon",
      atMs: 0,
      gain:
        profile.archetype === "laser"
          ? 0.34
          : profile.archetype === "terrain-cut" ||
              profile.archetype === "terrain-fill"
            ? 0.22
            : 0.3,
      pan,
      playbackRate: 0.94 + seededUnit(event.seed, 3) * 0.12,
      priority: 94,
    }),
  ];

  if (event.fizzled) {
    voices.push(
      voice(
        {
          id: `${profile.signature}:fizzle`,
          bus: "weapon",
          atMs: event.resolvedAtMs,
          durationMs: 260,
          frequencyHz: profile.motifHz[1],
          endFrequencyHz: Math.max(42, profile.motifHz[0] * 0.42),
          wave: "triangle",
          gain: 0.075,
          pan,
          priority: 98,
        },
        volume,
      ),
    );
  } else {
    const actualImpactTimes = event.impactTimesMs
      .filter((atMs) => Number.isFinite(atMs) && atMs >= 0)
      .slice(0, profile.voiceBudget);

    if (actualImpactTimes.length > 1) {
      const splitAt = Math.max(
        90,
        (actualImpactTimes[0] ?? event.resolvedAtMs) - profile.rhythmMs * 1.6,
      );
      voices.push(
        voice(
          {
            id: `${profile.signature}:secondary`,
            bus: "weapon",
            atMs: splitAt,
            durationMs: 180,
            frequencyHz: profile.motifHz[2],
            endFrequencyHz: profile.motifHz[1],
            wave: profile.waves[1],
            gain: 0.065,
            pan: normalizedPan(-pan * 0.5),
            priority: 88,
          },
          volume,
        ),
      );
    }

    actualImpactTimes.forEach((atMs, index) => {
      const childPan = normalizedPan(
        pan +
          (index % 2 === 0 ? -1 : 1) *
            Math.min(0.45, 0.08 + index * 0.04),
      );
      voices.push(
        voice(
          {
            id: `${profile.signature}:impact:${index}`,
            bus: "weapon",
            atMs,
            durationMs:
              profile.impactMs * (0.8 + scaleGain * 0.3) +
              (index % 3) * 24,
            frequencyHz:
              profile.motifHz[index % profile.motifHz.length] ??
              profile.motifHz[0],
            endFrequencyHz: Math.max(
              36,
              profile.motifHz[2] * (0.62 + (index % 4) * 0.06),
            ),
            wave: profile.waves[index % 2] ?? profile.waves[0],
            gain:
              (index === 0 ? 0.105 : 0.072) *
              (0.78 + scaleGain * 0.3),
            pan: childPan,
            priority: index === 0 ? 96 : 70 - index,
          },
          volume,
        ),
      );
      samples.push(
        sample({
          id: `${profile.signature}:impact-sample:${index}`,
          sampleId: impactSampleFor(profile),
          bus:
            profile.archetype === "terrain-cut" ||
            profile.archetype === "terrain-fill"
              ? "impactTerrain"
              : "weapon",
          atMs,
          gain: (index === 0 ? 0.56 : 0.34) * scaleGain,
          pan: childPan,
          playbackRate:
            0.92 + seededUnit(event.seed, 19 + index) * 0.14,
          priority: index === 0 ? 102 : 76 - index,
        }),
      );
      if (
        index === 0 &&
        (profile.impactScale === "large" ||
          profile.impactScale === "ultimate") &&
        (profile.archetype === "blast" ||
          profile.archetype === "cluster")
      ) {
        samples.push(
          sample({
            id: `${profile.signature}:impact-low`,
            sampleId: "blast-low",
            bus: "impactTerrain",
            atMs: atMs + 14,
            gain: profile.impactScale === "ultimate" ? 0.58 : 0.42,
            pan,
            playbackRate:
              profile.impactScale === "ultimate" ? 0.86 : 0.96,
            priority: 101,
          }),
        );
        samples.push(
          sample({
            id: `${profile.signature}:impact-crunch`,
            sampleId: "blast-medium",
            bus: "weapon",
            atMs: atMs + 22,
            gain:
              profile.impactScale === "ultimate" ? 0.72 : 0.56,
            pan: childPan,
            playbackRate:
              profile.impactScale === "ultimate" ? 0.8 : 0.9,
            priority: 100,
          }),
        );
      }
    });
  }

  const capped = capPlanLayers(
    voices,
    samples,
    Math.min(12, profile.voiceBudget + 3),
  );
  return {
    ...capped,
    duckDb: -8,
    durationMs: event.durationMs,
  };
}

function shieldVoice(
  event: ShieldEvent,
  index: number,
  pan: number,
  volume: number,
): AudioVoicePlan {
  const frequency =
    SHIELD_EVENT_FREQUENCIES[event.type] +
    SHIELD_ID_OFFSETS[event.shieldId];
  const broken =
    event.type === "break" ||
    (event.type === "deflect" && event.broken);
  return voice(
    {
      id: `shield:${event.shieldId}:${event.type}:${index}`,
      bus: "shieldArmor",
      atMs: index * 36,
      durationMs: broken ? 620 : 280,
      frequencyHz: Math.max(42, frequency),
      endFrequencyHz:
        event.type === "deflect"
          ? frequency * 1.72
          : event.type === "laser-immunity"
            ? frequency * 0.52
            : broken
              ? Math.max(36, frequency * 0.24)
              : frequency * 0.78,
      wave:
        event.shieldId === "heavy-shield"
          ? "square"
          : event.shieldId === "super-mag"
            ? "sine"
            : "triangle",
      gain: broken ? 0.115 : 0.078,
      pan:
        event.type === "deflect"
          ? normalizedPan(
              ((event.to.x - event.from.x) / 140) || pan,
            )
          : pan,
      priority: broken ? 99 : 91,
    },
    volume,
  );
}

function resolutionPlan(
  event: Extract<GameAudioEvent, { type: "resolution" }>,
): AudioPlan {
  const profile = getSoundProfile(event.weaponId);
  const volume = 1;
  const pan = normalizedPan(event.pan);
  const [materialFrequency, materialDuration, materialWave] =
    MATERIAL_CUES[event.material];
  const voices: AudioVoicePlan[] = [];
  const samples: AudioSamplePlan[] = [];

  if (event.fizzled) {
    voices.push(
      voice(
        {
          id: `${profile.signature}:resolution-fizzle`,
          bus: "impactTerrain",
          atMs: 0,
          durationMs: 230,
          frequencyHz: profile.motifHz[1],
          endFrequencyHz: 52,
          wave: "triangle",
          gain: 0.068,
          pan,
          priority: 96,
        },
        volume,
      ),
    );
  } else {
    voices.push(
      voice(
        {
          id: `material:${event.material}`,
          bus: "impactTerrain",
          atMs: 0,
          durationMs: materialDuration,
          frequencyHz: materialFrequency,
          endFrequencyHz:
            event.material === "air"
              ? materialFrequency * 0.48
              : Math.max(34, materialFrequency * 0.72),
          wave: materialWave,
          gain: event.material === "air" ? 0.04 : 0.09,
          pan,
          priority: 84,
        },
        volume,
      ),
    );
    const materialSample = MATERIAL_SAMPLES[event.material];
    if (materialSample) {
      samples.push(
        sample({
          id: `material:${event.material}:sample`,
          sampleId: materialSample,
          bus: "impactTerrain",
          atMs: 0,
          gain:
            event.material === "liquid-fire"
              ? 0.42
              : event.material === "hull"
                ? 0.48
                : 0.4,
          pan,
          playbackRate: 0.94 + seededUnit(event.seed, 41) * 0.12,
          priority: 87,
        }),
      );
    }
  }

  event.shieldEvents.forEach((shieldEvent, index) => {
    voices.push(shieldVoice(shieldEvent, index, pan, volume));
    samples.push(
      sample({
        id: `shield:${shieldEvent.shieldId}:${shieldEvent.type}:${index}:sample`,
        sampleId: "shield-field",
        bus: "shieldArmor",
        atMs: index * 36,
        gain:
          shieldEvent.type === "break" ||
          (shieldEvent.type === "deflect" && shieldEvent.broken)
            ? 0.54
            : 0.36,
        pan,
        playbackRate:
          0.9 +
          seededUnit(event.seed, 53 + index) * 0.18,
        priority:
          shieldEvent.type === "break" ? 100 : 92,
      }),
    );
  });

  event.damages.forEach((damage, index) => {
    if (damage.amount <= 0) {
      return;
    }
    const [frequency, duration, priority] = DAMAGE_CUES[damage.bucket];
    voices.push(
      voice(
        {
          id: `hull:${damage.bucket}:${index}`,
          bus: "shieldArmor",
          atMs: 18 + index * 28,
          durationMs: damage.destroyed ? 920 : duration,
          frequencyHz: damage.direct ? frequency * 1.18 : frequency,
          endFrequencyHz: damage.destroyed
            ? 38
            : Math.max(48, frequency * 0.58),
          wave: damage.direct ? "square" : "triangle",
          gain: damage.destroyed ? 0.13 : 0.09,
          pan: damage.pan,
          priority: damage.destroyed ? 100 : priority + 80,
        },
        volume,
      ),
    );
    if (damage.direct || damage.destroyed || damage.bucket === "critical") {
      samples.push(
        sample({
          id: `hull:${damage.bucket}:${index}:sample`,
          sampleId: "impact-hull",
          bus: "shieldArmor",
          atMs: 18 + index * 28,
          gain: damage.destroyed ? 0.62 : damage.direct ? 0.46 : 0.36,
          pan: damage.pan,
          playbackRate:
            (damage.destroyed ? 0.84 : 0.94) +
            seededUnit(event.seed, 67 + index) * 0.1,
          priority: damage.destroyed ? 103 : 91,
        }),
      );
    }
  });

  event.landings.forEach((landing, index) => {
    if (landing.distance <= 8) {
      return;
    }
    const heavy = landing.distance > 54 || landing.destroyed;
    voices.push(
      voice(
        {
          id: `hull:landing:${index}`,
          bus: "shieldArmor",
          atMs: 42 + index * 22,
          durationMs: heavy ? 620 : 240,
          frequencyHz: heavy ? 74 : 138,
          endFrequencyHz: heavy ? 38 : 92,
          wave: heavy ? "square" : "triangle",
          gain: heavy ? 0.11 : 0.062,
          pan: landing.pan,
          priority: heavy ? 96 : 82,
        },
        volume,
      ),
    );
    if (heavy) {
      samples.push(
        sample({
          id: `hull:landing:${index}:sample`,
          sampleId: "impact-hull",
          bus: "shieldArmor",
          atMs: 42 + index * 22,
          gain: landing.destroyed ? 0.58 : 0.4,
          pan: landing.pan,
          playbackRate:
            0.86 + seededUnit(event.seed, 79 + index) * 0.1,
          priority: landing.destroyed ? 100 : 90,
        }),
      );
    }
  });

  event.criticalCrossings.forEach((critical, index) => {
    voices.push(
      voice(
        {
          id: `hull:critical-crossing:${index}`,
          bus: "shieldArmor",
          atMs: 74 + index * 18,
          durationMs: 760,
          frequencyHz: 118,
          endFrequencyHz: 52,
          wave: "sawtooth",
          gain: 0.084,
          pan: critical.pan,
          priority: 97,
        },
        volume,
      ),
    );
  });

  if (event.terrainCollapse) {
    voices.push(
      voice(
        {
          id: "terrain:collapse",
          bus: "impactTerrain",
          atMs: 90,
          durationMs: 940,
          frequencyHz: 96,
          endFrequencyHz: 42,
          wave: "sawtooth",
          gain: 0.075,
          pan,
          priority: 74,
        },
        volume,
      ),
    );
    samples.push(
      sample({
        id: "terrain:collapse:sample",
        sampleId: "impact-rock",
        bus: "impactTerrain",
        atMs: 90,
        gain: 0.48,
        pan,
        playbackRate: 0.82,
        priority: 89,
      }),
    );
  }

  const capped = capPlanLayers(voices, samples, 12);
  return {
    ...capped,
    duckDb: event.damages.some((damage) => damage.destroyed) ? -9 : -7,
    durationMs: Math.max(
      profile.tailMs,
      ...voices.map((planned) => planned.atMs + planned.durationMs),
      0,
    ),
  };
}

function uiPlan(
  event: Extract<GameAudioEvent, { type: "ui" }>,
): AudioPlan {
  const [start, end, durationMs, wave, priority] = UI_CUES[event.cue];
  const volume = 1;
  const variation =
    ((seededUnit(event.seed ?? 1, event.cue.length) - 0.5) * 18) | 0;
  return {
    voices: [
      voice(
        {
          id: `ui:${event.cue}`,
          bus: "ui",
          atMs: 0,
          durationMs,
          frequencyHz: start + variation,
          endFrequencyHz: end + variation,
          wave,
          gain:
            event.cue === "sound-check"
              ? 0.11
              : event.cue === "unavailable"
                ? 0.072
                : 0.055,
          pan: normalizedPan(event.pan),
          priority: priority + 78,
        },
        volume,
      ),
    ],
    samples: [],
    duckDb: 0,
    durationMs,
  };
}

export function audioPlanForEvent(
  event: GameAudioEvent,
  preferencesInput: AudioPreferences,
): AudioPlan {
  const preferences = normalizeAudioPreferences(preferencesInput);
  if (!preferences.sfxEnabled) {
    return EMPTY_AUDIO_PLAN;
  }
  if (event.type === "weapon-timeline") {
    return timelinePlan(event);
  }
  if (event.type === "resolution") {
    return resolutionPlan(event);
  }
  return uiPlan(event);
}

interface ActiveVoice {
  readonly id: number;
  readonly bus: SfxBus;
  readonly priority: number;
  readonly startTime: number;
  readonly resumable:
    | { readonly kind: "voice"; readonly plan: AudioVoicePlan }
    | { readonly kind: "sample"; readonly plan: AudioSamplePlan };
  readonly source: OscillatorNode | AudioBufferSourceNode;
  readonly gain: GainNode;
  readonly panner: StereoPannerNode | null;
}

interface PendingSampleStart {
  readonly id: number;
  readonly generation: number;
  readonly dueTime: number;
  readonly plan: AudioSamplePlan;
}

type ResumableSfxPlan =
  | { readonly kind: "voice"; readonly plan: AudioVoicePlan }
  | { readonly kind: "sample"; readonly plan: AudioSamplePlan };

const MAX_ACTIVE_VOICES = 24;

function setParam(
  parameter: AudioParam,
  value: number,
  now: number,
  timeConstant = 0.025,
): void {
  parameter.cancelScheduledValues(now);
  parameter.setTargetAtTime(value, now, timeConstant);
}

export class AudioDirector {
  private readonly context: AudioContext;
  private readonly onContextStateChange:
    | ((state: RuntimeAudioContextState) => void)
    | null;
  private readonly master: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly musicGain: GainNode;
  private readonly duckGain: GainNode;
  private readonly sfxGain: GainNode;
  private readonly busGains: Readonly<Record<SfxBus, GainNode>>;
  private readonly audioSession: AudioSessionLike | null;
  private readonly mediaBridge: AudioMediaBridge | null;
  private readonly assetLoader: AudioAssetLoader | null;
  private readonly assetAbortController = new AbortController();
  private readonly outputRoute: AudioOutputRoute;
  private readonly activationTimeoutMs: number;
  private readonly activeVoices = new Map<number, ActiveVoice>();
  private readonly sampleBuffers = new Map<AudioSampleId, AudioBuffer>();
  private readonly sampleLoadPromises = new Map<
    AudioSampleId,
    Promise<void>
  >();
  private readonly pendingSampleStarts = new Map<
    number,
    PendingSampleStart
  >();
  private resumableSfx: ResumableSfxPlan[] = [];
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicLoadPromise: Promise<void> | null = null;
  private musicAssetState: MusicAssetState = "idle";
  private activationPromise: Promise<AudioActivationReport> | null = null;
  private settings: AudioPreferences = { ...DEFAULT_AUDIO_PREFERENCES };
  private nextVoiceId = 1;
  private nextPendingSampleId = 1;
  private sfxGeneration = 1;
  private activated = false;
  private paused = false;
  private hidden = false;
  private disposed = false;
  private primed = false;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(
    context: AudioContext,
    onContextStateChange: (
      state: RuntimeAudioContextState,
    ) => void = () => undefined,
    options: AudioDirectorOptions = {},
  ) {
    this.context = context;
    this.onContextStateChange = onContextStateChange;
    this.audioSession = options.audioSession ?? null;
    this.mediaBridge = options.mediaBridge ?? null;
    this.assetLoader = options.assetLoader ?? null;
    this.outputRoute = options.outputRoute ?? "webaudio";
    this.activationTimeoutMs = Math.max(
      50,
      options.activationTimeoutMs ?? DEFAULT_ACTIVATION_TIMEOUT_MS,
    );
    this.master = context.createGain();
    this.compressor = context.createDynamicsCompressor();
    this.musicGain = context.createGain();
    this.duckGain = context.createGain();
    this.sfxGain = context.createGain();
    this.busGains = {
      weapon: context.createGain(),
      shieldArmor: context.createGain(),
      impactTerrain: context.createGain(),
      ui: context.createGain(),
    };

    this.master.gain.value = 0.78;
    this.musicGain.gain.value = 0;
    this.duckGain.gain.value = 1;
    this.sfxGain.gain.value = 0;
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.006;
    this.compressor.release.value = 0.22;

    this.musicGain.connect(this.duckGain);
    this.duckGain.connect(this.master);
    Object.values(this.busGains).forEach((gain) => {
      gain.connect(this.sfxGain);
    });
    this.sfxGain.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(options.outputNode ?? context.destination);
    this.context.addEventListener?.(
      "statechange",
      this.handleContextStateChange,
    );
    this.audioSession?.addEventListener?.(
      "statechange",
      this.handleAudioSessionStateChange,
    );
  }

  public get state(): RuntimeAudioContextState {
    return this.context.state as RuntimeAudioContextState;
  }

  public get activeVoiceCount(): number {
    return this.activeVoices.size + (this.musicSource ? 1 : 0);
  }

  public debugSnapshot(): AudioDebugSnapshot {
    return {
      contextState: this.state,
      currentTime: this.context.currentTime,
      activeVoiceCount: this.activeVoiceCount,
      activated: this.activated,
      audioSessionType: this.audioSession?.type ?? null,
      audioSessionState: this.audioSession?.state ?? null,
      outputRoute: this.outputRoute,
      mediaBridgeState: this.mediaBridge?.state ?? null,
      musicAssetState: this.musicAssetState,
      loadedSampleCount: this.sampleBuffers.size,
      musicEnabled: this.settings.musicEnabled,
      sfxEnabled: this.settings.sfxEnabled,
      musicVolume: this.settings.musicVolume,
      sfxVolume: this.settings.sfxVolume,
      masterGain: this.master.gain.value,
      musicGain: this.musicGain.gain.value,
      sfxGain: this.sfxGain.gain.value,
      musicTargetGain:
        this.activated && this.settings.musicEnabled && !this.hidden
          ? (this.settings.musicVolume / 100) *
            (this.paused ? 0.24 : 1)
          : 0,
      sfxTargetGain:
        this.activated && this.settings.sfxEnabled
          ? this.settings.sfxVolume / 100
          : 0,
      categoryGains: {
        weapon: this.busGains.weapon.gain.value,
        shieldArmor: this.busGains.shieldArmor.gain.value,
        impactTerrain: this.busGains.impactTerrain.gain.value,
        ui: this.busGains.ui.gain.value,
      },
    };
  }

  public async activate(
    preferences: AudioPreferences = this.settings,
  ): Promise<AudioActivationReport> {
    if (this.disposed) {
      throw new Error("AudioDirector has been disposed.");
    }
    this.settings = normalizeAudioPreferences(preferences);
    if (!this.settings.musicEnabled && !this.settings.sfxEnabled) {
      throw new AudioActivationError(
        "Audio activation was requested while both categories are disabled.",
        this.state,
      );
    }
    if (this.state === "closed") {
      throw new AudioActivationError(
        "AudioContext is closed.",
        this.state,
      );
    }
    if (this.activationPromise) {
      return this.activationPromise;
    }
    const activation = this.activateFromGesture();
    this.activationPromise = activation;
    try {
      return await activation;
    } finally {
      if (this.activationPromise === activation) {
        this.activationPromise = null;
      }
    }
  }

  private async activateFromGesture(): Promise<AudioActivationReport> {
    const userActivationIsActive =
      typeof navigator === "undefined"
        ? null
        : (navigator as NavigatorWithAudioSession).userActivation
            ?.isActive ?? null;
    const audioSessionType = this.audioSession
      ? configurePlaybackAudioSession({
          audioSession: this.audioSession,
        })
      : null;

    if (
      this.activated &&
      !this.hidden &&
      this.state === "running" &&
      (!this.mediaBridge || this.mediaBridge.state === "playing")
    ) {
      this.applySettings();
      this.preloadSamples();
      this.ensureMusic();
      this.resumeSfx();
      return {
        contextState: "running",
        audioSessionType,
        outputRoute: this.outputRoute,
        userActivationIsActive,
      };
    }

    const needsLivenessCheck =
      !this.activated || this.hidden || this.state !== "running";

    // Both calls happen synchronously before the first await. This preserves
    // the direct tap/click relationship required by mobile WebKit.
    this.primeOutput();
    const activationSteps: Promise<unknown>[] = [];
    if (this.mediaBridge) {
      activationSteps.push(this.mediaBridge.start());
    }
    if (this.state !== "running") {
      activationSteps.push(this.context.resume());
    }
    await this.withActivationTimeout(Promise.all(activationSteps));

    if (this.state !== "running") {
      throw new AudioActivationError(
        `AudioContext resume completed without reaching running state (state: ${this.state}).`,
        this.state,
      );
    }
    this.activated = true;
    this.hidden = false;
    this.applySettings();
    this.preloadSamples();
    this.ensureMusic();
    this.resumeSfx();
    if (needsLivenessCheck) {
      await this.verifyClockIsAdvancing();
    }
    return {
      contextState: "running",
      audioSessionType,
      outputRoute: this.outputRoute,
      userActivationIsActive,
    };
  }

  public updateSettings(preferences: AudioPreferences): void {
    this.settings = normalizeAudioPreferences(preferences);
    if (!this.settings.sfxEnabled) {
      this.cancelSfx();
    }
    if (!this.settings.musicEnabled) {
      this.stopMusic();
    }
    if (!this.settings.musicEnabled && !this.settings.sfxEnabled) {
      this.mediaBridge?.pause();
    }
    this.applySettings();
    if (this.activated) {
      this.preloadSamples();
      this.ensureMusic();
    }
  }

  public setMusicState(state: MusicState): void {
    void state;
    if (!this.activated || !this.settings.musicEnabled || this.hidden) {
      return;
    }
    this.ensureMusic();
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) {
      this.applySettings();
      return;
    }
    this.paused = paused;
    if (paused) {
      this.pauseSfxForResume();
    } else {
      this.resumeSfx();
    }
    this.applySettings();
  }

  public async setHidden(hidden: boolean): Promise<void> {
    if (this.hidden === hidden) {
      return;
    }
    this.hidden = hidden;
    if (hidden) {
      this.pauseSfxForResume();
      this.stopMusic();
      this.mediaBridge?.pause();
      this.primed = false;
      if (this.context.state === "running") {
        await this.context.suspend();
      }
      return;
    }
    // Returning from the background requires a new direct user gesture on
    // iOS. The UI exposes Retry/Resume instead of claiming an automatic fix.
  }

  public play(event: GameAudioEvent): AudioPlan {
    const plan = audioPlanForEvent(event, this.settings);
    if (
      !this.activated ||
      this.disposed ||
      this.hidden ||
      this.state !== "running" ||
      (this.paused && event.type !== "ui")
    ) {
      return plan;
    }

    if (plan.duckDb < 0) {
      this.duck(plan.duckDb, Math.min(1_200, plan.durationMs + 500));
    }
    plan.voices
      .forEach((planned) => this.scheduleVoice(planned));
    plan.samples.forEach((planned) => this.scheduleSample(planned));
    return plan;
  }

  public cancelSfx(): void {
    this.sfxGeneration += 1;
    this.pendingSampleStarts.clear();
    this.resumableSfx = [];
    for (const active of [...this.activeVoices.values()]) {
      this.stopVoice(active);
    }
  }

  private pauseSfxForResume(): void {
    const now = this.context.currentTime;
    const resumable = [...this.resumableSfx];
    for (const active of this.activeVoices.values()) {
      if (active.startTime <= now + 0.015) {
        continue;
      }
      const atMs = Math.max(
        0,
        Math.round((active.startTime - now) * 1_000),
      );
      resumable.push(
        active.resumable.kind === "voice"
          ? {
              kind: "voice",
              plan: { ...active.resumable.plan, atMs },
            }
          : {
              kind: "sample",
              plan: { ...active.resumable.plan, atMs },
            },
      );
    }
    for (const pending of this.pendingSampleStarts.values()) {
      if (pending.dueTime <= now + 0.015) {
        continue;
      }
      resumable.push({
        kind: "sample",
        plan: {
          ...pending.plan,
          atMs: Math.max(
            0,
            Math.round((pending.dueTime - now) * 1_000),
          ),
        },
      });
    }

    this.sfxGeneration += 1;
    this.pendingSampleStarts.clear();
    for (const active of [...this.activeVoices.values()]) {
      this.stopVoice(active);
    }
    this.resumableSfx = resumable.slice(0, MAX_ACTIVE_VOICES);
  }

  private resumeSfx(): void {
    if (
      this.resumableSfx.length === 0 ||
      this.paused ||
      this.hidden ||
      this.disposed ||
      !this.activated ||
      !this.settings.sfxEnabled ||
      this.state !== "running"
    ) {
      return;
    }
    const resumable = this.resumableSfx;
    this.resumableSfx = [];
    resumable.forEach((entry) => {
      if (entry.kind === "voice") {
        this.scheduleVoice(entry.plan);
      } else {
        this.scheduleSample(entry.plan);
      }
    });
  }

  public cancelAll(): void {
    this.cancelSfx();
    this.stopMusic();
    if (this.duckTimer) {
      clearTimeout(this.duckTimer);
      this.duckTimer = null;
    }
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.assetAbortController.abort();
    this.context.removeEventListener?.(
      "statechange",
      this.handleContextStateChange,
    );
    this.audioSession?.removeEventListener?.(
      "statechange",
      this.handleAudioSessionStateChange,
    );
    this.mediaBridge?.dispose();
    this.cancelAll();
    [
      ...Object.values(this.busGains),
      this.sfxGain,
      this.musicGain,
      this.duckGain,
      this.master,
      this.compressor,
    ].forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // A partially initialized browser graph may already be disconnected.
      }
    });
    if (this.context.state !== "closed") {
      await this.context.close();
    }
  }

  private applySettings(): void {
    const now = this.context.currentTime;
    const sfxTarget =
      this.activated && this.settings.sfxEnabled
        ? this.settings.sfxVolume / 100
        : 0;
    const musicTarget =
      this.activated && this.settings.musicEnabled && !this.hidden
        ? (this.settings.musicVolume / 100) * (this.paused ? 0.24 : 1)
        : 0;
    setParam(this.sfxGain.gain, sfxTarget, now);
    setParam(this.musicGain.gain, musicTarget, now, 0.08);
  }

  private ensureMusic(): void {
    if (
      !this.activated ||
      !this.settings.musicEnabled ||
      this.hidden ||
      this.disposed ||
      this.state !== "running"
    ) {
      return;
    }
    if (this.musicSource) {
      return;
    }
    if (this.musicBuffer) {
      this.startMusicBuffer();
      return;
    }
    if (!this.assetLoader || this.musicLoadPromise) {
      return;
    }

    this.musicAssetState = "loading";
    const load = this.assetLoader
      .loadMusic(this.context, this.assetAbortController.signal)
      .then((buffer) => {
        if (this.disposed) {
          return;
        }
        this.musicBuffer = buffer;
        this.musicAssetState = "ready";
        if (
          this.activated &&
          this.settings.musicEnabled &&
          !this.hidden &&
          this.state === "running"
        ) {
          this.startMusicBuffer();
        }
      })
      .catch((error: unknown) => {
        if (this.disposed || this.assetAbortController.signal.aborted) {
          return;
        }
        this.musicAssetState = "error";
        console.warn("Music asset could not be loaded; SFX remain active.", error);
      })
      .finally(() => {
        if (this.musicLoadPromise === load) {
          this.musicLoadPromise = null;
        }
      });
    this.musicLoadPromise = load;
  }

  private stopMusic(): void {
    const source = this.musicSource;
    this.musicSource = null;
    if (!source) {
      return;
    }
    source.onended = null;
    try {
      source.stop();
    } catch {
      // The one-shot source may already have ended during interruption.
    }
    source.disconnect();
    this.musicAssetState = this.musicBuffer ? "ready" : this.musicAssetState;
  }

  private startMusicBuffer(): void {
    if (
      !this.musicBuffer ||
      this.musicSource ||
      this.disposed ||
      this.hidden ||
      !this.activated ||
      !this.settings.musicEnabled ||
      this.state !== "running"
    ) {
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.musicBuffer;
    source.loop = true;
    source.connect(this.musicGain);
    this.musicSource = source;
    this.musicAssetState = "playing";
    source.onended = () => {
      if (this.musicSource !== source) {
        return;
      }
      this.musicSource = null;
      source.disconnect();
      this.musicAssetState = this.musicBuffer ? "ready" : "idle";
    };
    source.start(this.context.currentTime);
  }

  private preloadSamples(): void {
    if (!this.assetLoader || this.disposed) {
      return;
    }
    const assetLoader = this.assetLoader;
    AUDIO_SAMPLE_IDS.forEach((sampleId) => {
      if (
        this.sampleBuffers.has(sampleId) ||
        this.sampleLoadPromises.has(sampleId)
      ) {
        return;
      }
      const load = assetLoader
        .loadSample(
          this.context,
          sampleId,
          this.assetAbortController.signal,
        )
        .then((buffer) => {
          if (!this.disposed) {
            this.sampleBuffers.set(sampleId, buffer);
          }
        })
        .catch((error: unknown) => {
          if (this.disposed || this.assetAbortController.signal.aborted) {
            return;
          }
          console.warn(`Audio sample ${sampleId} could not be loaded.`, error);
        })
        .finally(() => {
          if (this.sampleLoadPromises.get(sampleId) === load) {
            this.sampleLoadPromises.delete(sampleId);
          }
        });
      this.sampleLoadPromises.set(sampleId, load);
    });
  }

  private scheduleVoice(planned: AudioVoicePlan): void {
    if (
      this.activeVoiceCount >= MAX_ACTIVE_VOICES
    ) {
      const stealable = [...this.activeVoices.values()].sort(
        (left, right) => left.priority - right.priority,
      )[0];
      if (stealable && stealable.priority <= planned.priority) {
        this.stopVoice(stealable);
      } else {
        return;
      }
    }

    const start = this.context.currentTime + planned.atMs / 1_000;
    const end = start + planned.durationMs / 1_000;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner =
      typeof this.context.createStereoPanner === "function"
        ? this.context.createStereoPanner()
        : null;

    source.type = planned.wave;
    source.frequency.setValueAtTime(planned.frequencyHz, start);
    source.frequency.exponentialRampToValueAtTime(
      planned.endFrequencyHz,
      end,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, planned.gain),
      start + Math.min(0.028, planned.durationMs / 4_000),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(planned.pan, start);
      gain.connect(panner);
      panner.connect(this.busGains[planned.bus as SfxBus]);
    } else {
      gain.connect(this.busGains[planned.bus as SfxBus]);
    }

    const id = this.nextVoiceId;
    this.nextVoiceId += 1;
    const active: ActiveVoice = {
      id,
      bus: planned.bus,
      priority: planned.priority,
      startTime: start,
      resumable: { kind: "voice", plan: planned },
      source,
      gain,
      panner,
    };
    this.activeVoices.set(id, active);
    source.onended = () => {
      this.activeVoices.delete(id);
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
    source.start(start);
    source.stop(end + 0.04);
  }

  private scheduleSample(planned: AudioSamplePlan): void {
    const dueTime = this.context.currentTime + planned.atMs / 1_000;
    const buffer = this.sampleBuffers.get(planned.sampleId);
    if (!buffer) {
      const load = this.sampleLoadPromises.get(planned.sampleId);
      if (!load) {
        return;
      }
      const id = this.nextPendingSampleId;
      this.nextPendingSampleId += 1;
      const pending: PendingSampleStart = {
        id,
        generation: this.sfxGeneration,
        dueTime,
        plan: planned,
      };
      this.pendingSampleStarts.set(id, pending);
      void load.then(() => {
        if (
          this.pendingSampleStarts.get(id) !== pending ||
          pending.generation !== this.sfxGeneration
        ) {
          return;
        }
        this.pendingSampleStarts.delete(id);
        const decoded = this.sampleBuffers.get(planned.sampleId);
        const lateness = this.context.currentTime - dueTime;
        if (
          !decoded ||
          lateness > 0.18 ||
          this.paused ||
          this.hidden ||
          this.disposed ||
          !this.activated ||
          !this.settings.sfxEnabled ||
          this.state !== "running"
        ) {
          return;
        }
        this.scheduleDecodedSample(planned, decoded, dueTime);
      });
      return;
    }
    this.scheduleDecodedSample(planned, buffer, dueTime);
  }

  private scheduleDecodedSample(
    planned: AudioSamplePlan,
    buffer: AudioBuffer,
    dueTime: number,
  ): void {
    if (this.activeVoiceCount >= MAX_ACTIVE_VOICES) {
      const stealable = [...this.activeVoices.values()].sort(
        (left, right) => left.priority - right.priority,
      )[0];
      if (stealable && stealable.priority <= planned.priority) {
        this.stopVoice(stealable);
      } else {
        return;
      }
    }

    const start = Math.max(this.context.currentTime, dueTime);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const panner =
      typeof this.context.createStereoPanner === "function"
        ? this.context.createStereoPanner()
        : null;

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(planned.playbackRate, start);
    gain.gain.setValueAtTime(planned.gain, start);
    source.connect(gain);
    if (panner) {
      panner.pan.setValueAtTime(planned.pan, start);
      gain.connect(panner);
      panner.connect(this.busGains[planned.bus]);
    } else {
      gain.connect(this.busGains[planned.bus]);
    }

    const id = this.nextVoiceId;
    this.nextVoiceId += 1;
    const active: ActiveVoice = {
      id,
      bus: planned.bus,
      priority: planned.priority,
      startTime: start,
      resumable: { kind: "sample", plan: planned },
      source,
      gain,
      panner,
    };
    this.activeVoices.set(id, active);
    source.onended = () => {
      if (this.activeVoices.get(id) !== active) {
        return;
      }
      this.activeVoices.delete(id);
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
    source.start(start);
  }

  private stopVoice(active: ActiveVoice): void {
    this.activeVoices.delete(active.id);
    active.source.onended = null;
    try {
      active.source.stop();
    } catch {
      // Scheduled sources may already have ended.
    }
    active.source.disconnect();
    active.gain.disconnect();
    active.panner?.disconnect();
  }

  private duck(decibels: number, durationMs: number): void {
    const now = this.context.currentTime;
    const ratio = 10 ** (decibels / 20);
    setParam(this.duckGain.gain, ratio, now, 0.035);
    if (this.duckTimer) {
      clearTimeout(this.duckTimer);
    }
    this.duckTimer = setTimeout(() => {
      if (!this.disposed) {
        setParam(
          this.duckGain.gain,
          1,
          this.context.currentTime,
          0.18,
        );
      }
      this.duckTimer = null;
    }, Math.max(120, durationMs));
  }

  private readonly handleContextStateChange = (): void => {
    const state = this.state;
    if (state !== "running") {
      this.pauseSfxForResume();
      this.stopMusic();
    } else if (this.activated && !this.hidden && !this.disposed) {
      this.applySettings();
      this.ensureMusic();
      this.resumeSfx();
    }
    this.onContextStateChange?.(state);
  };

  private readonly handleAudioSessionStateChange = (): void => {
    if (this.audioSession?.state !== "interrupted") {
      return;
    }
    this.activated = false;
    this.primed = false;
    this.pauseSfxForResume();
    this.stopMusic();
    this.onContextStateChange?.("interrupted");
  };

  private primeOutput(): void {
    if (this.primed) {
      return;
    }
    this.primed = true;
    const now = this.context.currentTime;
    const source = this.context.createOscillator();
    const gain = this.context.createGain();
    source.type = "sine";
    source.frequency.setValueAtTime(880, now);
    source.frequency.exponentialRampToValueAtTime(1_320, now + 0.055);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    source.connect(gain);
    gain.connect(this.master);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start(now);
    source.stop(now + 0.065);
  }

  private async withActivationTimeout<T>(
    operation: Promise<T>,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(
              new AudioActivationError(
                `Audio activation timed out after ${this.activationTimeoutMs} ms.`,
                this.state,
              ),
            );
          }, this.activationTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private async verifyClockIsAdvancing(): Promise<void> {
    const before = this.context.currentTime;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 48);
    });
    const after = this.context.currentTime;
    if (this.state !== "running" || after <= before) {
      throw new AudioActivationError(
        `AudioContext reported ${this.state}, but its clock did not advance (${before.toFixed(3)} → ${after.toFixed(3)}).`,
        this.state,
      );
    }
  }
}

export function createAudioDirector(
  onContextStateChange?: (
    state: RuntimeAudioContextState,
  ) => void,
): AudioDirector | null {
  if (typeof window === "undefined") {
    return null;
  }
  const navigatorWithAudioSession =
    typeof navigator === "undefined"
      ? null
      : (navigator as NavigatorWithAudioSession);
  const appleMobile = isAppleMobileWebKit(navigatorWithAudioSession);
  const audioSession = appleMobile
    ? navigatorWithAudioSession?.audioSession ?? null
    : null;
  const playbackSessionType = audioSession
    ? configurePlaybackAudioSession({ audioSession })
    : null;
  if (!appleMobile) {
    configureAutomaticAudioSession(navigatorWithAudioSession);
  }
  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }
  const context = new AudioContextConstructor();
  const safariOutputBridge = createDesktopSafariOutputBridge(
    context,
    navigatorWithAudioSession,
  );
  const mediaBridge =
    safariOutputBridge ??
    (playbackSessionType === "playback" ? null : createMediaAudioBridge());
  const outputRoute: AudioOutputRoute =
    safariOutputBridge
      ? "safari-media-stream"
      : playbackSessionType === "playback"
      ? "audio-session"
      : mediaBridge
        ? "media-element-fallback"
        : "webaudio";
  return new AudioDirector(
    context,
    onContextStateChange,
    {
      assetLoader: createHttpAudioAssetLoader(),
      audioSession,
      mediaBridge,
      outputNode: safariOutputBridge?.outputNode,
      outputRoute,
    },
  );
}

export function damageBucket(amount: number, maxHealth: number): DamageBucket {
  const ratio = amount / Math.max(1, maxHealth);
  if (ratio >= 0.5) {
    return "critical";
  }
  if (ratio >= 0.28) {
    return "heavy";
  }
  if (ratio >= 0.12) {
    return "medium";
  }
  return "light";
}
