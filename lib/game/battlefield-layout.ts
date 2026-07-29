import { normalizeSeed, SeededRandom, type RandomSeed } from "./random";

export const BATTLEFIELD_LAYOUT_PROFILES = [
  "open",
  "ridge",
  "valley",
  "cavern",
] as const;

export type BattlefieldLayoutProfile =
  (typeof BATTLEFIELD_LAYOUT_PROFILES)[number];

export const BATTLEFIELD_LAYOUT_MOTIFS = [
  "island-chain",
  "broken-plateaus",
  "asymmetric-slope",
  "central-spire",
  "twin-peaks",
  "fortress-mesa",
  "deep-basin",
  "split-chasm",
  "terraced-canyon",
  "cliff-cave",
  "buried-duel",
  "underworld",
] as const;

export type BattlefieldLayoutMotif =
  (typeof BATTLEFIELD_LAYOUT_MOTIFS)[number];

export const BATTLEFIELD_LAYOUT_MOTIFS_BY_PROFILE = {
  open: [
    "island-chain",
    "broken-plateaus",
    "asymmetric-slope",
  ],
  ridge: ["central-spire", "twin-peaks", "fortress-mesa"],
  valley: ["deep-basin", "split-chasm", "terraced-canyon"],
  cavern: ["cliff-cave", "buried-duel", "underworld"],
} as const satisfies Readonly<
  Record<BattlefieldLayoutProfile, readonly BattlefieldLayoutMotif[]>
>;

export const BATTLEFIELD_LAYOUT_PROFILE_BY_MOTIF = {
  "island-chain": "open",
  "broken-plateaus": "open",
  "asymmetric-slope": "open",
  "central-spire": "ridge",
  "twin-peaks": "ridge",
  "fortress-mesa": "ridge",
  "deep-basin": "valley",
  "split-chasm": "valley",
  "terraced-canyon": "valley",
  "cliff-cave": "cavern",
  "buried-duel": "cavern",
  underworld: "cavern",
} as const satisfies Readonly<
  Record<BattlefieldLayoutMotif, BattlefieldLayoutProfile>
>;

export type BattlefieldSpawnKind = "surface" | "cave";
export type BattlefieldSide = "left" | "right";
export type CavernLayoutVariant = "surface-vs-cave" | "cave-vs-cave";
export const BATTLEFIELD_CAVERN_ROUTE_CLASSES = [
  "direct-rise",
  "high-arc",
  "deep-sag",
] as const;
export type BattlefieldCavernRouteClass =
  (typeof BATTLEFIELD_CAVERN_ROUTE_CLASSES)[number];
export type BattlefieldSurfaceTransition = "smooth" | "linear" | "step";
export type BattlefieldFeatureMaterial = "soil" | "rock";

const BATTLEFIELD_VARIANT_SLOT_COUNT = 6;

export interface BattlefieldLayoutRules {
  readonly profileWeights: Readonly<
    Record<BattlefieldLayoutProfile, number>
  >;
  readonly maxAttempts: number;
  readonly minFeatureHeightRatio: number;
  readonly minFeatureWidth: number;
  readonly caveHeadroomRatio: number;
  readonly caveRoofMinRatio: number;
}

export const DEFAULT_BATTLEFIELD_LAYOUT_RULES: BattlefieldLayoutRules = {
  profileWeights: {
    open: 1,
    ridge: 1,
    valley: 1,
    cavern: 1,
  },
  maxAttempts: 4,
  minFeatureHeightRatio: 0.1,
  minFeatureWidth: 160,
  caveHeadroomRatio: 0.12,
  caveRoofMinRatio: 0.035,
};

/**
 * Normalized world point. Both axes start at the top-left corner.
 */
export interface BattlefieldRatioPoint {
  readonly xRatio: number;
  readonly yRatio: number;
}

/**
 * Normalized top-left rectangle.
 */
export interface BattlefieldRatioRect extends BattlefieldRatioPoint {
  readonly widthRatio: number;
  readonly heightRatio: number;
}

/**
 * A surface keyframe. The final anchor's transition is retained for a uniform
 * contract but is ignored because it has no successor.
 */
export interface BattlefieldSurfaceAnchor extends BattlefieldRatioPoint {
  readonly transitionToNext: BattlefieldSurfaceTransition;
}

export interface BattlefieldAddIslandFeature {
  readonly kind: "add-island";
  readonly centerXRatio: number;
  readonly centerYRatio: number;
  readonly radiusXRatio: number;
  readonly radiusYRatio: number;
  readonly material: BattlefieldFeatureMaterial;
}

export interface BattlefieldCarveVoidFeature {
  readonly kind: "carve-void";
  readonly shape: "ellipse" | "rectangle";
  readonly centerXRatio: number;
  readonly centerYRatio: number;
  readonly radiusXRatio: number;
  readonly radiusYRatio: number;
  /**
   * Connect the void's upper edge to the sky to form a true chasm.
   */
  readonly openToSky: boolean;
}

export interface BattlefieldCarveArchFeature {
  readonly kind: "carve-arch";
  readonly bounds: BattlefieldRatioRect;
  readonly openingSide: "left" | "right" | "bottom";
  readonly roofThicknessRatio: number;
}

export interface BattlefieldAddBridgeFeature {
  readonly kind: "add-bridge";
  readonly start: BattlefieldRatioPoint;
  readonly end: BattlefieldRatioPoint;
  readonly thicknessRatio: number;
  readonly sagRatio: number;
  readonly material: BattlefieldFeatureMaterial;
}

export interface BattlefieldAddShelfFeature {
  readonly kind: "add-shelf";
  readonly bounds: BattlefieldRatioRect;
  readonly material: BattlefieldFeatureMaterial;
}

/**
 * Ordered material-grid operations applied after the anchored surface exists.
 * This is intentionally richer than a heightmap: it can create detached
 * masses, overhangs, open chasms, thin bridges and interior firing shelves.
 */
