import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { imagetools } from "vite-imagetools";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        preact(),
        imagetools(),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: "auto",
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
            },
            manifest: {
                name: "My Own Web Services",
                short_name: "MOWS",
                description: "The project presentation of My Own Web Services.",
                theme_color: "#00040c",
                icons: [
                    {
                        src: "website/public/assets/logos/mows_logo.svg",
                        sizes: "192x192",
                        type: "image/svg"
                    },
                    {
                        src: "website/public/assets/logos/mows_logo.svg",
                        sizes: "512x512",
                        type: "image/svg"
                    }
                ]
            }
        })
    ],
    // add assets inline limit
    build: {
        assetsInlineLimit: 0
    }
});
