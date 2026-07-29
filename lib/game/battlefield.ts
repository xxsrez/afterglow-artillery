import {
  createBattlefieldPlan,
  DEFAULT_BATTLEFIELD_LAYOUT_RULES,
  type BattlefieldLayoutProfile,
  type BattlefieldLayoutRules,
  type BattlefieldPlan,
  type BattlefieldSpawnKind,
  type BattlefieldSpawnRole,
} from "./battlefield-layout";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import type { RandomSeed } from "./random";
import {
  generateTerrain,
  Material,
  prepareSurfaceSpawnShelf,
  type SpawnSite,
  type TerrainGenerationOptions,
  type TerrainGrid,
} from "./terrain";

export interface BattlefieldSpawn extends SpawnSite {
  readonly kind: BattlefieldSpawnKind;
}

export interface BattlefieldTopologyMetrics {
  readonly relief: number;
  readonly ridgeHeight: number;
  readonly basinDepth: number;
  readonly featureWidth: number;
  readonly horizontalSeparation: number;
  readonly verticalSeparation: number;
}

export interface BattlefieldSpawnMetadata {
  readonly kind: BattlefieldSpawnKind;
  readonly openSky: boolean;
  readonly supportDepth: number;
  readonly headroom: number;
  readonly roofThickness: number;
  readonly mouthConnected: boolean;
  readonly firingExit: boolean;
}

export interface BattlefieldGenerationMetadata {
  readonly profile: BattlefieldLayoutProfile;
  readonly attempt: number;
  readonly fallbackReason: string | null;
  readonly topology: BattlefieldTopologyMetrics;
  readonly spawns: readonly [
    BattlefieldSpawnMetadata,
    BattlefieldSpawnMetadata,
  ];
}

export interface Battlefield {
  readonly terrain: TerrainGrid;
  readonly spawns: readonly [BattlefieldSpawn, BattlefieldSpawn];
  readonly plan: BattlefieldPlan;
  readonly metadata: BattlefieldGenerationMetadata;
}

export interface BattlefieldGenerationOptions
  extends TerrainGenerationOptions {
  /** One-based round number within a match. */
  readonly roundNumber?: number;
  /** Deterministic fixture/debug override. Normal matches use ruleset weights. */
  readonly layoutProfile?: BattlefieldLayoutProfile;
  /** Typed layout weights, retry bounds and topology thresholds. */
  readonly layoutRules?: BattlefieldLayoutRules;
  /** Empty margin between a spawn shelf and the open side of the world. */
  readonly spawnEdgeMargin?: number;
  /** Required horizontal distance between the two tank centers. */
  readonly minSpawnSeparation?: number;
  /** Flat solid half-width prepared for each tank. */
  readonly spawnPadHalfWidth?: number;
  /** Tank center offset above its first support row. */
  readonly tankHalfHeight?: number;
  /** Maximum unsculpted height variation accepted for a preferred site. */
  readonly maxSpawnSurfaceDelta?: number;
}

interface SurfaceCandidate {
  readonly x: number;
  readonly localScore: number;
}

interface CaveConstruction {
  readonly spawn: BattlefieldSpawn;
  readonly floorY: number;
  readonly firingDirection: -1 | 1;
  readonly tunnelPoints: readonly SpawnSite[];
}

