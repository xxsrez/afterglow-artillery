import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  BATTLEFIELD_LAYOUT_PROFILES,
  Material,
  generateBattlefield,
} from "../lib/game/index";

const tileWidth = 360;
const mapHeight = 90;
const labelHeight = 34;
const tileGap = 16;
const outerPadding = 20;
const columns = 4;
const rows = BATTLEFIELD_LAYOUT_PROFILES.length;
const svgWidth =
  outerPadding * 2 + columns * tileWidth + (columns - 1) * tileGap;
const svgHeight =
  outerPadding * 2 +
  rows * (mapHeight + labelHeight) +
  (rows - 1) * tileGap;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function materialPath(
  cells: Uint8Array,
  worldWidth: number,
  worldHeight: number,
  material: Material.Soil | Material.Rock,
): string {
  let path = "";
  for (let row = 0; row < mapHeight; row += 1) {
    const worldY = Math.min(
      worldHeight - 1,
      Math.floor(((row + 0.5) / mapHeight) * worldHeight),
    );
    let runStart = -1;

    for (let column = 0; column <= tileWidth; column += 1) {
      const worldX = Math.min(
        worldWidth - 1,
        Math.floor(((column + 0.5) / tileWidth) * worldWidth),
      );
      const filled =
        column < tileWidth &&
        cells[worldY * worldWidth + worldX] === material;
      if (filled && runStart < 0) {
        runStart = column;
      } else if (!filled && runStart >= 0) {
        path += `M${runStart} ${row}h${column - runStart}v1H${runStart}z`;
        runStart = -1;
      }
    }
  }
  return path;
}

const tiles: string[] = [];
for (const [row, profile] of BATTLEFIELD_LAYOUT_PROFILES.entries()) {
  for (let column = 0; column < columns; column += 1) {
    const seed = `gallery-${profile}-${column + 1}`;
    const battlefield = generateBattlefield(seed, {
      layoutProfile: profile,
    });
    const tileX = outerPadding + column * (tileWidth + tileGap);
    const tileY =
      outerPadding + row * (mapHeight + labelHeight + tileGap);
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
        const x = (spawn.x / battlefield.terrain.width) * tileWidth;
        const y = (spawn.y / battlefield.terrain.height) * mapHeight;
        const color = index === 0 ? "#b7ff5a" : "#ff4db8";
        const shape =
          spawn.kind === "cave"
            ? `<rect x="${(x - 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" width="6" height="6" rx="1"`
            : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"`;
        return `${shape} fill="${color}" stroke="#071117" stroke-width="1"/>`;
      })
      .join("");
    const topology = battlefield.metadata.topology;
    const metric =
      profile === "ridge"
        ? `ridge ${topology.ridgeHeight.toFixed(0)}`
        : profile === "valley"
          ? `basin ${topology.basinDepth.toFixed(0)}`
          : profile === "cavern"
            ? battlefield.spawns.map((spawn) => spawn.kind).join("/")
            : `relief ${topology.relief.toFixed(0)}`;

    tiles.push(`
      <g transform="translate(${tileX} ${tileY})">
        <rect width="${tileWidth}" height="${mapHeight}" rx="6" fill="#071117"/>
        <path d="${soil}" fill="#7b542b"/>
        <path d="${rock}" fill="#33434c"/>
        ${spawnMarkers}
        <rect width="${tileWidth}" height="${mapHeight}" rx="6" fill="none" stroke="#4f6975"/>
        <text x="4" y="${mapHeight + 14}" class="title">${escapeXml(profile)} · ${escapeXml(seed)}</text>
        <text x="4" y="${mapHeight + 28}" class="metric">${escapeXml(metric)} · attempt ${battlefield.metadata.attempt}</text>
      </g>`);
  }
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <style>
    .title { fill: #e7f6fb; font: 600 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .metric { fill: #9cb4bf; font: 10px ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
  <rect width="100%" height="100%" fill="#0d1b22"/>
  ${tiles.join("\n")}
</svg>
`.replace(/^[ \t]+$/gm, "");

const outputPath = resolve(
  process.cwd(),
  "docs/verification/battlefield-layout-gallery.svg",
);
await writeFile(outputPath, svg, "utf8");
console.log(`Wrote ${outputPath}`);
