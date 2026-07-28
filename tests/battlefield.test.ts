import { describe, expect, it } from "vitest";

import {
  Material,
  TerrainGrid,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  generateBattlefield,
  generateTerrain,
} from "../lib/game/index";

function countSurfaceDetail(terrain: TerrainGrid): {
  range: number;
  localChanges: number;
} {
  const surfaces = Array.from({ length: terrain.width }, (_, x) =>
    terrain.surfaceY(x),
  ).filter((value): value is number => value !== null);
  let localChanges = 0;

  for (let x = 8; x < surfaces.length; x += 8) {
    if (Math.abs((surfaces[x] as number) - (surfaces[x - 8] as number)) >= 2) {
      localChanges += 1;
    }
  }

  return {
    range: Math.max(...surfaces) - Math.min(...surfaces),
    localChanges,
  };
}

function countSurfaceConnectedCaveCells(terrain: TerrainGrid): number {
  const queue = new Int32Array(terrain.cells.length);
  const visited = new Uint8Array(terrain.cells.length);
  let head = 0;
  let tail = 0;

  for (let x = 0; x < terrain.width; x += 1) {
    if (terrain.get(x, 0) === Material.Empty) {
      const index = x;
      queue[tail] = index;
      tail += 1;
      visited[index] = 1;
    }
  }

  let buriedCells = 0;

  while (head < tail) {
    const index = queue[head] as number;
    head += 1;
    const x = index % terrain.width;
    const y = Math.floor(index / terrain.width);
    const surface = terrain.surfaceY(x);

    if (surface !== null && y > surface + 8) {
      buriedCells += 1;
    }

    const neighbors = [
      x > 0 ? index - 1 : -1,
      x + 1 < terrain.width ? index + 1 : -1,
      y > 0 ? index - terrain.width : -1,
      y + 1 < terrain.height ? index + terrain.width : -1,
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor < 0 ||
        visited[neighbor] === 1 ||
        terrain.cells[neighbor] !== Material.Empty
      ) {
        continue;
      }

      visited[neighbor] = 1;
      queue[tail] = neighbor;
      tail += 1;
    }
  }

  return buriedCells;
}

function countOverhangColumns(terrain: TerrainGrid): number {
  let columns = 0;

  for (let x = 0; x < terrain.width; x += 1) {
    const surface = terrain.surfaceY(x);
    if (surface === null) {
      continue;
    }

    let foundAirBelowMaterial = false;

    for (let y = surface + 1; y < terrain.height - 2; y += 1) {
      if (terrain.get(x, y) === Material.Empty) {
        foundAirBelowMaterial = true;
      } else if (foundAirBelowMaterial) {
        columns += 1;
        break;
      }
    }
  }

  return columns;
}

