const { defineConfig } = require("@playwright/test");

const visualSpec = /visual\.spec\.js/;

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  workers: 3,
  webServer: {
    command: "npx http-server -p 4173 --silent",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  expect: {
    timeout: 5000
  },
  use: {
    headless: true,
    actionTimeout: 10000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium-1366", testIgnore: visualSpec, use: { browserName: "chromium", viewport: { width: 1366, height: 768 } } },
    { name: "chromium-1440", testIgnore: visualSpec, use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "chromium-1920", testIgnore: visualSpec, use: { browserName: "chromium", viewport: { width: 1920, height: 1080 } } },
    { name: "screenshots", testMatch: visualSpec, use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } }
  ]
});
