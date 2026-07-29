import {
  createBattlefieldPlan,
  DEFAULT_BATTLEFIELD_LAYOUT_RULES,
  type BattlefieldFeatureMaterial,
  type BattlefieldLayoutMotif,
  type BattlefieldLayoutProfile,
  type BattlefieldLayoutRules,
  type BattlefieldMaterialFeature,
  type BattlefieldPlan,
  type BattlefieldSpawnKind,
  type BattlefieldSpawnRole,
  type BattlefieldSurfaceAnchor,
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
import {
  measureBattlefieldStructure,
  type BattlefieldStructureMetrics,
} from "./battlefield-structure";

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
  readonly motif: BattlefieldLayoutMotif;
  readonly attempt: number;
  readonly fallbackReason: string | null;
  readonly topology: BattlefieldTopologyMetrics;
  readonly structure: BattlefieldStructureMetrics;
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
  /**
   * Exact composition fixture/debug override. Throws when the requested
   * motif cannot satisfy final-grid validation, rather than substituting a
   * different motif.
   */
  readonly layoutMotif?: BattlefieldLayoutMotif;
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
  readonly firingAngleDegrees: number;
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
      | "minSurfaceY"
      | "maxSurfaceY"
      | "controlPointSpacing"
      | "roughness"
      | "caveCount"
      | "tunnelCount"
    >
  > = {
    open: {
      minSurfaceY: Math.round(height * 0.43),
      maxSurfaceY: Math.round(height * 0.62),
      controlPointSpacing: Math.max(64, Math.round(width / 10)),
      roughness: Math.max(8, height * 0.048),
      caveCount: 0,
      tunnelCount: 0,
    },
    ridge: {
      minSurfaceY: Math.round(height * 0.48),
      maxSurfaceY: Math.round(height * 0.64),
      controlPointSpacing: Math.max(64, Math.round(width / 12)),
      roughness: Math.max(8, height * 0.04),
      caveCount: 0,
      tunnelCount: 0,
    },
    valley: {
      minSurfaceY: Math.round(height * 0.36),
      maxSurfaceY: Math.round(height * 0.53),
      controlPointSpacing: Math.max(64, Math.round(width / 12)),
      roughness: Math.max(8, height * 0.042),
      caveCount: 0,
      tunnelCount: 0,
    },
    cavern: {
      minSurfaceY: Math.round(height * 0.39),
      maxSurfaceY: Math.round(height * 0.59),
      controlPointSpacing: Math.max(58, Math.round(width / 13)),
      roughness: Math.max(8, height * 0.052),
      caveCount: 0,
      tunnelCount: 0,
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

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function interpolateSurfaceAnchor(
  left: BattlefieldSurfaceAnchor,
  right: BattlefieldSurfaceAnchor,
  xRatio: number,
): number {
  const progress = clamp(
    (xRatio - left.xRatio) /
      Math.max(Number.EPSILON, right.xRatio - left.xRatio),
    0,
    1,
  );
  const interpolation =
    left.transitionToNext === "smooth"
      ? smoothStep(progress)
      : left.transitionToNext === "step"
        ? progress < 0.5
          ? 0
          : 1
        : progress;
  return left.yRatio + (right.yRatio - left.yRatio) * interpolation;
}

/**
 * The motif owns the large silhouette. Seeded terrain contributes only a
 * bounded high-frequency residual, so noise cannot collapse twelve
 * compositions back into one mean-reverting hill.
 */
function applyAnchoredSurface(
  terrain: TerrainGrid,
  anchors: readonly BattlefieldSurfaceAnchor[],
): void {
  if (anchors.length < 2) {
    throw new Error("Battlefield surface requires at least two anchors.");
  }

  const original = Array.from(
    { length: terrain.width },
    (_, x) => terrain.surfaceY(x) ?? Math.round(terrain.height * 0.5),
  );
  const prefix = new Float64Array(terrain.width + 1);
  for (let x = 0; x < terrain.width; x += 1) {
    prefix[x + 1] = (prefix[x] ?? 0) + (original[x] ?? 0);
  }

  const residualRadius = Math.max(10, Math.round(terrain.width / 72));
  const maxResidual = terrain.height * 0.028;
  let segment = 0;

  for (let x = 0; x < terrain.width; x += 1) {
    const xRatio = x / Math.max(1, terrain.width - 1);
    while (
      segment + 2 < anchors.length &&
      xRatio > (anchors[segment + 1]?.xRatio ?? 1)
    ) {
      segment += 1;
    }

    const left = anchors[segment] as BattlefieldSurfaceAnchor;
    const right = anchors[
      Math.min(segment + 1, anchors.length - 1)
    ] as BattlefieldSurfaceAnchor;
    const windowLeft = Math.max(0, x - residualRadius);
    const windowRight = Math.min(terrain.width - 1, x + residualRadius);
    const localMean =
      ((prefix[windowRight + 1] ?? 0) - (prefix[windowLeft] ?? 0)) /
      (windowRight - windowLeft + 1);
    const residual = clamp(
      (original[x] as number) - localMean,
      -maxResidual,
      maxResidual,
    );
    const target =
      interpolateSurfaceAnchor(left, right, xRatio) * terrain.height +
      residual * 0.58;
    setSurfaceColumn(terrain, x, target);
  }
}

function featureMaterial(
  material: BattlefieldFeatureMaterial,
): Material.Soil | Material.Rock {
  return material === "rock" ? Material.Rock : Material.Soil;
}

function rasterEllipse(
  terrain: TerrainGrid,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  material: Material,
): void {
  const safeRadiusX = Math.max(1, radiusX);
  const safeRadiusY = Math.max(1, radiusY);
  const minX = clamp(
    Math.floor(centerX - safeRadiusX),
    0,
    terrain.width - 1,
  );
  const maxX = clamp(
    Math.ceil(centerX + safeRadiusX),
    0,
    terrain.width - 1,
  );
  const minY = clamp(
    Math.floor(centerY - safeRadiusY),
    0,
    terrain.height - 1,
  );
  const maxY = clamp(
    Math.ceil(centerY + safeRadiusY),
    0,
    terrain.height - 1,
  );

  for (let y = minY; y <= maxY; y += 1) {
    const normalizedY = (y + 0.5 - centerY) / safeRadiusY;
    for (let x = minX; x <= maxX; x += 1) {
      const normalizedX = (x + 0.5 - centerX) / safeRadiusX;
      if (
        normalizedX * normalizedX + normalizedY * normalizedY <= 1
      ) {
        terrain.set(x, y, material);
      }
    }
  }
}

function rasterRectangle(
  terrain: TerrainGrid,
  left: number,
  top: number,
  right: number,
  bottom: number,
  material: Material,
): void {
  const minX = clamp(Math.floor(left), 0, terrain.width - 1);
  const maxX = clamp(Math.ceil(right), 0, terrain.width - 1);
  const minY = clamp(Math.floor(top), 0, terrain.height - 1);
  const maxY = clamp(Math.ceil(bottom), 0, terrain.height - 1);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      terrain.set(x, y, material);
    }
  }
}

function applyCarveArch(
  terrain: TerrainGrid,
  feature: Extract<BattlefieldMaterialFeature, { kind: "carve-arch" }>,
): void {
  const left = feature.bounds.xRatio * terrain.width;
  const top = feature.bounds.yRatio * terrain.height;
  const width = feature.bounds.widthRatio * terrain.width;
  const height = feature.bounds.heightRatio * terrain.height;
  const roof = Math.max(
    6,
    feature.roofThicknessRatio * terrain.height,
  );
  const innerTop = top + roof;
  const innerBottom = top + height;
  const centerX = left + width / 2;
  const centerY = innerTop + (innerBottom - innerTop) * 0.54;

  rasterEllipse(
    terrain,
    centerX,
    centerY,
    width * 0.44,
    Math.max(3, (innerBottom - innerTop) * 0.54),
    Material.Empty,
  );
  rasterRectangle(
    terrain,
    left + width * 0.18,
    centerY,
    left + width * 0.82,
    innerBottom,
    Material.Empty,
  );

  if (feature.openingSide === "bottom") {
    rasterRectangle(
      terrain,
      left + width * 0.24,
      centerY,
      left + width * 0.76,
      innerBottom,
      Material.Empty,
    );
  } else if (feature.openingSide === "left") {
    rasterRectangle(
      terrain,
      left,
      innerTop + roof * 0.35,
      centerX,
      innerBottom - roof * 0.25,
      Material.Empty,
    );
  } else {
    rasterRectangle(
      terrain,
      centerX,
      innerTop + roof * 0.35,
      left + width,
      innerBottom - roof * 0.25,
      Material.Empty,
    );
  }
}

function applyMaterialFeature(
  terrain: TerrainGrid,
  feature: BattlefieldMaterialFeature,
): void {
  switch (feature.kind) {
    case "add-island": {
      rasterEllipse(
        terrain,
        feature.centerXRatio * terrain.width,
        feature.centerYRatio * terrain.height,
        feature.radiusXRatio * terrain.width,
        feature.radiusYRatio * terrain.height,
        featureMaterial(feature.material),
      );
      return;
    }
    case "carve-void": {
      const centerX = feature.centerXRatio * terrain.width;
      const centerY = feature.centerYRatio * terrain.height;
      const radiusX = feature.radiusXRatio * terrain.width;
      const radiusY = feature.radiusYRatio * terrain.height;
      if (feature.shape === "ellipse") {
        rasterEllipse(
          terrain,
          centerX,
          centerY,
          radiusX,
          radiusY,
          Material.Empty,
        );
      } else {
        rasterRectangle(
          terrain,
          centerX - radiusX,
          centerY - radiusY,
          centerX + radiusX,
          centerY + radiusY,
          Material.Empty,
        );
      }
      if (feature.openToSky) {
        rasterRectangle(
          terrain,
          centerX - radiusX * 0.82,
          0,
          centerX + radiusX * 0.82,
          centerY,
          Material.Empty,
        );
      }
      return;
    }
    case "carve-arch":
      applyCarveArch(terrain, feature);
      return;
    case "add-bridge": {
      const startX = feature.start.xRatio * terrain.width;
      const startY = feature.start.yRatio * terrain.height;
      const endX = feature.end.xRatio * terrain.width;
      const endY = feature.end.yRatio * terrain.height;
      const distance = Math.hypot(endX - startX, endY - startY);
      const radius = Math.max(
        3,
        (feature.thicknessRatio * terrain.height) / 2,
      );
      const steps = Math.max(1, Math.ceil(distance / (radius * 0.7)));
      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        const x = startX + (endX - startX) * progress;
        const y =
          startY +
          (endY - startY) * progress +
          Math.sin(progress * Math.PI) *
            feature.sagRatio *
            terrain.height;
        terrain.fillCircle(
          x,
          y,
          radius,
          featureMaterial(feature.material),
        );
      }
      return;
    }
    case "add-shelf": {
      const left = feature.bounds.xRatio * terrain.width;
      const top = feature.bounds.yRatio * terrain.height;
      rasterRectangle(
        terrain,
        left,
        top,
        left + feature.bounds.widthRatio * terrain.width,
        top + feature.bounds.heightRatio * terrain.height,
        featureMaterial(feature.material),
      );
    }
  }
}

