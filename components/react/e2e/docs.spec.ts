import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

// Walks every page advertised by the docs sidebar and asserts that
// (a) the page rendered something tangible (the doc heading), and
// (b) the browser logged no console.error or uncaught page error.
//
// Discovery happens at runtime by scraping `<a href>` elements from the
// sidebar — so adding a new `<XDocPage>` to `src/demos.tsx` automatically
// gets covered without touching this file. The single-test loop reports
// every offending URL together rather than bailing on the first failure,
// which is what you want when scanning ~50 pages.

interface PageFailure {
    readonly url: string;
    readonly kind: `console-error` | `page-error` | `render`;
    readonly detail: string;
}

const collectErrors = (page: Page, currentUrl: { value: string }): PageFailure[] => {
    const failures: PageFailure[] = [];
    const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() !== `error`) return;
        // Filter out "Failed to load resource" errors that are navigation
        // cancellations — never real failures. Two flavours:
        //  1. Cross-origin URLs (shaka-demo-assets MP4, mapbox tiles,
        //     etc.) whose in-flight fetches die when the SPA pushes a
        //     new state mid-download.
        //  2. Same-origin Vite module loads (`localhost:5175/src/...`)
        //     that abort the same way during route changes — Chromium
        //     emits `net::ERR_NETWORK_CHANGED` / `ERR_ABORTED` and the
        //     dev server is fine, the request was just cancelled.
        // Anything else (real 404, parse failure, etc.) still fails the
        // test.
        const text = msg.text();
        if (text.startsWith(`Failed to load resource`)) {
            if (text.includes(`net::ERR_NETWORK_CHANGED`) ||
                text.includes(`net::ERR_ABORTED`)) {
                return;
            }
            const resourceUrl = msg.location().url;
            try {
                const origin = new URL(resourceUrl).origin;
                const baseOrigin = new URL(page.url()).origin;
                if (origin !== baseOrigin) return;
            } catch {
                // If the URL is unparseable, fall through and treat as a
                // real failure so we don't silently drop signal.
            }
        }
        failures.push({
            url: currentUrl.value,
            kind: `console-error`,
            detail: text
        });
    };
    const onPageError = (err: Error) => {
        failures.push({
            url: currentUrl.value,
            kind: `page-error`,
            detail: `${err.name}: ${err.message}`
        });
    };
    page.on(`console`, onConsole);
    page.on(`pageerror`, onPageError);
    return failures;
};

test.describe(`docs site`, () => {
    // Walking ~50 pages with a per-page 15s heading wait can easily blow
    // through the default 30s test budget. Allot a generous ceiling
    // (~6 minutes); the test still exits as soon as the loop finishes.
    test.setTimeout(360_000);

    test(`every demo + guide page renders without console errors`, async ({ page }) => {
        const currentUrl = { value: `/` };
        const failures = collectErrors(page, currentUrl);

        // Step 1: hit the root, confirm shell renders, scrape the sidebar.
        await page.goto(`/`);
        await expect(
            page.locator(`main, [role="main"], [data-testid="app-shell"]`).first()
        ).toBeVisible({ timeout: 30_000 });

        const hrefs = await page.$$eval(`a[href]`, (anchors) => {
            const unique = new Set<string>();
            for (const anchor of anchors) {
                const raw = anchor.getAttribute(`href`);
                if (!raw) continue;
                // Internal absolute paths only — skip mailto:, external,
                // and pure hash anchors (they reference subsections of
                // the currently visible page and would just re-scroll).
                if (!raw.startsWith(`/`)) continue;
                unique.add(raw.split(`#`)[0]);
            }
            return Array.from(unique).sort();
        });

        // Sanity floor — if the sidebar somehow renders empty, the loop
        // below would pass vacuously. demos.tsx ships ~50 entries today.
        expect(hrefs.length, `sidebar should expose at least 20 links`).toBeGreaterThan(20);

        // Step 2: walk every link. `page.goto` waits for `load` by default;
        // we add an explicit heading visibility wait so SPA route changes
        // that resolve only after a microtask don't false-positive.
        for (const href of hrefs) {
            currentUrl.value = href;
            await test.step(`visit ${href}`, async () => {
                try {
                    // `load` (not just `domcontentloaded`) keeps us from
                    // racing past the page while Vite is still streaming
                    // the route's JS modules — the docpage's heading is
                    // rendered by that JS, so checking for it before
                    // `load` resolves is a false-negative magnet.
                    await page.goto(href, { waitUntil: `load` });
                } catch (err) {
                    // Chrome sometimes aborts an in-flight nav when the SPA
                    // pushes its own state; record + keep walking so one
                    // flake doesn't mask 49 other pages.
                    failures.push({
                        url: href,
                        kind: `render`,
                        detail: `goto failed: ${(err as Error).message}`
                    });
                    return;
                }
                const heading = page
                    .locator(`main h1, main h2, main h3, [role="main"] h1, [role="main"] h2, [role="main"] h3`)
                    .first();
                try {
                    // Vite dev-server cold-compiles each route on first
                    // hit, so an unwarmed page can easily eat 20s while
                    // others wait in the queue. The total test budget
                    // (360s) is plenty; this per-page wait just needs to
                    // tolerate the compile spike.
                    await expect(heading).toBeVisible({ timeout: 30_000 });
                } catch (err) {
                    failures.push({
                        url: href,
                        kind: `render`,
                        detail: `no heading visible after 30s: ${(err as Error).message}`
                    });
                }
            });
        }

        if (failures.length > 0) {
            const grouped = failures
                .map((f) => `  [${f.kind}] ${f.url} — ${f.detail}`)
                .join(`\n`);
            throw new Error(
                `${failures.length} failure(s) across ${hrefs.length} page(s):\n${grouped}`
            );
        }
    });
});
