import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

// In dev, the supervisor runs on http://127.0.0.1:7878 (default). Vite proxies
// REST + websocket traffic so the UI can address `/v1/...` regardless of
// whether it's served by Vite (dev) or the supervisor's static file handler
// (prod). The websocket proxy is required for the display + console streams.
const SUPERVISOR_URL =
    process.env.MOWS_VM_SUPERVISOR_URL ?? "http://127.0.0.1:7878";

/**
 * Copy @mows/react-components's pre-bundled Monaco worker chunks into our
 * `public/assets/` before rollup starts.
 *
 * The lib ships Monaco language modes (json/css/html/ts/editor) that spawn
 * their workers via `new Worker(new URL("/assets/<name>.worker-<hash>.js",
 * import.meta.url))`. Vite's worker scanner treats these as additional
 * entry modules and tries to resolve them under the consumer's project
 * root — which fails. Staging the workers under `public/assets/` makes
 * those paths real on disk *and* serves them correctly at runtime.
 *
 * This is a workaround for a structural issue in the lib's library-mode
 * build (it inlines worker URLs as absolute paths). Once the lib is fixed
 * to externalize Monaco or use blob workers, this plugin can be deleted.
 */
const stageMonacoWorkers = (): Plugin => ({
    name: "stage-monaco-workers",
    enforce: "pre",
    buildStart() {
        const libAssets = resolve(
            dirname(new URL(import.meta.url).pathname),
            "node_modules/@mows/react-components/dist/assets"
        );
        const dest = resolve(
            dirname(new URL(import.meta.url).pathname),
            "public/assets"
        );
        if (!existsSync(libAssets)) return;
        mkdirSync(dest, { recursive: true });
        for (const name of readdirSync(libAssets)) {
            if (/\.worker-[A-Za-z0-9_-]+\.js(\.map)?$/.test(name)) {
                copyFileSync(`${libAssets}/${name}`, `${dest}/${name}`);
            }
        }
    }
});

export default defineConfig({
    server: {
        port: 5176,
        strictPort: true,
        proxy: {
            "/v1": {
                target: SUPERVISOR_URL,
                changeOrigin: true,
                ws: true,
                rewriteWsOrigin: true
            }
        }
    },
    plugins: [stageMonacoWorkers(), react(), tailwindcss()]
});
