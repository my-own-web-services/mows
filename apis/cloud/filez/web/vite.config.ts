import preact from "@preact/preset-vite";
import tailwindcssVite from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [preact(), tailwindcssVite()]
});
