import type { RandomSeed } from "./random";
import {
  TerrainGrid,
  type TerrainBounds,
} from "./terrain";
import type {
  ExperimentalEffectLevel,
  ExperimentalQualityBudget,
  ExperimentalTankState,
} from "./experimental-ultimates";
import type { ShotDirection, Vector2 } from "./types";

export const VFX_LAB_II_IDS = [
  "behindTheSky",
  "blackPanel",
  "inkTide",
  "thunderWeave",
  "filmBurnZero",
  "pixelUndertow",
  "neonLeviathan",
  "shadowJudgment",
  "clockworkEclipse",
  "invertedOcean",
] as const;

export type VfxLabWeaponId = (typeof VFX_LAB_II_IDS)[number];

export interface VfxLabWeaponDefinition {
  readonly id: VfxLabWeaponId;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly icon: string;
  readonly accent: string;
  readonly secondaryAccent: string;
  readonly strategy: "local-impact";
  readonly footprint: {
    readonly shape: "radial";
    readonly mechanicalRadius: number;
    readonly spectacleRadius: number;
  };
  readonly anticipationMs: number;
  readonly resolutionMs: number;
  readonly aftermathMs: number;
  readonly testSeed: number;
  readonly distinguishingAxes: readonly [
    string,
    string,
    string,
    string,
    ...string[],
  ];
  readonly audioMotif: readonly [number, number, number];
  readonly quality: Readonly<
    Record<ExperimentalEffectLevel, ExperimentalQualityBudget>
  >;
}

function quality(
  fullParticles: number,
  balancedParticles: number,
  reducedParticles: number,
  drawOperations: number,
  lights: number,
  audioVoices: number,
): VfxLabWeaponDefinition["quality"] {
  return {
    full: {
      particles: fullParticles,
      drawOperations,
      lights,
      audioVoices,
    },
    balanced: {
      particles: balancedParticles,
      drawOperations: Math.ceil(drawOperations * 0.7),
      lights: Math.max(1, Math.ceil(lights * 0.6)),
      audioVoices: Math.min(audioVoices, 6),
    },
    reduced: {
      particles: reducedParticles,
      drawOperations: Math.max(16, Math.ceil(drawOperations * 0.34)),
      lights: 1,
      audioVoices: Math.min(audioVoices, 3),
    },
  };
}

