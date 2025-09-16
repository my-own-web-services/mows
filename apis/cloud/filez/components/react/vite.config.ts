import tailwindcssPostcss from "@tailwindcss/postcss";
import tailwindcssVite from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [
        react(),
        tailwindcssVite(),
        dts({ include: ["lib"], rollupTypes: true, tsconfigPath: "tsconfig.app.json" })
    ],
    css: {
        postcss: {
            plugins: [tailwindcssPostcss]
        }
    },
    build: {
        lib: {
            entry: resolve(__dirname, "lib/main.ts"),
            fileName: "main",
            formats: ["es"]
        },
        sourcemap: true,
        emptyOutDir: true
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./lib")
        }
    }
});
