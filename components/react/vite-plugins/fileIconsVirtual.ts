import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

// Anchor the icon-package lookup to THIS file's location instead of
// `process.cwd()` (DEVOPS-58). Running `pnpm --filter @mows/react-components
// build` from the monorepo root used to resolve `vscode-material-icons`
// against the wrong cwd; now the resolve walks up from the plugin source.
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url));

// Virtual module that ships every `vscode-material-icons` SVG as a single
// inlined `Record<icon-name, data-URL>`. We need this because the previous
// implementation used `import.meta.glob('.../*.svg', { eager: true, query:
// '?url' })`, which is fine for production (rollup collapses the whole map
// into one chunk with inlined data URLs) but in the dev server expands into
// ~910 individual ESM module requests on every page load. That single
// behavioural quirk was making the docs hang on initial load.
//
// By baking the map at plugin-load time we get one module fetch in dev AND
// the same one-module shape in the published library build, so consumers
// don't need this plugin themselves — the data URLs are already inlined
// into the prebuilt JS that ships in `dist/`.
const VIRTUAL_ID = `virtual:mows-file-icons`;
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const encodeSvgDataUrl = (svg: string): string => {
    const compact = svg.replace(/\s+/g, ` `).trim();
    // Match the encoding Vite's built-in SVG inliner produces (URI-encoded,
    // not base64) so payload sizes stay close to the prior `?url`+`eager`
    // production output.
    const encoded = encodeURIComponent(compact);
    return `data:image/svg+xml,${encoded}`;
};

const findIconsDir = (root: string): string => {
    const requireFn = createRequire(resolve(root, `package.json`));
    // The package doesn't expose ./package.json under its "exports" field,
    // so resolve via the published entry and walk up to the package root.
    const entry = requireFn.resolve(`vscode-material-icons`);
    // entry is typically `<pkg>/dist/index.js`; walk up until we hit the
    // dir that contains `generated/icons` (handles future entry changes).
    let currentDirectory = dirname(entry);
    for (let depth = 0; depth < 5; depth += 1) {
        const candidate = resolve(currentDirectory, `generated/icons`);
        try {
            statSync(candidate);
            return candidate;
        } catch {
            /* keep walking */
        }
        const parent = dirname(currentDirectory);
        if (parent === currentDirectory) break;
        currentDirectory = parent;
    }
    throw new Error(
        `mows-file-icons-virtual: could not locate generated/icons under vscode-material-icons`
    );
};

const buildModule = (iconsDir: string): string => {
    const files = readdirSync(iconsDir).filter((file) => file.endsWith(`.svg`));
    const map: Record<string, string> = {};
    for (const file of files) {
        const name = file.slice(0, -4);
        const svg = readFileSync(resolve(iconsDir, file), `utf8`);
        map[name] = encodeSvgDataUrl(svg);
    }
    return `export const iconUrlMap = ${JSON.stringify(map)};\n`;
};

export const fileIconsVirtual = (): Plugin => {
    let cached: { iconsDir: string; module: string; mtime: number } | null = null;
    return {
        name: `mows-file-icons-virtual`,
        enforce: `pre`,
        resolveId(id) {
            if (id === VIRTUAL_ID) return RESOLVED_ID;
            return null;
        },
        load(id) {
            if (id !== RESOLVED_ID) return null;
            const iconsDir = findIconsDir(PLUGIN_DIR);
            const mtime = statSync(iconsDir).mtimeMs;
            if (!cached || cached.iconsDir !== iconsDir || cached.mtime !== mtime) {
                cached = { iconsDir, module: buildModule(iconsDir), mtime };
            }
            return cached.module;
        }
    };
};
