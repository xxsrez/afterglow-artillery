import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BATTLEFIELD_LAYOUT_MOTIFS,
  BATTLEFIELD_LAYOUT_MOTIFS_BY_PROFILE,
  BATTLEFIELD_LAYOUT_PROFILES,
  Material,
  generateBattlefield,
  measureBattlefieldStructure,
  normalizeSeed,
  type BattlefieldLayoutMotif,
} from "../lib/game/index";

const mapWidth = 390;
const mapHeight = 98;
const labelHeight = 34;
const tileGap = 14;
const outerPadding = 18;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Downsamples by occupied area instead of point-sampling one cell per 8×8
 * block. This keeps roofs, bridges and cave mouths visible in the evidence.
 */
function materialPath(
  cells: Uint8Array,
  worldWidth: number,
  worldHeight: number,
  material: Material.Soil | Material.Rock,
): string {
  let path = "";
  for (let row = 0; row < mapHeight; row += 1) {
    const worldTop = Math.floor((row / mapHeight) * worldHeight);
    const worldBottom = Math.max(
      worldTop + 1,
      Math.ceil(((row + 1) / mapHeight) * worldHeight),
    );
    let runStart = -1;

    for (let column = 0; column <= mapWidth; column += 1) {
      let occupied = false;
      if (column < mapWidth) {
        const worldLeft = Math.floor((column / mapWidth) * worldWidth);
        const worldRight = Math.max(
          worldLeft + 1,
          Math.ceil(((column + 1) / mapWidth) * worldWidth),
        );
        let matches = 0;
        const area =
          (worldRight - worldLeft) * (worldBottom - worldTop);
        for (let y = worldTop; y < worldBottom; y += 1) {
          for (let x = worldLeft; x < worldRight; x += 1) {
            if (cells[y * worldWidth + x] === material) {
              matches += 1;
            }
          }
        }
        occupied = matches / area >= 0.08;
      }

      if (occupied && runStart < 0) {
        runStart = column;
      } else if (!occupied && runStart >= 0) {
        path += `M${runStart} ${row}h${column - runStart}v1H${runStart}z`;
        runStart = -1;
      }
    }
  }
  return path;
}

function renderTile(
  motif: BattlefieldLayoutMotif,
  seed: string,
  tileX: number,
  tileY: number,
  labelled: boolean,
  labelTitle: string = motif,
): string {
  const battlefield = generateBattlefield(seed, { layoutMotif: motif });
  const soil = materialPath(
    battlefield.terrain.cells,
    battlefield.terrain.width,
    battlefield.terrain.height,
    Material.Soil,
  );
  const rock = materialPath(
    battlefield.terrain.cells,
    battlefield.terrain.width,
    battlefield.terrain.height,
    Material.Rock,
  );
  const spawnMarkers = battlefield.spawns
    .map((spawn, index) => {
      const x = (spawn.x / battlefield.terrain.width) * mapWidth;
      const y = (spawn.y / battlefield.terrain.height) * mapHeight;
      const color = index === 0 ? "#b7ff5a" : "#ff4db8";
      const shape =
        spawn.kind === "cave"
          ? `<rect x="${(x - 3.5).toFixed(1)}" y="${(y - 3.5).toFixed(1)}" width="7" height="7" rx="1"`
          : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"`;
      return `${shape} fill="${color}" stroke="#071117" stroke-width="1"/>`;
    })
    .join("");
  const structure = measureBattlefieldStructure(battlefield.terrain);
  const label = labelled
    ? `
        <text x="4" y="${mapHeight + 14}" class="title">${escapeXml(labelTitle)}</text>
        <text x="4" y="${mapHeight + 28}" class="metric">P${structure.prominentPeakCount} B${structure.prominentBasinCount} C${structure.cliffCount} I${structure.floatingSolidComponentCount} · roof ${Math.round(structure.roofedColumnRatio * 100)}% · ${battlefield.spawns.map((spawn) => spawn.kind[0]).join("/")}</text>`
    : "";

  return `
    <g transform="translate(${tileX} ${tileY})">
      <rect width="${mapWidth}" height="${mapHeight}" rx="6" fill="#071117"/>
      <path d="${soil}" fill="#7b542b"/>
      <path d="${rock}" fill="#33434c"/>
      ${spawnMarkers}
      <rect width="${mapWidth}" height="${mapHeight}" rx="6" fill="none" stroke="#4f6975"/>
      ${label}
    </g>`;
}

