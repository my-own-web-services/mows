#!/usr/bin/env node
// Asserts the relative-ratio properties that the e2e treeshake test
// actually cares about. Concrete sizes drift with React + Vite + Tailwind
// versions; ratios stay meaningful because the same React + Vite + Tailwind
// is in every scenario.
//
// Three numbers per scenario:
//   • eager     — what index.html DIRECTLY references (entry script,
//                 modulepreload, stylesheet). The bytes the browser
//                 fetches before first paint. Tree-shaking AND code
//                 splitting both shrink this.
//   • reachable — eager + every chunk reachable by following JS-internal
//                 filename references (dynamic-import targets, late
//                 chunks). "Everything the user MIGHT download during
//                 the session." If reachable ≫ eager, code splitting
//                 is doing its job.
//   • total     — every file Vite emitted in dist/, including orphans.
//                 Signals stray bytes that bloat downstream node_modules.
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
    console.error("usage: verify.mjs <sizes.json>");
    process.exit(64);
}

const data = JSON.parse(readFileSync(path, "utf8")).scenarios;
const required = ["empty", "button", "codeViewer", "resourceList"];
for (const s of required) {
    if (!data[s]) {
        console.error(`verify: missing scenario "${s}" in sizes.json`);
        process.exit(2);
    }
}

const eagerJsGz = (s) => data[s].eager.js.gzip;
const eagerJsRaw = (s) => data[s].eager.js.raw;
const reachJsGz = (s) => data[s].reachable.js.gzip;
const reachJsRaw = (s) => data[s].reachable.js.raw;
const totalRaw = (s) => data[s].total.raw;
const fmt = (n) => `${(n / 1024).toFixed(2)} kB`;

const emptyE = eagerJsGz("empty");
const buttonE = eagerJsGz("button");
const cvE = eagerJsGz("codeViewer");
const cvR = reachJsGz("codeViewer");
const rlE = eagerJsGz("resourceList");

const dButtonE = buttonE - emptyE;
const dCvE = cvE - emptyE;
const dRlE = rlE - emptyE;
const cvDeferred = cvR - cvE;

console.log("\nTree-shake e2e — bundle breakdown (gzip):");
console.log("┌────────────────┬─────────────┬─────────────┬─────────────┬─────────────┐");
console.log("│ Scenario       │ Eager JS    │ Reach JS    │ Δ over empty│ Total emit  │");
console.log("│                │ (1st paint) │ (+lazy)     │ (eager)     │ (incl orph.)│");
console.log("├────────────────┼─────────────┼─────────────┼─────────────┼─────────────┤");
for (const s of required) {
    const e = eagerJsGz(s);
    const r = reachJsGz(s);
    const d = s === "empty" ? "—" : `${e - emptyE >= 0 ? "+" : ""}${fmt(e - emptyE)}`;
    console.log(
        `│ ${s.padEnd(14)} │ ${fmt(e).padStart(11)} │ ${fmt(r).padStart(11)} │ ${d.padStart(
            11
        )} │ ${fmt(totalRaw(s)).padStart(11)} │`
    );
}
console.log("└────────────────┴─────────────┴─────────────┴─────────────┴─────────────┘\n");

const failures = [];
const warnings = [];
const assert = (label, ok, detail) => {
    if (!ok) failures.push(`  ✗ ${label}\n      ${detail}`);
    else console.log(`  ✓ ${label}`);
};

// --- Sanity ---

assert(
    "baseline eager bundle is non-trivial",
    emptyE > 10 * 1024,
    `empty.eager.js.gzip=${fmt(emptyE)}; expected >10kB (React + Vite floor)`
);

// --- Tree-shaking: a small component must not eagerly drag in heavy deps ---

assert(
    "Button adds non-zero weight",
    dButtonE > 0,
    `Δ over empty = ${fmt(dButtonE)}`
);

assert(
    "Button eager bundle adds <50 kB (gzip) over baseline",
    dButtonE < 50 * 1024,
    `Δ over empty = ${fmt(dButtonE)} — Button shouldn't add more than ~50kB even with the lib's shared utility chunk`
);

// --- Code splitting: heavy components must not bloat the first paint ---

// CodeViewer wrapper + React.lazy() for MonacoCodeEditor. Eager bundle
// is the small wrapper; Monaco itself only lands in `reachable`.
assert(
    "CodeViewer eager bundle adds <120 kB (gzip) over baseline (Monaco is lazy)",
    dCvE < 120 * 1024,
    `Δ over empty = ${fmt(dCvE)} — if Monaco is in the eager bundle, code splitting isn't working`
);

