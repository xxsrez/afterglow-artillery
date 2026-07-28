import { SeededRandom, type RandomSeed } from "./random";
import {
  Material,
  TerrainGrid,
  type TerrainBounds,
  type TerrainEdit,
} from "./terrain";
import type { ShotDirection, Vector2 } from "./types";

export const EXPERIMENTAL_ULTIMATE_IDS = [
  "heliosSpire",
  "gravityCathedral",
  "mirrorStorm",
  "chronoEcho",
  "portalComet",
  "crystalLattice",
  "magmaForge",
  "faultChoir",
  "auroraCage",
  "novaRing",
] as const;

export type ExperimentalUltimateId =
  (typeof EXPERIMENTAL_ULTIMATE_IDS)[number];

export type ExperimentalMechanicStrategy =
  | "top-down-column"
  | "gravity-pulses"
  | "reverse-bounce-chain"
  | "trajectory-echoes"
  | "portal-volley"
  | "rock-transmutation"
  | "volcanic-construction"
  | "branching-faults"
  | "triangular-pulses"
  | "annular-wave";

export type ExperimentalFootprintShape =
  | "column"
  | "radial"
  | "node-chain"
  | "trajectory-chain"
  | "portal-pair"
  | "star"
  | "cone-and-volley"
  | "fault-network"
  | "triangle"
  | "annulus";

export type ExperimentalEffectLevel = "full" | "balanced" | "reduced";

export const EXPERIMENTAL_PARTICLE_CAPS = Object.freeze({
  desktop: 600,
  phone: 250,
  reduced: 80,
});

export interface ExperimentalQualityBudget {
  readonly particles: number;
  readonly drawOperations: number;
  readonly lights: number;
  readonly audioVoices: number;
}