interface AttemptResult {
  readonly terrain: TerrainGrid;
  readonly spawns: readonly [BattlefieldSpawn, BattlefieldSpawn];
  readonly metadata: BattlefieldGenerationMetadata;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function terrainOptionsForProfile(
  profile: BattlefieldLayoutProfile,
  options: TerrainGenerationOptions,
): TerrainGenerationOptions {
  const width = options.width ?? WORLD_WIDTH;
  const height = options.height ?? WORLD_HEIGHT;
  const defaults: Record<
    BattlefieldLayoutProfile,
    Pick<
      TerrainGenerationOptions,
      "minSurfaceY" | "maxSurfaceY" | "controlPointSpacing" | "roughness"
    >
  > = {
    open: {
      minSurfaceY: Math.round(height * 0.43),
      maxSurfaceY: Math.round(height * 0.62),
      controlPointSpacing: Math.max(64, Math.round(width / 10)),
      roughness: Math.max(8, height * 0.048),
    },
    ridge: {
      minSurfaceY: Math.round(height * 0.48),
      maxSurfaceY: Math.round(height * 0.64),
      controlPointSpacing: Math.max(64, Math.round(width / 12)),
      roughness: Math.max(8, height * 0.04),
    },
    valley: {
      minSurfaceY: Math.round(height * 0.36),
      maxSurfaceY: Math.round(height * 0.53),
      controlPointSpacing: Math.max(64, Math.round(width / 12)),
      roughness: Math.max(8, height * 0.042),
    },
    cavern: {
      minSurfaceY: Math.round(height * 0.39),
      maxSurfaceY: Math.round(height * 0.59),
      controlPointSpacing: Math.max(58, Math.round(width / 13)),
      roughness: Math.max(8, height * 0.052),
    },
  };

  return {
    ...defaults[profile],
    ...options,
  };
}

function setSurfaceColumn(
  terrain: TerrainGrid,
  x: number,
  targetSurface: number,
): void {
  const originalSurface =
    terrain.surfaceY(x) ?? Math.round(terrain.height * 0.5);
  const surface = clamp(Math.round(targetSurface), 1, terrain.height - 2);

  for (let y = 0; y < surface; y += 1) {
    terrain.set(x, y, Material.Empty);
  }

  const supportBottom = Math.min(
    terrain.height,
    Math.max(
      originalSurface + 1,
      surface + Math.max(18, Math.round(terrain.height * 0.045)),
    ),
  );
  for (let y = surface; y < supportBottom; y += 1) {
    if (terrain.get(x, y) !== Material.Rock) {
      terrain.set(x, y, Material.Soil);
    }
  }
}

function applyMacroSurface(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
): void {
  if (plan.profile === "open" || plan.profile === "cavern") {
    return;
  }

  const centerX = plan.macro.centerXRatio * (terrain.width - 1);
  const halfWidth = Math.max(
    1,
    (plan.macro.widthRatio * terrain.width) / 2,
  );
  const leftX = clamp(Math.round(centerX - halfWidth), 0, terrain.width - 1);
  const rightX = clamp(Math.round(centerX + halfWidth), 0, terrain.width - 1);
  const leftSurface =
    terrain.surfaceY(leftX) ?? Math.round(terrain.height * 0.5);
  const rightSurface =
    terrain.surfaceY(rightX) ?? Math.round(terrain.height * 0.5);
  const amplitude = Math.round(plan.macro.amplitudeRatio * terrain.height);
  const sign = plan.profile === "ridge" ? -1 : 1;

  for (let x = leftX; x <= rightX; x += 1) {
    const across = (x - leftX) / Math.max(1, rightX - leftX);
    const baseline = leftSurface + (rightSurface - leftSurface) * across;
    const envelope = Math.sin(across * Math.PI) ** 2;
    setSurfaceColumn(
      terrain,
      x,
      Math.round(baseline + sign * amplitude * envelope),
    );
  }
}

function localSurfaceScore(
  terrain: TerrainGrid,
  centerX: number,
  halfWidth: number,
  maxDelta: number,
): number | null {
  const values: number[] = [];
  for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += 1) {
    const surface = terrain.surfaceY(x);
    if (surface === null) {
      return null;
    }
    values.push(surface);
  }

  const delta = Math.max(...values) - Math.min(...values);
  return delta <= maxDelta ? delta : null;
}

