import { defineConfig, devices } from "@playwright/test";

// The tests drive the running Vite dev server (which proxies /v1 to the
// supervisor on 127.0.0.1:7878) and create real VMs through the
// supervisor REST API. They do NOT start their own dev server — this
// project's dev loop is "vite is already up at :5176"; spinning a second
// vite in CI is left to the integration harness that owns supervisor
// boot.
const BASE_URL =
    process.env.MOWS_VM_SUPERVISOR_WEB_URL ?? "http://localhost:5176";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false, // VM lifecycle is serial — concurrent creates oversubscribe KVM
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        // The terminal needs a fixed viewport so xterm row math is stable.
        viewport: { width: 1280, height: 800 }
    },
    timeout: 120_000,
    expect: { timeout: 30_000 },
    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                // NixOS: the Chromium binary Playwright downloads can't
                // load its dynamic dependencies (libglib, libnss, …)
                // outside of a nix-shell. Honour PLAYWRIGHT_CHROMIUM_PATH
                // when set (so CI can override) and fall back to the
                // system chromium that the nix-managed wrapper installs.
                launchOptions: {
                    executablePath:
                        process.env.PLAYWRIGHT_CHROMIUM_PATH ??
                        "/run/current-system/sw/bin/chromium"
                }
            }
        }
    ]
});