function rasterizeBattlefieldComposition(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
): void {
  applyAnchoredSurface(terrain, plan.surfaceAnchors);
  for (const feature of plan.materialFeatures) {
    applyMaterialFeature(terrain, feature);
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
  role: BattlefieldSpawnRole,
  edgeMargin: number,
  padHalfWidth: number,
  maxDelta: number,
): readonly SurfaceCandidate[] {
  const bandLeft = clamp(
    Math.ceil(terrain.width * role.searchMinXRatio),
    edgeMargin,
    terrain.width - edgeMargin,
  );
  const bandRight = clamp(
    Math.floor(terrain.width * role.searchMaxXRatio),
    bandLeft,
    terrain.width - edgeMargin,
  );
  const target = terrain.width * role.preferredXRatio;
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
  const leftSurface =
    terrain.surfaceY(leftX) ?? Math.round(terrain.height * 0.5);
  const rightSurface =
    terrain.surfaceY(rightX) ?? Math.round(terrain.height * 0.5);
  let minimumSurface = Number.POSITIVE_INFINITY;
  let maximumSurface = Number.NEGATIVE_INFINITY;
  let ridgeHeight = 0;
  let basinDepth = 0;

  for (let x = leftX; x <= rightX; x += step) {
    const surface = terrain.surfaceY(x);
    if (surface === null) {
      continue;
    }
    const progress = (x - leftX) / Math.max(1, rightX - leftX);
    const baseline =
      leftSurface + (rightSurface - leftSurface) * progress;
    minimumSurface = Math.min(minimumSurface, surface);
    maximumSurface = Math.max(maximumSurface, surface);
    ridgeHeight = Math.max(ridgeHeight, baseline - surface);
    basinDepth = Math.max(basinDepth, surface - baseline);
  }

  const hasSamples =
    Number.isFinite(minimumSurface) && Number.isFinite(maximumSurface);
  return {
    relief: hasSamples ? maximumSurface - minimumSurface : 0,
    ridgeHeight: hasSamples ? ridgeHeight : 0,
    basinDepth: hasSamples ? basinDepth : 0,
  };
}

/**
 * Measures the widest substantial rendered ridge/basin at full column
 * resolution. The threshold is relative to the observed amplitude, and tiny
 * sub-one-percent gaps are bridged so local seeded detail cannot split one
 * broad feature into dozens of fragments.
 */
function measuredFeatureWidth(
  terrain: TerrainGrid,
  leftX: number,
  rightX: number,
  profile: BattlefieldLayoutProfile,
  topology: ReturnType<typeof intervalTopology>,
): number {
  if (profile !== "ridge" && profile !== "valley") {
    return 0;
  }

  const amplitude =
    profile === "ridge" ? topology.ridgeHeight : topology.basinDepth;
  if (amplitude <= 0) {
    return 0;
  }

  const leftSurface =
    terrain.surfaceY(leftX) ?? Math.round(terrain.height * 0.5);
  const rightSurface =
    terrain.surfaceY(rightX) ?? Math.round(terrain.height * 0.5);
  const threshold = Math.max(2, amplitude * 0.35);
  const allowedGap = Math.max(
    2,
    Math.round((rightX - leftX) * 0.006),
  );
  let current = 0;
  let pendingGap = 0;
  let longest = 0;

  for (let x = leftX; x <= rightX; x += 1) {
    const surface = terrain.surfaceY(x);
    if (surface === null) {
      longest = Math.max(longest, current);
      current = 0;
      pendingGap = 0;
      continue;
    }

    const progress = (x - leftX) / Math.max(1, rightX - leftX);
    const baseline =
      leftSurface + (rightSurface - leftSurface) * progress;
    const deviation =
      profile === "ridge" ? baseline - surface : surface - baseline;

    if (deviation >= threshold) {
      current += pendingGap + 1;
      pendingGap = 0;
      continue;
    }

    if (current > 0 && pendingGap < allowedGap) {
      pendingGap += 1;
      continue;
    }

    longest = Math.max(longest, current);
    current = 0;
    pendingGap = 0;
  }

  return Math.max(longest, current);
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
  plan: BattlefieldPlan,
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
    plan.spawnRoles[0],
    options.edgeMargin,
    options.padHalfWidth,
    options.maxSurfaceDelta,
  );
  const rightCandidates = surfaceCandidates(
    terrain,
    plan.spawnRoles[1],
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
        pairProfileScore(plan.profile, topology) +
        Math.abs(
          separation - terrain.width * plan.minSpawnSeparationRatio,
        ) * 0.008;
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
      role,
      edgeMargin,
      padHalfWidth,
      maxSurfaceDelta,
    )[0]?.x ?? Math.round(terrain.width * role.preferredXRatio)
  );
}