function surfaceCandidates(
  terrain: TerrainGrid,
  side: "left" | "right",
  edgeMargin: number,
  padHalfWidth: number,
  maxDelta: number,
): readonly SurfaceCandidate[] {
  const bandLeft =
    side === "left"
      ? edgeMargin
      : Math.min(terrain.width - edgeMargin, Math.ceil(terrain.width * 0.64));
  const bandRight =
    side === "left"
      ? Math.max(edgeMargin, Math.floor(terrain.width * 0.36))
      : terrain.width - edgeMargin;
  const target = terrain.width * (side === "left" ? 0.2 : 0.8);
  const candidates: SurfaceCandidate[] = [];

  for (let x = Math.ceil(bandLeft); x <= Math.floor(bandRight); x += 4) {
    const localDelta = localSurfaceScore(
      terrain,
      x,
      padHalfWidth,
      maxDelta,
    );
    if (localDelta === null) {
      continue;
    }
    candidates.push({
      x,
      localScore: localDelta * 14 + Math.abs(x - target) * 0.04,
    });
  }

  candidates.sort(
    (left, right) =>
      left.localScore - right.localScore || left.x - right.x,
  );
  if (candidates.length > 0) {
    return candidates.slice(0, 32);
  }

  return [{
    x: clamp(Math.round(target), bandLeft, bandRight),
    localScore: 10_000,
  }];
}

function intervalTopology(
  terrain: TerrainGrid,
  leftX: number,
  rightX: number,
): Omit<
  BattlefieldTopologyMetrics,
  "featureWidth" | "horizontalSeparation" | "verticalSeparation"
> {
  const step = Math.max(4, Math.round((rightX - leftX) / 160));
  const all: number[] = [];
  const center: number[] = [];
  const leftSurface =
    terrain.surfaceY(leftX) ?? Math.round(terrain.height * 0.5);
  const rightSurface =
    terrain.surfaceY(rightX) ?? Math.round(terrain.height * 0.5);

  for (let x = leftX; x <= rightX; x += step) {
    const surface = terrain.surfaceY(x);
    if (surface === null) {
      continue;
    }
    all.push(surface);
    const progress = (x - leftX) / Math.max(1, rightX - leftX);
    if (progress >= 0.35 && progress <= 0.65) {
      center.push(surface);
    }
  }

  const endpointMean = (leftSurface + rightSurface) / 2;
  const centerMean = average(center);
  return {
    relief: all.length === 0 ? 0 : Math.max(...all) - Math.min(...all),
    ridgeHeight: Math.max(0, endpointMean - centerMean),
    basinDepth: Math.max(0, centerMean - endpointMean),
  };
}

function pairProfileScore(
  profile: BattlefieldLayoutProfile,
  topology: ReturnType<typeof intervalTopology>,
): number {
  switch (profile) {
    case "ridge":
      return -topology.ridgeHeight * 8 - topology.relief * 0.4;
    case "valley":
      return -topology.basinDepth * 8 - topology.relief * 0.4;
    case "open":
      return topology.relief * 1.6;
    case "cavern":
      return 0;
  }
}

