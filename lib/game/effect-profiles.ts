import type { WeaponId } from "./weapons";

export type EffectEnvelopeShape =
  | "radial"
  | "multi-radial"
  | "flow"
  | "trace"
  | "wedge"
  | "subterranean"
  | "terrain-fill"
  | "global"
  | "beam";

export type SpectacleSignature =
  | "spark"
  | "shockwave"
  | "nuclear"
  | "cascade"
  | "fire"
  | "trail"
  | "rolling"
  | "cut"
  | "seismic"
  | "growth"
  | "gravity"
  | "energy"
  | "beam";

export interface EffectParticleBudget {
  readonly full: number;
  readonly balanced: number;
  readonly reduced: number;
}

export interface WeaponEffectProfile {
  /**
   * Measured effective radius/half-width before AND-7. For non-circular
   * families this is the documented spatial proxy named by `shape`.
   */
  readonly baselineMechanicalRadius: number;
  /**
   * Quick Demo mechanical radius/half-width after AND-7. This remains
   * provisional and is not a claim about Classic balance.
   */
  readonly mechanicalRadius: number;
  /** Solid/ticked cue for the actual mechanical boundary. */
  readonly readableRadius: number;
  /** Safe outer VFX envelope; never used by damage or terrain resolution. */
  readonly spectacleRadius: number;
  readonly shape: EffectEnvelopeShape;
  readonly signature: SpectacleSignature;
  readonly particleBudget: EffectParticleBudget;
  readonly shockwaveCount: 0 | 1 | 2 | 3 | 4;
  readonly aftermathMs: number;
}

const budget = (
  full: number,
  balanced: number,
  reduced: number,
): EffectParticleBudget => ({ full, balanced, reduced });

/**
 * Explicit 0.1 effect scale for every weapon. Values are intentionally
 * enumerated rather than inferred from price or Arms level so family roles,
 * map size and accessibility constraints stay reviewable.
 */
export const WEAPON_EFFECT_PROFILES: Readonly<
  Record<WeaponId, WeaponEffectProfile>
