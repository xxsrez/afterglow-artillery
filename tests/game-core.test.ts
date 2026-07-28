import { describe, expect, it } from "vitest";

import {
  CLASSIC_INTEREST_RATE,
  DEMO_PARTIAL_BUNDLE_MARKUP_RATE,
  DEMO_SELLBACK_RATE,
  MAX_INVENTORY,
  Material,
  SeededRandom,
  TerrainGrid,
  WEAPONS,
  WEAPON_BY_ID,
  WEAPON_IDS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  applyInterest,
  calculateInterest,
  createDemoInventory,
  generateTerrain,
  findTerrainIntersection,
  getWeapon,
  purchaseWeapon,
  quoteWeaponSale,
  quoteWeaponPurchase,
  sellWeapon,
  simulateTrajectory,
} from "../lib/game/index";

describe("seeded game core", () => {
  it("replays the same random sequence and terrain from the same seed", () => {
    const firstRandom = new SeededRandom("glowing-horizon");
    const secondRandom = new SeededRandom("glowing-horizon");

    const firstSequence = Array.from({ length: 12 }, () =>
      firstRandom.nextUint32(),
    );
    const secondSequence = Array.from({ length: 12 }, () =>
      secondRandom.nextUint32(),
    );

    expect(firstSequence).toEqual(secondSequence);

    const firstTerrain = generateTerrain(42, {
      width: 160,
      height: 100,
      caveCount: 2,
    });
    const replayedTerrain = generateTerrain(42, {
      width: 160,
      height: 100,
      caveCount: 2,
    });
    const differentTerrain = generateTerrain(43, {
      width: 160,
      height: 100,
      caveCount: 2,
    });

    expect(firstTerrain.cells).toEqual(replayedTerrain.cells);
    expect(firstTerrain.cells).not.toEqual(differentTerrain.cells);
  });

  it("uses the canonical logical world dimensions", () => {
    const terrain = generateTerrain("world-size", { caveCount: 0 });

    expect(WORLD_WIDTH).toBe(960);
    expect(WORLD_HEIGHT).toBe(540);
    expect(terrain.width).toBe(WORLD_WIDTH);
    expect(terrain.height).toBe(WORLD_HEIGHT);
    expect(terrain.cells).toBeInstanceOf(Uint8Array);
    expect(terrain.cells).toHaveLength(WORLD_WIDTH * WORLD_HEIGHT);
  });

  it("rejects dimensions too small for terrain generation", () => {
    expect(() =>
      generateTerrain("too-narrow", { width: 1, height: 20 }),
    ).toThrow(/width >= 2/i);
    expect(() =>
      generateTerrain("too-short", { width: 20, height: 2 }),
    ).toThrow(/height >= 3/i);
  });
});

describe("TerrainGrid", () => {
  it("carves a crater and can fill the same logical area", () => {
    const terrain = new TerrainGrid(64, 48);
    const initialFill = terrain.fillCircle(32, 24, 12, Material.Soil);

    expect(initialFill.changedCells).toBeGreaterThan(400);
    expect(terrain.isSolid(32, 24)).toBe(true);

    const crater = terrain.carveCircle(32, 24, 6);

    expect(crater.changedCells).toBeGreaterThan(100);
    expect(crater.bounds).toEqual({ x: 26, y: 18, width: 13, height: 13 });
    expect(terrain.isSolid(32, 24)).toBe(false);
    expect(terrain.isSolid(32, 31)).toBe(true);

    const refill = terrain.fillCircle(32, 24, 6, Material.Rock);

    expect(refill.changedCells).toBe(crater.changedCells);
    expect(terrain.get(32, 24)).toBe(Material.Rock);
  });

  it("settles loose material within explicit work budgets", () => {
    const terrain = new TerrainGrid(8, 10);
    terrain.set(3, 2, Material.Soil);

    const firstPass = terrain.settle({ maxPasses: 2, maxMoves: 2 });

    expect(firstPass.movedCells).toBe(2);
    expect(firstPass.passes).toBe(2);
    expect(firstPass.stable).toBe(false);
    expect(terrain.get(3, 4)).toBe(Material.Soil);

    const rest = terrain.settle({ maxPasses: 10, maxMoves: 10 });

    expect(rest.stable).toBe(true);
    expect(terrain.get(3, 9)).toBe(Material.Soil);
  });

  it("uses collision geometry when carving crater cells", () => {
    const terrain = new TerrainGrid(40, 40);

    for (let y = 0; y < terrain.height; y += 1) {
      for (let x = 0; x < terrain.width; x += 1) {
        terrain.set(x, y, Material.Soil);
      }
    }

    const center = { x: 20.25, y: 19.75 };
    const radius = 5.5;
    terrain.carveCircle(center.x, center.y, radius);

    expect(
      findTerrainIntersection(terrain, center, center, radius),
    ).toBeNull();
  });
});

