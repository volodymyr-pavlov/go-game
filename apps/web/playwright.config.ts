import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const SERVER_PORT = 8787;
/** The tests with accounts run against the Firebase Auth emulator and a game server of their own. */
const EMULATED = Boolean(process.env.VITE_FIREBASE_EMULATOR);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  outputDir: '.reports/test-results',
  reporter: process.env.CI
    ? 'line'
    : [['list'], ['html', { outputFolder: '.reports/playwright-report', open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    ...(EMULATED
      ? [
          {
            // A fresh local database each time. DEV_AUTH lets the server take the tokens of the Auth emulator. The assets folder must exist.
            command:
              'mkdir -p .dist && rm -rf .wrangler/e2e && ' +
              'npx wrangler d1 migrations apply DB --local --persist-to .wrangler/e2e --config ../api/wrangler.jsonc && ' +
              `npx wrangler dev --config ../api/wrangler.jsonc --port ${SERVER_PORT} --persist-to .wrangler/e2e --var DEV_AUTH:1`,
            url: `http://127.0.0.1:${SERVER_PORT}/api/leaderboard`,
            reuseExistingServer: !process.env.CI,
            timeout: 90_000,
          },
        ]
      : []),
  ],
});
