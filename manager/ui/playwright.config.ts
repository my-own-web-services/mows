import { defineConfig, devices } from "@playwright/test";

// On NixOS the playwright-bundled browsers won't run because they're missing
// glibc-linked libraries. Set PLAYWRIGHT_FIREFOX_PATH=$(which firefox) (or
// PLAYWRIGHT_CHROMIUM_PATH) to point at a system browser instead.
const systemFirefox = process.env.PLAYWRIGHT_FIREFOX_PATH;
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
    testDir: `./e2e`,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? `github` : `list`,
    use: {
        baseURL: `http://localhost:5173`,
        trace: `on-first-retry`
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
        command: `pnpm dev`,
        url: `http://localhost:5173`,
        reuseExistingServer: !process.env.CI,
        stdout: `pipe`,
        stderr: `pipe`,
        timeout: 60_000
    }
});
