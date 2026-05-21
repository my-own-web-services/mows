import { defineConfig, devices } from "@playwright/test";

// Reuse a developer's already-running `pnpm dev` (port 5175) instead of
// spawning a parallel one — Vite cold-starts are slow enough that
// double-starting noticeably regresses local DX. CI sets E2E_BASE_URL
// if a pre-built static preview is used instead.
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:5175`;

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
    projects: [
        {
            name: `chromium`,
            use: { ...devices[`Desktop Chrome`] }
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
