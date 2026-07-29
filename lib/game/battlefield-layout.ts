import { normalizeSeed, SeededRandom, type RandomSeed } from "./random";

export const BATTLEFIELD_LAYOUT_PROFILES = [
  "open",
  "ridge",
  "valley",
  "cavern",
] as const;

export type BattlefieldLayoutProfile =
  (typeof BATTLEFIELD_LAYOUT_PROFILES)[number];

export type BattlefieldSpawnKind = "surface" | "cave";
export type BattlefieldSide = "left" | "right";
export type CavernLayoutVariant = "surface-vs-cave" | "cave-vs-cave";

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

export interface BattlefieldMacroPlan {
  readonly centerXRatio: number;
  readonly widthRatio: number;
  readonly amplitudeRatio: number;
}

export interface BattlefieldSpawnRole {
  readonly side: BattlefieldSide;
  readonly kind: BattlefieldSpawnKind;
  readonly preferredXRatio: number;
  readonly firingDirection: -1 | 1;
}

export interface BattlefieldPlan {
  readonly seed: number;
  readonly roundNumber: number;
  readonly profile: BattlefieldLayoutProfile;
  readonly terrainSeed: string;
  readonly cavernVariant: CavernLayoutVariant | null;
  readonly macro: BattlefieldMacroPlan;
  readonly spawnRoles: readonly [
    BattlefieldSpawnRole,
    BattlefieldSpawnRole,
  ];
}

export interface BattlefieldPlanOptions {
  readonly roundNumber?: number;
  readonly profile?: BattlefieldLayoutProfile;
  readonly rules?: BattlefieldLayoutRules;
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

function spawnRolesFor(
  seed: RandomSeed,
  roundNumber: number,
  profile: BattlefieldLayoutProfile,
): {
  readonly variant: CavernLayoutVariant | null;
  readonly roles: readonly [BattlefieldSpawnRole, BattlefieldSpawnRole];
} {
  const leftSurface: BattlefieldSpawnRole = {
    side: "left",
    kind: "surface",
    preferredXRatio: 0.2,
    firingDirection: 1,
  };
  const rightSurface: BattlefieldSpawnRole = {
    side: "right",
    kind: "surface",
    preferredXRatio: 0.8,
    firingDirection: -1,
  };

  if (profile !== "cavern") {
    return {
      variant: null,
      roles: [leftSurface, rightSurface],
    };
  }

  const variantSeed = normalizeSeed(
    `${String(seed)}:${roundNumber}:cavern-variant`,
  );
  const variant: CavernLayoutVariant =
    variantSeed % 2 === 0 ? "cave-vs-cave" : "surface-vs-cave";

  if (variant === "cave-vs-cave") {
    return {
      variant,
      roles: [
        { ...leftSurface, kind: "cave" },
        { ...rightSurface, kind: "cave" },
      ],
    };
  }

  const caveOnLeft = ((variantSeed >>> 1) & 1) === 0;
  return {
    variant,
    roles: caveOnLeft
      ? [{ ...leftSurface, kind: "cave" }, rightSurface]
      : [leftSurface, { ...rightSurface, kind: "cave" }],
  };
}

/**
 * Creates the tactical contract before any material cells are rasterized.
 * Default equal weights form a four-profile round cycle, so a three-round
 * match cannot repeat one layout three times.
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

  const profile =
    options.profile ?? selectProfile(seed, roundNumber, rules);
  const random = new SeededRandom(
    `${String(seed)}:${roundNumber}:${profile}:macro`,
  );
  const roles = spawnRolesFor(seed, roundNumber, profile);

  return {
    seed: normalizeSeed(seed),
    roundNumber,
    profile,
    terrainSeed: `${String(seed)}:${roundNumber}:${profile}:terrain`,
    cavernVariant: roles.variant,
    macro: {
      centerXRatio: random.float(0.46, 0.54),
      widthRatio:
        profile === "open"
          ? random.float(0.48, 0.62)
          : random.float(0.28, 0.36),
      amplitudeRatio:
        profile === "open"
          ? random.float(0.025, 0.045)
          : random.float(0.13, 0.17),
    },
    spawnRoles: roles.roles,
  };
}
