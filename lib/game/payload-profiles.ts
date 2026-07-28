import { getWeapon, type WeaponId } from "./weapons";
import type { Vector2 } from "./types";

export type AirburstPayloadWeaponId = Extract<
  WeaponId,
  "mirv" | "deathsHead"
>;

export interface AirburstPayloadProfile {
  readonly weaponId: AirburstPayloadWeaponId;
  readonly childCount: number;
  readonly warheadRadius: number;
  readonly warheadDamage: number;
}

export interface LeapFrogImpactProfile {
  readonly radius: number;
  readonly damage: number;
}

export interface PayloadImpact {
  readonly point: Vector2;
  readonly radius: number;
  readonly damage: number;
}

const missileResolution = getWeapon("missile").demoResolution;
const mirvResolution = getWeapon("mirv").demoResolution;
const deathsHeadResolution = getWeapon("deathsHead").demoResolution;
const leapFrogResolution = getWeapon("leapFrog").demoResolution;

const AIRBURST_PAYLOAD_PROFILES = Object.freeze({
  mirv: Object.freeze({
    weaponId: "mirv",
    childCount: mirvResolution.count,
    warheadRadius: missileResolution.radius,
    warheadDamage: missileResolution.damage,
  }),
  deathsHead: Object.freeze({
    weaponId: "deathsHead",
    childCount: deathsHeadResolution.count,
    warheadRadius: deathsHeadResolution.radius,
    warheadDamage: deathsHeadResolution.damage,
  }),
} satisfies Readonly<
  Record<AirburstPayloadWeaponId, AirburstPayloadProfile>
>);

const LEAP_FROG_MULTIPLIERS = Object.freeze([0.68, 0.84, 1] as const);

const LEAP_FROG_IMPACT_PROFILES: readonly LeapFrogImpactProfile[] =
  Object.freeze(
    LEAP_FROG_MULTIPLIERS.map((multiplier) =>
      Object.freeze({
        radius: leapFrogResolution.radius * multiplier,
        damage: leapFrogResolution.damage * multiplier,
      }),
    ),
  );

/**
 * Mechanical payload for the two apogee-splitting weapons in Quick Demo.
 * MIRV children deliberately inherit the current Missile resolution, while
 * each Death's Head child keeps that weapon's heavier provisional resolution.
 */
export function airburstPayloadProfile(
  weaponId: AirburstPayloadWeaponId,
): AirburstPayloadProfile {
  return AIRBURST_PAYLOAD_PROFILES[weaponId];
}

/**
 * Three ordered impacts used by Leap Frog in Quick Demo.
 */
export function leapFrogImpactProfiles(): readonly LeapFrogImpactProfile[] {
  return LEAP_FROG_IMPACT_PROFILES;
}

function requireImpactCount(
  payload: string,
  actual: number,
  expected: number,
): void {
  if (actual !== expected) {
    throw new RangeError(
      `${payload} requires ${expected} impact points, received ${actual}`,
    );
  }
}

function payloadImpact(
  point: Vector2,
  profile: LeapFrogImpactProfile,
): PayloadImpact {
  return Object.freeze({
    point: Object.freeze({ x: point.x, y: point.y }),
    radius: profile.radius,
    damage: profile.damage,
  });
}

/**
 * Exact impact list consumed by terrain and damage resolution after an
 * airburst carrier has split.
 */
export function airburstImpactPlan(
  weaponId: AirburstPayloadWeaponId,
  impactPoints: readonly Vector2[],
): readonly PayloadImpact[] {
  const profile = airburstPayloadProfile(weaponId);
  requireImpactCount(weaponId, impactPoints.length, profile.childCount);

  return Object.freeze(
    impactPoints.map((point) =>
      payloadImpact(point, {
        radius: profile.warheadRadius,
        damage: profile.warheadDamage,
      }),
    ),
  );
}

/**
 * Exact ordered impact list consumed by Leap Frog terrain/damage resolution.
 */
export function leapFrogImpactPlan(
  impactPoints: readonly Vector2[],
): readonly PayloadImpact[] {
  const profiles = leapFrogImpactProfiles();
  requireImpactCount("leapFrog", impactPoints.length, profiles.length);

  return Object.freeze(
    impactPoints.map((point, index) =>
      payloadImpact(point, profiles[index] as LeapFrogImpactProfile),
    ),
  );
}
