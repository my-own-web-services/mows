import tailwindcssPostcss from "@tailwindcss/postcss";
import tailwindcssVite from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig, UserConfig } from "vite";
import dts from "vite-plugin-dts";

const libraryConfig: UserConfig = {
    plugins: [
        react(),
        tailwindcssVite(),
        dts({ rollupTypes: true, tsconfigPath: "tsconfig.lib.json" }),
        visualizer({
            emitFile: true,
            filename: "stats.html"
        })
    ],
    css: {
        postcss: {
            plugins: [tailwindcssPostcss]
        }
    },
    build: {
        lib: {
            entry: resolve(__dirname, "lib/main.ts"),
            fileName: "filez-components-react",
            name: "filez-components-react",
            formats: ["es", "cjs"]
        },
        rollupOptions: {
            external: ["react", "react-dom", "react/jsx-runtime"]
        },
        sourcemap: true,
        emptyOutDir: true
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./lib")
        }
    }
};

let config: UserConfig = {};

switch (process.env.TARGET) {
    case "lib": {
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
