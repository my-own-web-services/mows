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

const libraryConfig: UserConfig = {
    plugins: [
        react(),
        libInjectCss(),
        tailwindcssVite(),
        dts({ rollupTypes: true, tsconfigPath: resolve(__dirname, `tsconfig.lib.json`) }),
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
        rollupOptions: {
            external: [
                `react`,
                `react-dom`,
                `react/jsx-runtime`,
                `tailwindcss`,
                `filez-client-typescript`
            ],
            input: Object.fromEntries(
                glob
                    .sync(`lib/**/*.{ts,tsx}`, {
                        ignore: [`lib/**/*.d.ts`]
                    })
                    .map((file) => [
                        // The name of the entry point
                        // lib/nested/foo.ts becomes nested/foo
                        relative(`lib`, file.slice(0, file.length - extname(file).length)),
                        // The absolute path to the entry file
                        // lib/nested/foo.ts becomes /project/lib/nested/foo.ts
                        fileURLToPath(new URL(file, import.meta.url))
                    ])
            ),
            output: {
                assetFileNames: `assets/[name][extname]`,
                entryFileNames: `[name].js`
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

let config: UserConfig = {};

switch (process.env.TARGET) {
    case `lib`: {
        config = libraryConfig;
        break;
    }
    default: {
        config = libraryConfig;
        break;
    }
}

// https://vite.dev/config/
export default defineConfig(config);
