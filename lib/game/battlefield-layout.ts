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
export type BattlefieldSurfaceTransition = "smooth" | "linear" | "step";
export type BattlefieldFeatureMaterial = "soil" | "rock";

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

export interface BattlefieldPlan {
  readonly seed: number;
  readonly roundNumber: number;
  readonly profile: BattlefieldLayoutProfile;
  readonly motif: BattlefieldLayoutMotif;
  readonly terrainSeed: string;
  readonly cavernVariant: CavernLayoutVariant | null;
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

function jitterSurfaceAnchors(
  random: SeededRandom,
  anchors: readonly BattlefieldSurfaceAnchor[],
): readonly BattlefieldSurfaceAnchor[] {
  return anchors.map((current, index) => {
    const previous = anchors[index - 1];
    const next = anchors[index + 1];
    const xJitter =
      previous === undefined || next === undefined
        ? 0
        : Math.min(
            0.009,
            (current.xRatio - previous.xRatio) * 0.2,
            (next.xRatio - current.xRatio) * 0.2,
          );
    const yJitter = index === 0 || index === anchors.length - 1
      ? 0.006
      : 0.012;

    return {
      xRatio: roundedRatio(
        current.xRatio + random.float(-xJitter, xJitter),
      ),
      yRatio: roundedRatio(
        clamp(
          current.yRatio + random.float(-yJitter, yJitter),
          0.12,
          0.82,
        ),
      ),
      transitionToNext: current.transitionToNext,
    };
  });
}

function cloneMaterialFeature(
  feature: BattlefieldMaterialFeature,
): BattlefieldMaterialFeature {
  switch (feature.kind) {
    case "add-island":
    case "carve-void":
      return { ...feature };
    case "carve-arch":
    case "add-shelf":
      return { ...feature, bounds: { ...feature.bounds } };
    case "add-bridge":
      return {
        ...feature,
        start: { ...feature.start },
        end: { ...feature.end },
      };
  }
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

  if (!Number.isInteger(roundNumber) || roundNumber <= 0) {
    throw new RangeError("roundNumber must be a positive integer.");
  }

  const { profile, motif } = resolveProfileAndMotif(
    seed,
    roundNumber,
    rules,
    options.profile,
    options.motif,
  );
  const grammar = MOTIF_GRAMMAR[motif];
  const surfaceAnchors = jitterSurfaceAnchors(
    new SeededRandom(
      `${String(seed)}:${roundNumber}:${motif}:surface-anchors`,
    ),
    grammar.surfaceAnchors,
  );

  return {
    seed: normalizeSeed(seed),
    roundNumber,
    profile,
    motif,
    terrainSeed: `${String(seed)}:${roundNumber}:${profile}:terrain`,
    cavernVariant: grammar.cavernVariant,
    surfaceAnchors,
    materialFeatures: grammar.materialFeatures.map(cloneMaterialFeature),
    minSpawnSeparationRatio: grammar.minSpawnSeparationRatio,
    macro: compatibilityMacro(
      profile,
      grammar.compatibilityWidthRatio,
      surfaceAnchors,
    ),
    spawnRoles: [
      { ...grammar.spawnRoles[0] },
      { ...grammar.spawnRoles[1] },
    ],
  };
}