export type BattlefieldMaterialFeature =
  | BattlefieldAddIslandFeature
  | BattlefieldCarveVoidFeature
  | BattlefieldCarveArchFeature
  | BattlefieldAddBridgeFeature
  | BattlefieldAddShelfFeature;

/**
 * Compatibility envelope for topology metrics and older rasterizers.
 * New generation code should consume surfaceAnchors and materialFeatures.
 */
export interface BattlefieldMacroPlan {
  readonly centerXRatio: number;
  readonly widthRatio: number;
  readonly amplitudeRatio: number;
}

export interface BattlefieldSpawnRole {
  readonly side: BattlefieldSide;
  readonly kind: BattlefieldSpawnKind;
  readonly preferredXRatio: number;
  readonly searchMinXRatio: number;
  readonly searchMaxXRatio: number;
  readonly firingDirection: -1 | 1;
}

/**
 * Stable, reader-facing identity for one same-motif composition candidate.
 * The small slot is useful for galleries while the signature distinguishes
 * candidates that happen to share that slot.
 */
export interface BattlefieldPlanVariation {
  readonly candidate: number;
  readonly slot: number;
  readonly signature: string;
  readonly optionalFeatureCount: number;
  readonly cavernRouteClass: BattlefieldCavernRouteClass | null;
}

export interface BattlefieldPlan {
  readonly seed: number;
  readonly roundNumber: number;
  readonly profile: BattlefieldLayoutProfile;
  readonly motif: BattlefieldLayoutMotif;
  readonly terrainSeed: string;
  readonly cavernVariant: CavernLayoutVariant | null;
  readonly cavernRouteClass: BattlefieldCavernRouteClass | null;
  readonly variation: BattlefieldPlanVariation;
  readonly surfaceAnchors: readonly BattlefieldSurfaceAnchor[];
  readonly materialFeatures: readonly BattlefieldMaterialFeature[];
  readonly minSpawnSeparationRatio: number;
  /**
   * @deprecated Use surfaceAnchors and materialFeatures for rasterization.
   */
  readonly macro: BattlefieldMacroPlan;
  readonly spawnRoles: readonly [
    BattlefieldSpawnRole,
    BattlefieldSpawnRole,
  ];
}

export interface BattlefieldPlanOptions {
  readonly roundNumber?: number;
  readonly profile?: BattlefieldLayoutProfile;
  readonly motif?: BattlefieldLayoutMotif;
  readonly rules?: BattlefieldLayoutRules;
  /**
   * Zero-based same-motif composition candidate. Generation retries increment
   * this value without reselecting the requested profile or motif.
   */
  readonly candidate?: number;
}

interface BattlefieldMotifGrammar {
  readonly profile: BattlefieldLayoutProfile;
  readonly surfaceAnchors: readonly BattlefieldSurfaceAnchor[];
  readonly materialFeatures: readonly BattlefieldMaterialFeature[];
  readonly spawnRoles: readonly [
    BattlefieldSpawnRole,
    BattlefieldSpawnRole,
  ];
  readonly minSpawnSeparationRatio: number;
  readonly cavernVariant: CavernLayoutVariant | null;
  readonly compatibilityWidthRatio: number;
}

function anchor(
  xRatio: number,
  yRatio: number,
  transitionToNext: BattlefieldSurfaceTransition,
): BattlefieldSurfaceAnchor {
  return { xRatio, yRatio, transitionToNext };
}

function spawnRole(
  side: BattlefieldSide,
  kind: BattlefieldSpawnKind,
  preferredXRatio: number,
  searchMinXRatio: number,
  searchMaxXRatio: number,
): BattlefieldSpawnRole {
  return {
    side,
    kind,
    preferredXRatio,
    searchMinXRatio,
    searchMaxXRatio,
    firingDirection: side === "left" ? 1 : -1,
  };
}

function spawnPair(
  left: BattlefieldSpawnRole,
  right: BattlefieldSpawnRole,
): readonly [BattlefieldSpawnRole, BattlefieldSpawnRole] {
  return [left, right];
}

function ratioRect(
  xRatio: number,
  yRatio: number,
  widthRatio: number,
  heightRatio: number,
): BattlefieldRatioRect {
  return { xRatio, yRatio, widthRatio, heightRatio };
}

function addIsland(
  centerXRatio: number,
  centerYRatio: number,
  radiusXRatio: number,
  radiusYRatio: number,
  material: BattlefieldFeatureMaterial,
): BattlefieldAddIslandFeature {
  return {
    kind: "add-island",
    centerXRatio,
    centerYRatio,
    radiusXRatio,
    radiusYRatio,
    material,
  };
}

function carveVoid(
  centerXRatio: number,
  centerYRatio: number,
  radiusXRatio: number,
  radiusYRatio: number,
  shape: BattlefieldCarveVoidFeature["shape"],
  openToSky: boolean,
): BattlefieldCarveVoidFeature {
  return {
    kind: "carve-void",
    shape,
    centerXRatio,
    centerYRatio,
    radiusXRatio,
    radiusYRatio,
    openToSky,
  };
}

function carveArch(
  bounds: BattlefieldRatioRect,
  openingSide: BattlefieldCarveArchFeature["openingSide"],
  roofThicknessRatio: number,
): BattlefieldCarveArchFeature {
  return {
    kind: "carve-arch",
    bounds,
    openingSide,
    roofThicknessRatio,
  };
}

function addBridge(
  start: BattlefieldRatioPoint,
  end: BattlefieldRatioPoint,
  thicknessRatio: number,
  sagRatio: number,
  material: BattlefieldFeatureMaterial,
): BattlefieldAddBridgeFeature {
  return {
    kind: "add-bridge",
    start,
    end,
    thicknessRatio,
    sagRatio,
    material,
  };
}

function addShelf(
  bounds: BattlefieldRatioRect,
  material: BattlefieldFeatureMaterial,
): BattlefieldAddShelfFeature {
  return { kind: "add-shelf", bounds, material };
}

