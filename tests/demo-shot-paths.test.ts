import { describe, expect, it } from "vitest";

import {
  DEMO_BEHAVIORS,
  Material,
  TerrainGrid,
  WEAPON_IDS,
  buildAirburstFallTrajectories,
  buildDiggerPath,
  buildFlowPoints,
  buildFunkyChain,
  buildRollPath,
  buildUndergroundFan,
  getDemoBehavior,
  terrainSurfaceOrFloor,
  trajectoryApexIndex,
  type TrajectoryPoint,
  type Vector2,
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

  it("routes only MIRV and Death's Head through apogee airburst", () => {
    const airburstWeapons = WEAPON_IDS.filter(
      (id) => getDemoBehavior(id).kind === "airburst",
    );

    expect(airburstWeapons).toEqual(["mirv", "deathsHead"]);
    expect(getDemoBehavior("leapFrog").kind).toBe("leap-frog");
    expect(getDemoBehavior("funkyBomb").kind).toBe("funky");
    expect(getDemoBehavior("babySandhog").kind).toBe("sandhog");
    expect(getDemoBehavior("sandhog").kind).toBe("sandhog");
    expect(getDemoBehavior("heavySandhog").kind).toBe("sandhog");
    expect(getDemoBehavior("napalm").kind).toBe("napalm");
    expect(getDemoBehavior("hotNapalm").kind).toBe("napalm");
    expect(getDemoBehavior("liquidDirt").kind).toBe("liquid-dirt");
  });
});

describe("Quick Demo shot paths", () => {
  function flatTerrain(): TerrainGrid {
    const terrain = new TerrainGrid(720, 400);
    for (let x = 0; x < terrain.width; x += 1) {
      for (let y = 350; y < terrain.height; y += 1) {
        terrain.set(x, y, Material.Soil);
      }
    }
    return terrain;
  }

  it.each([
    ["mirv", 5, 24],
    ["deathsHead", 9, 16],
  ] as const)(
    "builds a synchronous non-upward %s fall formation",
    (weaponId, childCount, horizontalDelta) => {
      const terrain = flatTerrain();
      const apex: TrajectoryPoint = {
        x: 360,
        y: 50,
        time: 1.4,
        velocityX: 30,
        velocityY: 2,
      };
      const children = buildAirburstFallTrajectories(
        terrain,
        apex,
        weaponId,
        0,
      );

      expect(children).toHaveLength(childCount);
      expect(
        children.map(({ horizontalVelocityOffset }) =>
          horizontalVelocityOffset,
        ),
      ).toEqual(
        Array.from({ length: childCount }, (_, index) => {
          const centered = index - (childCount - 1) / 2;
          return centered * horizontalDelta;
        }),
      );

      const initialPoints = children.map(({ points }) => points[0]);
      expect(initialPoints.every((point) => point?.velocityY === 2)).toBe(true);
      expect(
        initialPoints.every((point) => (point?.velocityY ?? -1) >= 0),
      ).toBe(true);

      const pointCounts = children.map(({ points }) => points.length);
      expect(new Set(pointCounts).size).toBe(1);
      const sharedPointCount = pointCounts[0] ?? 0;

      for (let pointIndex = 0; pointIndex < sharedPointCount; pointIndex += 1) {
        const row = children.map(({ points }) => points[pointIndex]);
        const first = row[0];
        expect(first).toBeDefined();
        expect(
          row.every(
            (point) =>
              point !== undefined &&
              Math.abs(point.y - (first?.y ?? 0)) < 1e-9 &&
              Math.abs(point.time - (first?.time ?? 0)) < 1e-9,
          ),
        ).toBe(true);

        const spacings = row.slice(1).map((point, index) => {
          const previous = row[index];
          return (point?.x ?? 0) - (previous?.x ?? 0);
        });
        expect(
          spacings.every(
            (spacing) =>
              Math.abs(
                spacing - horizontalDelta * (first?.time ?? 0),
              ) < 1e-8,
          ),
        ).toBe(true);
      }
    },
  );

  it("applies wind deterministically without breaking vertical phase", () => {
    const terrain = flatTerrain();
    const apex: TrajectoryPoint = {
      x: 360,
      y: 50,
      time: 1.4,
      velocityX: -20,
      velocityY: 0,
    };
    const first = buildAirburstFallTrajectories(
      terrain,
      apex,
      "deathsHead",
      32,
    );
    const replay = buildAirburstFallTrajectories(
      terrain,
      apex,
      "deathsHead",
      32,
    );

    expect(first).toEqual(replay);
    const sharedPointCount = Math.min(
      ...first.map(({ points }) => points.length),
    );
    for (let pointIndex = 0; pointIndex < sharedPointCount; pointIndex += 1) {
      const y = first[0]?.points[pointIndex]?.y;
      expect(
        first.every(
          ({ points }) =>
            Math.abs((points[pointIndex]?.y ?? 0) - (y ?? 0)) < 1e-9,
        ),
      ).toBe(true);
    }
  });

  it("builds deterministic bounded paths independently of React and Canvas", () => {
    const terrain = slopedTerrain();
    const impact = { x: 80, y: 54 };

    const firstFunky = buildFunkyChain(terrain, impact, 14, 51_101);
    const replayedFunky = buildFunkyChain(terrain, impact, 14, 51_101);
    const differentFunky = buildFunkyChain(terrain, impact, 14, 51_102);
    expect(firstFunky).toEqual(replayedFunky);
    expect(firstFunky).not.toEqual(differentFunky);
    expect(firstFunky).toHaveLength(14);
    expect(buildFunkyChain(terrain, impact, 9, 51_101)).toHaveLength(10);

    const fanCounts = [3, 5, 7] as const;
    const fans = fanCounts.map((count) =>
      buildUndergroundFan(terrain, impact, count, 3, 71_303),
    );
    expect(fans.map((fan) => fan.length)).toEqual(fanCounts);
    const firstFan = fans[1] as readonly (readonly Vector2[])[];
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
