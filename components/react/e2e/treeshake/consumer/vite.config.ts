import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// One Vite build per scenario. `SCENARIO` selects the entry html and the
// output directory so each scenario's dist/ is independent — measuring
// the sum of every emitted JS+CSS gives the real footprint of consuming
// just that one component.
const scenario = process.env.SCENARIO;
if (!scenario) {
    throw new Error(`SCENARIO env var is required (e.g. SCENARIO=button vite build)`);
}

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: `dist/${scenario}`,
        emptyOutDir: true,
        sourcemap: false,
        minify: true,
        // Treeshaking only really takes effect when minified production
        // chunks are emitted; modulePreload polyfill / dynamic-import
        // hashing must not introduce extra noise between runs.
        target: `es2022`,
        rollupOptions: {
            input: resolve(__dirname, `src/scenarios/${scenario}/index.html`)
        },
        reportCompressedSize: true
    }
});
