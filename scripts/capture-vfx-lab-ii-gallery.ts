import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";
import sharp from "sharp";

import {
  VFX_LAB_II_IDS,
  getExperimentalPresentation,
  getVfxLabWeapon,
} from "../lib/game";

const baseUrl =
  process.env.VFX_LAB_BASE_URL ?? "http://127.0.0.1:5188";
const outputPath = path.resolve(
  process.cwd(),
  "docs/verification/vfx-lab-ii-contact-sheet.png",
);
const telemetryPath = path.resolve(
  process.cwd(),
  "docs/verification/vfx-lab-ii-browser-telemetry.json",
);
const cardWidth = 480;
const cardHeight = 302;
const imageHeight = 270;
const columns = 2;
const rows = Math.ceil(VFX_LAB_II_IDS.length / columns);

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 960, height: 540 },
    colorScheme: "dark",
    locale: "ru-RU",
  });
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "afterglow-artillery.audio.v1",
      JSON.stringify({
        musicEnabled: false,
        sfxEnabled: false,
        musicVolume: 0,
        sfxVolume: 0,
      }),
    );
  });
  await page.goto(baseUrl);
  await page
    .locator("[data-client-ready='true']")
    .waitFor({ state: "visible" });
  await page
    .getByRole("button", { name: /^Infinite Arsenal/ })
    .click();
  await page
    .getByRole("button", { name: "Начать Infinite Arsenal" })
    .click();
  await page.evaluate(`
    (() => {
      const samples = [];
      let previous = 0;
      const sample = (now) => {
        if (previous > 0) {
          samples.push(now - previous);
        }
        previous = now;
        requestAnimationFrame(sample);
      };
      window.__vfxLabSamples = samples;
      requestAnimationFrame(sample);
    })()
  `);
  const cards: Buffer[] = [];

  for (const weaponId of VFX_LAB_II_IDS) {
    await page.getByTestId("weapon-chip").click();
    const dialog = page.getByTestId("loadout-weapon-dialog");
    await dialog.locator(`[data-weapon-id="${weaponId}"]`).click();
    await page.getByTestId("fire-button").click();
    await page.getByTestId("bottom-action-rail").waitFor({
      state: "hidden",
    });
    await page.waitForTimeout(1_100);
    const screenshot = await page
      .getByTestId("battlefield-canvas")
      .screenshot();
    const definition = getVfxLabWeapon(weaponId);
    const presentation = getExperimentalPresentation(weaponId);
    const caption = Buffer.from(`
      <svg width="${cardWidth}" height="${cardHeight}">
        <rect width="${cardWidth}" height="${cardHeight}" fill="#080d10"/>
        <rect y="${imageHeight}" width="${cardWidth}" height="${cardHeight - imageHeight}" fill="#11191d"/>
        <text x="12" y="${imageHeight + 21}" fill="#f1f3e9" font-family="Arial, sans-serif" font-size="14" font-weight="700">
          ${escapeXml(definition.name)}
        </text>
        <text x="${cardWidth - 12}" y="${imageHeight + 21}" text-anchor="end" fill="#78dfe8" font-family="Arial, sans-serif" font-size="11">
          ${escapeXml(presentation.presentationClass)} · r=${definition.footprint.mechanicalRadius}
        </text>
      </svg>
    `);
    const image = await sharp(screenshot)
      .resize(cardWidth, imageHeight, { fit: "fill" })
      .png()
      .toBuffer();
    cards.push(
      await sharp(caption)
        .composite([{ input: image, top: 0, left: 0 }])
        .png()
        .toBuffer(),
    );
    await page.getByTestId("bottom-action-rail").waitFor({
      state: "visible",
      timeout: 4_000,
    });
  }

  const titleHeight = 74;
  const width = columns * cardWidth;
  const height = titleHeight + rows * cardHeight;
  const title = Buffer.from(`
    <svg width="${width}" height="${titleHeight}">
      <rect width="${width}" height="${titleHeight}" fill="#05090b"/>
      <text x="24" y="32" fill="#f1f3e9" font-family="Arial, sans-serif" font-size="23" font-weight="700">
        VFX Lab II · fixed browser capture
      </text>
      <text x="24" y="55" fill="#89a4aa" font-family="Arial, sans-serif" font-size="13">
        seed from current match · Full · Music/SFX muted · climax t=1100 ms · 960×540
      </text>
    </svg>
  `);
  const composites = cards.map((input, index) => ({
    input,
    left: (index % columns) * cardWidth,
    top: titleHeight + Math.floor(index / columns) * cardHeight,
  }));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#05090b",
    },
  })
    .composite([{ input: title, left: 0, top: 0 }, ...composites])
    .png()
    .toFile(outputPath);
  const frameSamples = await page.evaluate(
    () =>
      (
        window as typeof window & { __vfxLabSamples?: number[] }
      ).__vfxLabSamples ?? [],
  );
  const ordered = frameSamples
    .filter((sample) => Number.isFinite(sample) && sample > 0)
    .sort((left, right) => left - right);
  const percentile = (fraction: number) =>
    ordered[
      Math.min(
        ordered.length - 1,
        Math.floor(ordered.length * fraction),
      )
    ] ?? 0;
  await writeFile(
    telemetryPath,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        environment:
          "Playwright Chromium, macOS host, 960x540 CSS viewport, Full effects",
        audio: "Music and SFX muted before match start",
        prototypes: [...VFX_LAB_II_IDS],
        sampleCount: ordered.length,
        p50FrameMs: percentile(0.5),
        p95FrameMs: percentile(0.95),
        longFramesOver50Ms: ordered.filter((sample) => sample > 50).length,
        caveats: [
          "Browser-host measurement only; not a physical-phone trace.",
          "The sampled browser session includes setup, selection and screenshot capture pauses.",
        ],
      },
      null,
      2,
    )}\n`,
  );
  console.log(outputPath);
  console.log(telemetryPath);
} finally {
  await browser.close();
}