export interface ExperimentalUltimateDefinition {
  readonly id: ExperimentalUltimateId;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly icon: string;
  readonly accent: string;
  readonly secondaryAccent: string;
  readonly strategy: ExperimentalMechanicStrategy;
  readonly footprint: {
    readonly shape: ExperimentalFootprintShape;
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

const quality = (
  fullParticles: number,
  balancedParticles: number,
  reducedParticles: number,
  drawOperations: number,
  lights: number,
  audioVoices: number,
): ExperimentalUltimateDefinition["quality"] => ({
  full: {
    particles: fullParticles,
    drawOperations,
    lights,
    audioVoices,
  },
  balanced: {
    particles: balancedParticles,
    drawOperations: Math.ceil(drawOperations * 0.68),
    lights: Math.max(1, Math.ceil(lights * 0.6)),
    audioVoices,
  },
  reduced: {
    particles: reducedParticles,
    drawOperations: Math.max(12, Math.ceil(drawOperations * 0.36)),
    lights: 1,
    audioVoices: Math.min(3, audioVoices),
  },
});

export const EXPERIMENTAL_ULTIMATES = Object.freeze([
  {
    id: "heliosSpire",
    name: "Гелиос-столп",
    shortName: "Гелиос",
    description:
      "Баллистический marker вызывает узкий вертикальный солнечный shaft.",
    icon: "╿",
    accent: "#ffbd45",
    secondaryAccent: "#fff9c9",
    strategy: "top-down-column",
    footprint: {
      shape: "column",
      mechanicalRadius: 18,
      spectacleRadius: 148,
    },
    anticipationMs: 720,
    resolutionMs: 3_150,
    aftermathMs: 3_600,
    testSeed: 51_701,
    distinguishingAxes: [
      "vertical column",
      "single delayed pulse",
      "gold and white",
      "upward embers",
      "top-down camera framing",
    ],
    audioMotif: [880, 1320, 110],
    quality: quality(420, 250, 72, 170, 3, 5),
  },
  {
    id: "gravityCathedral",
    name: "Гравитационный собор",
    shortName: "Собор",
    description:
      "Три импульса втягивают объекты в bounded singularity перед схлопыванием.",
    icon: "◌",
    accent: "#9d7bff",
    secondaryAccent: "#65f6ff",
    strategy: "gravity-pulses",
    footprint: {
      shape: "radial",
      mechanicalRadius: 118,
      spectacleRadius: 250,
    },
    anticipationMs: 860,
    resolutionMs: 4_400,
    aftermathMs: 3_900,
    testSeed: 51_702,
    distinguishingAxes: [
      "concentric lens",
      "three inward pulses",
      "violet and cyan",
      "spiralling debris",
      "collapse then outward release",
    ],
    audioMotif: [92, 138, 620],
    quality: quality(560, 330, 80, 220, 4, 6),
  },
  {
    id: "mirrorStorm",
    name: "Зеркальный шторм",
    shortName: "Зеркало",
    description:
      "Orb оставляет bounce-nodes, которые детонируют в обратном порядке.",
    icon: "◇",
    accent: "#66e8ff",
    secondaryAccent: "#ff65cc",
    strategy: "reverse-bounce-chain",
    footprint: {
      shape: "node-chain",
      mechanicalRadius: 26,
      spectacleRadius: 96,
    },
    anticipationMs: 360,
    resolutionMs: 4_650,
    aftermathMs: 3_200,
    testSeed: 51_703,
    distinguishingAxes: [
      "faceted nodes",
      "reverse detonation rhythm",
      "cyan magenta gold sequence",
      "angular reflected motion",
      "glass-star aftermath",
    ],
    audioMotif: [420, 610, 980],
    quality: quality(480, 290, 76, 210, 3, 7),
  },
  {
    id: "chronoEcho",
    name: "Хроноэхо",
    shortName: "Хроно",
    description:
      "Пять damage-echo возвращаются по фактической траектории к стрелку.",
    icon: "◷",
    accent: "#58e5e8",
    secondaryAccent: "#ffbf69",
    strategy: "trajectory-echoes",
    footprint: {
      shape: "trajectory-chain",
      mechanicalRadius: 24,
      spectacleRadius: 82,
    },
    anticipationMs: 420,
    resolutionMs: 4_250,
    aftermathMs: 3_000,
    testSeed: 51_704,
    distinguishingAxes: [
      "clock ticks",
      "reverse temporal cadence",
      "cyan and amber",
      "backward path motion",
      "single trajectory ribbon",
    ],
    audioMotif: [720, 480, 960],
    quality: quality(410, 245, 70, 190, 2, 6),
  },
  {
    id: "portalComet",
    name: "Портальная комета",
    shortName: "Портал",
    description:
      "Связанная portal-пара переносит seeded веер мини-снарядов.",
    icon: "∞",
    accent: "#ff58c7",
    secondaryAccent: "#5df6c7",
    strategy: "portal-volley",
    footprint: {
      shape: "portal-pair",
      mechanicalRadius: 22,
      spectacleRadius: 132,
    },
    anticipationMs: 600,
    resolutionMs: 4_500,
    aftermathMs: 3_500,
    testSeed: 51_705,
    distinguishingAxes: [
      "contrasting portal shapes",
      "entrance pause then exit fan",
      "magenta and mint",
      "teleporting ribbon movement",
      "flower shockwave",
    ],
    audioMotif: [310, 155, 840],
    quality: quality(500, 300, 78, 230, 4, 7),
  },
  {
    id: "crystalLattice",
    name: "Кристальная решётка",
    shortName: "Решётка",
    description:
      "Шесть лучей преобразуют Soil в Rock и раскалывают внешние tips.",
    icon: "✧",
    accent: "#55f2d0",
    secondaryAccent: "#79b8ff",
    strategy: "rock-transmutation",
    footprint: {
      shape: "star",
      mechanicalRadius: 92,
      spectacleRadius: 168,
    },
    anticipationMs: 520,
    resolutionMs: 3_900,
    aftermathMs: 3_800,
    testSeed: 51_706,
    distinguishingAxes: [
      "six-point wireframe",
      "outward growth",
      "cyan emerald magenta",
      "faceted crystal motion",
      "persistent rock lattice",
    ],
    audioMotif: [510, 765, 1020],
    quality: quality(460, 275, 74, 205, 3, 6),
  },
  {
    id: "magmaForge",
    name: "Магматическая кузница",
    shortName: "Кузница",
    description:
      "Сначала поднимает basalt cone, затем выпускает molten ejecta.",
    icon: "♨",
    accent: "#ff7a2f",
    secondaryAccent: "#70a5ff",
    strategy: "volcanic-construction",
    footprint: {
      shape: "cone-and-volley",
      mechanicalRadius: 112,
      spectacleRadius: 238,
    },
    anticipationMs: 760,
    resolutionMs: 4_850,
    aftermathMs: 4_000,
    testSeed: 51_707,
    distinguishingAxes: [
      "volcanic cone",
      "build then erupt rhythm",
      "orange and cobalt",
      "heavy ballistic droplets",
      "mushroom plume",
    ],
    audioMotif: [78, 126, 540],
    quality: quality(580, 340, 80, 250, 4, 8),
  },
  {
    id: "faultChoir",
    name: "Хор разломов",
    shortName: "Разлом",
    description:
      "Branching fault network режет опоры и осаживает bounded terrain.",
    icon: "≋",
    accent: "#735cff",
    secondaryAccent: "#ffad4f",
    strategy: "branching-faults",
    footprint: {
      shape: "fault-network",
      mechanicalRadius: 138,
      spectacleRadius: 228,
    },
    anticipationMs: 680,
    resolutionMs: 4_900,
    aftermathMs: 3_700,
    testSeed: 51_708,
    distinguishingAxes: [
      "branching underground lines",
      "left-to-right wave rhythm",
      "indigo and amber",
      "seismic propagation",
      "dust-fountain aftermath",
    ],
    audioMotif: [64, 96, 192],
    quality: quality(540, 320, 78, 245, 2, 8),
  },
  {
    id: "auroraCage",
    name: "Клетка Авроры",
    shortName: "Аврора",
    description:
      "Три grounded anchors строят triangular damage и knockback cage.",
    icon: "△",
    accent: "#62f6c5",
    secondaryAccent: "#b573ff",
    strategy: "triangular-pulses",
    footprint: {
      shape: "triangle",
      mechanicalRadius: 108,
      spectacleRadius: 206,
    },
    anticipationMs: 700,
    resolutionMs: 4_300,
    aftermathMs: 3_300,
    testSeed: 51_709,
    distinguishingAxes: [
      "fixed triangle",
      "three rising pulses",
      "mint violet blue",
      "curtain-like vertical motion",
      "directional final knockback",
    ],
    audioMotif: [260, 390, 585],
    quality: quality(520, 310, 76, 225, 4, 7),
  },
  {
    id: "novaRing",
    name: "Кольцо сверхновой",
    shortName: "Nova Ring",
    description:
      "Annular damage-band оставляет безопасный eye и круговую trench.",
    icon: "⊚",
    accent: "#ffdf62",
    secondaryAccent: "#ff66ba",
    strategy: "annular-wave",
    footprint: {
      shape: "annulus",
      mechanicalRadius: 116,
      spectacleRadius: 286,
    },
    anticipationMs: 820,
    resolutionMs: 4_100,
    aftermathMs: 3_900,
    testSeed: 51_710,
    distinguishingAxes: [
      "annular band with quiet eye",
      "single expanding corona",
      "rainbow gold",
      "outward radial motion",
      "persistent circular trench",
    ],
    audioMotif: [180, 360, 1080],
    quality: quality(590, 350, 80, 260, 4, 7),
  },
] as const satisfies readonly ExperimentalUltimateDefinition[]);

export const EXPERIMENTAL_ULTIMATE_BY_ID = Object.freeze(
  EXPERIMENTAL_ULTIMATES.reduce(
    (registry, ultimate) => {
      registry[ultimate.id] = ultimate;
      return registry;
    },
    {} as Record<ExperimentalUltimateId, ExperimentalUltimateDefinition>,
  ),
);

const experimentalIdSet: ReadonlySet<string> = new Set(
  EXPERIMENTAL_ULTIMATE_IDS,
);

export function isExperimentalUltimateId(
  value: string,
): value is ExperimentalUltimateId {
  return experimentalIdSet.has(value);
}

export function getExperimentalUltimate(
  id: ExperimentalUltimateId,
): ExperimentalUltimateDefinition {
  return EXPERIMENTAL_ULTIMATE_BY_ID[id];
}

export interface ExperimentalTankState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly health: number;
  readonly maxHealth: number;
}

export type ExperimentalEvent =
  | {
      readonly type: "phase";
      readonly atMs: number;
      readonly phase: "anticipation" | "deployment" | "culmination" | "aftermath";
    }
  | {
      readonly type: "node";
      readonly atMs: number;
      readonly index: number;
      readonly role:
        | "marker"
        | "pulse"
        | "bounce"
        | "echo"
        | "portal-in"
        | "portal-out"
        | "mini-impact"
        | "crystal-tip"
        | "ejecta"
        | "fault"
        | "anchor"
        | "ring";
      readonly position: Vector2;
      readonly mechanic: boolean;
    }
  | {
      readonly type: "terrain";
      readonly atMs: number;
      readonly operation:
        | "carve"
        | "fill"
        | "transmute"
        | "settle"
        | "annular-carve";
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
      readonly type: "tank-displaced";
      readonly atMs: number;
      readonly tankId: string;
      readonly pulse: number;
      readonly from: Vector2;
      readonly to: Vector2;
    }
  | {
      readonly type: "resolved";
      readonly atMs: number;
      readonly ultimateId: ExperimentalUltimateId;
    };

export interface ExperimentalResolutionInput {
  readonly ultimateId: ExperimentalUltimateId;
  readonly seed: RandomSeed;
  readonly origin: Vector2;
  readonly impact: Vector2;
  readonly direction: ShotDirection;
  readonly terrain: TerrainGrid;
  readonly tanks: readonly ExperimentalTankState[];
}

export interface ExperimentalResolutionResult {
  readonly ultimateId: ExperimentalUltimateId;
  readonly terrain: TerrainGrid;
  readonly tanks: readonly ExperimentalTankState[];
  readonly eventLog: readonly ExperimentalEvent[];
  readonly mechanicPoints: readonly Vector2[];
  readonly durationMs: number;
}

interface MutableExperimentalTank {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
}

interface MutableBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function includeBounds(
  bounds: MutableBounds | null,
  x: number,
  y: number,
): MutableBounds {
  if (bounds === null) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  bounds.minX = Math.min(bounds.minX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.maxY = Math.max(bounds.maxY, y);
  return bounds;
}

function finishBounds(bounds: MutableBounds | null): TerrainBounds | null {
  return bounds === null
    ? null
    : {
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX + 1,
        height: bounds.maxY - bounds.minY + 1,
      };
}

function combineEdits(edits: readonly TerrainEdit[]): TerrainEdit {
  let changedCells = 0;
  let bounds: MutableBounds | null = null;
  for (const edit of edits) {
    changedCells += edit.changedCells;
    if (edit.bounds) {
      bounds = includeBounds(bounds, edit.bounds.x, edit.bounds.y);
      bounds = includeBounds(
        bounds,
        edit.bounds.x + edit.bounds.width - 1,
        edit.bounds.y + edit.bounds.height - 1,
      );
    }
  }
  return { changedCells, bounds: finishBounds(bounds) };
}

function editLine(
  terrain: TerrainGrid,
  start: Vector2,
  end: Vector2,
  radius: number,
  operation: "carve" | "fill",
  material = Material.Soil,
): TerrainEdit {
  const length = Math.max(1, distance(start, end));
  const steps = Math.max(1, Math.ceil(length / Math.max(2, radius * 0.7)));
  const edits: TerrainEdit[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;
    edits.push(
      operation === "carve"
        ? terrain.carveCircle(x, y, radius)
        : terrain.fillCircle(x, y, radius, material),
    );
  }
  return combineEdits(edits);
}

function editAnnulus(
  terrain: TerrainGrid,
  center: Vector2,
  innerRadius: number,
  outerRadius: number,
): TerrainEdit {
  const left = clamp(Math.floor(center.x - outerRadius), 0, terrain.width - 1);
  const right = clamp(Math.ceil(center.x + outerRadius), 0, terrain.width - 1);
  const top = clamp(Math.floor(center.y - outerRadius), 0, terrain.height - 1);
  const bottom = clamp(
    Math.ceil(center.y + outerRadius),
    0,
    terrain.height - 1,
  );
  let changedCells = 0;
  let bounds: MutableBounds | null = null;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const radius = Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y);
      if (
        radius < innerRadius ||
        radius > outerRadius ||
        terrain.get(x, y) === Material.Empty
      ) {
        continue;
      }
      terrain.set(x, y, Material.Empty);
      changedCells += 1;
      bounds = includeBounds(bounds, x, y);
    }
  }
  return { changedCells, bounds: finishBounds(bounds) };
}

