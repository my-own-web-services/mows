import { defineConfig, devices } from "@playwright/test";

// Reuse a developer's already-running `pnpm dev` (port 5175) instead of
// spawning a parallel one — Vite cold-starts are slow enough that
// double-starting noticeably regresses local DX. CI sets E2E_BASE_URL
// if a pre-built static preview is used instead.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:5175`;

// On NixOS the playwright-bundled browsers won't run because they're
// missing glibc-linked shared libraries (libglib-2.0, libnss3, …). Point
// at a system browser via env var, mirroring the manager/ui setup:
//   PLAYWRIGHT_CHROMIUM_PATH=$(which google-chrome-stable) pnpm test:e2e
//   PLAYWRIGHT_FIREFOX_PATH=$(which firefox) pnpm test:e2e
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const systemFirefox = process.env.PLAYWRIGHT_FIREFOX_PATH;

export default defineConfig({
    testDir: `./e2e`,
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: process.env.CI ? `github` : `list`,
    use: {
        baseURL,
        trace: `retain-on-failure`,
        screenshot: `only-on-failure`
    },
    projects: systemFirefox
        ? [
              {
                  name: `firefox`,
                  use: {
                      ...devices[`Desktop Firefox`],
                      launchOptions: { executablePath: systemFirefox }
                  }
              }
          ]
        : [
              {
                  name: `chromium`,
                  use: {
                      ...devices[`Desktop Chrome`],
                      ...(systemChromium
                          ? { launchOptions: { executablePath: systemChromium } }
                          : {})
                  }
              }
          ],
    webServer: {
        // Only auto-start dev if nothing is already serving at the URL,
        // so the suite remains zero-config locally AND in CI.
        command: `pnpm dev`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        stdout: `ignore`,
        stderr: `pipe`
    }
});
