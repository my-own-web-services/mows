// Cross-doc link registry: maps a PascalCase component / guide name
// ("PrimaryMenu", "ConsoleManager", "CreatingApps") to the doc-site path
// that hosts its doc page.
//
// Populated at module-init time by `demos.tsx` and `guides/index.tsx`
// (both call `registerDemoLinks` / `registerGuideLinks` after they
// declare their entry arrays). Consumers — currently the inline-prose
// renderer at `src/examples/harness/docPage/renderInlineMarkup.tsx` —
// pull entries via `lookupComponentPath`.
//
// The registry must NOT import from `demos.tsx` or `guides/index.tsx`:
// those files import every DocPage, and most DocPages use the inline
// renderer, which uses this registry — closing that loop would create a
// circular import chain. The producer-side `register*Links` call lives
// inside `demos.tsx` / `guides/index.tsx` so the dependency only flows
// in one direction.

import { pathForDemoName, pathForGuideName } from "./componentRoutes";

interface NamedEntry {
    readonly name: string;
}

const links = new Map<string, string>();

export const registerDemoLinks = (
    entries: ReadonlyArray<NamedEntry>
): void => {
    for (const entry of entries) links.set(entry.name, pathForDemoName(entry.name));
};

export const registerGuideLinks = (
    entries: ReadonlyArray<NamedEntry>
): void => {
    for (const entry of entries) links.set(entry.name, pathForGuideName(entry.name));
};

/**
 * Returns the doc-site path for a registered component / guide name, or
 * `undefined` when the name is not a known doc target.
 *
 * Names are matched case-sensitively against the PascalCase form used in
 * source (e.g. `PrimaryMenu`). Prose that says `<primarymenu>` will not
 * link — by design: the casing inconsistency is more useful as an author
 * hint than as a fuzzy match.
 */
export const lookupComponentPath = (name: string): string | undefined =>
    links.get(name);

/**
 * Test-only: every other consumer should be using `lookupComponentPath`.
 * The registry is process-global state, so vitest specs that exercise
 * the linker need a way to reset between tests.
 */
export const __resetComponentLinkRegistryForTests = (): void => {
    links.clear();
};
