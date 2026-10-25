import { defineConfig, devices } from '@playwright/test';

// E2E runs against its own stack: backend on 3100 using dcagent_test (reset before start), Vite on 5174.
// The real database (dcagent, served on 3000/5173) is never touched.
const BACKEND_PORT = 3100;
const FRONTEND_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  // night-smoke walks the live stack with its own config (playwright.night.config.ts)
  testIgnore: /night-smoke\.spec\.ts$/,
  // Playwright empties outputDir on every run; a subfolder keeps test-results/night-screenshots intact
  outputDir: './test-results/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    locale: 'zh-CN',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: [
    {
      // db:test:reset refuses any database whose name does not end with _test
      command: `npm run db:test:reset && NODE_ENV=test npx tsx src/index.ts`,
      cwd: '../backend',
      port: BACKEND_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
      port: FRONTEND_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