// And the deferred chunks must actually be substantial — proves the
// lazy chunks aren't tiny stubs.
assert(
    "CodeViewer defers a substantial payload (reachable ≫ eager)",
    cvDeferred > 500 * 1024,
    `reachable - eager = ${fmt(cvDeferred)} — Monaco should add ≫500kB on demand`
);

// Strong ratio: Button (no lazy chunks) vs CodeViewer (lots of lazy).
// In the EAGER bundle these should be comparable; the difference
// should land in reachable only.
assert(
    "Button and CodeViewer have comparable eager bundles (≤3× apart)",
    dCvE < dButtonE * 3 + 50 * 1024,
    `Button eager Δ=${fmt(dButtonE)}, CodeViewer eager Δ=${fmt(dCvE)} — if CodeViewer's eager bundle is much bigger than Button's, Monaco is being inlined`
);

// --- Tree-shaking against another heavy component ---

assert(
    "ResourceList eager bundle adds <300 kB (gzip) over baseline",
    dRlE < 300 * 1024,
    `Δ over empty = ${fmt(dRlE)} — ResourceList should fit in <300kB once its deps are tree-shaken`
);

// --- Distinguishability ---

// Even if every scenario's eager bundle is similar (because of lazy
// loading), the reachable totals should be obviously different —
// otherwise nothing is actually being downloaded on demand.
const cvAllJs = reachJsRaw("codeViewer");
const rlAllJs = reachJsRaw("resourceList");
assert(
    "CodeViewer reachable JS is much larger than ResourceList reachable JS",
    cvAllJs > rlAllJs * 2,
    `codeViewer reachable=${fmt(cvAllJs)}, resourceList reachable=${fmt(
        rlAllJs
    )} — heavy components should remain distinguishable in their total fetched payload`
);

// --- Orphan-asset warning (non-blocking) ---

const ORPHAN_THRESHOLD = 100 * 1024;
const orphans = [];
for (const s of required) {
    const reach = reachJsRaw(s) + data[s].reachable.css.raw;
    const orphan = totalRaw(s) - reach;
    if (orphan > ORPHAN_THRESHOLD) {
        orphans.push({ scenario: s, bytes: orphan });
    }
}
if (orphans.length > 0) {
    const list = orphans.map((o) => `      • ${o.scenario.padEnd(14)} ${fmt(o.bytes)}`).join("\n");
    warnings.push(
        `  ! Orphan assets emitted to dist by the consumer build:
${list}

      These files sit in dist/ (and thus in every downstream consumer's
      node_modules) but nothing in the runtime bundle references them.
      Usually a sign that some module in the lib has
      \`new URL("./worker.js", import.meta.url)\` references that
      Vite copies eagerly even when the module is tree-shaken out.`
    );
}

if (failures.length > 0) {
    console.error("\nFAIL — tree-shake / code-split regressions:");
    for (const f of failures) console.error(f);
    if (warnings.length > 0) {
        console.error("\nWarnings:");
        for (const w of warnings) console.error(w);
    }
    console.error(`
Diagnostic notes:

  • If Button's eager bundle leaked: check that lib/main.ts's barrel
    isn't statically importing a heavy module. A heavy module reachable
    via static \`export { ... } from "./Heavy"\` will be included by the
    consumer's bundler unless tree-shaking can drop every named export
    Heavy provides.

  • If CodeViewer's eager bundle leaked: the React.lazy(import())
    wrapping in CodeViewer.tsx may have regressed to a static import,
    or some other path is statically reaching MonacoCodeEditor. Check
    the entry chunk for monaco-editor references.

  • If reachable ≈ eager for a heavy component: code splitting is broken.
    Either the dynamic import was inlined by the bundler, or the lazy
    chunk's identity was lost. Inspect index.html: every <link rel=
    "modulepreload"> is an eager preload — a lazy chunk should NOT be
    in that list.

  • Run \`bash e2e/treeshake/run.sh --rebuild\` after lib changes to
    force a fresh library build before the e2e measurement.

  • last-run-sizes.json next to this script holds the raw numbers.
`);
    process.exit(1);
}

if (warnings.length > 0) {
    console.log("\nWarnings (non-blocking):");
    for (const w of warnings) console.log(w);
}
console.log("\nPASS — tree-shake + code-split constraints hold.\n");