function carveTacticalCave(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
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
  const angleDegrees =
    plan.motif === "cliff-cave"
      ? 38
      : plan.motif === "underworld"
        ? 34
        : 42;
  const angle = (angleDegrees * Math.PI) / 180;
  const start: SpawnSite = {
    x: spawn.x + role.firingDirection * 12,
    y: spawn.y - 5,
  };
  const tunnelPoints: SpawnSite[] = [];
  const maxDistance = Math.min(
    plan.motif === "underworld" ? 460 : 390,
    terrain.width * 0.2,
  );
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
    firingAngleDegrees: angleDegrees,
    tunnelPoints,
  };
}

function carveCaveCorridor(
  terrain: TerrainGrid,
  from: SpawnSite,
  to: SpawnSite,
  radius: number,
  bend: number,
): void {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / Math.max(5, radius * 0.62)));
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    terrain.carveCircle(
      from.x + (to.x - from.x) * progress,
      from.y +
        (to.y - from.y) * progress +
        Math.sin(progress * Math.PI) * bend,
      radius,
    );
  }
}

function connectPlannedCaverns(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
  caves: readonly (CaveConstruction | null)[],
): void {
  const actualCaves = caves.filter(
    (cave): cave is CaveConstruction => cave !== null,
  );
  if (actualCaves.length < 2) {
    return;
  }

  const left = actualCaves[0] as CaveConstruction;
  const right = actualCaves[1] as CaveConstruction;
  const corridorRadius = Math.max(18, Math.round(terrain.height * 0.034));
  const leftCenter = {
    x: left.spawn.x + 44,
    y: left.floorY - Math.round(terrain.height * 0.07),
  };
  const rightCenter = {
    x: right.spawn.x - 44,
    y: right.floorY - Math.round(terrain.height * 0.07),
  };

  carveCaveCorridor(
    terrain,
    leftCenter,
    rightCenter,
    corridorRadius,
    plan.motif === "underworld"
      ? -terrain.height * 0.055
      : terrain.height * 0.025,
  );

  if (plan.motif === "underworld") {
    const chamberY =
      Math.min(left.floorY, right.floorY) -
      Math.round(terrain.height * 0.11);
    terrain.carveCircle(
      terrain.width * 0.5,
      chamberY,
      Math.max(44, terrain.height * 0.085),
    );
    carveCaveCorridor(
      terrain,
      {
        x: left.spawn.x + 60,
        y: left.floorY - Math.round(terrain.height * 0.045),
      },
      {
        x: terrain.width * 0.5 - terrain.width * 0.07,
        y: chamberY,
      },
      Math.max(15, corridorRadius * 0.78),
      -terrain.height * 0.028,
    );
    carveCaveCorridor(
      terrain,
      {
        x: terrain.width * 0.5 + terrain.width * 0.07,
        y: chamberY,
      },
      {
        x: right.spawn.x - 60,
        y: right.floorY - Math.round(terrain.height * 0.045),
      },
      Math.max(15, corridorRadius * 0.78),
      -terrain.height * 0.028,
    );
  }
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
      const cave = carveTacticalCave(terrain, plan, role, rules, options);
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
  connectPlannedCaverns(terrain, plan, caves);
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
  angleDegrees: number,
): boolean {
  const angle = (angleDegrees * Math.PI) / 180;
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
      clearFiringExit(
        terrain,
        spawn,
        cave.firingDirection,
        cave.firingAngleDegrees,
      ),
  };
}

