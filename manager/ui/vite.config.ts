import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        port: 5173,
        strictPort: true
    },
    plugins: [
        react({
            babel: {
                plugins: [[`module:@preact/signals-react-transform`, { mode: `all` }]]
            }
        }),
        tailwindcss()
    ]
});
