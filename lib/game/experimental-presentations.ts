import {
  EXPERIMENTAL_SHOWCASE_IDS,
  type ExperimentalShowcaseId,
} from "./experimental-showcase";
import type { ExperimentalEffectLevel } from "./experimental-ultimates";
import {
  VFX_LAB_II_IDS,
  type VfxLabWeaponId,
} from "./experimental-vfx-lab-ii";

export type PresentationDrawStage =
  | "behindWorld"
  | "worldUnderlay"
  | "worldOverlay"
  | "foreground"
  | "screenSpace";

export type PresentationKeyframe =
  | "anticipation"
  | "climax"
  | "aftermath";

export type ExperimentalPresentationClass =
  | "legacy-solar-column"
  | "legacy-gravity-lens"
  | "legacy-reflection-chain"
  | "legacy-time-ribbon"
  | "legacy-portal-pair"
  | "legacy-crystal-star"
  | "legacy-volcanic-cone"
  | "legacy-fault-network"
  | "legacy-aurora-triangle"
  | "legacy-annular-wave"
  | VfxLabPresentationClass;

export type VfxLabPresentationClass =
  | "background-flipbook-parallax"
  | "graphic-novel-screen-compositor"
  | "animated-organic-alpha-matte"
  | "procedural-vector-network"
  | "burn-dissolve-mask-transition"
  | "scene-snapshot-tile-compositor"
  | "giant-vector-character-path"
  | "dynamic-silhouette-lighting"
  | "hierarchical-vector-rig"
  | "layered-atmospheric-caustics";

export interface PresentationBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PresentationBudget {
  readonly atlasBytes: number;
  readonly decodedImageBytes: number;
  readonly offscreenCanvases: number;
  readonly offscreenPixels: number;
  readonly sceneCaptures: number;
  readonly compositePasses: number;
  readonly drawOperations: number;
  readonly activeFlipbookLayers: number;
  readonly particles: number;
  readonly lights: number;
  readonly audioVoices: number;
  readonly blockingMs: number;
  readonly decorativeTailMs: number;
  readonly cameraZoom: number;
  readonly shakePx: number;
  readonly screenDistortion: boolean;
  readonly strongParallax: boolean;
}

export interface ExperimentalPresentationDefinition {
  readonly weaponId: ExperimentalShowcaseId;
  readonly presentationClass: ExperimentalPresentationClass;
  readonly stages: readonly PresentationDrawStage[];
  readonly keyframes: Readonly<
    Record<PresentationKeyframe, readonly PresentationDrawStage[]>
  >;
  readonly signaturePrimitives: readonly [string, string, ...string[]];
  readonly climaxBounds: Readonly<
    Record<ExperimentalEffectLevel, PresentationBounds>
  >;
  readonly budget: Readonly<
    Record<ExperimentalEffectLevel, PresentationBudget>
  >;
  readonly accessibility: {
    readonly maxFlashesPerSecond: number;
    readonly viewportLuminancePulses: number;
    readonly saturatedRedFullscreenFlash: false;
  };
  readonly particlesOptional: true;
  readonly minimapCue: "mechanic-footprint-only";
}

const levelBounds = (
  full: PresentationBounds,
): ExperimentalPresentationDefinition["climaxBounds"] => ({
  full,
  balanced: {
    x: Math.min(0.16, full.x + 0.04),
    y: Math.min(0.16, full.y + 0.04),
    width: Math.max(0.66, full.width - 0.08),
    height: Math.max(0.62, full.height - 0.08),
  },
  reduced: {
    x: 0.24,
    y: 0.2,
    width: 0.52,
    height: 0.54,
  },
});

