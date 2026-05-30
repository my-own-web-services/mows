import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Proxy target is overridable via VITE_AUTHZ_ADMIN_API_URL. Same
// localhost-only safety guard the realtime chat app ships — a
// developer who accidentally exports a remote URL doesn't leak the
// dev `x-realtime-user-id` / `x-filez-user-id` headers to that
// origin.
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    const target = env.VITE_AUTHZ_ADMIN_API_URL ?? "http://127.0.0.1:8770";

    {
        const allowRemote = env.VITE_AUTHZ_ADMIN_API_URL_ALLOW_REMOTE === "1";
        const targetHost = new URL(target).hostname;
        const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
        if (!localHosts.has(targetHost) && !allowRemote) {
            throw new Error(
                `VITE_AUTHZ_ADMIN_API_URL=${target} points to a non-localhost host ` +
                    `(${targetHost}). Set VITE_AUTHZ_ADMIN_API_URL_ALLOW_REMOTE=1 ` +
                    `to opt in to a remote target (staging, integration tests).`
            );
        }
    }

    return {
        plugins: [react(), tailwindcss()],
        server: {
            proxy: {
                "/api": { target },
            },
        },
    };
});