export const VFX_LAB_II_WEAPONS = Object.freeze([
  {
    id: "behindTheSky",
    name: "Изнанка неба",
    shortName: "Изнанка",
    description:
      "Локальный кратер на фоне трёх гигантских cel-взрывов за рельефом.",
    icon: "☼",
    accent: "#ff9f43",
    secondaryAccent: "#fff0a8",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 28, spectacleRadius: 420 },
    anticipationMs: 560,
    resolutionMs: 1_620,
    aftermathMs: 1_520,
    testSeed: 62_801,
    distinguishingAxes: [
      "cel flipbook horizon",
      "three delayed blooms",
      "orange cream silhouette",
      "deep parallax",
    ],
    audioMotif: [82, 246, 738],
    quality: quality(48, 22, 0, 142, 3, 6),
  },
  {
    id: "blackPanel",
    name: "Чёрная панель",
    shortName: "Панель",
    description:
      "Мир складывается в контрастный graphic-novel panel вокруг малого impact.",
    icon: "▰",
    accent: "#f5f1dc",
    secondaryAccent: "#65e9ff",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 22, spectacleRadius: 460 },
    anticipationMs: 480,
    resolutionMs: 1_460,
    aftermathMs: 1_440,
    testSeed: 62_802,
    distinguishingAxes: [
      "jagged panel framing",
      "single held graphic beat",
      "black cream cyan",
      "screen-space halftone",
    ],
    audioMotif: [190, 380, 760],
    quality: quality(34, 16, 0, 158, 2, 5),
  },
  {
    id: "inkTide",
    name: "Чернильный прилив",
    shortName: "Чернила",
    description:
      "Крупные каллиграфические plates почти заливают поле и стекают в кратер.",
    icon: "≈",
    accent: "#17131f",
    secondaryAccent: "#d7a7ff",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 26, spectacleRadius: 440 },
    anticipationMs: 600,
    resolutionMs: 1_700,
    aftermathMs: 1_580,
    testSeed: 62_803,
    distinguishingAxes: [
      "organic alpha matte",
      "rising then draining tide",
      "ink violet paper",
      "foreground tendrils",
    ],
    audioMotif: [66, 132, 528],
    quality: quality(28, 12, 0, 126, 2, 5),
  },
  {
    id: "thunderWeave",
    name: "Громовая ткань",
    shortName: "Ткань",
    description:
      "Seeded vector-сеть прошивает небо и сходится в одном малом contour.",
    icon: "ϟ",
    accent: "#7ee8ff",
    secondaryAccent: "#fff6b3",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 20, spectacleRadius: 510 },
    anticipationMs: 520,
    resolutionMs: 1_540,
    aftermathMs: 1_400,
    testSeed: 62_804,
    distinguishingAxes: [
      "branching vector network",
      "three converging waves",
      "cyan gold navy",
      "sky-to-impact motion",
    ],
    audioMotif: [108, 432, 1_296],
    quality: quality(42, 18, 0, 176, 4, 7),
  },
  {
    id: "filmBurnZero",
    name: "Киноплёнка-0",
    shortName: "Плёнка",
    description:
      "Одна безопасная burn-matte открывает альтернативную экспозицию сцены.",
    icon: "◐",
    accent: "#ffc857",
    secondaryAccent: "#65d7ff",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 24, spectacleRadius: 470 },
    anticipationMs: 500,
    resolutionMs: 1_500,
    aftermathMs: 1_480,
    testSeed: 62_805,
    distinguishingAxes: [
      "burn dissolve matte",
      "one continuous reveal",
      "amber cyan charcoal",
      "screen exposure transition",
    ],
    audioMotif: [124, 248, 992],
    quality: quality(30, 14, 0, 150, 3, 5),
  },
  {
    id: "pixelUndertow",
    name: "Пиксельный отлив",
    shortName: "Отлив",
    description:
      "Bounded snapshot-tiles поднимаются волной и точно возвращаются на место.",
    icon: "▦",
    accent: "#74f4d4",
    secondaryAccent: "#ff78c7",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 18, spectacleRadius: 480 },
    anticipationMs: 540,
    resolutionMs: 1_580,
    aftermathMs: 1_460,
    testSeed: 62_806,
    distinguishingAxes: [
      "scene snapshot tiles",
      "out-and-back wave",
      "mint magenta dark",
      "screen-space strip motion",
    ],
    audioMotif: [240, 360, 720],
    quality: quality(24, 10, 0, 188, 2, 6),
  },
  {
    id: "neonLeviathan",
    name: "Неоновый левиафан",
    shortName: "Левиафан",
    description:
      "Оригинальный световой силуэт огибает поле и оставляет один локальный укус.",
    icon: "⌁",
    accent: "#4dffd2",
    secondaryAccent: "#b46cff",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 30, spectacleRadius: 520 },
    anticipationMs: 620,
    resolutionMs: 1_760,
    aftermathMs: 1_560,
    testSeed: 62_807,
    distinguishingAxes: [
      "giant vector creature",
      "slow swim then bite",
      "mint violet black",
      "behind-world spline",
    ],
    audioMotif: [54, 162, 648],
    quality: quality(38, 16, 0, 164, 4, 7),
  },
  {
    id: "shadowJudgment",
    name: "Суд теней",
    shortName: "Тени",
    description:
      "Один проходящий источник вытягивает тени и сжимает их в precision strike.",
    icon: "◩",
    accent: "#ffe8a3",
    secondaryAccent: "#6f58a8",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 21, spectacleRadius: 450 },
    anticipationMs: 580,
    resolutionMs: 1_680,
    aftermathMs: 1_420,
    testSeed: 62_808,
    distinguishingAxes: [
      "dynamic silhouette lighting",
      "long sweep then contraction",
      "gold aubergine",
      "foreground shadow wedges",
    ],
    audioMotif: [72, 216, 864],
    quality: quality(26, 12, 0, 132, 3, 5),
  },
  {
    id: "clockworkEclipse",
    name: "Механическое затмение",
    shortName: "Затмение",
    description:
      "Иерархический gear-rig выстраивается за полем и выпускает узкий pulse.",
    icon: "⚙",
    accent: "#ffcf5c",
    secondaryAccent: "#68ddeb",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 23, spectacleRadius: 500 },
    anticipationMs: 640,
    resolutionMs: 1_780,
    aftermathMs: 1_540,
    testSeed: 62_809,
    distinguishingAxes: [
      "hierarchical gear rig",
      "nested alignment beat",
      "brass cyan graphite",
      "orbital rotation",
    ],
    audioMotif: [96, 288, 576],
    quality: quality(36, 14, 0, 196, 3, 7),
  },
  {
    id: "invertedOcean",
    name: "Океан вверх дном",
    shortName: "Океан",
    description:
      "Крупные translucent bands и caustics опускаются сверху к водяному гвоздю.",
    icon: "≋",
    accent: "#57d9ff",
    secondaryAccent: "#b6ffde",
    strategy: "local-impact",
    footprint: { shape: "radial", mechanicalRadius: 27, spectacleRadius: 530 },
    anticipationMs: 610,
    resolutionMs: 1_720,
    aftermathMs: 1_600,
    testSeed: 62_810,
    distinguishingAxes: [
      "layered inverted ocean",
      "descending bands then nail",
      "cyan mint midnight",
      "caustic light masks",
    ],
    audioMotif: [58, 174, 522],
    quality: quality(44, 18, 0, 170, 4, 6),
  },
] as const satisfies readonly VfxLabWeaponDefinition[]);