function transmuteStar(
  terrain: TerrainGrid,
  center: Vector2,
  radius: number,
): TerrainEdit {
  let changedCells = 0;
  let bounds: MutableBounds | null = null;
  for (let ray = 0; ray < 6; ray += 1) {
    const angle = (Math.PI * 2 * ray) / 6 - Math.PI / 2;
    const end = {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
    const steps = Math.ceil(radius / 3);
    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const x = Math.round(center.x + (end.x - center.x) * progress);
      const y = Math.round(center.y + (end.y - center.y) * progress);
      for (let offsetY = -2; offsetY <= 2; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          if (
            Math.hypot(offsetX, offsetY) > 2.4 ||
            terrain.get(x + offsetX, y + offsetY) !== Material.Soil
          ) {
            continue;
          }
          terrain.set(x + offsetX, y + offsetY, Material.Rock);
          changedCells += 1;
          bounds = includeBounds(bounds, x + offsetX, y + offsetY);
        }
      }
    }
  }
  return { changedCells, bounds: finishBounds(bounds) };
}

function fillCone(
  terrain: TerrainGrid,
  center: Vector2,
  halfWidth: number,
  height: number,
): TerrainEdit {
  const edits: TerrainEdit[] = [];
  const layers = Math.ceil(height / 5);
  for (let layer = 0; layer <= layers; layer += 1) {
    const progress = layer / Math.max(1, layers);
    const y = center.y - progress * height;
    const radius = Math.max(3, halfWidth * (1 - progress) * 0.32);
    const width = halfWidth * (1 - progress);
    const steps = Math.max(1, Math.ceil(width / Math.max(3, radius)));
    for (let step = -steps; step <= steps; step += 1) {
      edits.push(
        terrain.fillCircle(
          center.x + (step / steps) * width,
          y,
          radius,
          progress > 0.75 ? Material.Rock : Material.Soil,
        ),
      );
    }
  }
  return combineEdits(edits);
}

