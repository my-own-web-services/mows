/// <reference types="@testing-library/jest-dom" />
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: `jsdom`,
            setupFiles: `./vitest.setup.ts`,
            globals: true,
            // Playwright specs live in `e2e/` and use the Playwright test
            // runner; vitest would otherwise pick them up via its default
            // pattern and crash trying to instantiate `expect` from
            // `@playwright/test`.
            exclude: [`**/node_modules/**`, `**/dist/**`, `e2e/**`]
        }
    })
);
