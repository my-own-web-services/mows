// Single source of truth for doc-site URL shapes (demos + guides). Lives
// outside App.tsx so anything in `src/` — the link registry, prose
// renderers, sidebar — can derive a path without dragging the entire
// `demos` / `guides` graph behind it.
//
// `import.meta.env.BASE_URL` is Vite's static `base`. It always ends with
// a `/` (e.g. `/` in dev, `/mows/` under GitHub Pages), so concatenating
// directly produces the canonical absolute path.
const APP_BASE = import.meta.env.BASE_URL;

export const DEMO_PATH_PREFIX = APP_BASE;
export const GUIDE_PATH_PREFIX = `${APP_BASE}guide/`;

export const pathForDemoName = (name: string): string =>
    `${DEMO_PATH_PREFIX}${name}`;

export const pathForGuideName = (name: string): string =>
    `${GUIDE_PATH_PREFIX}${name}`;