const MOTIF_GRAMMAR = {
  "island-chain": {
    profile: "open",
    surfaceAnchors: [
      anchor(0, 0.5, "smooth"),
      anchor(0.14, 0.44, "smooth"),
      anchor(0.28, 0.52, "smooth"),
      anchor(0.43, 0.46, "smooth"),
      anchor(0.58, 0.53, "smooth"),
      anchor(0.73, 0.45, "smooth"),
      anchor(0.87, 0.51, "smooth"),
      anchor(1, 0.48, "linear"),
    ],
    materialFeatures: [
      carveVoid(0.34, 0.66, 0.075, 0.35, "rectangle", true),
      carveVoid(0.68, 0.65, 0.065, 0.34, "rectangle", true),
      addIsland(0.52, 0.27, 0.11, 0.068, "rock"),
      addBridge(
        { xRatio: 0.25, yRatio: 0.48 },
        { xRatio: 0.43, yRatio: 0.47 },
        0.011,
        0.012,
        "rock",
      ),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.18, 0.09, 0.31),
      spawnRole("right", "surface", 0.82, 0.69, 0.91),
    ),
    minSpawnSeparationRatio: 0.56,
    cavernVariant: null,
    compatibilityWidthRatio: 0.56,
  },
  "broken-plateaus": {
    profile: "open",
    surfaceAnchors: [
      anchor(0, 0.54, "linear"),
      anchor(0.12, 0.49, "step"),
      anchor(0.2, 0.42, "linear"),
      anchor(0.37, 0.42, "step"),
      anchor(0.44, 0.56, "linear"),
      anchor(0.56, 0.56, "step"),
      anchor(0.63, 0.45, "linear"),
      anchor(0.84, 0.45, "step"),
      anchor(0.92, 0.53, "linear"),
      anchor(1, 0.53, "linear"),
    ],
    materialFeatures: [
      carveVoid(0.5, 0.58, 0.06, 0.25, "rectangle", true),
      addBridge(
        { xRatio: 0.435, yRatio: 0.44 },
        { xRatio: 0.565, yRatio: 0.44 },
        0.01,
        0.006,
        "rock",
      ),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.22, 0.11, 0.34),
      spawnRole("right", "surface", 0.78, 0.66, 0.89),
    ),
    minSpawnSeparationRatio: 0.54,
    cavernVariant: null,
    compatibilityWidthRatio: 0.54,
  },
  "asymmetric-slope": {
    profile: "open",
    surfaceAnchors: [
      anchor(0, 0.64, "smooth"),
      anchor(0.15, 0.62, "linear"),
      anchor(0.31, 0.57, "linear"),
      anchor(0.48, 0.5, "linear"),
      anchor(0.65, 0.42, "linear"),
      anchor(0.82, 0.35, "smooth"),
      anchor(1, 0.41, "linear"),
    ],
    materialFeatures: [
      addIsland(0.76, 0.23, 0.11, 0.068, "rock"),
      carveArch(
        ratioRect(0.65, 0.36, 0.22, 0.23),
        "left",
        0.025,
      ),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.19, 0.09, 0.31),
      spawnRole("right", "surface", 0.77, 0.67, 0.9),
    ),
    minSpawnSeparationRatio: 0.53,
    cavernVariant: null,
    compatibilityWidthRatio: 0.58,
  },
  "central-spire": {
    profile: "ridge",
    surfaceAnchors: [
      anchor(0, 0.59, "smooth"),
      anchor(0.27, 0.54, "linear"),
      anchor(0.41, 0.43, "linear"),
      anchor(0.5, 0.24, "linear"),
      anchor(0.59, 0.43, "linear"),
      anchor(0.73, 0.54, "smooth"),
      anchor(1, 0.59, "linear"),
    ],
    materialFeatures: [
      carveArch(
        ratioRect(0.445, 0.34, 0.11, 0.2),
        "bottom",
        0.026,
      ),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.17, 0.08, 0.29),
      spawnRole("right", "surface", 0.83, 0.71, 0.92),
    ),
    minSpawnSeparationRatio: 0.6,
    cavernVariant: null,
    compatibilityWidthRatio: 0.32,
  },
  "twin-peaks": {
    profile: "ridge",
    surfaceAnchors: [
      anchor(0, 0.58, "smooth"),
      anchor(0.25, 0.53, "smooth"),
      anchor(0.39, 0.29, "smooth"),
      anchor(0.5, 0.48, "smooth"),
      anchor(0.61, 0.3, "smooth"),
      anchor(0.75, 0.53, "smooth"),
      anchor(1, 0.58, "linear"),
    ],
    materialFeatures: [
      carveVoid(0.5, 0.49, 0.045, 0.09, "ellipse", false),
      addBridge(
        { xRatio: 0.405, yRatio: 0.33 },
        { xRatio: 0.595, yRatio: 0.34 },
        0.009,
        0.014,
        "rock",
      ),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.18, 0.08, 0.3),
      spawnRole("right", "surface", 0.82, 0.7, 0.92),
    ),
    minSpawnSeparationRatio: 0.58,
    cavernVariant: null,
    compatibilityWidthRatio: 0.48,
  },
  "fortress-mesa": {
    profile: "ridge",
    surfaceAnchors: [
      anchor(0, 0.58, "smooth"),
      anchor(0.25, 0.54, "linear"),
      anchor(0.36, 0.43, "step"),
      anchor(0.42, 0.29, "linear"),
      anchor(0.58, 0.29, "step"),
      anchor(0.64, 0.43, "linear"),
      anchor(0.75, 0.54, "smooth"),
      anchor(1, 0.58, "linear"),
    ],
    materialFeatures: [
      carveArch(
        ratioRect(0.43, 0.34, 0.14, 0.23),
        "bottom",
        0.028,
      ),
      addShelf(ratioRect(0.465, 0.48, 0.07, 0.014), "rock"),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.2, 0.09, 0.32),
      spawnRole("right", "surface", 0.8, 0.68, 0.91),
    ),
    minSpawnSeparationRatio: 0.55,
    cavernVariant: null,
    compatibilityWidthRatio: 0.36,
  },
  "deep-basin": {
    profile: "valley",
    surfaceAnchors: [
      anchor(0, 0.4, "smooth"),
      anchor(0.2, 0.43, "smooth"),
      anchor(0.34, 0.53, "smooth"),
      anchor(0.43, 0.63, "smooth"),
      anchor(0.5, 0.69, "smooth"),
      anchor(0.57, 0.63, "smooth"),
      anchor(0.66, 0.53, "smooth"),
      anchor(0.8, 0.43, "smooth"),
      anchor(1, 0.4, "linear"),
    ],
    materialFeatures: [
      addIsland(0.5, 0.57, 0.07, 0.025, "rock"),
      addBridge(
        { xRatio: 0.355, yRatio: 0.5 },
        { xRatio: 0.645, yRatio: 0.5 },
        0.009,
        0.025,
        "soil",
      ),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.18, 0.08, 0.3),
      spawnRole("right", "surface", 0.82, 0.7, 0.92),
    ),
    minSpawnSeparationRatio: 0.58,
    cavernVariant: null,
    compatibilityWidthRatio: 0.4,
  },
  "split-chasm": {
    profile: "valley",
    surfaceAnchors: [
      anchor(0, 0.42, "smooth"),
      anchor(0.28, 0.44, "linear"),
      anchor(0.42, 0.48, "step"),
      anchor(0.47, 0.72, "linear"),
      anchor(0.53, 0.72, "step"),
      anchor(0.58, 0.48, "linear"),
      anchor(0.72, 0.44, "smooth"),
      anchor(1, 0.42, "linear"),
    ],
    materialFeatures: [
      carveVoid(0.5, 0.56, 0.065, 0.34, "rectangle", true),
      addBridge(
        { xRatio: 0.425, yRatio: 0.45 },
        { xRatio: 0.575, yRatio: 0.45 },
        0.008,
        0,
        "rock",
      ),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.25, 0.12, 0.32),
      spawnRole("right", "surface", 0.75, 0.68, 0.88),
    ),
    minSpawnSeparationRatio: 0.46,
    cavernVariant: null,
    compatibilityWidthRatio: 0.3,
  },
  "terraced-canyon": {
    profile: "valley",
    surfaceAnchors: [
      anchor(0, 0.4, "linear"),
      anchor(0.24, 0.42, "step"),
      anchor(0.33, 0.51, "linear"),
      anchor(0.42, 0.51, "step"),
      anchor(0.47, 0.62, "linear"),
      anchor(0.53, 0.62, "step"),
      anchor(0.58, 0.52, "linear"),
      anchor(0.67, 0.52, "step"),
      anchor(0.76, 0.43, "linear"),
      anchor(1, 0.4, "linear"),
    ],
    materialFeatures: [
      carveArch(
        ratioRect(0.34, 0.5, 0.16, 0.18),
        "right",
        0.022,
      ),
      addShelf(ratioRect(0.375, 0.6, 0.09, 0.012), "rock"),
      addShelf(ratioRect(0.535, 0.56, 0.09, 0.012), "soil"),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.19, 0.08, 0.31),
      spawnRole("right", "surface", 0.81, 0.69, 0.92),
    ),
    minSpawnSeparationRatio: 0.56,
    cavernVariant: null,
    compatibilityWidthRatio: 0.42,
  },
  "cliff-cave": {
    profile: "cavern",
    surfaceAnchors: [
      anchor(0, 0.5, "smooth"),
      anchor(0.23, 0.47, "smooth"),
      anchor(0.46, 0.52, "linear"),
      anchor(0.62, 0.46, "linear"),
      anchor(0.7, 0.31, "step"),
      anchor(0.88, 0.31, "smooth"),
      anchor(1, 0.4, "linear"),
    ],
    materialFeatures: [
      carveArch(
        ratioRect(0.66, 0.37, 0.25, 0.29),
        "left",
        0.032,
      ),
      addShelf(ratioRect(0.72, 0.57, 0.13, 0.016), "rock"),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "surface", 0.18, 0.08, 0.31),
      spawnRole("right", "cave", 0.78, 0.68, 0.87),
    ),
    minSpawnSeparationRatio: 0.52,
    cavernVariant: "surface-vs-cave",
    compatibilityWidthRatio: 0.38,
  },
  "buried-duel": {
    profile: "cavern",
    surfaceAnchors: [
      anchor(0, 0.43, "smooth"),
      anchor(0.2, 0.39, "smooth"),
      anchor(0.4, 0.45, "smooth"),
      anchor(0.6, 0.44, "smooth"),
      anchor(0.8, 0.39, "smooth"),
      anchor(1, 0.43, "linear"),
    ],
    materialFeatures: [
      carveVoid(0.22, 0.61, 0.105, 0.1, "ellipse", false),
      carveVoid(0.78, 0.61, 0.105, 0.1, "ellipse", false),
      carveVoid(0.5, 0.61, 0.205, 0.025, "rectangle", false),
      addShelf(ratioRect(0.16, 0.67, 0.12, 0.015), "rock"),
      addShelf(ratioRect(0.72, 0.67, 0.12, 0.015), "rock"),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "cave", 0.22, 0.12, 0.33),
      spawnRole("right", "cave", 0.78, 0.67, 0.88),
    ),
    minSpawnSeparationRatio: 0.5,
    cavernVariant: "cave-vs-cave",
    compatibilityWidthRatio: 0.46,
  },
  underworld: {
    profile: "cavern",
    surfaceAnchors: [
      anchor(0, 0.45, "smooth"),
      anchor(0.18, 0.38, "smooth"),
      anchor(0.36, 0.46, "linear"),
      anchor(0.5, 0.35, "linear"),
      anchor(0.64, 0.47, "smooth"),
      anchor(0.82, 0.39, "smooth"),
      anchor(1, 0.45, "linear"),
    ],
    materialFeatures: [
      carveArch(
        ratioRect(0.14, 0.45, 0.72, 0.36),
        "bottom",
        0.04,
      ),
      addIsland(0.5, 0.64, 0.095, 0.045, "rock"),
      addBridge(
        { xRatio: 0.29, yRatio: 0.65 },
        { xRatio: 0.405, yRatio: 0.62 },
        0.011,
        0.008,
        "rock",
      ),
      addBridge(
        { xRatio: 0.595, yRatio: 0.62 },
        { xRatio: 0.71, yRatio: 0.65 },
        0.011,
        0.008,
        "rock",
      ),
      addShelf(ratioRect(0.18, 0.69, 0.12, 0.014), "rock"),
      addShelf(ratioRect(0.7, 0.69, 0.12, 0.014), "rock"),
    ],
    spawnRoles: spawnPair(
      spawnRole("left", "cave", 0.24, 0.14, 0.33),
      spawnRole("right", "cave", 0.76, 0.67, 0.86),
    ),
    minSpawnSeparationRatio: 0.48,
    cavernVariant: "cave-vs-cave",
    compatibilityWidthRatio: 0.56,
  },
} as const satisfies Readonly<
  Record<BattlefieldLayoutMotif, BattlefieldMotifGrammar>
