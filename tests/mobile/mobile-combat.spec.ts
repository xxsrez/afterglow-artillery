import { expect, test } from "@playwright/test";

import {
  assertAimingGeometry,
  assertNoPageErrors,
  attachFailureGeometry,
  collectGeometry,
  dispatchCoarsePointer,
  prepareMatch,
  watchPageErrors,
} from "./mobile-helpers";

const LANDSCAPE_VIEWPORTS = [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 932, height: 430 },
  { width: 844, height: 320 },
  { width: 932, height: 296 },
] as const;

test.beforeEach(async ({ page }) => {
  watchPageErrors(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await attachFailureGeometry(page, testInfo);
  await assertNoPageErrors(page, testInfo);
});

for (const viewport of LANDSCAPE_VIEWPORTS) {
  for (const mode of ["quick-demo", "infinite-arsenal"] as const) {
    test(`${viewport.width}x${viewport.height} ${mode} aiming geometry`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await prepareMatch(page, mode);
      assertAimingGeometry(await collectGeometry(page), mode);

      await expect(page.getByText("R1/3", { exact: true })).toBeVisible();
      await expect(page.getByTestId("weapon-chip")).toBeVisible();
      await expect(page.getByTestId("fire-button")).toBeVisible();
      if (mode === "infinite-arsenal") {
        await expect(page.getByTestId("shield-chip")).toBeVisible();
      }
    });
  }
}

test("precision trays are exclusive and gate Fire", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "infinite-arsenal");

  await page.getByRole("button", { name: "Увеличить угол" }).click();
  await expect(
    page.getByRole("button", {
      name: "Угол 49 градусов. Открыть точную настройку",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Увеличить силу" }).click();
  await expect(
    page.getByRole("button", {
      name: "Сила 410. Открыть точную настройку",
    }),
  ).toBeVisible();

  const angle = page.getByRole("button", {
    name: "Угол 49 градусов. Открыть точную настройку",
  });
  await angle.click();
  await expect(page.getByTestId("angle-precision-tray")).toBeVisible();
  await expect(page.getByTestId("fire-button")).toBeDisabled();
  await page.getByRole("button", { name: "Готово" }).click();

  await page
    .getByRole("button", {
      name: "Сила 410. Открыть точную настройку",
    })
    .click();
  await expect(page.getByTestId("power-precision-tray")).toBeVisible();
  await expect(page.getByTestId("angle-precision-tray")).toBeHidden();
  await page.getByTestId("battlefield-canvas").dispatchEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    pointerId: 90,
    pointerType: "touch",
    clientX: 420,
    clientY: 150,
  });
  await page.locator("body").dispatchEvent("pointerup", {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    pointerId: 90,
    pointerType: "touch",
  });
  await expect(page.getByTestId("power-precision-tray")).toBeHidden();
  await expect(page.getByTestId("fire-button")).toBeEnabled();
  await expect(page.getByTestId("bottom-action-rail")).toBeVisible();
});

test("visible-viewport fit keeps real taps on aim and Fire controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    if (window.visualViewport) {
      Object.defineProperty(window.visualViewport, "height", {
        configurable: true,
        get: () => 320,
      });
    }
  });
  await prepareMatch(page, "quick-demo");

  await expect(page.getByTestId("game-container")).toHaveAttribute(
    "data-stage-height",
    "320",
  );

  await page.getByRole("button", { name: "Увеличить угол" }).tap();
  await expect(
    page.getByRole("button", {
      name: "Угол 49 градусов. Открыть точную настройку",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Уменьшить угол" }).tap();
  await expect(
    page.getByRole("button", {
      name: "Угол 48 градусов. Открыть точную настройку",
    }),
  ).toBeVisible();

  const geometry = await collectGeometry(page);
  expect(geometry.regions["game-container"]?.bottom).toBeLessThanOrEqual(320);
  expect(geometry.regions["fire-button"]?.bottom).toBeLessThanOrEqual(320);
});

test("Loadout tabs are fullscreen and block background", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "infinite-arsenal");

  await page.getByTestId("weapon-chip").click();
  const weaponDialog = page.getByTestId("loadout-weapon-dialog");
  await expect(weaponDialog).toBeVisible();
  const weaponRect = await weaponDialog.boundingBox();
  expect(weaponRect?.width).toBeGreaterThanOrEqual(843);
  expect(weaponRect?.height).toBeGreaterThanOrEqual(319);
  await expect(page.getByTestId("fire-button")).toBeDisabled();

  await weaponDialog.getByRole("tab", { name: "Щит" }).click();
  const shieldDialog = page.getByTestId("loadout-shield-dialog");
  await expect(shieldDialog).toBeVisible();
  await shieldDialog
    .getByRole("button", { name: "Закрыть каталог щитов" })
    .click();
  await expect(page.getByTestId("fire-button")).toBeEnabled();
});