function damageTank(
  events: ExperimentalEvent[],
  tank: MutableExperimentalTank,
  amount: number,
  atMs: number,
): void {
  const applied = Math.max(0, Math.min(tank.health, amount));
  if (applied <= 0) {
    return;
  }
  tank.health -= applied;
  events.push({
    type: "tank-damaged",
    atMs,
    tankId: tank.id,
    amount: applied,
    remainingHealth: tank.health,
  });
}

function damageNear(
  events: ExperimentalEvent[],
  tanks: MutableExperimentalTank[],
  center: Vector2,
  radius: number,
  peakDamage: number,
  atMs: number,
): void {
  for (const tank of tanks) {
    const proximity = distance(center, tank);
    if (proximity > radius + 14) {
      continue;
    }
    const falloff = 1 - proximity / Math.max(1, radius + 14);
    damageTank(events, tank, peakDamage * (0.24 + falloff * 0.76), atMs);
  }
}

function moveTank(
  events: ExperimentalEvent[],
  terrain: TerrainGrid,
  tank: MutableExperimentalTank,
  nextX: number,
  pulse: number,
  atMs: number,
): void {
  const from = { x: tank.x, y: tank.y };
  tank.x = clamp(nextX, 12, terrain.width - 12);
  tank.y = (terrain.surfaceY(tank.x) ?? terrain.height - 12) - 11;
  events.push({
    type: "tank-displaced",
    atMs,
    tankId: tank.id,
    pulse,
    from,
    to: { x: tank.x, y: tank.y },
  });
}