>;

function isBattlefieldLayoutProfile(
  value: unknown,
): value is BattlefieldLayoutProfile {
  return BATTLEFIELD_LAYOUT_PROFILES.includes(
    value as BattlefieldLayoutProfile,
  );
}

function isBattlefieldLayoutMotif(
  value: unknown,
): value is BattlefieldLayoutMotif {
  return BATTLEFIELD_LAYOUT_MOTIFS.includes(
    value as BattlefieldLayoutMotif,
  );
}

export function battlefieldLayoutMotifsForProfile(
  profile: BattlefieldLayoutProfile,
): readonly BattlefieldLayoutMotif[] {
  return BATTLEFIELD_LAYOUT_MOTIFS_BY_PROFILE[profile];
}

export function battlefieldLayoutProfileForMotif(
  motif: BattlefieldLayoutMotif,
): BattlefieldLayoutProfile {
  return BATTLEFIELD_LAYOUT_PROFILE_BY_MOTIF[motif];
}

function weightedProfileSchedule(
  rules: BattlefieldLayoutRules,
): readonly BattlefieldLayoutProfile[] {
  const schedule: BattlefieldLayoutProfile[] = [];

  for (const profile of BATTLEFIELD_LAYOUT_PROFILES) {
    const weight = rules.profileWeights[profile];
    if (!Number.isInteger(weight) || weight <= 0) {
      throw new RangeError(
        `Battlefield profile weight for ${profile} must be a positive integer.`,
      );
    }

    for (let slot = 0; slot < weight; slot += 1) {
      schedule.push(profile);
    }
  }

  return schedule;
}

