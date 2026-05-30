import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Proxy target is overridable via VITE_REALTIME_API_URL so a
// non-default backend (e.g. a different port for two-realtime-server
// integration tests, or a staging URL) can be wired without
// editing this file. Falls back to the dev URL. (review B10 /
// SLOP-1)
export default defineConfig(({ mode }) => {
    // Only load VITE_-prefixed env vars (the public-safe surface);
    // an empty prefix would pull in every env var in the shell,
    // including secrets unrelated to the build. (review C2)
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const target = env.VITE_REALTIME_API_URL ?? "http://127.0.0.1:8765";

    // C6 — defensive guard: refuse to proxy to a non-localhost
    // host unless the operator explicitly opts in. A developer
    // with VITE_REALTIME_API_URL pointing at attacker.example.com
    // would otherwise leak the dev-mode X-Realtime-User-Id header
    // (and any future Authorization cookies) to that origin.
    {
        const allowRemote = env.VITE_REALTIME_API_URL_ALLOW_REMOTE === "1";
        const targetHost = new URL(target).hostname;
        const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
        if (!localHosts.has(targetHost) && !allowRemote) {
            throw new Error(
                `VITE_REALTIME_API_URL=${target} points to a non-localhost host ` +
                    `(${targetHost}). Set VITE_REALTIME_API_URL_ALLOW_REMOTE=1 ` +
                    `to opt in to a remote target (staging, integration tests).`
            );
        }
    }

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
