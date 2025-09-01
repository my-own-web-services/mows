import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [react(),tailwindcss()],
    build: {
        lib: {
            entry: resolve(__dirname, "lib/main.ts"),
            name: "FilezComponentsReact",

            fileName: "filez-components-react",
            formats: ["es"]
        },
        rollupOptions: {
        external: ['react', 'react/jsx-runtime'],
        }
    }
});