function selectProfile(
  seed: RandomSeed,
  roundNumber: number,
  rules: BattlefieldLayoutRules,
): BattlefieldLayoutProfile {
  const schedule = weightedProfileSchedule(rules);
  const firstSlot =
    (normalizeSeed(`${String(seed)}:battlefield-profile`) + 1) %
    schedule.length;
  return schedule[
    (firstSlot + roundNumber - 1) % schedule.length
  ] as BattlefieldLayoutProfile;
}

function selectMotif(
  seed: RandomSeed,
  roundNumber: number,
  profile: BattlefieldLayoutProfile,
): BattlefieldLayoutMotif {
  const motifs = battlefieldLayoutMotifsForProfile(profile);
  const slot =
    normalizeSeed(`${String(seed)}:${roundNumber}:${profile}:motif`) %
    motifs.length;
  return motifs[slot] as BattlefieldLayoutMotif;
}

function resolveProfileAndMotif(
  seed: RandomSeed,
  roundNumber: number,
  rules: BattlefieldLayoutRules,
  profileOverride: BattlefieldLayoutProfile | undefined,
  motifOverride: BattlefieldLayoutMotif | undefined,
): {
  readonly profile: BattlefieldLayoutProfile;
  readonly motif: BattlefieldLayoutMotif;
} {
  if (
    profileOverride !== undefined &&
    !isBattlefieldLayoutProfile(profileOverride)
  ) {
    throw new RangeError(
      `Unknown battlefield layout profile: ${String(profileOverride)}.`,
    );
  }
  if (
    motifOverride !== undefined &&
    !isBattlefieldLayoutMotif(motifOverride)
  ) {
    throw new RangeError(
      `Unknown battlefield layout motif: ${String(motifOverride)}.`,
    );
  }

  const motifProfile =
    motifOverride === undefined
      ? undefined
      : battlefieldLayoutProfileForMotif(motifOverride);
  if (
    profileOverride !== undefined &&
    motifProfile !== undefined &&
    profileOverride !== motifProfile
  ) {
    throw new RangeError(
      `Battlefield motif ${motifOverride} belongs to profile ` +
        `${motifProfile}, not ${profileOverride}.`,
    );
  }

  const profile =
    profileOverride ??
    motifProfile ??
    selectProfile(seed, roundNumber, rules);
  return {
    profile,
    motif:
      motifOverride ?? selectMotif(seed, roundNumber, profile),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundedRatio(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1_000_000) / 1_000_000;
}

function boundedRatio(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max) * 1_000_000) / 1_000_000;
}

