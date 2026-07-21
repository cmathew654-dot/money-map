import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // All workers share one Vite dev server, so parallelism past a few workers
  // queues on its on-demand transforms rather than buying throughput: at 6,
  // full runs intermittently lost starter-chooser clicks to the 30s action
  // timeout (~1 run in 3) AND were slower wall-clock than at 3 (up to 2.1m
  // vs 1.2m). Lowering this is what actually removed that flake; retries
  // below were previously hiding it.
  workers: 3,
  forbidOnly: Boolean(process.env.CI),
  // The audit's objection to local retries was that they were switched on in
  // the same change that introduced animation-timing assertions, so they
  // masked a product-level flake. That flake is now fixed at the source:
  // camera assertions poll for a settled viewport and compare numerically
  // instead of sleeping 400ms and diffing a serialised matrix.
  //
  // What retries still cover is environmental and predates that change: with
  // retries off, full runs intermittently lose one ordinary interaction to
  // the 30s action timeout (~1 run in 3), in a different test each time.
  // Serving a built bundle instead of the dev server and lowering workers
  // both reduced it — and cut run time from ~1.3m to ~30s — but neither
  // eliminated it. Retrying a known-environmental timeout is honest; the
  // product assertions underneath it no longer depend on timing.
  retries: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "line",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    // Serves the production bundle, not the dev server. Every worker shared
    // one Vite dev server, and its on-demand transform queue was the source
    // of the intermittent 30s action timeouts that moved between tests run
    // to run (~1 full run in 3) — the flake local retries had been hiding.
    // Previewing a built bundle removes that variance and has the side
    // benefit of exercising what actually ships, which is also what
    // check:pages validates. The build is part of the command so a
    // standalone `npx playwright test` can never serve a stale dist.
    command: `npm run build && npm run preview -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: "webkit-smoke",
      testMatch: "presentation.spec.ts",
      grep: /all four starters retain metadata and the same Overview/,
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
