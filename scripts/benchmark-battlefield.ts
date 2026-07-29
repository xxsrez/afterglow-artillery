import { performance } from "node:perf_hooks";

import {
  BATTLEFIELD_LAYOUT_PROFILES,
  findSpawnSites,
  generateBattlefield,
  generateTerrain,
} from "../lib/game/index";

const mode = process.argv[2];
if (mode !== "baseline" && mode !== "current") {
  throw new Error("Usage: benchmark-battlefield.ts baseline|current");
}

const corpus = BATTLEFIELD_LAYOUT_PROFILES.flatMap((profile) =>
  Array.from(
    { length: 4 },
    (_, index) => ({ profile, seed: `benchmark-${profile}-${index + 1}` }),
  ),
);
const start = performance.now();

for (const item of corpus) {
  if (mode === "current") {
    generateBattlefield(item.seed, { layoutProfile: item.profile });
  } else {
    const terrain = generateTerrain(item.seed);
    findSpawnSites(terrain, {
      count: 2,
      minSeparation: Math.round(terrain.width * 0.56),
      padHalfWidth: 24,
    });
  }
}

const durationMs = performance.now() - start;
console.log(
  JSON.stringify({
    mode,
    maps: corpus.length,
    dimensions: "2880x720",
    durationMs: Number(durationMs.toFixed(1)),
    averageMs: Number((durationMs / corpus.length).toFixed(1)),
  }),
);