function parameterizeSurfaceAnchors(
  random: SeededRandom,
  profile: BattlefieldLayoutProfile,
  motif: BattlefieldLayoutMotif,
  anchors: readonly BattlefieldSurfaceAnchor[],
): readonly BattlefieldSurfaceAnchor[] {
  const first = anchors[0];
  const last = anchors.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error("Battlefield motif requires surface anchors.");
  }

  const lift = random.float(-0.032, 0.032);
  const tilt =
    motif === "asymmetric-slope"
      ? random.float(-0.045, 0.006)
      : random.float(-0.042, 0.042);
  const reliefScale =
    profile === "open"
      ? random.float(0.84, 1.24)
      : random.float(0.88, 1.2);
  const centerWarp = random.float(-0.034, 0.034);
  const regionalWarp = random.float(-0.022, 0.022);
  const centerRelief = random.float(-0.026, 0.026);
  const regionalRelief = random.float(-0.018, 0.018);

  return anchors.map((current, index) => {
    const previous = anchors[index - 1];
    const next = anchors[index + 1];
    const endpoint = previous === undefined || next === undefined;
    const horizontalWarp =
      Math.sin(current.xRatio * Math.PI) * centerWarp +
      Math.sin(current.xRatio * Math.PI * 2) * regionalWarp;
    const localX = endpoint ? 0 : random.float(-0.012, 0.012);
    const minX =
      previous === undefined
        ? current.xRatio
        : previous.xRatio +
          (current.xRatio - previous.xRatio) * 0.28;
    const maxX =
      next === undefined
        ? current.xRatio
        : next.xRatio -
          (next.xRatio - current.xRatio) * 0.28;
    const baseline =
      first.yRatio +
      (last.yRatio - first.yRatio) * current.xRatio;
    const baseRelief = current.yRatio - baseline;
    const localY = random.float(
      endpoint ? -0.01 : -0.018,
      endpoint ? 0.01 : 0.018,
    );
    const shapedY =
      baseline +
      baseRelief * reliefScale +
      lift +
      tilt * (current.xRatio - 0.5) +
      Math.sin(current.xRatio * Math.PI) * centerRelief +
      Math.sin(current.xRatio * Math.PI * 2) * regionalRelief +
      localY;

    return {
      xRatio: endpoint
        ? roundedRatio(current.xRatio)
        : boundedRatio(
            current.xRatio + horizontalWarp + localX,
            minX,
            maxX,
          ),
      yRatio: boundedRatio(shapedY, 0.12, 0.82),
      transitionToNext: current.transitionToNext,
    };
  });
}

function parameterizeRect(
  random: SeededRandom,
  bounds: BattlefieldRatioRect,
): BattlefieldRatioRect {
  const widthRatio = boundedRatio(
    bounds.widthRatio * random.float(0.84, 1.16),
    0.035,
    0.82,
  );
  const heightRatio = boundedRatio(
    bounds.heightRatio * random.float(0.8, 1.2),
    0.012,
    0.46,
  );
  return ratioRect(
    boundedRatio(
      bounds.xRatio + random.float(-0.022, 0.022),
      0.015,
      0.985 - widthRatio,
    ),
    boundedRatio(
      bounds.yRatio + random.float(-0.024, 0.024),
      0.08,
      0.96 - heightRatio,
    ),
    widthRatio,
    heightRatio,
  );
}

function parameterizeMaterialFeature(
  random: SeededRandom,
  feature: BattlefieldMaterialFeature,
): BattlefieldMaterialFeature {
  switch (feature.kind) {
    case "add-island": {
      const radiusXRatio = boundedRatio(
        feature.radiusXRatio * random.float(0.78, 1.22),
        0.012,
        0.24,
      );
      const radiusYRatio = boundedRatio(
        feature.radiusYRatio * random.float(0.74, 1.26),
        0.01,
        0.18,
      );
      return {
        ...feature,
        centerXRatio: boundedRatio(
          feature.centerXRatio + random.float(-0.026, 0.026),
          radiusXRatio + 0.01,
          0.99 - radiusXRatio,
        ),
        centerYRatio: boundedRatio(
          feature.centerYRatio + random.float(-0.024, 0.024),
          radiusYRatio + 0.04,
          0.92 - radiusYRatio,
        ),
        radiusXRatio,
        radiusYRatio,
      };
    }
    case "carve-void": {
      const radiusXRatio = boundedRatio(
        feature.radiusXRatio * random.float(0.8, 1.2),
        0.014,
        0.27,
      );
      const radiusYRatio = boundedRatio(
        feature.radiusYRatio * random.float(0.78, 1.22),
        0.012,
        0.42,
      );
      return {
        ...feature,
        centerXRatio: boundedRatio(
          feature.centerXRatio + random.float(-0.024, 0.024),
          radiusXRatio * 0.72,
          1 - radiusXRatio * 0.72,
        ),
        centerYRatio: boundedRatio(
          feature.centerYRatio + random.float(-0.026, 0.026),
          0.08,
          0.92,
        ),
        radiusXRatio,
        radiusYRatio,
      };
    }
    case "carve-arch": {
      const bounds = parameterizeRect(random, feature.bounds);
      return {
        ...feature,
        bounds,
        roofThicknessRatio: boundedRatio(
          feature.roofThicknessRatio * random.float(0.78, 1.24),
          0.014,
          Math.min(0.07, bounds.heightRatio * 0.34),
        ),
      };
    }
    case "add-shelf":
      return {
        ...feature,
        bounds: parameterizeRect(random, feature.bounds),
      };
    case "add-bridge": {
      const centerX = (feature.start.xRatio + feature.end.xRatio) * 0.5;
      const centerY = (feature.start.yRatio + feature.end.yRatio) * 0.5;
      const halfX =
        (feature.end.xRatio - feature.start.xRatio) *
        0.5 *
        random.float(0.84, 1.16);
      const halfY =
        (feature.end.yRatio - feature.start.yRatio) *
        0.5 *
        random.float(0.78, 1.22);
      const shiftX = random.float(-0.018, 0.018);
      const shiftY = random.float(-0.022, 0.022);
      const endpointSkew = random.float(-0.01, 0.01);
      const sagRatio =
        Math.abs(feature.sagRatio) < 0.000_001
          ? random.float(-0.007, 0.012)
          : feature.sagRatio * random.float(0.68, 1.36) +
            random.float(-0.003, 0.003);
      return {
        ...feature,
        start: {
          xRatio: boundedRatio(centerX + shiftX - halfX, 0.015, 0.985),
          yRatio: boundedRatio(
            centerY + shiftY - halfY - endpointSkew,
            0.08,
            0.9,
          ),
        },
        end: {
          xRatio: boundedRatio(centerX + shiftX + halfX, 0.015, 0.985),
          yRatio: boundedRatio(
            centerY + shiftY + halfY + endpointSkew,
            0.08,
            0.9,
          ),
        },
        thicknessRatio: boundedRatio(
          feature.thicknessRatio * random.float(0.76, 1.28),
          0.005,
          0.032,
        ),
        sagRatio: boundedRatio(sagRatio, -0.035, 0.055),
      };
    }
  }
}