describe("large battlefield generation", () => {
  it("separates the fixed viewport from a substantially larger world", () => {
    const battlefield = generateBattlefield("full-world-dimensions");

    expect(VIEWPORT_WIDTH).toBe(960);
    expect(VIEWPORT_HEIGHT).toBe(540);
    expect(WORLD_WIDTH).toBe(2_880);
    expect(WORLD_HEIGHT).toBe(720);
    expect(WORLD_WIDTH).toBe(VIEWPORT_WIDTH * 3);
    expect(WORLD_HEIGHT).toBeGreaterThan(VIEWPORT_HEIGHT);
    expect(battlefield.terrain.width).toBe(WORLD_WIDTH);
    expect(battlefield.terrain.height).toBe(WORLD_HEIGHT);
  });

  it("replays terrain and spawn preparation exactly from the same seed", () => {
    const options = {
      width: 840,
      height: 360,
      minSurfaceY: 130,
      maxSurfaceY: 235,
      caveCount: 7,
      tunnelCount: 10,
      bedrockDepth: 22,
      spawnPadHalfWidth: 18,
    } as const;
    const first = generateBattlefield("deterministic-caverns", options);
    const replay = generateBattlefield("deterministic-caverns", options);
    const different = generateBattlefield("different-caverns", options);

    expect(first.spawns).toEqual(replay.spawns);
    expect(first.terrain.cells).toEqual(replay.terrain.cells);
    expect(first.terrain.cells).not.toEqual(different.terrain.cells);
  });

  it.each(["ridge-17", "vault-203", "burrow-991"])(
    "places seed %s on distant safe shelves in opposite bands",
    (seed) => {
      const tankHalfHeight = 11;
      const padHalfWidth = 20;
      const battlefield = generateBattlefield(seed, {
        width: 1_200,
        height: 420,
        minSurfaceY: 150,
        maxSurfaceY: 285,
        caveCount: 8,
        tunnelCount: 12,
        bedrockDepth: 24,
        minSpawnSeparation: 624,
        spawnPadHalfWidth: padHalfWidth,
        tankHalfHeight,
      });
      const [left, right] = battlefield.spawns;

      expect(left.x).toBeLessThanOrEqual(battlefield.terrain.width * 0.33);
      expect(right.x).toBeGreaterThanOrEqual(battlefield.terrain.width * 0.67);
      expect(right.x - left.x).toBeGreaterThanOrEqual(624);

      for (const spawn of battlefield.spawns) {
        const supportY = spawn.y + tankHalfHeight;

        for (
          let x = spawn.x - padHalfWidth;
          x <= spawn.x + padHalfWidth;
          x += 1
        ) {
          expect(battlefield.terrain.surfaceY(x)).toBe(supportY);

          for (let y = supportY - 20; y < supportY; y += 1) {
            expect(battlefield.terrain.get(x, y)).toBe(Material.Empty);
          }

          for (let y = supportY; y < supportY + 12; y += 1) {
            expect(battlefield.terrain.isSolid(x, y)).toBe(true);
          }
        }
      }
    },
  );

  it.each(["caves-alpha", "caves-beta", "caves-gamma"])(
    "creates detailed surface, connected cave mouths and overhangs for %s",
    (seed) => {
      const bedrockDepth = 20;
      const terrain = generateTerrain(seed, {
        width: 900,
        height: 380,
        minSurfaceY: 135,
        maxSurfaceY: 245,
        controlPointSpacing: 90,
        roughness: 58,
        caveCount: 9,
        tunnelCount: 13,
        bedrockDepth,
      });
      const detail = countSurfaceDetail(terrain);

      expect(detail.range).toBeGreaterThan(35);
      expect(detail.localChanges).toBeGreaterThan(12);
      expect(countSurfaceConnectedCaveCells(terrain)).toBeGreaterThan(900);
      expect(countOverhangColumns(terrain)).toBeGreaterThan(70);

      for (
        let y = terrain.height - bedrockDepth;
        y < terrain.height;
        y += 1
      ) {
        for (let x = 0; x < terrain.width; x += 11) {
          expect(terrain.get(x, y)).toBe(Material.Rock);
        }
      }
    },
  );
});

describe("TerrainGrid support queries", () => {
  it("finds the first floor at or below a requested cave height", () => {
    const terrain = new TerrainGrid(12, 18);
    terrain.set(4, 3, Material.Soil);
    terrain.set(4, 10, Material.Rock);
    terrain.set(4, 11, Material.Rock);

    expect(terrain.firstSolidYAtOrBelow(4, -20)).toBe(3);
    expect(terrain.firstSolidYAtOrBelow(4, 3)).toBe(3);
    expect(terrain.firstSolidYAtOrBelow(4, 4)).toBe(10);
    expect(terrain.firstSolidYAtOrBelow(4, 10.9)).toBe(10);
    expect(terrain.firstSolidYAtOrBelow(4, 12)).toBeNull();
    expect(terrain.firstSolidYAtOrBelow(-1, 0)).toBeNull();
    expect(terrain.firstSolidYAtOrBelow(4, terrain.height)).toBeNull();
  });
});
