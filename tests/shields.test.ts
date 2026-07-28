import { describe, expect, it } from "vitest";

import {
  SHIELDS,
  resolveShieldDamage,
  resolveShieldDeflection,
  shieldCapacity,
  type ShieldId,
} from "../lib/game";

describe("shield catalog", () => {
  it("keeps None plus five source-grounded families under original public names", () => {
    expect(SHIELDS).toHaveLength(6);
    expect(SHIELDS.map(({ id }) => id)).toEqual([
      "none",
      "mag-deflector",
      "shield",
      "force-shield",
      "heavy-shield",
      "super-mag",
    ]);
    expect(SHIELDS.slice(1).map(({ classicName }) => classicName)).toEqual([
      "Mag Deflector",
      "Shield",
      "Force Shield",
      "Heavy Shield",
      "Super Mag",
    ]);
    expect(
      SHIELDS.slice(1).every(
        ({ name, classicName }) => String(name) !== classicName,
      ),
    ).toBe(true);
  });

  it("uses explicit deterministic demo capacities instead of inferred classic values", () => {
    expect(SHIELDS.map(({ id }) => shieldCapacity(id))).toEqual([
      0, 36, 46, 42, 82, 68,
    ]);
    expect(shieldCapacity("heavy-shield", 25)).toBe(107);
  });
});