test("camera popover owns minimap and stays clear of Fire", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "infinite-arsenal");

  await page.getByTestId("camera-toggle").click();
  await expect(page.getByTestId("camera-popover")).toBeVisible();
  const geometry = await collectGeometry(page);
  const popover = geometry.regions["camera-popover"];
  const toggle = geometry.regions["camera-toggle"];
  const fire = geometry.regions["fire-button"];
  if (!popover || !toggle || !fire) {
    throw new Error("Camera or Fire geometry is missing");
  }
  expect(popover.bottom).toBeLessThanOrEqual(fire.top);
  expect(popover.right).toBeLessThanOrEqual(toggle.left);
  await page.getByTestId("camera-toggle").click();
  await expect(page.getByTestId("camera-popover")).toBeHidden();
});

test("coarse Fire taps once and cancels after leaving the button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "quick-demo");

  await dispatchCoarsePointer(page, "pointerdown");
  await dispatchCoarsePointer(page, "pointerup");
  await expect(page.getByTestId("bottom-action-rail")).toBeHidden();
  await expect(page.getByTestId("top-combat-strip")).toBeVisible();

  await expect(page.getByTestId("bottom-action-rail")).toBeVisible({
    timeout: 2_500,
  });

  await dispatchCoarsePointer(page, "pointerdown", 73);
  await page.getByTestId("fire-button").dispatchEvent("pointermove", {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    pointerId: 73,
    pointerType: "touch",
    clientX: 0,
    clientY: 0,
  });
  await dispatchCoarsePointer(page, "pointerup", 73);
  await expect(page.getByTestId("bottom-action-rail")).toBeVisible();
});

test("resize and orientation round-trip preserve the match", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await prepareMatch(page, "quick-demo");
  await page.getByRole("button", { name: "Увеличить угол" }).click();
  await expect(
    page.getByRole("button", {
      name: "Угол 49 градусов. Открыть точную настройку",
    }),
  ).toBeVisible();

  await page.setViewportSize({ width: 844, height: 320 });
  await expect(page.getByTestId("game-container")).toHaveAttribute(
    "data-stage-height",
    "320",
  );
  assertAimingGeometry(await collectGeometry(page), "quick-demo");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByTestId("game-container")).toHaveAttribute(
    "data-stage-height",
    "390",
  );
  await expect(
    page.getByRole("button", {
      name: "Угол 49 градусов. Открыть точную настройку",
    }),
  ).toBeVisible();

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.getByText("Поверните телефон", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 320 });
  await expect(page.getByTestId("game-container")).toHaveAttribute(
    "data-stage-height",
    "320",
  );
  await expect(
    page.getByRole("button", {
      name: "Угол 49 градусов. Открыть точную настройку",
    }),
  ).toBeVisible();
});

test("Pause freezes and restores an active flight", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 320 });
  await prepareMatch(page, "quick-demo");
  await page.getByTestId("fire-button").click();
  await expect(page.getByTestId("bottom-action-rail")).toBeHidden();
  await page.getByRole("button", { name: "Пауза и настройки" }).click();
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
  await page.waitForTimeout(1_800);
  await page
    .getByRole("button", { name: "Вернуться в матч" })
    .click();
  await expect(page.getByTestId("bottom-action-rail")).toBeHidden();
  await expect(page.getByTestId("top-combat-strip")).toBeVisible();
  await expect(page.getByTestId("bottom-action-rail")).toBeVisible({
    timeout: 2_500,
  });
});
