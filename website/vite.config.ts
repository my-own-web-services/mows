import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { imagetools } from "vite-imagetools";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [preact(), imagetools()],
    // add assets inline limit
    build: {
        assetsInlineLimit: 0
    }
});
