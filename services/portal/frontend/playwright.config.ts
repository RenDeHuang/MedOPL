import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  testMatch: "**/*.visual.ts",
  snapshotDir: "./tests/visual",
  outputDir: "./test-results/visual",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:17180",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 920 },
        colorScheme: "light",
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 17180",
    url: "http://127.0.0.1:17180/overview",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
