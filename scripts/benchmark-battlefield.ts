import { performance } from "node:perf_hooks";

import {
  BATTLEFIELD_LAYOUT_MOTIFS,
  findSpawnSites,
  generateBattlefield,
  generateTerrain,
} from "../lib/game/index";

const mode = process.argv[2];
if (mode !== "baseline" && mode !== "current") {
  throw new Error("Usage: benchmark-battlefield.ts baseline|current");
}

const corpus = BATTLEFIELD_LAYOUT_MOTIFS.flatMap((motif) =>
  Array.from(
    { length: 2 },
    (_, index) => ({ motif, seed: `benchmark-${motif}-${index + 1}` }),
  ),
);
const start = performance.now();

for (const item of corpus) {
  if (mode === "current") {
    generateBattlefield(item.seed, { layoutMotif: item.motif });
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
