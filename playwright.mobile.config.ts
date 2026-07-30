import { defineConfig, devices } from "@playwright/test";

const mobilePort = Number(process.env.PLAYWRIGHT_PORT ?? "41921");
const mobileBaseUrl = `http://127.0.0.1:${mobilePort}`;

export default defineConfig({
  testDir: "./tests/mobile",
  testIgnore: process.env.CI ? "**/mobile-visual.spec.ts" : undefined,
  outputDir:
    process.env.PLAYWRIGHT_OUTPUT_DIR ?? "test-results/mobile",
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{projectName}/{testFilePath}/{arg}{ext}",
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "line",
  use: {
    baseURL: mobileBaseUrl,
    colorScheme: "dark",
    locale: "ru-RU",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.015,
    },
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Desktop Chrome"],
        hasTouch: true,
      },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["Desktop Safari"],
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      `npm run build && npm run start -- --host 127.0.0.1 --port ${mobilePort}`,
    url: mobileBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