function prepareSurfacePair(
  terrain: TerrainGrid,
  profile: BattlefieldLayoutProfile,
  options: {
    readonly edgeMargin: number;
    readonly minSeparation: number;
    readonly padHalfWidth: number;
    readonly tankHalfHeight: number;
    readonly maxSurfaceDelta: number;
  },
): readonly [BattlefieldSpawn, BattlefieldSpawn] {
  const leftCandidates = surfaceCandidates(
    terrain,
    "left",
    options.edgeMargin,
    options.padHalfWidth,
    options.maxSurfaceDelta,
  );
  const rightCandidates = surfaceCandidates(
    terrain,
    "right",
    options.edgeMargin,
    options.padHalfWidth,
    options.maxSurfaceDelta,
  );
  let best:
    | {
        readonly left: SurfaceCandidate;
        readonly right: SurfaceCandidate;
        readonly score: number;
      }
    | undefined;

  for (const left of leftCandidates) {
    for (const right of rightCandidates) {
      const separation = right.x - left.x;
      if (separation < options.minSeparation) {
        continue;
      }
      const topology = intervalTopology(terrain, left.x, right.x);
      const score =
        left.localScore +
        right.localScore +
        pairProfileScore(profile, topology) +
        Math.abs(separation - terrain.width * 0.6) * 0.01;
      if (
        best === undefined ||
        score < best.score ||
        (score === best.score && left.x < best.left.x)
      ) {
        best = { left, right, score };
      }
    }
  }

  const leftX = best?.left.x ?? Math.round(terrain.width * 0.2);
  const rightX = best?.right.x ?? Math.round(terrain.width * 0.8);
  const leftSupport = prepareSurfaceSpawnShelf(
    terrain,
    leftX,
    options.padHalfWidth,
  );
  const rightSupport = prepareSurfaceSpawnShelf(
    terrain,
    rightX,
    options.padHalfWidth,
  );

  return [
    {
      x: leftX,
      y: leftSupport - options.tankHalfHeight,
      kind: "surface",
    },
    {
      x: rightX,
      y: rightSupport - options.tankHalfHeight,
      kind: "surface",
    },
  ];
}

function pickSurfaceX(
  terrain: TerrainGrid,
  role: BattlefieldSpawnRole,
  edgeMargin: number,
  padHalfWidth: number,
  maxSurfaceDelta: number,
): number {
  return (
    surfaceCandidates(
      terrain,
      role.side,
      edgeMargin,
      padHalfWidth,
      maxSurfaceDelta,
    )[0]?.x ?? Math.round(terrain.width * role.preferredXRatio)
  );
}

function carveTacticalCave(
  terrain: TerrainGrid,
  role: BattlefieldSpawnRole,
  rules: BattlefieldLayoutRules,
  options: {
    readonly padHalfWidth: number;
    readonly tankHalfHeight: number;
    readonly bedrockDepth: number;
  },
): CaveConstruction {
  const x = clamp(
    Math.round(terrain.width * role.preferredXRatio),
    options.padHalfWidth + 8,
    terrain.width - options.padHalfWidth - 9,
  );
  const surfaceY = terrain.surfaceY(x) ?? Math.round(terrain.height * 0.45);
  const bedrockStart = terrain.height - options.bedrockDepth;
  const roofTarget = Math.max(
    22,
    Math.round(terrain.height * rules.caveRoofMinRatio),
  );
  const headroom = Math.max(
    62,
    Math.round(terrain.height * rules.caveHeadroomRatio),
  );
  const floorY = clamp(
    surfaceY + roofTarget + headroom + 8,
    surfaceY + roofTarget + headroom,
    bedrockStart - 20,
  );
  const chamberCenterY = floorY - headroom * 0.5;
  const chamberRadius = headroom * 0.52;
  const chamberHalfWidth = Math.max(
    options.padHalfWidth + 22,
    Math.min(94, Math.round(terrain.width * 0.045)),
  );

  for (
    let chamberX = x - chamberHalfWidth;
    chamberX <= x + chamberHalfWidth;
    chamberX += Math.max(16, chamberRadius * 0.62)
  ) {
    terrain.carveCircle(chamberX, chamberCenterY, chamberRadius);
  }
  terrain.carveCircle(x + chamberHalfWidth, chamberCenterY, chamberRadius);

  const spawn: BattlefieldSpawn = {
    x,
    y: floorY - options.tankHalfHeight,
    kind: "cave",
  };
  const tunnelRadius = Math.max(17, Math.round(terrain.height * 0.04));
  const angle = (48 * Math.PI) / 180;
  const start: SpawnSite = {
    x: spawn.x + role.firingDirection * 12,
    y: spawn.y - 5,
  };
  const tunnelPoints: SpawnSite[] = [];
  const maxDistance = Math.min(360, terrain.width * 0.18);
  let openedToSky = false;

  for (
    let distance = 0;
    distance <= maxDistance;
    distance += Math.max(7, tunnelRadius * 0.52)
  ) {
    const point = {
      x: start.x + role.firingDirection * Math.cos(angle) * distance,
      y: start.y - Math.sin(angle) * distance,
    };
    if (point.x < 2 || point.x >= terrain.width - 2 || point.y < 2) {
      break;
    }
    const surfaceBeforeCarve = terrain.surfaceY(point.x);
    terrain.carveCircle(point.x, point.y, tunnelRadius);
    tunnelPoints.push(point);
    if (
      surfaceBeforeCarve !== null &&
      point.y - tunnelRadius <= surfaceBeforeCarve
    ) {
      openedToSky = true;
      terrain.carveCircle(
        point.x,
        Math.min(point.y, surfaceBeforeCarve - tunnelRadius * 0.35),
        tunnelRadius * 1.08,
      );
      break;
    }
  }

  if (!openedToSky) {
    const last = tunnelPoints.at(-1) ?? start;
    for (
      let y = last.y;
      y >= 0;
      y -= Math.max(7, tunnelRadius * 0.55)
    ) {
      terrain.carveCircle(last.x, y, tunnelRadius);
    }
  }

  for (
    let shelfX = x - options.padHalfWidth;
    shelfX <= x + options.padHalfWidth;
    shelfX += 1
  ) {
    for (let y = floorY - Math.round(headroom * 0.78); y < floorY; y += 1) {
      terrain.set(shelfX, y, Material.Empty);
    }
    for (let y = floorY; y < Math.min(floorY + 16, bedrockStart); y += 1) {
      if (terrain.get(shelfX, y) !== Material.Rock) {
        terrain.set(shelfX, y, Material.Soil);
      }
    }
  }

  return {
    spawn,
    floorY,
    firingDirection: role.firingDirection,
    tunnelPoints,
  };
}