function budgets(
  drawOperations: number,
  particles: number,
  options: {
    readonly atlasBytes?: number;
    readonly offscreenCanvases?: number;
    readonly offscreenPixels?: number;
    readonly sceneCaptures?: number;
    readonly compositePasses?: number;
    readonly flipbookLayers?: number;
    readonly lights?: number;
    readonly voices?: number;
    readonly tailMs?: number;
    readonly distortion?: boolean;
    readonly parallax?: boolean;
  } = {},
): ExperimentalPresentationDefinition["budget"] {
  const atlasBytes = options.atlasBytes ?? 0;
  const offscreenCanvases = options.offscreenCanvases ?? 0;
  const offscreenPixels = options.offscreenPixels ?? 0;
  const sceneCaptures = options.sceneCaptures ?? 0;
  const compositePasses = options.compositePasses ?? 1;
  const flipbookLayers = options.flipbookLayers ?? 0;
  const lights = options.lights ?? 2;
  const voices = options.voices ?? 5;
  const tailMs = options.tailMs ?? 1_500;
  return {
    full: {
      atlasBytes,
      decodedImageBytes: atlasBytes * 4,
      offscreenCanvases,
      offscreenPixels,
      sceneCaptures,
      compositePasses,
      drawOperations,
      activeFlipbookLayers: flipbookLayers,
      particles,
      lights,
      audioVoices: voices,
      blockingMs: 1_800,
      decorativeTailMs: tailMs,
      cameraZoom: options.parallax ? 1.06 : 1,
      shakePx: 5,
      screenDistortion: options.distortion ?? false,
      strongParallax: options.parallax ?? false,
    },
    balanced: {
      atlasBytes: Math.ceil(atlasBytes * 0.7),
      decodedImageBytes: Math.ceil(atlasBytes * 2.8),
      offscreenCanvases: Math.min(offscreenCanvases, 1),
      offscreenPixels: Math.ceil(offscreenPixels * 0.65),
      sceneCaptures: Math.min(sceneCaptures, 1),
      compositePasses: Math.max(1, Math.ceil(compositePasses * 0.7)),
      drawOperations: Math.ceil(drawOperations * 0.68),
      activeFlipbookLayers: Math.ceil(flipbookLayers * 0.7),
      particles: Math.ceil(particles * 0.45),
      lights: Math.max(1, Math.ceil(lights * 0.6)),
      audioVoices: Math.min(voices, 6),
      blockingMs: 1_800,
      decorativeTailMs: Math.ceil(tailMs * 0.8),
      cameraZoom: options.parallax ? 1.025 : 1,
      shakePx: 2.5,
      screenDistortion: options.distortion ?? false,
      strongParallax: false,
    },
    reduced: {
      atlasBytes: Math.min(atlasBytes, 12_288),
      decodedImageBytes: Math.min(atlasBytes * 4, 49_152),
      offscreenCanvases: 0,
      offscreenPixels: 0,
      sceneCaptures: 0,
      compositePasses: 1,
      drawOperations: Math.max(16, Math.ceil(drawOperations * 0.28)),
      activeFlipbookLayers: Math.min(flipbookLayers, 1),
      particles: 0,
      lights: 1,
      audioVoices: Math.min(voices, 3),
      blockingMs: 1_800,
      decorativeTailMs: Math.min(900, tailMs),
      cameraZoom: 1,
      shakePx: 0,
      screenDistortion: false,
      strongParallax: false,
    },
  };
}

const legacyClasses = [
  "legacy-solar-column",
  "legacy-gravity-lens",
  "legacy-reflection-chain",
  "legacy-time-ribbon",
  "legacy-portal-pair",
  "legacy-crystal-star",
  "legacy-volcanic-cone",
  "legacy-fault-network",
  "legacy-aurora-triangle",
  "legacy-annular-wave",
] as const;

const legacyPresentations = EXPERIMENTAL_SHOWCASE_IDS.slice(0, 10).map(
  (weaponId, index): ExperimentalPresentationDefinition => ({
    weaponId,
    presentationClass: legacyClasses[index] ?? "legacy-solar-column",
    stages: ["worldOverlay"],
    keyframes: {
      anticipation: ["worldOverlay"],
      climax: ["worldOverlay"],
      aftermath: ["worldOverlay"],
    },
    signaturePrimitives: ["mechanic contour", "strategy geometry"],
    climaxBounds: levelBounds({
      x: 0.12,
      y: 0.12,
      width: 0.76,
      height: 0.76,
    }),
    budget: budgets(150, 320),
    accessibility: {
      maxFlashesPerSecond: 1,
      viewportLuminancePulses: 0,
      saturatedRedFullscreenFlash: false,
    },
    particlesOptional: true,
    minimapCue: "mechanic-footprint-only",
  }),
);

