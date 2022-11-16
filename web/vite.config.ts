import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [preact()],
    css: {
        preprocessorOptions: {
            less: {
                modifyVars: { "@enable-css-reset": false }
            }
        }
    },
    server: {
        proxy: {
            "/api": {
                target: "http://127.0.0.1:8080",
                changeOrigin: true
            }
        }
    }
});