const VFX_LAB_II_BY_ID = Object.freeze(
  VFX_LAB_II_WEAPONS.reduce(
    (registry, weapon) => {
      registry[weapon.id] = weapon;
      return registry;
    },
    {} as Record<VfxLabWeaponId, VfxLabWeaponDefinition>,
  ),
);

const vfxLabIdSet: ReadonlySet<string> = new Set(VFX_LAB_II_IDS);

export function isVfxLabWeaponId(value: string): value is VfxLabWeaponId {
  return vfxLabIdSet.has(value);
}

export function getVfxLabWeapon(
  id: VfxLabWeaponId,
): VfxLabWeaponDefinition {
  return VFX_LAB_II_BY_ID[id];
}

export type VfxLabResolutionEvent =
  | {
      readonly type: "phase";
      readonly atMs: number;
      readonly phase: "anticipation" | "deployment" | "culmination" | "aftermath";
    }
  | {
      readonly type: "node";
      readonly atMs: number;
      readonly index: number;
      readonly role: "marker";
      readonly position: Vector2;
      readonly mechanic: true;
    }
  | {
      readonly type: "terrain";
      readonly atMs: number;
      readonly operation: "carve";
      readonly changedCells: number;
      readonly bounds: TerrainBounds | null;
    }
  | {
      readonly type: "tank-damaged";
      readonly atMs: number;
      readonly tankId: string;
      readonly amount: number;
      readonly remainingHealth: number;
    }
  | {
      readonly type: "resolved";
      readonly atMs: number;
      readonly weaponId: VfxLabWeaponId;
    };

export interface VfxLabResolutionInput {
  readonly weaponId: VfxLabWeaponId;
  readonly seed: RandomSeed;
  readonly origin: Vector2;
  readonly impact: Vector2;
  readonly direction: ShotDirection;
  readonly terrain: TerrainGrid;
  readonly tanks: readonly ExperimentalTankState[];
}

export interface VfxLabResolutionResult {
  readonly weaponId: VfxLabWeaponId;
  readonly terrain: TerrainGrid;
  readonly tanks: readonly ExperimentalTankState[];
  readonly eventLog: readonly VfxLabResolutionEvent[];
  readonly mechanicPoints: readonly Vector2[];
  readonly durationMs: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * All VFX Lab II concepts deliberately share one small, review-safe mechanic:
 * a deterministic local crater and radial damage. Presentation tier is absent
 * from this API, so Canvas choreography cannot alter the outcome.
 */
export function resolveVfxLabWeapon(
  input: VfxLabResolutionInput,
): VfxLabResolutionResult {
  const definition = getVfxLabWeapon(input.weaponId);
  const terrain = input.terrain.clone();
  const impact = {
    x: clamp(input.impact.x, definition.footprint.mechanicalRadius, terrain.width - definition.footprint.mechanicalRadius),
    y: clamp(input.impact.y, definition.footprint.mechanicalRadius, terrain.height - definition.footprint.mechanicalRadius),
  };
  const climaxAt = definition.resolutionMs - 420;
  const edit = terrain.carveCircle(
    impact.x,
    impact.y,
    definition.footprint.mechanicalRadius,
  );
  const events: VfxLabResolutionEvent[] = [
    { type: "phase", atMs: 0, phase: "anticipation" },
    {
      type: "phase",
      atMs: definition.anticipationMs,
      phase: "deployment",
    },
    {
      type: "node",
      atMs: definition.anticipationMs,
      index: 0,
      role: "marker",
      position: impact,
      mechanic: true,
    },
    {
      type: "phase",
      atMs: climaxAt,
      phase: "culmination",
    },
    {
      type: "terrain",
      atMs: climaxAt,
      operation: "carve",
      changedCells: edit.changedCells,
      bounds: edit.bounds,
    },
  ];
  const tanks = input.tanks.map((tank) => {
    const distance = Math.hypot(tank.x - impact.x, tank.y - impact.y);
    if (distance > definition.footprint.mechanicalRadius) {
      return { ...tank };
    }
    const falloff =
      1 - distance / Math.max(1, definition.footprint.mechanicalRadius);
    const amount = Math.min(tank.health, 22 + falloff * 20);
    const health = tank.health - amount;
    events.push({
      type: "tank-damaged",
      atMs: climaxAt,
      tankId: tank.id,
      amount,
      remainingHealth: health,
    });
    return { ...tank, health };
  });
  events.push(
    {
      type: "phase",
      atMs: definition.resolutionMs,
      phase: "aftermath",
    },
    {
      type: "resolved",
      atMs: definition.resolutionMs,
      weaponId: input.weaponId,
    },
  );
  return {
    weaponId: input.weaponId,
    terrain,
    tanks,
    eventLog: events,
    mechanicPoints: [impact],
    durationMs: definition.resolutionMs + definition.aftermathMs,
  };
}