describe("ballistic trajectory", () => {
  it("uses swept collision so a projectile cannot skip thin terrain", () => {
    const terrain = new TerrainGrid(220, 130);

    for (let x = 0; x < terrain.width; x += 1) {
      terrain.set(x, 82, Material.Soil);
    }

    const trajectory = simulateTrajectory(terrain, {
      origin: { x: 20, y: 70 },
      angleDegrees: 0,
      power: 220,
      powerScale: 1,
      gravity: 180,
      wind: 0,
      timeStep: 1 / 10,
      maxTime: 2,
    });

    expect(trajectory.reason).toBe("terrain");
    expect(trajectory.collision?.type).toBe("terrain");
    expect(trajectory.collision?.cell?.y).toBe(82);
    expect(trajectory.collision?.position.y).toBeGreaterThanOrEqual(82);
    expect(trajectory.points.at(-1)?.time).toBeLessThan(1);
  });

  it("applies wind deterministically without mutating terrain", () => {
    const terrain = new TerrainGrid(500, 200);
    const before = terrain.cells.slice();
    const options = {
      origin: { x: 250, y: 100 },
      angleDegrees: 90,
      power: 120,
      powerScale: 1,
      gravity: 100,
      wind: 40,
      maxTime: 1,
    } as const;

    const first = simulateTrajectory(terrain, options);
    const replay = simulateTrajectory(terrain, options);

    expect(first).toEqual(replay);
    expect(first.points.at(-1)?.x).toBeGreaterThan(options.origin.x);
    expect(terrain.cells).toEqual(before);
  });
});

