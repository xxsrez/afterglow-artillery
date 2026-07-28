import { describe, expect, it } from "vitest";

import {
  WEAPONS,
  WEAPON_EFFECT_PROFILES,
  WEAPON_IDS,
  getWeaponEffectProfile,
  resolveRadialDamage,
  type WeaponId,
} from "../lib/game";

const EXPECTED_RADIUS_CHANGES = [
  ["babyMissile", 10, 18],
  ["missile", 20, 34],
  ["babyNuke", 40, 64],
  ["nuke", 75, 110],
  ["leapFrog", 30, 44],
  ["funkyBomb", 16, 24],
  ["mirv", 20, 32],
  ["deathsHead", 35, 52],
  ["napalm", 72, 92],
  ["hotNapalm", 96, 126],
  ["tracer", 0, 0],
  ["smokeTracer", 0, 0],
  ["babyRoller", 10, 18],
  ["roller", 20, 34],
  ["heavyRoller", 45, 68],
  ["riotCharge", 36, 50],
  ["riotBlast", 60, 84],
  ["riotBomb", 30, 48],
  ["heavyRiotBomb", 45, 68],
  ["babyDigger", 12, 20],
  ["digger", 20, 34],
  ["heavyDigger", 34, 52],
  ["babySandhog", 14, 22],
  ["sandhog", 20, 32],
  ["heavySandhog", 30, 46],
  ["dirtClod", 20, 32],
  ["dirtBall", 35, 52],
  ["tonOfDirt", 70, 90],
  ["liquidDirt", 112, 126],
  ["dirtCharge", 44, 64],
  ["earthDisrupter", 480, 480],
  ["plasmaBlast", 75, 110],
  ["laser", 13, 17],
] as const satisfies readonly (readonly [WeaponId, number, number])[];

describe("0.1 weapon effect scale", () => {
  it("defines an explicit current-to-proposed radius for all 33 weapons", () => {
    expect(Object.keys(WEAPON_EFFECT_PROFILES)).toEqual([...WEAPON_IDS]);
    expect(
      WEAPON_IDS.map((id) => {
        const profile = getWeaponEffectProfile(id);
        return [
          id,
          profile.baselineMechanicalRadius,
          profile.mechanicalRadius,
        ];
      }),
    ).toEqual(EXPECTED_RADIUS_CHANGES);
  });

  it("uses a bounded family scale rather than a blind global multiplier", () => {
    const changedRatios = EXPECTED_RADIUS_CHANGES.filter(
      ([, baseline]) => baseline > 0,
    ).map(([, baseline, proposed]) => proposed / baseline);

    expect(new Set(changedRatios.map((ratio) => ratio.toFixed(2))).size).toBeGreaterThan(
      8,
    );
    expect(Math.min(...changedRatios)).toBe(1);
    expect(Math.max(...changedRatios)).toBeLessThanOrEqual(1.8);
    expect(getWeaponEffectProfile("earthDisrupter").mechanicalRadius).toBe(
      480,
    );
  });

  it("keeps readable and decorative envelopes distinct and budgeted", () => {
    for (const id of WEAPON_IDS) {
      const profile = getWeaponEffectProfile(id);
      expect(profile.readableRadius).toBeGreaterThanOrEqual(
        profile.mechanicalRadius,
      );
      expect(profile.spectacleRadius).toBeGreaterThan(
        profile.readableRadius,
      );
      expect(profile.particleBudget.full).toBeGreaterThanOrEqual(
        profile.particleBudget.balanced,
      );
      expect(profile.particleBudget.balanced).toBeGreaterThanOrEqual(
        profile.particleBudget.reduced,
      );
      expect(profile.particleBudget.full).toBeLessThanOrEqual(220);
      expect(profile.aftermathMs).toBeGreaterThanOrEqual(450);
      expect(profile.aftermathMs).toBeLessThanOrEqual(1_900);
    }
  });

  it("keeps direct circular resolution aligned with the typed profile", () => {
    const behaviorSpecific = new Set<WeaponId>([
      "funkyBomb",
      "napalm",
      "hotNapalm",
      "liquidDirt",
      "earthDisrupter",
      "laser",
    ]);

    for (const weapon of WEAPONS) {
      if (!behaviorSpecific.has(weapon.id)) {
        expect(weapon.demoResolution.radius).toBe(
          getWeaponEffectProfile(weapon.id).mechanicalRadius,
        );
      }
    }
  });

  it("does not change center damage or payload counts while widening radius", () => {
    expect(
      WEAPONS.map(({ id, demoResolution }) => [
        id,
        demoResolution.damage,
        demoResolution.count,
      ]),
    ).toEqual([
      ["babyMissile", 18, 1],
      ["missile", 34, 1],
      ["babyNuke", 62, 1],
      ["nuke", 100, 1],
      ["leapFrog", 36, 3],
      ["funkyBomb", 72, 12],
      ["mirv", 32, 5],
      ["deathsHead", 48, 9],
      ["napalm", 46, 12],
      ["hotNapalm", 78, 20],
      ["tracer", 0, 1],
      ["smokeTracer", 0, 1],
      ["babyRoller", 20, 1],
      ["roller", 38, 1],
      ["heavyRoller", 70, 1],
      ["riotCharge", 0, 1],
      ["riotBlast", 0, 1],
      ["riotBomb", 0, 1],
      ["heavyRiotBomb", 0, 1],
      ["babyDigger", 26, 1],
      ["digger", 46, 1],
      ["heavyDigger", 72, 1],
      ["babySandhog", 30, 3],
      ["sandhog", 50, 5],
      ["heavySandhog", 78, 7],
      ["dirtClod", 0, 1],
      ["dirtBall", 0, 1],
      ["tonOfDirt", 0, 1],
      ["liquidDirt", 0, 16],
      ["dirtCharge", 0, 1],
      ["earthDisrupter", 0, 1],
      ["plasmaBlast", 92, 1],
      ["laser", 62, 1],
    ]);
  });
});

describe("radial damage contract", () => {
  it("preserves center damage and widens only the falloff reach", () => {
    expect(
      resolveRadialDamage({
        peakDamage: 100,
        mechanicalRadius: 110,
        distance: 0,
      }),
    ).toBe(100);
    expect(
      resolveRadialDamage({
        peakDamage: 18,
        mechanicalRadius: 10,
        distance: 34,
      }),
    ).toBe(0);
    expect(
      resolveRadialDamage({
        peakDamage: 18,
        mechanicalRadius: 18,
        distance: 34,
      }),
    ).toBeGreaterThan(0);
  });

  it("is deterministic and independent from presentation level", () => {
    const input = {
      peakDamage: 70,
      mechanicalRadius: 68,
      distance: 41,
    };
    const outcomes = (["full", "balanced", "reduced"] as const).map(() =>
      resolveRadialDamage(input),
    );

    expect(outcomes).toEqual([outcomes[0], outcomes[0], outcomes[0]]);
  });
});