describe("shield damage resolution", () => {
  it("absorbs damage and reports a break when capacity is exhausted", () => {
    expect(
      resolveShieldDamage(
        { shieldId: "shield", capacity: 46 },
        {
          incomingDamage: 30,
          kind: "blast",
          ownerIsTarget: false,
          directHit: false,
        },
      ),
    ).toEqual({
      healthDamage: 0,
      remainingCapacity: 16,
      event: {
        type: "absorb",
        shieldId: "shield",
        absorbed: 30,
        healthDamage: 0,
        remainingCapacity: 16,
      },
    });

    expect(
      resolveShieldDamage(
        { shieldId: "shield", capacity: 20 },
        {
          incomingDamage: 60,
          kind: "blast",
          ownerIsTarget: false,
          directHit: false,
        },
      ),
    ).toEqual({
      healthDamage: 40,
      remainingCapacity: 0,
      event: {
        type: "break",
        shieldId: "shield",
        absorbed: 20,
        healthDamage: 40,
        remainingCapacity: 0,
      },
    });
  });

  it("bypasses a self-fired direct hit but shields a secondary self effect", () => {
    const direct = resolveShieldDamage(
      { shieldId: "heavy-shield", capacity: 82 },
      {
        incomingDamage: 20,
        kind: "blast",
        ownerIsTarget: true,
        directHit: true,
      },
    );
    const secondary = resolveShieldDamage(
      { shieldId: "heavy-shield", capacity: 82 },
      {
        incomingDamage: 20,
        kind: "blast",
        ownerIsTarget: true,
        directHit: false,
      },
    );

    expect(direct).toMatchObject({
      healthDamage: 20,
      remainingCapacity: 82,
      event: { type: "bypass", reason: "self-direct" },
    });
    expect(secondary).toMatchObject({
      healthDamage: 0,
      remainingCapacity: 62,
      event: { type: "absorb" },
    });
  });

  it("lets Laser through an ordinary shield and blocks it with Magnetar", () => {
    const ordinary = resolveShieldDamage(
      { shieldId: "shield", capacity: 46 },
      {
        incomingDamage: 32,
        kind: "laser",
        ownerIsTarget: false,
        directHit: true,
        bypassFraction: 1,
      },
    );
    const magnetar = resolveShieldDamage(
      { shieldId: "super-mag", capacity: 68 },
      {
        incomingDamage: 32,
        kind: "laser",
        ownerIsTarget: false,
        directHit: true,
        bypassFraction: 1,
      },
    );

    expect(ordinary).toMatchObject({
      healthDamage: 32,
      remainingCapacity: 46,
      event: { type: "bypass", reason: "weapon" },
    });
    expect(magnetar).toEqual({
      healthDamage: 0,
      remainingCapacity: 68,
      event: {
        type: "laser-immunity",
        shieldId: "super-mag",
        remainingCapacity: 68,
      },
    });
  });

  it("applies the declared underground bypass while napalm remains shieldable", () => {
    const underground = resolveShieldDamage(
      { shieldId: "shield", capacity: 46 },
      {
        incomingDamage: 100,
        kind: "underground",
        ownerIsTarget: false,
        directHit: false,
        bypassFraction: 0.82,
      },
    );
    const napalm = resolveShieldDamage(
      { shieldId: "shield", capacity: 46 },
      {
        incomingDamage: 24,
        kind: "napalm",
        ownerIsTarget: false,
        directHit: false,
      },
    );

    expect(underground.healthDamage).toBeCloseTo(82);
    expect(underground.remainingCapacity).toBeCloseTo(28);
    expect(napalm).toMatchObject({
      healthDamage: 0,
      remainingCapacity: 22,
      event: { type: "absorb" },
    });
  });

  it("returns the same mechanics for every presentation effect level", () => {
    const results = (["full", "balanced", "reduced"] as const).map(() =>
      resolveShieldDamage(
        { shieldId: "force-shield", capacity: 42 },
        {
          incomingDamage: 20,
          kind: "plasma",
          ownerIsTarget: false,
          directHit: false,
        },
      ),
    );

    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
});

describe("shield deflection", () => {
  it.each([
    ["mag-deflector", { x: 100, y: 62 }, 28],
    ["force-shield", { x: 130, y: 82 }, 32],
    ["super-mag", { x: 118, y: 66 }, 59],
  ] satisfies readonly [ShieldId, { x: number; y: number }, number][])(
    "deflects %s deterministically and consumes only that shield",
    (shieldId, expectedPoint, expectedCapacity) => {
      const input = {
        impact: { x: 100, y: 100 },
        tankCenter: { x: 100, y: 100 },
        ownerIsTarget: false,
        incomingDirection: 1 as const,
      };
      const capacity = shieldCapacity(shieldId);
      const first = resolveShieldDeflection(
        { shieldId, capacity },
        input,
      );
      const replay = resolveShieldDeflection(
        { shieldId, capacity },
        input,
      );

      expect(first).toEqual(replay);
      expect(first.point).toEqual(expectedPoint);
      expect(first.remainingCapacity).toBe(expectedCapacity);
      expect(first.event).toMatchObject({ type: "deflect", shieldId });
    },
  );

  it("does not deflect the owner's own projectile or a distant impact", () => {
    const state = { shieldId: "mag-deflector" as const, capacity: 36 };
    const own = resolveShieldDeflection(state, {
      impact: { x: 100, y: 100 },
      tankCenter: { x: 100, y: 100 },
      ownerIsTarget: true,
      incomingDirection: 1,
    });
    const distant = resolveShieldDeflection(state, {
      impact: { x: 200, y: 100 },
      tankCenter: { x: 100, y: 100 },
      ownerIsTarget: false,
      incomingDirection: 1,
    });

    expect(own.event).toBeNull();
    expect(distant.event).toBeNull();
    expect(own.remainingCapacity).toBe(36);
    expect(distant.remainingCapacity).toBe(36);
  });

  it("keeps two players' selected families and capacities independent across turns", () => {
    const players = [
      { shieldId: "mag-deflector" as ShieldId, capacity: 36 },
      { shieldId: "heavy-shield" as ShieldId, capacity: 82 },
    ];
    const turnOrder = [0, 1, 0] as const;

    const snapshots = turnOrder.map((activePlayer) => ({
      activePlayer,
      selected: players[activePlayer]?.shieldId,
      capacity: players[activePlayer]?.capacity,
    }));

    expect(snapshots).toEqual([
      { activePlayer: 0, selected: "mag-deflector", capacity: 36 },
      { activePlayer: 1, selected: "heavy-shield", capacity: 82 },
      { activePlayer: 0, selected: "mag-deflector", capacity: 36 },
    ]);
  });
});
