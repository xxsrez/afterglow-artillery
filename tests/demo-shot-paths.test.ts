import { describe, expect, it } from "vitest";

import {
  DEMO_BEHAVIORS,
  Material,
  TerrainGrid,
  WEAPON_IDS,
  buildDiggerPath,
  buildFlowPoints,
  buildFunkyChain,
  buildRollPath,
  buildUndergroundFan,
  getDemoBehavior,
  terrainSurfaceOrFloor,
  trajectoryApexIndex,
  type TrajectoryPoint,
} from "../lib/game";

function slopedTerrain(): TerrainGrid {
  const terrain = new TerrainGrid(160, 100);
  for (let x = 0; x < terrain.width; x += 1) {
    const surface = 55 + Math.floor(x / 24);
    for (let y = surface; y < terrain.height; y += 1) {
      terrain.set(x, y, Material.Soil);
    }
  }
  return terrain;
}

describe("Quick Demo behavior registry", () => {
  it("covers all 33 weapons exactly once with bounded tiers", () => {
    expect(Object.keys(DEMO_BEHAVIORS)).toEqual(WEAPON_IDS);
    for (const id of WEAPON_IDS) {
      const behavior = getDemoBehavior(id);
      expect(behavior.tier).toBeGreaterThanOrEqual(1);
      expect(behavior.tier).toBeLessThanOrEqual(4);
    }
  });
});

describe("Quick Demo shot paths", () => {
  it("builds deterministic bounded paths independently of React and Canvas", () => {
    const terrain = slopedTerrain();
    const impact = { x: 80, y: 54 };

    const firstFunky = buildFunkyChain(terrain, impact, 14, 51_101);
    const replayedFunky = buildFunkyChain(terrain, impact, 14, 51_101);
    const differentFunky = buildFunkyChain(terrain, impact, 14, 51_102);
    expect(firstFunky).toEqual(replayedFunky);
    expect(firstFunky).not.toEqual(differentFunky);
    expect(firstFunky).toHaveLength(14);

    const firstFan = buildUndergroundFan(terrain, impact, 5, 3, 71_303);
    expect(firstFan).toEqual(
      buildUndergroundFan(terrain, impact, 5, 3, 71_303),
    );
    expect(firstFan).toHaveLength(5);
    expect(firstFan.every((path) => path.length === 35)).toBe(true);

    for (const point of [...firstFunky, ...firstFan.flat()]) {
      expect(point.x).toBeGreaterThanOrEqual(4);
      expect(point.x).toBeLessThanOrEqual(terrain.width - 4);
      expect(point.y).toBeGreaterThanOrEqual(4);
      expect(point.y).toBeLessThanOrEqual(terrain.height - 5);
    }
  });

  it("keeps roller, flow and digger helpers on the terrain grid", () => {
    const terrain = slopedTerrain();
    const impact = { x: 80, y: 58 };
    const roll = buildRollPath(terrain, impact);
    const flow = buildFlowPoints(terrain, impact, 36);
    const digger = buildDiggerPath(terrain, impact, { x: 4, y: 7 });

    expect(roll.length).toBeGreaterThan(1);
    expect(flow).toHaveLength(7);
    expect(digger).toHaveLength(63);
    expect(roll).toEqual(buildRollPath(terrain, impact));
    expect(digger.at(-1)?.y).toBeGreaterThan(impact.y);

    for (const point of [...roll, ...flow, ...digger]) {
      expect(point.x).toBeGreaterThanOrEqual(3);
      expect(point.x).toBeLessThanOrEqual(terrain.width - 3);
      expect(point.y).toBeLessThan(terrain.height);
    }
  });

  it("uses the documented floor fallback and identifies a real apex", () => {
    const empty = new TerrainGrid(80, 60);
    expect(terrainSurfaceOrFloor(empty, 40)).toBe(34);

    const point = (
      velocityY: number,
      time: number,
    ): TrajectoryPoint => ({
      x: time * 4,
      y: time * 2,
      time,
      velocityX: 12,
      velocityY,
    });
    const trajectory = [
      point(-10, 0),
      point(-7, 1),
      point(-2, 2),
      point(1, 3),
      point(4, 4),
    ];

    expect(trajectoryApexIndex(trajectory)).toBe(3);
    expect(trajectoryApexIndex(trajectory.slice(0, 3))).toBeNull();
  });
});