function prepareCavernSpawns(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
  rules: BattlefieldLayoutRules,
  options: {
    readonly edgeMargin: number;
    readonly padHalfWidth: number;
    readonly tankHalfHeight: number;
    readonly maxSurfaceDelta: number;
    readonly bedrockDepth: number;
  },
): {
  readonly spawns: readonly [BattlefieldSpawn, BattlefieldSpawn];
  readonly caves: readonly (CaveConstruction | null)[];
} {
  const spawns: BattlefieldSpawn[] = [];
  const caves: (CaveConstruction | null)[] = [];

  for (const role of plan.spawnRoles) {
    if (role.kind === "cave") {
      const cave = carveTacticalCave(terrain, role, rules, options);
      spawns.push(cave.spawn);
      caves.push(cave);
      continue;
    }

    const x = pickSurfaceX(
      terrain,
      role,
      options.edgeMargin,
      options.padHalfWidth,
      options.maxSurfaceDelta,
    );
    const supportY = prepareSurfaceSpawnShelf(
      terrain,
      x,
      options.padHalfWidth,
    );
    spawns.push({
      x,
      y: supportY - options.tankHalfHeight,
      kind: "surface",
    });
    caves.push(null);
  }

  const left = spawns[0];
  const right = spawns[1];
  if (left === undefined || right === undefined) {
    throw new Error("Cavern generation requires exactly two spawn roles.");
  }
  return { spawns: [left, right], caves };
}

function isOpenToSky(
  terrain: TerrainGrid,
  x: number,
  y: number,
): boolean {
  const cellX = Math.floor(x);
  const lastY = Math.floor(y);
  if (cellX < 0 || cellX >= terrain.width || lastY < 0) {
    return true;
  }
  for (let scanY = 0; scanY <= lastY; scanY += 1) {
    if (terrain.isSolid(cellX, scanY)) {
      return false;
    }
  }
  return true;
}

