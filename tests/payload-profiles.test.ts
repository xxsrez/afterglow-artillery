import { describe, expect, it } from "vitest";

import {
  airburstImpactPlan,
  airburstPayloadProfile,
  getWeapon,
  leapFrogImpactPlan,
  leapFrogImpactProfiles,
} from "../lib/game";

describe("composite payload profiles", () => {
  it("resolves MIRV as five Missile-equivalent warheads", () => {
    const profile = airburstPayloadProfile("mirv");
    const missile = getWeapon("missile").demoResolution;

    expect(profile.childCount).toBe(5);
    expect(profile.warheadRadius).toBe(missile.radius);
    expect(profile.warheadDamage).toBe(missile.damage);
  });

  it("keeps all nine Death's Head warheads individually heavy", () => {
    const profile = airburstPayloadProfile("deathsHead");
    const deathsHead = getWeapon("deathsHead").demoResolution;
    const missile = getWeapon("missile").demoResolution;

    expect(profile.childCount).toBe(9);
    expect(profile.warheadRadius).toBe(deathsHead.radius);
    expect(profile.warheadDamage).toBe(deathsHead.damage);
    expect(profile.warheadRadius).toBeGreaterThan(missile.radius);
    expect(profile.warheadDamage).toBeGreaterThan(missile.damage);
  });

  it("returns Leap Frog's three ordered radius and damage steps", () => {
    const profiles = leapFrogImpactProfiles();
    const resolution = getWeapon("leapFrog").demoResolution;

    expect(profiles).toEqual(
      [0.68, 0.84, 1].map((multiplier) => ({
        radius: resolution.radius * multiplier,
        damage: resolution.damage * multiplier,
      })),
    );
    expect(profiles).toHaveLength(3);
    expect(profiles[0]?.radius).toBeLessThan(profiles[1]?.radius ?? 0);
    expect(profiles[1]?.radius).toBeLessThan(profiles[2]?.radius ?? 0);
    expect(profiles[0]?.damage).toBeLessThan(profiles[1]?.damage ?? 0);
    expect(profiles[1]?.damage).toBeLessThan(profiles[2]?.damage ?? 0);
  });

  it("shares frozen profiles that presentation code cannot mutate", () => {
    const mirv = airburstPayloadProfile("mirv");
    const deathsHead = airburstPayloadProfile("deathsHead");
    const leapFrog = leapFrogImpactProfiles();

    expect(Object.isFrozen(mirv)).toBe(true);
    expect(Object.isFrozen(deathsHead)).toBe(true);
    expect(Object.isFrozen(leapFrog)).toBe(true);
    expect(leapFrog.every((profile) => Object.isFrozen(profile))).toBe(true);
    expect(airburstPayloadProfile("mirv")).toBe(mirv);
    expect(leapFrogImpactProfiles()).toBe(leapFrog);
  });

  it("builds the exact impact lists consumed by terrain and damage", () => {
    const mirvPoints = Array.from({ length: 5 }, (_, index) => ({
      x: index * 10,
      y: 120 + index,
    }));
    const deathsHeadPoints = Array.from({ length: 9 }, (_, index) => ({
      x: index * 12,
      y: 180 + index,
    }));
    const leapFrogPoints = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ];

    const mirv = airburstImpactPlan("mirv", mirvPoints);
    const deathsHead = airburstImpactPlan("deathsHead", deathsHeadPoints);
    const leapFrog = leapFrogImpactPlan(leapFrogPoints);

    expect(mirv).toHaveLength(5);
    expect(
      mirv.every(
        ({ radius, damage }) =>
          radius === getWeapon("missile").demoResolution.radius &&
          damage === getWeapon("missile").demoResolution.damage,
      ),
    ).toBe(true);
    expect(deathsHead).toHaveLength(9);
    expect(
      deathsHead.every(
        ({ radius, damage }) =>
          radius === getWeapon("deathsHead").demoResolution.radius &&
          damage === getWeapon("deathsHead").demoResolution.damage,
      ),
    ).toBe(true);
    expect(leapFrog.map(({ radius }) => radius)).toEqual(
      leapFrogImpactProfiles().map(({ radius }) => radius),
    );
    expect(leapFrog.map(({ damage }) => damage)).toEqual(
      leapFrogImpactProfiles().map(({ damage }) => damage),
    );
    expect(Object.isFrozen(mirv)).toBe(true);
    expect(mirv.every((impact) => Object.isFrozen(impact))).toBe(true);
  });

  it("rejects incomplete composite payloads before partial resolution", () => {
    expect(() =>
      airburstImpactPlan("mirv", [{ x: 0, y: 0 }]),
    ).toThrow(/requires 5 impact points/);
    expect(() =>
      airburstImpactPlan("deathsHead", [{ x: 0, y: 0 }]),
    ).toThrow(/requires 9 impact points/);
    expect(() =>
      leapFrogImpactPlan([{ x: 0, y: 0 }]),
    ).toThrow(/requires 3 impact points/);
  });
});
