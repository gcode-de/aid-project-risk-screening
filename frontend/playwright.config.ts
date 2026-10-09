import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:8000", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1100 } },
    },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command:
      "uv run --project .. uvicorn backend.main:app --app-dir .. --host 127.0.0.1 --port 8000",
    url: "http://127.0.0.1:8000/api/health",
    env: { MODEL_MODE: "demo", STATIC_DIR: "dist" },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
