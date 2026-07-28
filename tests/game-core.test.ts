import { describe, expect, it } from "vitest";

import {
  Material,
  SeededRandom,
  TerrainGrid,
  WEAPONS,
  WEAPON_BY_ID,
  WEAPON_IDS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  generateTerrain,
  findTerrainIntersection,
  getWeapon,
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
  it("contains the six vertical-slice roles and coherent ammo contracts", () => {
    expect(WEAPONS).toHaveLength(6);
    expect(WEAPONS.map(({ id }) => id)).toEqual(WEAPON_IDS);
    expect(new Set(WEAPONS.map(({ role }) => role)).size).toBe(6);

    expect(WEAPON_BY_ID.shell.price).toBe(0);
    expect(WEAPON_BY_ID.shell.ammo).toEqual({ kind: "unlimited" });

    for (const weapon of WEAPONS.filter(({ id }) => id !== "shell")) {
      expect(weapon.price).toBeGreaterThan(0);
      expect(weapon.ammo.kind).toBe("finite");

      if (weapon.ammo.kind === "finite") {
        expect(weapon.ammo.bundleSize).toBeGreaterThan(0);
      }

      expect(getWeapon(weapon.id)).toBe(weapon);
    }
  });
});
