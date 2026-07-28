import type { RandomSeed } from "./random";
import {
  findSpawnSites,
  generateTerrain,
  type SpawnSite,
  type TerrainGenerationOptions,
  type TerrainGrid,
} from "./terrain";

export type BattlefieldSpawn = SpawnSite;

export interface Battlefield {
  readonly terrain: TerrainGrid;
  readonly spawns: readonly [BattlefieldSpawn, BattlefieldSpawn];
}

export interface BattlefieldGenerationOptions
  extends TerrainGenerationOptions {
  /** Empty margin between a spawn shelf and the open side of the world. */
  readonly spawnEdgeMargin?: number;
  /** Required horizontal distance between the two tank centers. */
  readonly minSpawnSeparation?: number;
  /** Flat solid half-width prepared for each tank. */
  readonly spawnPadHalfWidth?: number;
  /** Tank center offset above its first support row. */
  readonly tankHalfHeight?: number;
  /** Maximum unsculpted height variation accepted for a preferred site. */
  readonly maxSpawnSurfaceDelta?: number;
}

/**
 * Pure seeded entry point for a playable round battlefield.
 *
 * Terrain generation owns the material topology; this orchestration step then
 * chooses opposite map bands and prepares two safe shelves. The returned tank
 * positions are world-space centers, ready to use without a second surface
 * lookup.
 */
export function generateBattlefield(
  seed: RandomSeed,
  options: BattlefieldGenerationOptions = {},
): Battlefield {
  const {
    spawnEdgeMargin,
    minSpawnSeparation,
    spawnPadHalfWidth,
    tankHalfHeight,
    maxSpawnSurfaceDelta,
    ...terrainOptions
  } = options;
  const terrain = generateTerrain(seed, terrainOptions);
  const sites = findSpawnSites(terrain, {
    count: 2,
    edgeMargin: spawnEdgeMargin,
    minSeparation:
      minSpawnSeparation ?? Math.round(terrain.width * 0.56),
    padHalfWidth: spawnPadHalfWidth ?? 24,
    tankHalfHeight,
    maxSurfaceDelta: maxSpawnSurfaceDelta,
  });
  const left = sites[0];
  const right = sites[1];

  if (left === undefined || right === undefined) {
    throw new Error("Battlefield generation requires exactly two spawn sites.");
  }

  return {
    terrain,
    spawns: [left, right],
  };
}