function clearFiringExit(
  terrain: TerrainGrid,
  spawn: BattlefieldSpawn,
  direction: -1 | 1,
): boolean {
  const angle = (48 * Math.PI) / 180;
  for (let distance = 12; distance <= 380; distance += 3) {
    const x = spawn.x + direction * Math.cos(angle) * distance;
    const y = spawn.y - 5 - Math.sin(angle) * distance;
    if (x < 0 || x >= terrain.width || y < 0) {
      return true;
    }
    if (terrain.isSolid(x, y)) {
      return false;
    }
    if (distance >= 48 && isOpenToSky(terrain, x, y)) {
      return true;
    }
  }
  return false;
}

function inspectSpawn(
  terrain: TerrainGrid,
  spawn: BattlefieldSpawn,
  cave: CaveConstruction | null,
  padHalfWidth: number,
  tankHalfHeight: number,
): BattlefieldSpawnMetadata {
  const supportY = spawn.y + tankHalfHeight;
  let supportDepth = 0;
  for (let y = supportY; y < terrain.height; y += 1) {
    if (!terrain.isSolid(spawn.x, y)) {
      break;
    }
    supportDepth += 1;
  }

  if (spawn.kind === "surface") {
    return {
      kind: "surface",
      openSky: isOpenToSky(terrain, spawn.x, spawn.y),
      supportDepth,
      headroom: spawn.y,
      roofThickness: 0,
      mouthConnected: true,
      firingExit: true,
    };
  }

  let ceilingY = -1;
  for (let y = Math.floor(spawn.y) - 1; y >= 0; y -= 1) {
    if (terrain.isSolid(spawn.x, y)) {
      ceilingY = y;
      break;
    }
  }
  const roofSurface = terrain.surfaceY(spawn.x);
  let roofBottom = roofSurface ?? -1;
  if (roofSurface !== null) {
    while (
      roofBottom + 1 < terrain.height &&
      terrain.isSolid(spawn.x, roofBottom + 1)
    ) {
      roofBottom += 1;
    }
  }
  const tunnelConnected =
    cave !== null &&
    cave.tunnelPoints.length > 0 &&
    cave.tunnelPoints.every(
      (point) => !terrain.isSolid(point.x, point.y),
    ) &&
    cave.tunnelPoints.some((point) => isOpenToSky(terrain, point.x, point.y));
  const supportIsContinuous = Array.from(
    { length: padHalfWidth * 2 + 1 },
    (_, offset) => spawn.x - padHalfWidth + offset,
  ).every(
    (x) =>
      terrain.firstSolidYAtOrBelow(x, supportY - 1) === supportY,
  );

  return {
    kind: "cave",
    openSky: false,
    supportDepth: supportIsContinuous ? supportDepth : 0,
    headroom: ceilingY < 0 ? 0 : supportY - ceilingY - 1,
    roofThickness:
      roofSurface === null || roofBottom < roofSurface
        ? 0
        : roofBottom - roofSurface + 1,
    mouthConnected: tunnelConnected,
    firingExit:
      cave !== null &&
      clearFiringExit(terrain, spawn, cave.firingDirection),
  };
}