> = Object.freeze({
  babyMissile: {
    baselineMechanicalRadius: 10,
    mechanicalRadius: 18,
    readableRadius: 18,
    spectacleRadius: 42,
    shape: "radial",
    signature: "spark",
    particleBudget: budget(34, 22, 10),
    shockwaveCount: 1,
    aftermathMs: 650,
  },
  missile: {
    baselineMechanicalRadius: 20,
    mechanicalRadius: 34,
    readableRadius: 34,
    spectacleRadius: 76,
    shape: "radial",
    signature: "shockwave",
    particleBudget: budget(58, 36, 18),
    shockwaveCount: 2,
    aftermathMs: 850,
  },
  babyNuke: {
    baselineMechanicalRadius: 40,
    mechanicalRadius: 64,
    readableRadius: 64,
    spectacleRadius: 160,
    shape: "radial",
    signature: "nuclear",
    particleBudget: budget(150, 90, 42),
    shockwaveCount: 3,
    aftermathMs: 1_450,
  },
  nuke: {
    baselineMechanicalRadius: 75,
    mechanicalRadius: 110,
    readableRadius: 110,
    spectacleRadius: 285,
    shape: "radial",
    signature: "nuclear",
    particleBudget: budget(220, 132, 60),
    shockwaveCount: 4,
    aftermathMs: 1_900,
  },
  leapFrog: {
    baselineMechanicalRadius: 30,
    mechanicalRadius: 44,
    readableRadius: 44,
    spectacleRadius: 102,
    shape: "multi-radial",
    signature: "cascade",
    particleBudget: budget(104, 64, 30),
    shockwaveCount: 2,
    aftermathMs: 1_050,
  },
  funkyBomb: {
    baselineMechanicalRadius: 16,
    mechanicalRadius: 24,
    readableRadius: 24,
    spectacleRadius: 72,
    shape: "multi-radial",
    signature: "cascade",
    particleBudget: budget(180, 108, 50),
    shockwaveCount: 3,
    aftermathMs: 1_500,
  },
  mirv: {
    baselineMechanicalRadius: 20,
    mechanicalRadius: 32,
    readableRadius: 32,
    spectacleRadius: 74,
    shape: "multi-radial",
    signature: "cascade",
    particleBudget: budget(120, 72, 34),
    shockwaveCount: 2,
    aftermathMs: 1_100,
  },
  deathsHead: {
    baselineMechanicalRadius: 35,
    mechanicalRadius: 52,
    readableRadius: 52,
    spectacleRadius: 122,
    shape: "multi-radial",
    signature: "cascade",
    particleBudget: budget(168, 100, 46),
    shockwaveCount: 3,
    aftermathMs: 1_350,
  },
  napalm: {
    baselineMechanicalRadius: 72,
    mechanicalRadius: 92,
    readableRadius: 92,
    spectacleRadius: 132,
    shape: "flow",
    signature: "fire",
    particleBudget: budget(78, 46, 22),
    shockwaveCount: 0,
    aftermathMs: 1_200,
  },
  hotNapalm: {
    baselineMechanicalRadius: 96,
    mechanicalRadius: 126,
    readableRadius: 126,
    spectacleRadius: 188,
    shape: "flow",
    signature: "fire",
    particleBudget: budget(126, 76, 36),
    shockwaveCount: 0,
    aftermathMs: 1_550,
  },
  tracer: {
    baselineMechanicalRadius: 0,
    mechanicalRadius: 0,
    readableRadius: 5,
    spectacleRadius: 22,
    shape: "trace",
    signature: "trail",
    particleBudget: budget(14, 10, 6),
    shockwaveCount: 0,
    aftermathMs: 450,
  },
  smokeTracer: {
    baselineMechanicalRadius: 0,
    mechanicalRadius: 0,
    readableRadius: 7,
    spectacleRadius: 34,
    shape: "trace",
    signature: "trail",
    particleBudget: budget(48, 30, 14),
    shockwaveCount: 0,
    aftermathMs: 1_400,
  },
  babyRoller: {
    baselineMechanicalRadius: 10,
    mechanicalRadius: 18,
    readableRadius: 18,
    spectacleRadius: 44,
    shape: "radial",
    signature: "rolling",
    particleBudget: budget(38, 24, 12),
    shockwaveCount: 1,
    aftermathMs: 700,
  },
  roller: {
    baselineMechanicalRadius: 20,
    mechanicalRadius: 34,
    readableRadius: 34,
    spectacleRadius: 78,
    shape: "radial",
    signature: "rolling",
    particleBudget: budget(64, 40, 20),
    shockwaveCount: 2,
    aftermathMs: 900,
  },
  heavyRoller: {
    baselineMechanicalRadius: 45,
    mechanicalRadius: 68,
    readableRadius: 68,
    spectacleRadius: 154,
    shape: "radial",
    signature: "rolling",
    particleBudget: budget(118, 70, 32),
    shockwaveCount: 3,
    aftermathMs: 1_250,
  },
  riotCharge: {
    baselineMechanicalRadius: 36,
    mechanicalRadius: 50,
    readableRadius: 50,
    spectacleRadius: 76,
    shape: "wedge",
    signature: "cut",
    particleBudget: budget(44, 28, 14),
    shockwaveCount: 0,
    aftermathMs: 700,
  },
  riotBlast: {
    baselineMechanicalRadius: 60,
    mechanicalRadius: 84,
    readableRadius: 84,
    spectacleRadius: 126,
    shape: "wedge",
    signature: "cut",
    particleBudget: budget(78, 48, 22),
    shockwaveCount: 0,
    aftermathMs: 900,
  },
  riotBomb: {
    baselineMechanicalRadius: 30,
    mechanicalRadius: 48,
    readableRadius: 48,
    spectacleRadius: 92,
    shape: "radial",
    signature: "cut",
    particleBudget: budget(62, 38, 18),
    shockwaveCount: 2,
    aftermathMs: 850,
  },
  heavyRiotBomb: {
    baselineMechanicalRadius: 45,
    mechanicalRadius: 68,
    readableRadius: 68,
    spectacleRadius: 136,
    shape: "radial",
    signature: "cut",
    particleBudget: budget(94, 56, 26),
    shockwaveCount: 3,
    aftermathMs: 1_050,
  },
  babyDigger: {
    baselineMechanicalRadius: 12,
    mechanicalRadius: 20,
    readableRadius: 20,
    spectacleRadius: 50,
    shape: "subterranean",
    signature: "seismic",
    particleBudget: budget(46, 28, 14),
    shockwaveCount: 1,
    aftermathMs: 850,
  },
  digger: {
    baselineMechanicalRadius: 20,
    mechanicalRadius: 34,
    readableRadius: 34,
    spectacleRadius: 78,
    shape: "subterranean",
    signature: "seismic",
    particleBudget: budget(74, 44, 22),
    shockwaveCount: 2,
    aftermathMs: 1_000,
  },
  heavyDigger: {
    baselineMechanicalRadius: 34,
    mechanicalRadius: 52,
    readableRadius: 52,
    spectacleRadius: 118,
    shape: "subterranean",
    signature: "seismic",
    particleBudget: budget(108, 64, 30),
    shockwaveCount: 3,
    aftermathMs: 1_250,
  },
  babySandhog: {
    baselineMechanicalRadius: 14,
    mechanicalRadius: 22,
    readableRadius: 22,
    spectacleRadius: 54,
    shape: "subterranean",
    signature: "seismic",
    particleBudget: budget(82, 50, 24),
    shockwaveCount: 1,
    aftermathMs: 1_000,
  },
  sandhog: {
    baselineMechanicalRadius: 20,
    mechanicalRadius: 32,
    readableRadius: 32,
    spectacleRadius: 76,
    shape: "subterranean",
    signature: "seismic",
    particleBudget: budget(118, 70, 34),
    shockwaveCount: 2,
    aftermathMs: 1_200,
  },
  heavySandhog: {
    baselineMechanicalRadius: 30,
    mechanicalRadius: 46,
    readableRadius: 46,
    spectacleRadius: 108,
    shape: "subterranean",
    signature: "seismic",
    particleBudget: budget(158, 94, 44),
    shockwaveCount: 3,
    aftermathMs: 1_450,
  },
  dirtClod: {
    baselineMechanicalRadius: 20,
    mechanicalRadius: 32,
    readableRadius: 32,
    spectacleRadius: 68,
    shape: "terrain-fill",
    signature: "growth",
    particleBudget: budget(52, 32, 16),
    shockwaveCount: 1,
    aftermathMs: 850,
  },
  dirtBall: {
    baselineMechanicalRadius: 35,
    mechanicalRadius: 52,
    readableRadius: 52,
    spectacleRadius: 104,
    shape: "terrain-fill",
    signature: "growth",
    particleBudget: budget(82, 50, 24),
    shockwaveCount: 2,
    aftermathMs: 1_050,
  },
  tonOfDirt: {
    baselineMechanicalRadius: 70,
    mechanicalRadius: 90,
    readableRadius: 90,
    spectacleRadius: 178,
    shape: "terrain-fill",
    signature: "growth",
    particleBudget: budget(138, 82, 38),
    shockwaveCount: 3,
    aftermathMs: 1_400,
  },
  liquidDirt: {
    baselineMechanicalRadius: 112,
    mechanicalRadius: 126,
    readableRadius: 126,
    spectacleRadius: 174,
    shape: "flow",
    signature: "growth",
    particleBudget: budget(96, 58, 28),
    shockwaveCount: 0,
    aftermathMs: 1_250,
  },
  dirtCharge: {
    baselineMechanicalRadius: 44,
    mechanicalRadius: 64,
    readableRadius: 64,
    spectacleRadius: 112,
    shape: "wedge",
    signature: "growth",
    particleBudget: budget(72, 44, 20),
    shockwaveCount: 0,
    aftermathMs: 950,
  },
  earthDisrupter: {
    baselineMechanicalRadius: 480,
    mechanicalRadius: 480,
    readableRadius: 480,
    spectacleRadius: 520,
    shape: "global",
    signature: "gravity",
    particleBudget: budget(110, 66, 30),
    shockwaveCount: 2,
    aftermathMs: 1_300,
  },
  plasmaBlast: {
    baselineMechanicalRadius: 75,
    mechanicalRadius: 110,
    readableRadius: 110,
    spectacleRadius: 210,
    shape: "radial",
    signature: "energy",
    particleBudget: budget(158, 94, 44),
    shockwaveCount: 3,
    aftermathMs: 1_350,
  },
  laser: {
    baselineMechanicalRadius: 13,
    mechanicalRadius: 17,
    readableRadius: 17,
    spectacleRadius: 34,
    shape: "beam",
    signature: "beam",
    particleBudget: budget(76, 46, 22),
    shockwaveCount: 0,
    aftermathMs: 700,
  },
});

export function getWeaponEffectProfile(
  weaponId: WeaponId,
): WeaponEffectProfile {
  return WEAPON_EFFECT_PROFILES[weaponId];
}

export function resolveRadialDamage(input: {
  readonly peakDamage: number;
  readonly mechanicalRadius: number;
  readonly distance: number;
  readonly targetAllowance?: number;
}): number {
  const peakDamage = Math.max(0, input.peakDamage);
  const reach =
    Math.max(0, input.mechanicalRadius) +
    Math.max(0, input.targetAllowance ?? 18);
  const distance = Math.max(0, input.distance);
  if (peakDamage === 0 || distance > reach) {
    return 0;
  }
  const falloff = 1 - distance / Math.max(1, reach);
  return peakDamage * (0.22 + falloff * 0.78);
}
