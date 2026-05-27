import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3015',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cd ../backend && python3 main.py',
      port: 8483,
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
    {
      command: 'pnpm dev',
      port: 3015,
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
  ],
})