function featureMetrics(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
  spawns: readonly [BattlefieldSpawn, BattlefieldSpawn],
): BattlefieldTopologyMetrics {
  const interval = intervalTopology(terrain, spawns[0].x, spawns[1].x);
  const centerX = Math.round(plan.macro.centerXRatio * (terrain.width - 1));
  const halfWidth = Math.max(
    1,
    Math.round((plan.macro.widthRatio * terrain.width) / 2),
  );
  const sampleRadius = Math.max(2, Math.round(terrain.width * 0.006));
  const sampleAt = (x: number): number => {
    const values: number[] = [];
    for (
      let sampleX = clamp(x - sampleRadius, 0, terrain.width - 1);
      sampleX <= clamp(x + sampleRadius, 0, terrain.width - 1);
      sampleX += 2
    ) {
      const value = terrain.surfaceY(sampleX);
      if (value !== null) {
        values.push(value);
      }
    }
    return average(values);
  };
  const center = sampleAt(centerX);
  const shoulders =
    (sampleAt(centerX - halfWidth) + sampleAt(centerX + halfWidth)) / 2;

  return {
    ...interval,
    ridgeHeight:
      plan.profile === "ridge"
        ? Math.max(0, shoulders - center)
        : interval.ridgeHeight,
    basinDepth:
      plan.profile === "valley"
        ? Math.max(0, center - shoulders)
        : interval.basinDepth,
    featureWidth: Math.round(plan.macro.widthRatio * terrain.width),
    horizontalSeparation: spawns[1].x - spawns[0].x,
    verticalSeparation: Math.abs(spawns[1].y - spawns[0].y),
  };
}

function validateAttempt(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
  metadata: BattlefieldGenerationMetadata,
  options: {
    readonly padHalfWidth: number;
    readonly tankHalfHeight: number;
    readonly minSeparation: number;
    readonly rules: BattlefieldLayoutRules;
  },
): string | null {
  if (metadata.topology.horizontalSeparation < options.minSeparation) {
    return "spawn-separation";
  }

  const requiredFeatureHeight =
    terrain.height * options.rules.minFeatureHeightRatio;
  if (
    plan.profile === "ridge" &&
    (metadata.topology.ridgeHeight < requiredFeatureHeight ||
      metadata.topology.featureWidth < options.rules.minFeatureWidth)
  ) {
    return "ridge-topology";
  }
  if (
    plan.profile === "valley" &&
    (metadata.topology.basinDepth < requiredFeatureHeight ||
      metadata.topology.featureWidth < options.rules.minFeatureWidth)
  ) {
    return "valley-topology";
  }

  for (const spawn of metadata.spawns) {
    if (spawn.supportDepth < 12) {
      return "spawn-support";
    }
    if (spawn.kind === "surface" && !spawn.openSky) {
      return "surface-occluded";
    }
    if (
      spawn.kind === "cave" &&
      (spawn.headroom < options.tankHalfHeight * 3 ||
        spawn.roofThickness <
          terrain.height * options.rules.caveRoofMinRatio ||
        !spawn.mouthConnected ||
        !spawn.firingExit)
    ) {
      return "cave-playability";
    }
  }

  return null;
}

function generateAttempt(
  plan: BattlefieldPlan,
  attempt: number,
  options: TerrainGenerationOptions,
  spawnOptions: {
    readonly edgeMargin: number;
    readonly minSeparation: number;
    readonly padHalfWidth: number;
    readonly tankHalfHeight: number;
    readonly maxSurfaceDelta: number;
    readonly bedrockDepth: number;
  },
  rules: BattlefieldLayoutRules,
  fallbackReason: string | null,
): AttemptResult {
  const terrain = generateTerrain(
    `${plan.terrainSeed}:attempt:${attempt}`,
    terrainOptionsForProfile(plan.profile, options),
  );
  applyMacroSurface(terrain, plan);

  let spawns: readonly [BattlefieldSpawn, BattlefieldSpawn];
  let caves: readonly (CaveConstruction | null)[] = [null, null];
  if (plan.profile === "cavern") {
    const cavern = prepareCavernSpawns(terrain, plan, rules, spawnOptions);
    spawns = cavern.spawns;
    caves = cavern.caves;
  } else {
    spawns = prepareSurfacePair(terrain, plan.profile, spawnOptions);
  }

  const spawnMetadata = spawns.map((spawn, index) =>
    inspectSpawn(
      terrain,
      spawn,
      caves[index] ?? null,
      spawnOptions.padHalfWidth,
      spawnOptions.tankHalfHeight,
    ),
  ) as unknown as readonly [
    BattlefieldSpawnMetadata,
    BattlefieldSpawnMetadata,
  ];
  const metadata: BattlefieldGenerationMetadata = {
    profile: plan.profile,
    attempt,
    fallbackReason,
    topology: featureMetrics(terrain, plan, spawns),
    spawns: spawnMetadata,
  };

  return { terrain, spawns, metadata };
}