function secondaryFeaturePalette(
  motif: BattlefieldLayoutMotif,
): readonly BattlefieldMaterialFeature[] {
  switch (motif) {
    case "island-chain":
      return [
        addIsland(0.18, 0.3, 0.055, 0.034, "rock"),
        addBridge(
          { xRatio: 0.58, yRatio: 0.48 },
          { xRatio: 0.69, yRatio: 0.45 },
          0.008,
          0.009,
          "soil",
        ),
        carveVoid(0.84, 0.63, 0.032, 0.085, "ellipse", false),
      ];
    case "broken-plateaus":
      return [
        addIsland(0.5, 0.28, 0.06, 0.032, "rock"),
        carveArch(ratioRect(0.23, 0.44, 0.11, 0.17), "right", 0.022),
        addShelf(ratioRect(0.72, 0.52, 0.08, 0.014), "rock"),
      ];
    case "asymmetric-slope":
      return [
        addBridge(
          { xRatio: 0.49, yRatio: 0.48 },
          { xRatio: 0.61, yRatio: 0.41 },
          0.009,
          0.008,
          "rock",
        ),
        carveVoid(0.43, 0.61, 0.04, 0.07, "ellipse", false),
        addIsland(0.55, 0.29, 0.05, 0.03, "soil"),
      ];
    case "central-spire":
      return [
        addIsland(0.5, 0.16, 0.052, 0.024, "rock"),
        addShelf(ratioRect(0.36, 0.5, 0.075, 0.014), "rock"),
        carveVoid(0.64, 0.55, 0.038, 0.065, "ellipse", false),
      ];
    case "twin-peaks":
      return [
        addIsland(0.5, 0.2, 0.05, 0.024, "rock"),
        carveArch(ratioRect(0.31, 0.39, 0.12, 0.16), "right", 0.021),
        addShelf(ratioRect(0.57, 0.48, 0.08, 0.013), "rock"),
      ];
    case "fortress-mesa":
      return [
        addIsland(0.5, 0.18, 0.058, 0.025, "rock"),
        addBridge(
          { xRatio: 0.32, yRatio: 0.47 },
          { xRatio: 0.42, yRatio: 0.4 },
          0.009,
          0.006,
          "rock",
        ),
        carveVoid(0.68, 0.55, 0.038, 0.07, "ellipse", false),
      ];
    case "deep-basin":
      return [
        addIsland(0.5, 0.42, 0.052, 0.026, "rock"),
        addShelf(ratioRect(0.26, 0.49, 0.085, 0.014), "soil"),
        carveArch(ratioRect(0.66, 0.48, 0.11, 0.18), "left", 0.022),
      ];
    case "split-chasm":
      return [
        addIsland(0.5, 0.31, 0.043, 0.022, "rock"),
        addShelf(ratioRect(0.31, 0.49, 0.075, 0.014), "rock"),
        addShelf(ratioRect(0.615, 0.5, 0.075, 0.014), "soil"),
      ];
    case "terraced-canyon":
      return [
        addIsland(0.5, 0.36, 0.05, 0.024, "rock"),
        addBridge(
          { xRatio: 0.43, yRatio: 0.55 },
          { xRatio: 0.57, yRatio: 0.55 },
          0.008,
          0.012,
          "soil",
        ),
        carveVoid(0.72, 0.58, 0.035, 0.07, "ellipse", false),
      ];
    case "cliff-cave":
      return [
        addIsland(0.46, 0.29, 0.052, 0.026, "rock"),
        addBridge(
          { xRatio: 0.49, yRatio: 0.49 },
          { xRatio: 0.61, yRatio: 0.44 },
          0.009,
          0.008,
          "rock",
        ),
        carveVoid(0.57, 0.58, 0.038, 0.075, "ellipse", false),
      ];
    case "buried-duel":
      return [
        addIsland(0.5, 0.28, 0.052, 0.025, "rock"),
        addShelf(ratioRect(0.43, 0.65, 0.14, 0.014), "rock"),
        carveVoid(0.5, 0.53, 0.05, 0.06, "ellipse", false),
      ];
    case "underworld":
      return [
        addIsland(0.5, 0.24, 0.055, 0.026, "rock"),
        carveVoid(0.5, 0.53, 0.055, 0.07, "ellipse", false),
        addShelf(ratioRect(0.45, 0.7, 0.1, 0.014), "rock"),
      ];
  }
}

function parameterizeMaterialFeatures(
  variationLabel: string,
  motif: BattlefieldLayoutMotif,
  slot: number,
  features: readonly BattlefieldMaterialFeature[],
): {
  readonly features: readonly BattlefieldMaterialFeature[];
  readonly optionalFeatureCount: number;
} {
  const parameterized = features.map((feature, index) => {
    const parameterizedFeature = parameterizeMaterialFeature(
      new SeededRandom(`${variationLabel}:material:${index}`),
      feature,
    );
    if (
      motif === "buried-duel" &&
      parameterizedFeature.kind === "carve-void"
    ) {
      return {
        ...parameterizedFeature,
        centerYRatio: boundedRatio(
          parameterizedFeature.centerYRatio + 0.075,
          0.16,
          0.9,
        ),
      };
    }
    return parameterizedFeature;
  });
  const palette = secondaryFeaturePalette(motif);
  const selectionRandom = new SeededRandom(
    `${variationLabel}:secondary-selection`,
  );
  const optionalFeatureCount = 1 + (slot % 2);
  const start = selectionRandom.integer(0, palette.length);
  const optional = Array.from(
    { length: optionalFeatureCount },
    (_, offset) => {
      const paletteIndex = (start + offset) % palette.length;
      return parameterizeMaterialFeature(
        new SeededRandom(
          `${variationLabel}:secondary:${paletteIndex}:${offset}`,
        ),
        palette[paletteIndex] as BattlefieldMaterialFeature,
      );
    },
  );
  return {
    features: [...parameterized, ...optional],
    optionalFeatureCount,
  };
}