function settleTankHeights(
  terrain: TerrainGrid,
  tanks: MutableExperimentalTank[],
): void {
  for (const tank of tanks) {
    tank.y = (terrain.surfaceY(tank.x) ?? terrain.height - 12) - 11;
  }
}

function pointInTriangle(
  point: Vector2,
  a: Vector2,
  b: Vector2,
  c: Vector2,
): boolean {
  const sign = (p1: Vector2, p2: Vector2, p3: Vector2) =>
    (p1.x - p3.x) * (p2.y - p3.y) -
    (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = sign(point, a, b);
  const d2 = sign(point, b, c);
  const d3 = sign(point, c, a);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

function terrainEvent(
  events: ExperimentalEvent[],
  atMs: number,
  operation: Extract<ExperimentalEvent, { type: "terrain" }>["operation"],
  edit: TerrainEdit,
): void {
  events.push({
    type: "terrain",
    atMs,
    operation,
    changedCells: edit.changedCells,
    bounds: edit.bounds,
  });
}

function nodeEvent(
  events: ExperimentalEvent[],
  mechanicPoints: Vector2[],
  atMs: number,
  index: number,
  role: Extract<ExperimentalEvent, { type: "node" }>["role"],
  position: Vector2,
  mechanic = true,
): void {
  events.push({ type: "node", atMs, index, role, position, mechanic });
  if (mechanic) {
    mechanicPoints.push(position);
  }
}

/**
 * Pure, bounded resolution for the Experimental registry. The input terrain
 * and tanks are never mutated. Presentation consumes the returned event log
 * but cannot alter the returned mechanical result.
 */
export function resolveExperimentalUltimate(
  input: ExperimentalResolutionInput,
): ExperimentalResolutionResult {
  const definition = getExperimentalUltimate(input.ultimateId);
  const terrain = input.terrain.clone();
  const tanks: MutableExperimentalTank[] = input.tanks.map((tank) => ({
    ...tank,
  }));
  const events: ExperimentalEvent[] = [
    { type: "phase", atMs: 0, phase: "anticipation" },
  ];
  const mechanicPoints: Vector2[] = [];
  const random = new SeededRandom(
    `${input.seed}:${input.ultimateId}:mechanics`,
  );
  const impact = {
    x: clamp(input.impact.x, 8, terrain.width - 8),
    y: clamp(input.impact.y, 8, terrain.height - 8),
  };

  events.push({
    type: "phase",
    atMs: definition.anticipationMs,
    phase: "deployment",
  });

  switch (input.ultimateId) {
    case "heliosSpire": {
      nodeEvent(events, mechanicPoints, 820, 0, "marker", impact);
      const shaft = editLine(
        terrain,
        { x: impact.x, y: 0 },
        impact,
        11,
        "carve",
      );
      const crater = terrain.carveCircle(impact.x, impact.y, 28);
      terrainEvent(events, 1_720, "carve", combineEdits([shaft, crater]));
      for (const tank of tanks) {
        if (Math.abs(tank.x - impact.x) <= 18) {
          damageTank(events, tank, 118, 1_720);
        }
      }
      break;
    }
    case "gravityCathedral": {
      nodeEvent(events, mechanicPoints, 760, 0, "marker", impact);
      for (let pulse = 1; pulse <= 3; pulse += 1) {
        nodeEvent(events, mechanicPoints, 900 + pulse * 420, pulse, "pulse", impact);
        for (const tank of tanks) {
          const delta = impact.x - tank.x;
          if (Math.abs(delta) <= 138) {
            moveTank(
              events,
              terrain,
              tank,
              tank.x + Math.sign(delta) * Math.min(Math.abs(delta), 13 + pulse * 4),
              pulse,
              900 + pulse * 420,
            );
          }
        }
      }
      const crater = terrain.carveCircle(impact.x, impact.y, 62);
      terrainEvent(events, 2_560, "carve", crater);
      const settle = terrain.settle({
        maxPasses: 8,
        maxMoves: 14_000,
        bounds: {
          x: impact.x - 96,
          y: impact.y - 94,
          width: 192,
          height: 188,
        },
        movableMaterials: [Material.Soil],
      });
      terrainEvent(events, 2_720, "settle", settle);
      damageNear(events, tanks, impact, 94, 74, 2_760);
      for (const tank of tanks) {
        const delta = tank.x - impact.x || input.direction;
        if (Math.abs(delta) <= 118) {
          moveTank(
            events,
            terrain,
            tank,
            tank.x + Math.sign(delta) * 28,
            4,
            2_820,
          );
        }
      }
      break;
    }
    case "mirrorStorm": {
      const bounceCount = random.integer(4, 7);
      const nodes: Vector2[] = [];
      for (let index = 0; index < bounceCount; index += 1) {
        const offsetDirection = index % 2 === 0 ? input.direction : -input.direction;
        const x = clamp(
          impact.x + offsetDirection * (44 + index * 31),
          12,
          terrain.width - 12,
        );
        const y = (terrain.surfaceY(x) ?? impact.y) - 3;
        const node = { x, y };
        nodes.push(node);
        nodeEvent(events, mechanicPoints, 780 + index * 260, index, "bounce", node);
      }
      [...nodes].reverse().forEach((node, reverseIndex) => {
        const edit = terrain.carveCircle(node.x, node.y, 22);
        const atMs = 2_350 + reverseIndex * 210;
        terrainEvent(events, atMs, "carve", edit);
        damageNear(events, tanks, node, 26, 31, atMs);
      });
      break;
    }
    case "chronoEcho": {
      const nodes: Vector2[] = [];
      for (let index = 0; index < 5; index += 1) {
        const progress = (index + 1) / 6;
        nodes.push({
          x: input.origin.x + (impact.x - input.origin.x) * progress,
          y:
            input.origin.y +
            (impact.y - input.origin.y) * progress -
            Math.sin(progress * Math.PI) * Math.min(94, distance(input.origin, impact) * 0.18),
        });
      }
      [...nodes, impact].reverse().forEach((node, index) => {
        const atMs = 1_760 + index * 250;
        nodeEvent(events, mechanicPoints, atMs, index, "echo", node);
        const edit = terrain.carveCircle(node.x, node.y, 14);
        terrainEvent(events, atMs, "carve", edit);
        damageNear(events, tanks, node, 24, 27, atMs);
      });
      break;
    }
    case "portalComet": {
      const entrance = impact;
      const desiredExitX = impact.x + input.direction * 188;
      const fallback =
        desiredExitX < 28 || desiredExitX > terrain.width - 28;
      const exitX = fallback
        ? clamp(terrain.width - impact.x, 28, terrain.width - 28)
        : desiredExitX;
      const exit = {
        x: exitX,
        y: (terrain.surfaceY(exitX) ?? impact.y) - 10,
      };
      nodeEvent(events, mechanicPoints, 820, 0, "portal-in", entrance);
      nodeEvent(events, mechanicPoints, 1_320, 1, "portal-out", exit);
      for (let index = 0; index < 6; index += 1) {
        const offset = (index - 2.5) * 24 + random.float(-6, 7);
        const x = clamp(exit.x + offset, 8, terrain.width - 8);
        const node = {
          x,
          y: (terrain.surfaceY(x) ?? exit.y) - 2,
        };
        const atMs = 1_780 + index * 150;
        nodeEvent(events, mechanicPoints, atMs, index + 2, "mini-impact", node);
        terrainEvent(events, atMs, "carve", terrain.carveCircle(node.x, node.y, 18));
        damageNear(events, tanks, node, 22, 24, atMs);
      }
      break;
    }
    case "crystalLattice": {
      nodeEvent(events, mechanicPoints, 760, 0, "marker", impact);
      const transmuted = transmuteStar(terrain, impact, 92);
      terrainEvent(events, 1_620, "transmute", transmuted);
      for (let ray = 0; ray < 6; ray += 1) {
        const angle = (Math.PI * 2 * ray) / 6 - Math.PI / 2;
        const tip = {
          x: impact.x + Math.cos(angle) * 92,
          y: impact.y + Math.sin(angle) * 92,
        };
        nodeEvent(events, mechanicPoints, 1_850 + ray * 90, ray, "crystal-tip", tip);
        if (ray % 2 === 1) {
          terrainEvent(
            events,
            2_450 + ray * 70,
            "carve",
            terrain.carveCircle(tip.x, tip.y, 14),
          );
          damageNear(events, tanks, tip, 18, 20, 2_450 + ray * 70);
        }
      }
      break;
    }
    case "magmaForge": {
      nodeEvent(events, mechanicPoints, 720, 0, "marker", impact);
      const cone = fillCone(terrain, impact, 82, 84);
      terrainEvent(events, 1_720, "fill", cone);
      for (let index = 0; index < 6; index += 1) {
        const offset = (index - 2.5) * 34 + random.float(-10, 11);
        const x = clamp(impact.x + offset, 8, terrain.width - 8);
        const ejecta = {
          x,
          y: (terrain.surfaceY(x) ?? impact.y) - 2,
        };
        const atMs = 2_180 + index * 180;
        nodeEvent(events, mechanicPoints, atMs, index, "ejecta", ejecta);
        terrainEvent(
          events,
          atMs,
          "carve",
          terrain.carveCircle(ejecta.x, ejecta.y, 16),
        );
        damageNear(events, tanks, ejecta, 21, 23, atMs);
      }
      break;
    }
    case "faultChoir": {
      nodeEvent(events, mechanicPoints, 720, 0, "marker", impact);
      const edits: TerrainEdit[] = [];
      for (let branch = 0; branch < 5; branch += 1) {
        const spread = (branch - 2) * 0.34 + random.float(-0.08, 0.09);
        const endX = clamp(
          impact.x + input.direction * (112 + branch * 11),
          8,
          terrain.width - 8,
        );
        const end = {
          x: endX,
          y: clamp(impact.y + 52 + Math.abs(spread) * 70, 8, terrain.height - 8),
        };
        nodeEvent(events, mechanicPoints, 1_050 + branch * 230, branch, "fault", end);
        edits.push(editLine(terrain, impact, end, 6 + (branch % 2), "carve"));
      }
      terrainEvent(events, 2_340, "carve", combineEdits(edits));
      const settle = terrain.settle({
        maxPasses: 10,
        maxMoves: 18_000,
        bounds: {
          x: impact.x - 146,
          y: impact.y - 30,
          width: 292,
          height: 190,
        },
        movableMaterials: [Material.Soil],
      });
      terrainEvent(events, 2_720, "settle", settle);
      settleTankHeights(terrain, tanks);
      break;
    }
    case "auroraCage": {
      const anchors = [
        { x: impact.x, y: impact.y - 104 },
        { x: impact.x - 96, y: impact.y + 58 },
        { x: impact.x + 96, y: impact.y + 58 },
      ].map((point) => ({
        x: clamp(point.x, 8, terrain.width - 8),
        y: clamp(point.y, 8, terrain.height - 8),
      })) as [Vector2, Vector2, Vector2];
      anchors.forEach((anchor, index) =>
        nodeEvent(events, mechanicPoints, 920 + index * 210, index, "anchor", anchor),
      );
      for (let pulse = 1; pulse <= 3; pulse += 1) {
        const atMs = 1_760 + pulse * 430;
        nodeEvent(events, mechanicPoints, atMs, pulse, "pulse", impact, false);
        for (const tank of tanks) {
          if (pointInTriangle(tank, anchors[0], anchors[1], anchors[2])) {
            damageTank(events, tank, 16 + pulse * 8, atMs);
            if (pulse === 3) {
              const delta = tank.x - impact.x || input.direction;
              moveTank(
                events,
                terrain,
                tank,
                tank.x + Math.sign(delta) * 54,
                pulse,
                atMs + 30,
              );
            }
          }
        }
      }
      for (const anchor of anchors) {
        terrainEvent(
          events,
          1_520,
          "fill",
          terrain.fillCircle(anchor.x, anchor.y, 3, Material.Rock),
        );
      }
      break;
    }
    case "novaRing": {
      nodeEvent(events, mechanicPoints, 840, 0, "ring", impact);
      const innerRadius = 48;
      const outerRadius = 116;
      terrainEvent(
        events,
        1_940,
        "annular-carve",
        editAnnulus(terrain, impact, innerRadius, outerRadius),
      );
      for (const tank of tanks) {
        const radius = distance(impact, tank);
        if (radius >= innerRadius - 12 && radius <= outerRadius + 14) {
          const bandCenter = (innerRadius + outerRadius) / 2;
          const bandDistance = Math.abs(radius - bandCenter);
          damageTank(
            events,
            tank,
            92 * (1 - bandDistance / (bandCenter - innerRadius + 22)),
            1_940,
          );
          const delta = tank.x - impact.x || input.direction;
          moveTank(
            events,
            terrain,
            tank,
            tank.x + Math.sign(delta) * 62,
            1,
            2_020,
          );
        }
      }
      break;
    }
  }

  settleTankHeights(terrain, tanks);
  events.push({
    type: "phase",
    atMs: definition.resolutionMs - 500,
    phase: "culmination",
  });
  events.push({
    type: "phase",
    atMs: definition.resolutionMs,
    phase: "aftermath",
  });
  events.push({
    type: "resolved",
    atMs: definition.resolutionMs,
    ultimateId: input.ultimateId,
  });

  return {
    ultimateId: input.ultimateId,
    terrain,
    tanks,
    eventLog: events,
    mechanicPoints,
    durationMs: definition.resolutionMs + definition.aftermathMs,
  };
}