function longestEmptyRunInColumn(
  terrain: TerrainGrid,
  x: number,
): number {
  let longest = 0;
  let current = 0;
  for (let y = 0; y < terrain.height; y += 1) {
    if (terrain.get(x, y) === Material.Empty) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function featureMetrics(
  terrain: TerrainGrid,
  plan: BattlefieldPlan,
  spawns: readonly [BattlefieldSpawn, BattlefieldSpawn],
): BattlefieldTopologyMetrics {
  const interval = intervalTopology(terrain, spawns[0].x, spawns[1].x);
  return {
    ...interval,
    featureWidth: measuredFeatureWidth(
      terrain,
      spawns[0].x,
      spawns[1].x,
      plan.profile,
      interval,
    ),
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
  const requiredFeatureWidth = Math.min(
    options.rules.minFeatureWidth,
    terrain.width * 0.12,
  );
  if (
    plan.profile === "ridge" &&
    (metadata.topology.ridgeHeight < requiredFeatureHeight ||
      metadata.topology.featureWidth < requiredFeatureWidth)
  ) {
    return "ridge-topology";
  }
  if (
    plan.profile === "valley" &&
    plan.motif !== "split-chasm" &&
    (metadata.topology.basinDepth < requiredFeatureHeight ||
      metadata.topology.featureWidth < requiredFeatureWidth)
  ) {
    return "valley-topology";
  }
  if (
    plan.motif === "split-chasm" &&
    longestEmptyRunInColumn(
      terrain,
      Math.round(terrain.width * 0.5),
    ) <
      terrain.height * 0.2
  ) {
    return "split-chasm-topology";
  }
  if (
    (plan.motif === "island-chain" ||
      plan.motif === "asymmetric-slope") &&
    metadata.structure.floatingSolidComponentCount < 1
  ) {
    return "floating-mass-topology";
  }
  if (
    plan.motif === "asymmetric-slope" &&
    metadata.topology.verticalSeparation < terrain.height * 0.3
  ) {
    return "asymmetric-spawn-context";
  }
  if (
    (plan.motif === "broken-plateaus" ||
      plan.motif === "fortress-mesa") &&
    metadata.structure.cliffCount < 2
  ) {
    return "cliff-topology";
  }
  if (
    plan.motif === "buried-duel" &&
    (metadata.structure.roofedColumnRatio < 0.5 ||
      metadata.structure.undergroundOpenAirSpan < terrain.width * 0.16)
  ) {
    return "buried-duel-underground-space";
  }
  if (
    plan.motif === "underworld" &&
    (metadata.structure.roofedColumnRatio < 0.5 ||
      metadata.structure.undergroundOpenAirSpan < terrain.width * 0.16)
  ) {
    return "underworld-underground-space";
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
      spawn.headroom < options.tankHalfHeight * 3
    ) {
      return "cave-headroom";
    }
    if (
      spawn.kind === "cave" &&
      spawn.roofThickness <
        terrain.height * options.rules.caveRoofMinRatio
    ) {
      return "cave-roof";
    }
    if (spawn.kind === "cave" && !spawn.mouthConnected) {
      return "cave-mouth";
    }
    if (spawn.kind === "cave" && !spawn.firingExit) {
      return "cave-firing-exit";
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
  rasterizeBattlefieldComposition(terrain, plan);

  let spawns: readonly [BattlefieldSpawn, BattlefieldSpawn];
  let caves: readonly (CaveConstruction | null)[] = [null, null];
  if (plan.profile === "cavern") {
    const cavern = prepareCavernSpawns(terrain, plan, rules, spawnOptions);
    spawns = cavern.spawns;
    caves = cavern.caves;
  } else {
    spawns = prepareSurfacePair(terrain, plan, spawnOptions);
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
    motif: plan.motif,
    attempt,
    fallbackReason,
    topology: featureMetrics(terrain, plan, spawns),
    structure: measureBattlefieldStructure(terrain),
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
    layoutMotif,
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
  const plan = createBattlefieldPlan(seed, {
    roundNumber,
    profile: layoutProfile,
    motif: layoutMotif,
    rules,
  });
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
    Math.round(
      minSpawnSeparation ?? width * plan.minSpawnSeparationRatio,
    ),
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

  const rescue = generateAttempt(
    plan,
    rules.maxAttempts + 1,
    {
      ...terrainOptions,
      caveCount: 0,
      tunnelCount: 0,
      roughness: 0,
    },
    spawnOptions,
    rules,
    `${plan.profile}:${lastFailure}:clean-rescue`,
  );
  const rescueFailure = validateAttempt(
    rescue.terrain,
    plan,
    rescue.metadata,
    {
      padHalfWidth,
      tankHalfHeight: resolvedTankHalfHeight,
      minSeparation,
      rules,
    },
  );
  if (rescueFailure === null) {
    return { ...rescue, plan };
  }
  lastFailure = rescueFailure;

  if (layoutMotif !== undefined) {
    throw new Error(
      `Unable to validate exact battlefield motif ${layoutMotif}: ` +
        `${lastFailure}.`,
    );
  }

  const fallbackPlan = createBattlefieldPlan(seed, {
    roundNumber,
    profile: "open",
    rules,
  });
  const fallback = generateAttempt(
    fallbackPlan,
    rules.maxAttempts + 2,
    terrainOptions,
    spawnOptions,
    rules,
    `${plan.profile}:${lastFailure}`,
  );
  return { ...fallback, plan: fallbackPlan };
}