/**
 * Stable FNV-1a digest used by replay fixtures without serializing 2 MB grids.
 */
export function battlefieldGridHash(terrain: TerrainGrid): string {
  let hash = 0x811c9dc5;
  for (const cell of terrain.cells) {
    hash ^= cell;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Pure seeded entry point for a playable tactical battlefield.
 *
 * The plan owns macro topology and spawn roles. Rasterization, paired spawn
 * preparation and final grid validation then prove that the plan survived
 * material operations.
 */
export function generateBattlefield(
  seed: RandomSeed,
  options: BattlefieldGenerationOptions = {},
): Battlefield {
  const {
    roundNumber,
    layoutProfile,
    layoutRules,
    spawnEdgeMargin,
    minSpawnSeparation,
    spawnPadHalfWidth,
    tankHalfHeight,
    maxSpawnSurfaceDelta,
    ...terrainOptions
  } = options;
  const rules = layoutRules ?? DEFAULT_BATTLEFIELD_LAYOUT_RULES;
  const width = terrainOptions.width ?? WORLD_WIDTH;
  const height = terrainOptions.height ?? WORLD_HEIGHT;
  const edgeMargin = clamp(
    Math.round(spawnEdgeMargin ?? Math.max(96, width * 0.08)),
    12,
    Math.max(12, Math.floor(width / 3)),
  );
  const padHalfWidth = clamp(
    Math.round(spawnPadHalfWidth ?? 24),
    8,
    Math.max(8, Math.floor(width / 10)),
  );
  const resolvedTankHalfHeight = clamp(
    Math.round(tankHalfHeight ?? 11),
    1,
    Math.max(1, Math.floor(height / 8)),
  );
  const minSeparation = clamp(
    Math.round(minSpawnSeparation ?? width * 0.56),
    padHalfWidth * 3,
    Math.max(padHalfWidth * 3, width - edgeMargin * 2),
  );
  const maxSurfaceDelta = clamp(
    Math.round(maxSpawnSurfaceDelta ?? 12),
    2,
    Math.max(2, Math.floor(height / 12)),
  );
  const bedrockDepth = clamp(
    Math.round(
      terrainOptions.bedrockDepth ?? Math.max(4, height * 0.025),
    ),
    1,
    height,
  );
  const plan = createBattlefieldPlan(seed, {
    roundNumber,
    profile: layoutProfile,
    rules,
  });
  const spawnOptions = {
    edgeMargin,
    minSeparation,
    padHalfWidth,
    tankHalfHeight: resolvedTankHalfHeight,
    maxSurfaceDelta,
    bedrockDepth,
  };
  let lastFailure = "unknown";

  for (let attempt = 1; attempt <= rules.maxAttempts; attempt += 1) {
    const result = generateAttempt(
      plan,
      attempt,
      terrainOptions,
      spawnOptions,
      rules,
      null,
    );
    const failure = validateAttempt(result.terrain, plan, result.metadata, {
      padHalfWidth,
      tankHalfHeight: resolvedTankHalfHeight,
      minSeparation,
      rules,
    });
    if (failure === null) {
      return { ...result, plan };
    }
    lastFailure = failure;
  }

  const fallbackPlan = createBattlefieldPlan(seed, {
    roundNumber,
    profile: "open",
    rules,
  });
  const fallback = generateAttempt(
    fallbackPlan,
    rules.maxAttempts + 1,
    terrainOptions,
    spawnOptions,
    rules,
    `${plan.profile}:${lastFailure}`,
  );
  return { ...fallback, plan: fallbackPlan };
}
