import tailwindcssPostcss from "@tailwindcss/postcss";
import tailwindcssVite from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { glob } from "glob";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, UserConfig } from "vite";
import dts from "vite-plugin-dts";
import { libInjectCss } from "vite-plugin-lib-inject-css";
import { fileIconsVirtual } from "./vite-plugins/fileIconsVirtual";

const libraryConfig: UserConfig = {
    // `base: './'` makes every URL Vite emits (including the Monaco
    // worker URLs produced by `new Worker(new URL(..., import.meta.url))`
    // inside `monaco-editor/esm/vs/language/*/*Mode.js`) relative to the
    // importing chunk. Without this, the default `/` base produces
    // absolute paths like `"/assets/html.worker-XXX.js"` which a
    // consumer's Vite build resolves against the consumer's project
    // root (looking under `public/assets/`), where the worker file
    // doesn't exist — breaking `vite build` in every downstream app
    // that transitively imports CodeViewer / Monaco. Relative URLs
    // resolve against `dist/`, where the worker chunks actually live.
    base: `./`,
    plugins: [
        fileIconsVirtual(),
        react(),
        libInjectCss(),
        tailwindcssVite(),
        dts({
            // `rollupTypes` is temporarily disabled because api-extractor
            // dereferences source-map paths from prior build artefacts and
            // crashes when the underlying files have since moved. Per-file
            // d.ts emit avoids that lookup entirely. Re-enable once the
            // dangling sourcemap refs are cleaned up.
            rollupTypes: false,
            tsconfigPath: resolve(__dirname, `tsconfig.lib.json`),
            compilerOptions: { noEmitOnError: false }
        }),
        visualizer({
            emitFile: true,
            filename: `stats.html`
        })
    ],
    css: {
        postcss: {
            plugins: [tailwindcssPostcss]
        }
    },
    build: {
        lib: {
            entry: Object.fromEntries(
                glob
                    .sync(`lib/**/*.{ts,tsx}`, {
                        // Exclude type-declarations, tests, and any
                        // colocated docs / fixtures that get added under
                        // `lib/` in the future. Anything bundled into
                        // `dist/` becomes part of the published surface.
                        ignore: [
                            `lib/**/*.d.ts`,
                            `lib/**/*.test.{ts,tsx}`,
                            `lib/**/*.md`,
                            `lib/**/__fixtures__/**`,
                            `lib/**/fixtures/**`
                        ]
                    })
                    .map((file) => [
                        relative(`lib`, file.slice(0, file.length - extname(file).length)),
                        fileURLToPath(new URL(file, import.meta.url))
                    ])
            ),
            formats: [`es`]
        },
        rollupOptions: {
            external: [`react`, `react-dom`, `react/jsx-runtime`, `tailwindcss`],
            output: {
                assetFileNames: `assets/[name][extname]`,
                entryFileNames: `[name].js`,
                preserveModules: false
            }
        },
        sourcemap: true,
        emptyOutDir: true,
        copyPublicDir: false
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, `./lib`)
        }
    }
};

// Docs site (the in-app component showcase served on :5175 during dev) is
// shipped as a static SPA — index.html as the entry, react app mounted into
// #root. `SITE_BASE` controls the public path so the same artefact can be
// deployed under `/`, `/mows/` (default project page), or a custom domain
// without rebuilding the lib.
const siteBase = process.env.SITE_BASE ?? `/`;
const siteConfig: UserConfig = {
    base: siteBase,
    plugins: [fileIconsVirtual(), react(), tailwindcssVite()],
    css: {
        postcss: {
            plugins: [tailwindcssPostcss]
        }
    },
    build: {
        outDir: `dist-site`,
        emptyOutDir: true,
        sourcemap: true
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, `./lib`)
        }
    }
};

let config: UserConfig = {};

switch (process.env.TARGET) {
    case `lib`: {
        config = libraryConfig;
        break;
    }
    case `site`: {
        config = siteConfig;
        break;
    }
    default: {
        config = libraryConfig;
        break;
    }
}

export default defineConfig(config);
