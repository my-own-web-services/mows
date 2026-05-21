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
        // Network failures for genuinely missing assets are interesting,
        // but Vite HMR warnings during navigation occasionally surface as
        // benign `error`s. Surface everything; let the assertion show
        // the noise and decide later whether to filter.
        failures.push({
            url: currentUrl.value,
            kind: `console-error`,
            detail: msg.text()
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
                await page.goto(href, { waitUntil: `domcontentloaded` });
                const heading = page
                    .locator(`main h1, main h2, main h3, [role="main"] h1, [role="main"] h2, [role="main"] h3`)
                    .first();
                try {
                    await expect(heading).toBeVisible({ timeout: 15_000 });
                } catch (err) {
                    failures.push({
                        url: href,
                        kind: `render`,
                        detail: `no heading visible after 15s: ${(err as Error).message}`
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