function parameterizeSpawnRoles(
  variationLabel: string,
  roles: readonly [BattlefieldSpawnRole, BattlefieldSpawnRole],
): readonly [BattlefieldSpawnRole, BattlefieldSpawnRole] {
  return roles.map((role, index) => {
    const random = new SeededRandom(
      `${variationLabel}:spawn-role:${index}:${role.side}`,
    );
    const bandWidth = role.searchMaxXRatio - role.searchMinXRatio;
    const inset = Math.min(0.012, bandWidth * 0.08);
    const maxShift = Math.min(0.045, bandWidth * 0.24);
    return {
      ...role,
      preferredXRatio: boundedRatio(
        role.preferredXRatio + random.float(-maxShift, maxShift),
        role.searchMinXRatio + inset,
        role.searchMaxXRatio - inset,
      ),
    };
  }) as unknown as readonly [
    BattlefieldSpawnRole,
    BattlefieldSpawnRole,
  ];
}

function compatibilityMacro(
  profile: BattlefieldLayoutProfile,
  widthRatio: number,
  anchors: readonly BattlefieldSurfaceAnchor[],
): BattlefieldMacroPlan {
  const first = anchors[0];
  if (first === undefined) {
    throw new Error("Battlefield motif requires at least one surface anchor.");
  }

  let highest = first;
  let lowest = first;
  for (const current of anchors.slice(1)) {
    if (current.yRatio < highest.yRatio) {
      highest = current;
    }
    if (current.yRatio > lowest.yRatio) {
      lowest = current;
    }
  }

  const amplitudeRange = lowest.yRatio - highest.yRatio;
  const center =
    profile === "ridge"
      ? highest
      : profile === "valley"
        ? lowest
        : anchors.reduce(
            (closest, current) =>
              Math.abs(current.xRatio - 0.5) <
              Math.abs(closest.xRatio - 0.5)
                ? current
                : closest,
            first,
          );
  const amplitudeRatio =
    profile === "open"
      ? clamp(amplitudeRange * 0.18, 0.025, 0.045)
      : clamp(amplitudeRange * 0.58, 0.13, 0.17);

  return {
    centerXRatio: center.xRatio,
    widthRatio,
    amplitudeRatio,
  };
}

/**
 * Creates the tactical contract before any material cells are rasterized.
 * Default equal weights retain the four-profile round cycle; a second seeded
 * choice selects one of the profile's three motifs. Exact motif overrides are
 * useful for fixtures and reject an incompatible explicit profile.
 */
export function createBattlefieldPlan(
  seed: RandomSeed,
  options: BattlefieldPlanOptions = {},
): BattlefieldPlan {
  const roundNumber = options.roundNumber ?? 1;
  const rules = options.rules ?? DEFAULT_BATTLEFIELD_LAYOUT_RULES;
  const candidate = options.candidate ?? 0;

  if (!Number.isInteger(roundNumber) || roundNumber <= 0) {
    throw new RangeError("roundNumber must be a positive integer.");
  }
  if (!Number.isSafeInteger(candidate) || candidate < 0) {
    throw new RangeError(
      "Battlefield plan candidate must be a non-negative safe integer.",
    );
  }

  const { profile, motif } = resolveProfileAndMotif(
    seed,
    roundNumber,
    rules,
    options.profile,
    options.motif,
  );
  const grammar = MOTIF_GRAMMAR[motif];
  const variationLabel =
    `${String(seed)}:${roundNumber}:${motif}:grammar-v2:` +
    `candidate:${candidate}`;
  const slot = new SeededRandom(
    `${variationLabel}:variant-slot`,
  ).integer(0, BATTLEFIELD_VARIANT_SLOT_COUNT);
  const signatureValue = new SeededRandom(
    `${variationLabel}:variant-signature`,
  ).nextUint32();
  const signature = signatureValue.toString(16).padStart(8, "0");
  const cavernRouteClass =
    profile === "cavern"
      ? new SeededRandom(`${variationLabel}:cavern-route`).pick(
          BATTLEFIELD_CAVERN_ROUTE_CLASSES,
        )
      : null;
  const surfaceAnchors = parameterizeSurfaceAnchors(
    new SeededRandom(
      `${variationLabel}:surface-anchors`,
    ),
    profile,
    motif,
    grammar.surfaceAnchors,
  );
  const parameterizedFeatures = parameterizeMaterialFeatures(
    variationLabel,
    motif,
    slot,
    grammar.materialFeatures,
  );
  const spawnRoles = parameterizeSpawnRoles(
    variationLabel,
    grammar.spawnRoles,
  );
  const variation: BattlefieldPlanVariation = {
    candidate,
    slot,
    signature,
    optionalFeatureCount: parameterizedFeatures.optionalFeatureCount,
    cavernRouteClass,
  };

  return {
    seed: normalizeSeed(seed),
    roundNumber,
    profile,
    motif,
    terrainSeed:
      `${String(seed)}:${roundNumber}:${profile}:${motif}:` +
      `variant:${signature}:terrain`,
    cavernVariant: grammar.cavernVariant,
    cavernRouteClass,
    variation,
    surfaceAnchors,
    materialFeatures: parameterizedFeatures.features,
    minSpawnSeparationRatio: grammar.minSpawnSeparationRatio,
    macro: compatibilityMacro(
      profile,
      grammar.compatibilityWidthRatio,
      surfaceAnchors,
    ),
    spawnRoles,
  };
}
