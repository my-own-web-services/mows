import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Proxy target is overridable via VITE_REALTIME_API_URL so a
// non-default backend (e.g. a different port for two-realtime-server
// integration tests, or a staging URL) can be wired without
// editing this file. Falls back to the dev URL. (review B10 /
// SLOP-1)
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const target = env.VITE_REALTIME_API_URL ?? "http://127.0.0.1:8765";
    return {
        plugins: [react(), tailwindcss()],
        server: {
            proxy: {
                // Forward all /api + /demo requests to the realtime
                // server on the same origin (avoiding CORS + matching
                // the production deployment shape).
                // `ws: true` is REQUIRED for the WebSocket upgrade on
                // `/api/channels/{id}/live` to reach the backend;
                // without it vite returns 404 + the WS connect fails
                // silently.
                "/api": { target, ws: true },
                "/demo": { target },
            },
        },
    };
});