const labPresentationSpecs: readonly {
  readonly weaponId: VfxLabWeaponId;
  readonly presentationClass: VfxLabPresentationClass;
  readonly stages: readonly PresentationDrawStage[];
  readonly signaturePrimitives: readonly [string, string, ...string[]];
  readonly bounds: PresentationBounds;
  readonly budget: ExperimentalPresentationDefinition["budget"];
  readonly pulse: 0 | 1;
}[] = [
  {
    weaponId: "behindTheSky",
    presentationClass: "background-flipbook-parallax",
    stages: ["behindWorld", "worldOverlay", "foreground"],
    signaturePrimitives: ["six-frame cel atlas", "three parallax horizon blooms"],
    bounds: { x: 0.04, y: 0.08, width: 0.92, height: 0.82 },
    budget: budgets(142, 48, {
      atlasBytes: 55_296,
      offscreenCanvases: 1,
      offscreenPixels: 55_296,
      flipbookLayers: 3,
      lights: 3,
      voices: 6,
      parallax: true,
    }),
    pulse: 1,
  },
  {
    weaponId: "blackPanel",
    presentationClass: "graphic-novel-screen-compositor",
    stages: ["worldOverlay", "screenSpace"],
    signaturePrimitives: ["jagged panel matte", "halftone masses", "speed-line fan"],
    bounds: { x: 0.02, y: 0.05, width: 0.96, height: 0.84 },
    budget: budgets(158, 34, { compositePasses: 3, voices: 5 }),
    pulse: 1,
  },
  {
    weaponId: "inkTide",
    presentationClass: "animated-organic-alpha-matte",
    stages: ["worldUnderlay", "worldOverlay", "foreground"],
    signaturePrimitives: ["bezier ink plate", "three calligraphic tendrils"],
    bounds: { x: 0.03, y: 0.1, width: 0.94, height: 0.82 },
    budget: budgets(126, 28, { compositePasses: 2, voices: 5 }),
    pulse: 0,
  },
  {
    weaponId: "thunderWeave",
    presentationClass: "procedural-vector-network",
    stages: ["behindWorld", "worldUnderlay", "worldOverlay"],
    signaturePrimitives: ["seeded branching graph", "terrain rim-light"],
    bounds: { x: 0.04, y: 0.05, width: 0.92, height: 0.86 },
    budget: budgets(176, 42, { lights: 4, voices: 7 }),
    pulse: 1,
  },
  {
    weaponId: "filmBurnZero",
    presentationClass: "burn-dissolve-mask-transition",
    stages: ["worldOverlay", "screenSpace"],
    signaturePrimitives: ["moving burn matte", "single bright contour edge"],
    bounds: { x: 0.02, y: 0.04, width: 0.96, height: 0.86 },
    budget: budgets(150, 30, {
      offscreenCanvases: 1,
      offscreenPixels: 518_400,
      compositePasses: 3,
      distortion: true,
      voices: 5,
    }),
    pulse: 1,
  },
  {
    weaponId: "pixelUndertow",
    presentationClass: "scene-snapshot-tile-compositor",
    stages: ["worldOverlay", "screenSpace"],
    signaturePrimitives: ["bounded scene capture", "thirty-two returning tiles"],
    bounds: { x: 0.03, y: 0.06, width: 0.94, height: 0.82 },
    budget: budgets(188, 24, {
      offscreenCanvases: 1,
      offscreenPixels: 518_400,
      sceneCaptures: 1,
      compositePasses: 2,
      distortion: true,
      voices: 6,
    }),
    pulse: 0,
  },
  {
    weaponId: "neonLeviathan",
    presentationClass: "giant-vector-character-path",
    stages: ["behindWorld", "worldOverlay", "foreground"],
    signaturePrimitives: ["original long-body spline", "paired fins", "local bite ray"],
    bounds: { x: 0.01, y: 0.12, width: 0.98, height: 0.74 },
    budget: budgets(164, 38, { lights: 4, voices: 7, parallax: true }),
    pulse: 0,
  },
  {
    weaponId: "shadowJudgment",
    presentationClass: "dynamic-silhouette-lighting",
    stages: ["behindWorld", "worldUnderlay", "worldOverlay", "foreground"],
    signaturePrimitives: ["moving light disc", "five perspective shadow wedges"],
    bounds: { x: 0.04, y: 0.08, width: 0.92, height: 0.8 },
    budget: budgets(132, 26, { compositePasses: 2, lights: 3, voices: 5 }),
    pulse: 1,
  },
  {
    weaponId: "clockworkEclipse",
    presentationClass: "hierarchical-vector-rig",
    stages: ["behindWorld", "worldUnderlay", "worldOverlay"],
    signaturePrimitives: ["nested gear hierarchy", "orbit lines", "closing shutters"],
    bounds: { x: 0.03, y: 0.06, width: 0.94, height: 0.8 },
    budget: budgets(196, 36, { compositePasses: 2, lights: 3, voices: 7 }),
    pulse: 0,
  },
  {
    weaponId: "invertedOcean",
    presentationClass: "layered-atmospheric-caustics",
    stages: ["behindWorld", "worldUnderlay", "worldOverlay", "foreground"],
    signaturePrimitives: ["three inverted wave bands", "cached caustic paths", "water nail"],
    bounds: { x: 0.02, y: 0.04, width: 0.96, height: 0.82 },
    budget: budgets(170, 44, {
      offscreenCanvases: 1,
      offscreenPixels: 65_536,
      compositePasses: 3,
      lights: 4,
      voices: 6,
    }),
    pulse: 0,
  },
];

