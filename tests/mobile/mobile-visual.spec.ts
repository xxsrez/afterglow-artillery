import { expect, test } from "@playwright/test";

import {
  assertNoPageErrors,
  attachFailureGeometry,
  prepareMatch,
  watchPageErrors,
} from "./mobile-helpers";

test.beforeEach(async ({ page }) => {
  watchPageErrors(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await attachFailureGeometry(page, testInfo);
  await assertNoPageErrors(page, testInfo);
});

async function expectLayoutSnapshot(
  page: Parameters<typeof prepareMatch>[0],
  name: string,
): Promise<void> {
  const battlefield = page.getByTestId("battlefield-canvas");
  await battlefield.evaluate((canvas) => {
    canvas.style.visibility = "hidden";
  });
  await expect(page).toHaveScreenshot(name);
}

test("667x375 Quick Demo aiming visual", async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await prepareMatch(page, "quick-demo");
  await expectLayoutSnapshot(page, "667x375-quick-aiming.png");
});

test("844x320 Infinite Arsenal aiming visual", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "infinite-arsenal");
  await expectLayoutSnapshot(page, "844x320-infinite-aiming.png");
});

test("932x296 Infinite Arsenal aiming visual", async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 296 });
  await prepareMatch(page, "infinite-arsenal");
  await expectLayoutSnapshot(page, "932x296-infinite-aiming.png");
});

test("844x320 Loadout Weapon visual", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "infinite-arsenal");
  await page.getByTestId("weapon-chip").click();
  await expect(page.getByTestId("loadout-weapon-dialog")).toBeVisible();
  await expectLayoutSnapshot(page, "844x320-loadout-weapon.png");
});

test("844x320 Loadout Shield visual", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "infinite-arsenal");
  await page.getByTestId("shield-chip").click();
  await expect(page.getByTestId("loadout-shield-dialog")).toBeVisible();
  await expectLayoutSnapshot(page, "844x320-loadout-shield.png");
});

test("390x844 portrait gate visual", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-client-ready]")).toHaveAttribute(
    "data-client-ready",
    "true",
  );
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByText("Поверните телефон", { exact: true })).toBeVisible();
  await expectLayoutSnapshot(page, "390x844-portrait-gate.png");
});