describe("weapon catalog", () => {
  it("contains exactly the 33 canonical weapons in manual order", () => {
    const expectedIds = [
      "babyMissile",
      "missile",
      "babyNuke",
      "nuke",
      "leapFrog",
      "funkyBomb",
      "mirv",
      "deathsHead",
      "napalm",
      "hotNapalm",
      "tracer",
      "smokeTracer",
      "babyRoller",
      "roller",
      "heavyRoller",
      "riotCharge",
      "riotBlast",
      "riotBomb",
      "heavyRiotBomb",
      "babyDigger",
      "digger",
      "heavyDigger",
      "babySandhog",
      "sandhog",
      "heavySandhog",
      "dirtClod",
      "dirtBall",
      "tonOfDirt",
      "liquidDirt",
      "dirtCharge",
      "earthDisrupter",
      "plasmaBlast",
      "laser",
    ];

    expect(WEAPONS).toHaveLength(33);
    expect(WEAPON_IDS).toEqual(expectedIds);
    expect(WEAPONS.map(({ id }) => id)).toEqual(WEAPON_IDS);

    for (const weapon of WEAPONS) {
      expect(getWeapon(weapon.id)).toBe(weapon);
    }
  });

  it("preserves every canonical price, bundle, radius, and Arms row", () => {
    expect(WEAPONS.map(({ classicName }) => classicName)).toEqual([
      "Baby Missile",
      "Missile",
      "Baby Nuke",
      "Nuke",
      "Leap Frog",
      "Funky Bomb",
      "MIRV",
      "Death's Head",
      "Napalm",
      "Hot Napalm",
      "Tracer",
      "Smoke Tracer",
      "Baby Roller",
      "Roller",
      "Heavy Roller",
      "Riot Charge",
      "Riot Blast",
      "Riot Bomb",
      "Heavy Riot Bomb",
      "Baby Digger",
      "Digger",
      "Heavy Digger",
      "Baby Sandhog",
      "Sandhog",
      "Heavy Sandhog",
      "Dirt Clod",
      "Dirt Ball",
      "Ton of Dirt",
      "Liquid Dirt",
      "Dirt Charge",
      "Earth Disrupter",
      "Plasma Blast",
      "Laser",
    ]);
    expect(
      WEAPONS.map(
        ({ id, catalogPrice, catalogBundleSize, blastRadius, armsLevel }) => [
          id,
          catalogPrice,
          catalogBundleSize,
          blastRadius,
          armsLevel,
        ],
      ),
    ).toEqual([
      ["babyMissile", 400, 10, 10, 0],
      ["missile", 1_875, 5, 20, 0],
      ["babyNuke", 10_000, 3, 40, 0],
      ["nuke", 12_000, 1, 75, 1],
      ["leapFrog", 10_000, 2, [20, 25, 30], 3],
      ["funkyBomb", 7_000, 2, 80, 4],
      ["mirv", 10_000, 3, 20, 2],
      ["deathsHead", 20_000, 1, 35, 4],
      ["napalm", 10_000, 10, null, 2],
      ["hotNapalm", 20_000, 2, null, 4],
      ["tracer", 10, 20, 0, 0],
      ["smokeTracer", 500, 10, 0, 1],
      ["babyRoller", 5_000, 10, 10, 2],
      ["roller", 6_000, 5, 20, 2],
      ["heavyRoller", 6_750, 2, 45, 3],
      ["riotCharge", 2_000, 10, 36, 2],
      ["riotBlast", 5_000, 5, 60, 3],
      ["riotBomb", 5_000, 5, 30, 3],
      ["heavyRiotBomb", 4_750, 2, 45, 3],
      ["babyDigger", 3_000, 10, null, 0],
      ["digger", 2_500, 5, null, 0],
      ["heavyDigger", 6_750, 2, null, 1],
      ["babySandhog", 10_000, 10, null, 0],
      ["sandhog", 16_750, 5, null, 0],
      ["heavySandhog", 25_000, 2, null, 1],
      ["dirtClod", 5_000, 10, 20, 0],
      ["dirtBall", 5_000, 5, 35, 0],
      ["tonOfDirt", 6_750, 2, 70, 1],
      ["liquidDirt", 5_000, 10, null, 2],
      ["dirtCharge", 5_000, 5, null, 1],
      ["earthDisrupter", 5_000, 10, null, 0],
      ["plasmaBlast", 9_000, 5, { min: 10, max: 75 }, 3],
      ["laser", 5_000, 5, null, 2],
    ]);

    expect(WEAPON_BY_ID.funkyBomb).toMatchObject({
      name: "Funky Bomb",
      classicName: "Funky Bomb",
    });
    expect(WEAPON_BY_ID.mirv).toMatchObject({
      name: "Prism MIRV",
      classicName: "MIRV",
    });
    expect(WEAPON_BY_ID.deathsHead).toMatchObject({
      name: "Death Crown",
      classicName: "Death's Head",
    });
    expect(WEAPON_BY_ID.laser).toMatchObject({
      name: "Sunline",
      classicName: "Laser",
      catalogPrice: 5_000,
      catalogBundleSize: 5,
      blastRadius: null,
      armsLevel: 2,
    });
  });

  it("keeps Baby Missile free and unlimited while retaining its catalog row", () => {
    expect(WEAPON_BY_ID.babyMissile).toMatchObject({
      price: 0,
      catalogPrice: 400,
      catalogBundleSize: 10,
      ammo: { kind: "unlimited" },
    });

    for (const weapon of WEAPONS.slice(1)) {
      expect(weapon.price).toBe(weapon.catalogPrice);
      expect(weapon.ammo).toEqual({
        kind: "finite",
        bundleSize: weapon.catalogBundleSize,
      });
    }
  });
});

