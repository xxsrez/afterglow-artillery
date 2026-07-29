import {
  expect,
  type Page,
  type TestInfo,
} from "@playwright/test";

export type MatchMode = "quick-demo" | "infinite-arsenal";

export interface GeometryRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface GeometryDump {
  readonly viewport: {
    readonly innerWidth: number;
    readonly innerHeight: number;
    readonly visualWidth: number;
    readonly visualHeight: number;
  };
  readonly body: {
    readonly scrollWidth: number;
    readonly scrollHeight: number;
  };
  readonly regions: Record<string, GeometryRect>;
  readonly targets: readonly (GeometryRect & {
    readonly label: string;
    readonly disabled: boolean;
  })[];
}

const pageErrors = new WeakMap<Page, string[]>();

export function watchPageErrors(page: Page): void {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
}

export async function assertNoPageErrors(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  const errors = pageErrors.get(page) ?? [];
  if (errors.length > 0) {
    await testInfo.attach("browser-errors.txt", {
      body: errors.join("\n"),
      contentType: "text/plain",
    });
  }
  expect(errors).toEqual([]);
}

export async function prepareMatch(
  page: Page,
  mode: MatchMode,
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await page.goto("/");
  await expect(page.locator("[data-client-ready='true']")).toBeVisible();
  await expect(page.locator("[data-mobile-combat='true']")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (mode === "infinite-arsenal") {
    await page
      .getByRole("button", { name: /^Infinite Arsenal/ })
      .click();
  }
  await page
    .getByRole("button", {
      name:
        mode === "infinite-arsenal"
          ? "Начать Infinite Arsenal"
          : "Начать Quick Demo",
    })
    .click();
  await expect(page.getByTestId("bottom-action-rail")).toBeVisible();
}

export async function collectGeometry(page: Page): Promise<GeometryDump> {
  return page.evaluate(() => {
    const regionIds = [
      "battlefield-canvas",
      "top-combat-strip",
      "bottom-action-rail",
      "angle-stepper",
      "power-stepper",
      "weapon-chip",
      "shield-chip",
      "fire-button",
      "camera-toggle",
      "camera-popover",
      "angle-precision-tray",
      "power-precision-tray",
      "loadout-weapon-dialog",
      "loadout-shield-dialog",
    ];
    const toRect = (rect: DOMRect) => ({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    });
    const regions: Record<string, ReturnType<typeof toRect>> = {};
    for (const id of regionIds) {
      const element = document.querySelector<HTMLElement>(
        `[data-testid="${id}"]`,
      );
      if (element && element.getClientRects().length > 0) {
        regions[id] = toRect(element.getBoundingClientRect());
      }
    }
    const rail = document.querySelector<HTMLElement>(
      "[data-testid='bottom-action-rail']",
    );
    const targets = rail
      ? [...rail.querySelectorAll<HTMLButtonElement>("button")]
          .filter((button) => button.getClientRects().length > 0)
          .map((button) => ({
            ...toRect(button.getBoundingClientRect()),
            label: button.getAttribute("aria-label") ?? button.textContent ?? "",
            disabled: button.disabled,
          }))
      : [];
    return {
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visualWidth: window.visualViewport?.width ?? window.innerWidth,
        visualHeight: window.visualViewport?.height ?? window.innerHeight,
      },
      body: {
        scrollWidth: document.body.scrollWidth,
        scrollHeight: document.body.scrollHeight,
      },
      regions,
      targets,
    };
  });
}

export async function attachFailureGeometry(
  page: Page,
  testInfo: TestInfo,
): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) {
    return;
  }
  const geometry = await collectGeometry(page);
  await testInfo.attach("geometry.json", {
    body: JSON.stringify(geometry, null, 2),
    contentType: "application/json",
  });
}

export function assertAimingGeometry(
  geometry: GeometryDump,
  mode: MatchMode,
): void {
  const {
    viewport,
    body,
    regions,
    targets,
  } = geometry;
  const canvas = regions["battlefield-canvas"];
  const top = regions["top-combat-strip"];
  const rail = regions["bottom-action-rail"];
  const fire = regions["fire-button"];
  const loadoutNeighbor =
    mode === "infinite-arsenal"
      ? regions["shield-chip"]
      : regions["weapon-chip"];
  if (!canvas || !top || !rail || !fire || !loadoutNeighbor) {
    throw new Error("Missing persistent mobile combat geometry");
  }

  expect(body.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth);
  expect(body.scrollHeight).toBeLessThanOrEqual(viewport.innerHeight);
  expect(canvas.width / viewport.innerWidth).toBeGreaterThanOrEqual(0.95);
  expect(canvas.height / viewport.innerHeight).toBeGreaterThanOrEqual(0.95);
  expect(top.bottom).toBeLessThanOrEqual(rail.top);
  expect(top.height + rail.height).toBeLessThanOrEqual(112);
  if (canvas.height >= 296) {
    expect(rail.top - top.bottom).toBeGreaterThanOrEqual(180);
  }

  for (const target of targets) {
    expect(target.left).toBeGreaterThanOrEqual(0);
    expect(target.top).toBeGreaterThanOrEqual(0);
    expect(target.right).toBeLessThanOrEqual(viewport.visualWidth + 0.5);
    expect(target.bottom).toBeLessThanOrEqual(viewport.visualHeight + 0.5);
    expect(target.width).toBeGreaterThanOrEqual(48);
    expect(target.height).toBeGreaterThanOrEqual(48);
  }
  expect(fire.width).toBeGreaterThanOrEqual(72);
  expect(fire.height).toBeGreaterThanOrEqual(56);
  expect(fire.left - loadoutNeighbor.right).toBeGreaterThanOrEqual(12);
}

export async function dispatchCoarsePointer(
  page: Page,
  type: "pointerdown" | "pointerup" | "pointercancel",
  pointerId = 71,
): Promise<void> {
  const target =
    type === "pointerdown"
      ? page.getByTestId("fire-button")
      : page.locator("body");
  const box = await page.getByTestId("fire-button").boundingBox();
  const clientX = box ? box.x + box.width / 2 : 1;
  const clientY = box ? box.y + box.height / 2 : 1;
  await target.dispatchEvent(type, {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    pointerId,
    pointerType: "touch",
    clientX,
    clientY,
  });
}
