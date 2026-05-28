# Tree-shake e2e

End-to-end verification that consuming a single component from
`@my-own-web-services/react-components` produces a bundle containing **only** that
component plus its real dependencies — no Monaco when you import Button,
no react-dnd when you import Avatar.

## What it does

1. Builds the library in the repo (`pnpm run build`).
2. Packs the built lib into a tarball (`npm pack`).
3. Builds a Docker image with a minimal Vite consumer project — React +
   Vite + Tailwind + the four scenario sources.
4. Runs the container, bind-mounting the tarball. The container installs
   the tarball, then builds each scenario in isolation:
   - `empty` — imports nothing from the lib (baseline cost: React + Vite)
   - `button` — `import { Button } from "@my-own-web-services/react-components"`
   - `codeViewer` — heavy scenario with Monaco
   - `resourceList` — heavy scenario with react-dnd / virtualizer
5. Writes per-scenario raw and gzip byte counts to `sizes.json`.
6. `verify.mjs` asserts the relative-ratio properties (e.g. Button's Δ
   over baseline must be ≥4× smaller than CodeViewer's Δ).

## Running

```sh
pnpm test:treeshake          # reuses dist/ if it exists
pnpm test:treeshake --       # …same
bash e2e/treeshake/run.sh --rebuild   # force a fresh lib build first
```

Docker must be on the PATH. The image is built once and cached; only
the bind-mounted tarball changes between runs.

## What it measures

Three numbers per scenario:

- **eager** — what `index.html` DIRECTLY references via `<script>`,
  `<link rel="modulepreload">`, and `<link rel="stylesheet">`. The
  bytes the browser fetches before first paint. Tree-shaking AND
  code splitting both shrink this.
- **reachable** — `eager` plus every chunk reachable by following
  JS-internal filename references (dynamic-import targets, late
  chunks). Everything the user MIGHT download during the session.
  If `reachable ≫ eager`, code splitting is doing its job.
- **total** — every file Vite emitted under the scenario's `dist/`,
  including orphan assets nothing references at runtime. Surfaces
  stray bytes that bloat every downstream `node_modules`.

## What it asserts (hard failures)

| # | Property                                                                | Why                                                                            |
| - | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1 | baseline eager bundle is non-trivial                                   | Catches a vacuously-passing test where every ratio is `0`                      |
| 2 | Button adds non-zero weight                                            | Sanity                                                                         |
| 3 | Button eager bundle adds <50 kB (gzip) over baseline                   | A heavy dep leaking into Button via the barrel would blow this past 50 kB      |
| 4 | CodeViewer eager bundle adds <120 kB (gzip) over baseline              | Proves Monaco is lazy — if it lands in the eager bundle, code splitting broke  |
| 5 | CodeViewer defers a substantial payload (reachable ≫ eager, >500 kB)  | Proves the deferred chunks aren't tiny stubs — Monaco really is downloadable  |
| 6 | Button & CodeViewer have comparable eager bundles (≤3× apart)         | The wrapper for a "heavy" component should be no larger than a simple one     |
| 7 | ResourceList eager bundle adds <300 kB (gzip) over baseline           | ResourceList has no dynamic imports, but its deps must still tree-shake       |
| 8 | CodeViewer reachable JS > ResourceList reachable JS × 2               | Catches "every scenario gets the same blob" — heavy components stay heavy     |

Absolute sizes are intentionally NOT asserted — they drift with React,
Vite, and Tailwind versions. The ratios stay meaningful because every
scenario uses the same toolchain.

## Non-blocking warnings

When `total - reachable > 100 kB` for any scenario, the report prints
an **orphan-asset warning**: Vite copied files into the consumer's
dist that nothing in the runtime bundle references. The most common
cause is a `new URL("./worker.js", import.meta.url)` pattern somewhere
in the lib that Vite's asset emission follows eagerly, even when the
referring module is tree-shaken from the bundle. The browser never
downloads those files, but they bloat every downstream `node_modules`.

## Current numbers (snapshot)

| Scenario     | Eager (gzip) | Reachable (gzip) | Δ over empty (eager) |
| ------------ | ------------ | ---------------- | -------------------- |
| empty        | 57 kB        | 57 kB            | —                    |
| button       | 67 kB        | 67 kB            | +10 kB               |
| codeViewer   | 131 kB       | 3 211 kB         | +74 kB               |
| resourceList | 133 kB       | 133 kB           | +77 kB               |

`codeViewer.reachable ≫ codeViewer.eager` is the smoking gun that
code splitting works: the wrapper costs 74 kB at first paint, and the
Monaco editor (3 MB) only loads once the lazy chunk is requested.

## On failure

`run.sh` preserves `last-run-sizes.json` next to itself for inspection.
The container also prints the size table to stderr before exit.
