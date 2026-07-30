import { expect, test } from "@playwright/test";

import { VFX_LAB_II_IDS } from "../../lib/game";
import {
  assertNoPageErrors,
  attachFailureGeometry,
  prepareMatch,
  watchPageErrors,
} from "./mobile-helpers";

test.describe.configure({ timeout: 90_000 });

test.beforeEach(async ({ page, browserName }) => {
  test.skip(
    browserName !== "chromium",
    "One bounded Chromium mobile session is the automated VFX bake-off smoke.",
  );
  watchPageErrors(page);
  await page.addInitScript(() => {
    const samples: number[] = [];
    let previous = 0;
    const sample = (now: number) => {
      if (previous > 0) {
        samples.push(now - previous);
      }
      previous = now;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    Object.defineProperty(window, "__vfxLabFrameSamples", {
      configurable: true,
      value: samples,
    });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  await attachFailureGeometry(page, testInfo);
  await assertNoPageErrors(page, testInfo);
});

test("all ten VFX Lab II prototypes resolve in one muted mobile session", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await prepareMatch(page, "infinite-arsenal");

  const storedAudio = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem("afterglow-artillery.audio.v1") ?? "{}",
    ),
  );
  expect(storedAudio).toMatchObject({
    musicEnabled: false,
    sfxEnabled: false,
    musicVolume: 0,
    sfxVolume: 0,
  });
  const baselineCanvasCount = await page.locator("canvas").count();

  for (const weaponId of VFX_LAB_II_IDS) {
    await page.getByTestId("weapon-chip").click();
    const dialog = page.getByTestId("loadout-weapon-dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator(`[data-weapon-id="${weaponId}"]`).click();
    await expect(dialog).toBeHidden();

    await page.getByTestId("fire-button").click();
    await expect(page.getByTestId("bottom-action-rail")).toBeHidden();
    const canvas = page.getByTestId("battlefield-canvas");
    await page.waitForTimeout(260);
    await testInfo.attach(`${weaponId}-anticipation.png`, {
      body: await canvas.screenshot(),
      contentType: "image/png",
    });
    await page.waitForTimeout(800);
    await testInfo.attach(`${weaponId}-climax.png`, {
      body: await canvas.screenshot(),
      contentType: "image/png",
    });
    await page.waitForTimeout(820);
    await testInfo.attach(`${weaponId}-aftermath.png`, {
      body: await canvas.screenshot(),
      contentType: "image/png",
    });
    await expect(page.getByTestId("bottom-action-rail")).toBeVisible({
      timeout: 3_500,
    });
    expect(await page.locator("canvas").count()).toBe(baselineCanvasCount);
  }

  const frameTelemetry = await page.evaluate(() => {
    const samples =
      (window as typeof window & { __vfxLabFrameSamples?: number[] })
        .__vfxLabFrameSamples ?? [];
    const ordered = samples
      .filter((sample) => Number.isFinite(sample) && sample > 0)
      .sort((left, right) => left - right);
    const percentile = (fraction: number) =>
      ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))] ??
      0;
    return {
      sampleCount: ordered.length,
      p50FrameMs: percentile(0.5),
      p95FrameMs: percentile(0.95),
      longFramesOver50Ms: ordered.filter((sample) => sample > 50).length,
      canvasCount: document.querySelectorAll("canvas").length,
    };
  });
  expect(frameTelemetry.sampleCount).toBeGreaterThan(100);
  expect(frameTelemetry.canvasCount).toBe(baselineCanvasCount);
  await testInfo.attach("vfx-lab-ii-frame-telemetry.json", {
    body: JSON.stringify(frameTelemetry, null, 2),
    contentType: "application/json",
  });
});