function svgDocument(
  width: number,
  height: number,
  tiles: readonly string[],
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .title { fill: #e7f6fb; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 600; }
    .metric { fill: #9cb4bf; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
  </style>
  <rect width="100%" height="100%" fill="#0d1b22"/>
  ${tiles.join("\n")}
</svg>
`.replace(/^[ \t]+$/gm, "");
}

const labelledColumns = 3;
const labelledRows = BATTLEFIELD_LAYOUT_PROFILES.length;
const labelledWidth =
  outerPadding * 2 +
  labelledColumns * mapWidth +
  (labelledColumns - 1) * tileGap;
const labelledHeight =
  outerPadding * 2 +
  labelledRows * (mapHeight + labelHeight) +
  (labelledRows - 1) * tileGap;
const labelledTiles: string[] = [];

for (const [row, profile] of BATTLEFIELD_LAYOUT_PROFILES.entries()) {
  for (const [column, motif] of BATTLEFIELD_LAYOUT_MOTIFS_BY_PROFILE[
    profile
  ].entries()) {
    labelledTiles.push(
      renderTile(
        motif,
        `gallery-compare-${profile}`,
        outerPadding + column * (mapWidth + tileGap),
        outerPadding + row * (mapHeight + labelHeight + tileGap),
        true,
      ),
    );
  }
}

const variationSeeds = [
  "gallery-variation-alpha",
  "gallery-variation-beta",
  "gallery-variation-gamma",
] as const;
const variationColumns = variationSeeds.length;
const variationRows = BATTLEFIELD_LAYOUT_MOTIFS.length;
const variationWidth =
  outerPadding * 2 +
  variationColumns * mapWidth +
  (variationColumns - 1) * tileGap;
const variationHeight =
  outerPadding * 2 +
  variationRows * (mapHeight + labelHeight) +
  (variationRows - 1) * tileGap;
const variationTiles: string[] = [];

for (const [row, motif] of BATTLEFIELD_LAYOUT_MOTIFS.entries()) {
  for (const [column, seed] of variationSeeds.entries()) {
    variationTiles.push(
      renderTile(
        motif,
        seed,
        outerPadding + column * (mapWidth + tileGap),
        outerPadding + row * (mapHeight + labelHeight + tileGap),
        true,
        `${motif} · seed ${column + 1}`,
      ),
    );
  }
}

const blindColumns = 6;
const blindRows = 6;
const blindWidth =
  outerPadding * 2 +
  blindColumns * mapWidth +
  (blindColumns - 1) * tileGap;
const blindHeight =
  outerPadding * 2 +
  blindRows * mapHeight +
  (blindRows - 1) * tileGap;
const blindCases = BATTLEFIELD_LAYOUT_MOTIFS.flatMap((motif) =>
  variationSeeds.map((seed) => ({ motif, seed })),
).sort((left, right) => {
  const scoreDifference =
    normalizeSeed(`${left.seed}:${left.motif}:blind-position`) -
    normalizeSeed(`${right.seed}:${right.motif}:blind-position`);
  return (
    scoreDifference ||
    left.motif.localeCompare(right.motif) ||
    left.seed.localeCompare(right.seed)
  );
});
const blindTiles = blindCases.map(({ motif, seed }, index) =>
  renderTile(
    motif,
    seed,
    outerPadding + (index % blindColumns) * (mapWidth + tileGap),
    outerPadding + Math.floor(index / blindColumns) * (mapHeight + tileGap),
    false,
  ),
);

const labelledPath = resolve(
  process.cwd(),
  "docs/verification/battlefield-layout-gallery.svg",
);
const blindPath = resolve(
  process.cwd(),
  "docs/verification/battlefield-layout-blind-gallery.svg",
);
const variationPath = resolve(
  process.cwd(),
  "docs/verification/battlefield-layout-seed-gallery.svg",
);
await Promise.all([
  writeFile(
    labelledPath,
    svgDocument(labelledWidth, labelledHeight, labelledTiles),
    "utf8",
  ),
  writeFile(
    blindPath,
    svgDocument(blindWidth, blindHeight, blindTiles),
    "utf8",
  ),
  writeFile(
    variationPath,
    svgDocument(variationWidth, variationHeight, variationTiles),
    "utf8",
  ),
]);
console.log(`Wrote ${labelledPath}`);
console.log(`Wrote ${blindPath}`);
console.log(`Wrote ${variationPath}`);