const labPresentations = labPresentationSpecs.map(
  (spec): ExperimentalPresentationDefinition => ({
    weaponId: spec.weaponId,
    presentationClass: spec.presentationClass,
    stages: spec.stages,
    keyframes: {
      anticipation: ["worldOverlay"],
      climax: spec.stages,
      aftermath: spec.stages.includes("foreground")
        ? ["worldOverlay", "foreground"]
        : ["worldOverlay"],
    },
    signaturePrimitives: spec.signaturePrimitives,
    climaxBounds: levelBounds(spec.bounds),
    budget: spec.budget,
    accessibility: {
      maxFlashesPerSecond: spec.pulse,
      viewportLuminancePulses: spec.pulse,
      saturatedRedFullscreenFlash: false,
    },
    particlesOptional: true,
    minimapCue: "mechanic-footprint-only",
  }),
);

export const EXPERIMENTAL_PRESENTATIONS = Object.freeze([
  ...legacyPresentations,
  ...labPresentations,
]);

const presentationById = Object.freeze(
  EXPERIMENTAL_PRESENTATIONS.reduce(
    (registry, presentation) => {
      registry[presentation.weaponId] = presentation;
      return registry;
    },
    {} as Record<ExperimentalShowcaseId, ExperimentalPresentationDefinition>,
  ),
);

export function getExperimentalPresentation(
  weaponId: ExperimentalShowcaseId,
): ExperimentalPresentationDefinition {
  return presentationById[weaponId];
}

export function measuredDecorativeCoverage(
  bounds: PresentationBounds,
): number {
  const left = Math.max(0, bounds.x);
  const top = Math.max(0, bounds.y);
  const right = Math.min(1, bounds.x + bounds.width);
  const bottom = Math.min(1, bounds.y + bounds.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

export interface PresentationFrameTelemetry {
  readonly weaponId: VfxLabWeaponId;
  readonly keyframe: PresentationKeyframe;
  readonly effectLevel: ExperimentalEffectLevel;
  readonly activeStages: readonly PresentationDrawStage[];
  readonly decorativeBounds: PresentationBounds;
  readonly decorativeCoverage: number;
  readonly drawOperations: number;
  readonly compositePasses: number;
  readonly sceneCaptures: number;
  readonly particles: number;
}

export function presentationFrameTelemetry(
  weaponId: VfxLabWeaponId,
  keyframe: PresentationKeyframe,
  effectLevel: ExperimentalEffectLevel,
): PresentationFrameTelemetry {
  const presentation = getExperimentalPresentation(weaponId);
  const decorativeBounds =
    keyframe === "climax"
      ? presentation.climaxBounds[effectLevel]
      : {
          x: 0.42,
          y: 0.4,
          width: keyframe === "anticipation" ? 0.16 : 0.28,
          height: keyframe === "anticipation" ? 0.2 : 0.3,
        };
  const budget = presentation.budget[effectLevel];
  return {
    weaponId,
    keyframe,
    effectLevel,
    activeStages: presentation.keyframes[keyframe],
    decorativeBounds,
    decorativeCoverage: measuredDecorativeCoverage(decorativeBounds),
    drawOperations: budget.drawOperations,
    compositePasses: budget.compositePasses,
    sceneCaptures: budget.sceneCaptures,
    particles: budget.particles,
  };
}

export function isVfxLabPresentationId(
  weaponId: ExperimentalShowcaseId,
): weaponId is VfxLabWeaponId {
  return (VFX_LAB_II_IDS as readonly string[]).includes(weaponId);
}