describe("weapon economy", () => {
  it("creates one demo shot for every finite weapon only", () => {
    const inventory = createDemoInventory();
    const finiteWeapons = WEAPONS.filter(
      (weapon) => weapon.ammo.kind === "finite",
    );

    expect(Object.keys(inventory)).toHaveLength(32);
    expect(inventory.babyMissile).toBeUndefined();

    for (const weapon of finiteWeapons) {
      expect(inventory[weapon.id]).toBe(1);
    }
  });

  it("quotes a full bundle at the exact catalog price", () => {
    const quote = quoteWeaponPurchase("mirv", {});

    expect(quote).toEqual({
      kind: "available",
      weaponId: "mirv",
      currentQuantity: 0,
      quantity: 3,
      resultingQuantity: 3,
      catalogBundleSize: 3,
      price: 10_000,
      isPartialBundle: false,
      markupRate: 0,
    });
  });

  it("caps inventory at 99 and applies the partial-bundle markup", () => {
    const inventory = { missile: 97 };
    const quote = quoteWeaponPurchase("missile", inventory);
    const result = purchaseWeapon({
      weaponId: "missile",
      inventory,
      credits: 2_000,
    });

    expect(MAX_INVENTORY).toBe(99);
    expect(DEMO_PARTIAL_BUNDLE_MARKUP_RATE).toBe(0.2);
    expect(quote).toMatchObject({
      kind: "available",
      quantity: 2,
      resultingQuantity: 99,
      price: 900,
      isPartialBundle: true,
      markupRate: 0.2,
    });
    expect(result).toMatchObject({
      ok: true,
      credits: 1_100,
      spent: 900,
      inventory: { missile: 99 },
    });
    expect(inventory).toEqual({ missile: 97 });
    expect(quoteWeaponPurchase("missile", { missile: 99 })).toMatchObject({
      kind: "unavailable",
      reason: "inventory-full",
    });
  });

  it("returns a mutation-free failure when credits are insufficient", () => {
    const inventory = { nuke: 2 };
    const result = purchaseWeapon({
      weaponId: "nuke",
      inventory,
      credits: 11_999,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "insufficient-credits",
      credits: 11_999,
      spent: 0,
      inventory: { nuke: 2 },
    });
    expect(result.inventory).not.toBe(inventory);
    expect(inventory).toEqual({ nuke: 2 });
  });

  it("calculates the classic 5% interest without mutating a balance", () => {
    expect(CLASSIC_INTEREST_RATE).toBe(0.05);
    expect(calculateInterest(1_000)).toBe(50);
    expect(applyInterest(1_000)).toBe(1_050);
    expect(calculateInterest(101)).toBe(5);
  });

  it("quotes and applies the explicit provisional sell-back policy", () => {
    const inventory = { missile: 3 };
    const quote = quoteWeaponSale("missile", inventory, 2);
    const result = sellWeapon({
      weaponId: "missile",
      inventory,
      credits: 100,
      quantity: 2,
    });

    expect(DEMO_SELLBACK_RATE).toBe(0.6);
    expect(quote).toEqual({
      kind: "available",
      weaponId: "missile",
      currentQuantity: 3,
      requestedQuantity: 2,
      quantity: 2,
      resultingQuantity: 1,
      proceeds: 450,
      sellbackRate: 0.6,
    });
    expect(result).toMatchObject({
      ok: true,
      inventory: { missile: 1 },
      credits: 550,
      earned: 450,
    });
    expect(inventory).toEqual({ missile: 3 });
  });

  it("does not sell unlimited or unavailable ammo", () => {
    expect(quoteWeaponSale("babyMissile", {})).toMatchObject({
      kind: "unavailable",
      reason: "unlimited-weapon",
    });
    expect(quoteWeaponSale("laser", {})).toMatchObject({
      kind: "unavailable",
      reason: "no-inventory",
    });
    expect(quoteWeaponSale("laser", { laser: 1 }, 2)).toMatchObject({
      kind: "unavailable",
      reason: "insufficient-inventory",
    });
  });
});
