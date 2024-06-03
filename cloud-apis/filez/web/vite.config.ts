import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [preact({})],
    css: {
        preprocessorOptions: {
            less: {
                modifyVars: { "@enable-css-reset": false }
            }
        }
    },
    resolve: {
        alias: {
            react: "preact/compat",
            "react-dom/test-utils": "preact/test-utils",
            "react-dom": "preact/compat",
            "react/jsx-runtime": "preact/jsx-runtime"
        }
    },

    server: {
        proxy: {
            "/api": {
                target: "http://localhost:8080"
            }
        }
    }
});
