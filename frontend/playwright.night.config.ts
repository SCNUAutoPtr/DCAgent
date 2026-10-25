import { defineConfig, devices } from '@playwright/test';

// Night smoke: read-only acceptance run against the live dev stack (Vite 5173 -> backend 3000, real database).
// No webServer, no global setup (that one resets dcagent_test). Run: npx playwright test -c playwright.night.config.ts
export default defineConfig({
  testDir: './e2e',
  testMatch: /night-smoke\.spec\.ts$/,
  outputDir: './test-results/night-pw',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.NIGHT_BASE_URL ?? 'http://localhost:5173',
    locale: 'zh-CN',
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1600, height: 1000 } } }],
});
