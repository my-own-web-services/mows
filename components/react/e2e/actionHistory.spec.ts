import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the action-history + undo/redo system.
 *
 * Runs against the docs harness because that's the only place we have a
 * page with the panel actually mounted. The HistoryPanel demo dispatches
 * three sample undoable actions on mount, so the panel renders with
 * content immediately.
 *
 * Note on NixOS: Playwright's bundled browsers need a system Chromium
 * (`PLAYWRIGHT_CHROMIUM_PATH=$(which google-chrome-stable)`).
 */

test.describe(`Action history + undo (HistoryPanel docs page)`, () => {
    // Generous timeout: the Playwright webServer can take up to 120s for
    // a Vite cold-start before the test itself even begins. 60s is too
    // close to that edge in CI environments.
    test.setTimeout(180_000);

    test(`renders the populated panel with three sample entries`, async ({ page }) => {
        await page.goto(`/HistoryPanel`);

        // The default example is the first card on the page — wait for
        // it to render at least one row before asserting.
        const list = page.locator(`.HistoryPanel ul`).first();
        await expect(list).toBeVisible({ timeout: 30_000 });

        // Sample actions registered + dispatched by examples/historyPanel/Default.tsx.
        await expect(list.locator(`li`)).toHaveCount(3);
    });

    test(`search box narrows the visible rows`, async ({ page }) => {
        await page.goto(`/HistoryPanel`);
        const panel = page.locator(`.HistoryPanel`).first();
        await expect(panel).toBeVisible({ timeout: 30_000 });

        const search = panel.getByPlaceholder(/search/i).first();
        await search.fill(`rename`);

        const visibleRows = panel.locator(`ul li`);
        await expect(visibleRows).toHaveCount(1);
        await expect(visibleRows.first()).toContainText(/rename/i);
    });

    test(`clicking "Undo to here" pops the most recent entry`, async ({ page }) => {
        await page.goto(`/HistoryPanel`);
        const panel = page.locator(`.HistoryPanel`).first();
        await expect(panel).toBeVisible({ timeout: 30_000 });
        const rows = panel.locator(`ul li`);
        await expect(rows).toHaveCount(3);

        // Top row is the most recent dispatch. Clicking its "Undo to
        // here" affordance pops just that one entry.
        const undoButtons = panel.getByRole(`button`, { name: /undo to here/i });
        await expect(undoButtons.first()).toBeVisible();
        await undoButtons.first().click();

        // The audit entry stays in the log (history is append-only); only
        // the undoable affordance disappears. The most recent row should
        // no longer offer "Undo to here" because the matching undo-stack
        // entry was popped.
        await expect(rows).toHaveCount(3);
        // First row's undo button is gone (the entry is no longer on the
        // undo stack); the next two rows still have theirs.
        const remainingButtons = panel.getByRole(`button`, { name: /undo to here/i });
        await expect(remainingButtons).toHaveCount(2);
    });

    test(`Ctrl+Z hotkey reduces the undoable count by one`, async ({ page }) => {
        await page.goto(`/HistoryPanel`);
        const panel = page.locator(`.HistoryPanel`).first();
        await expect(panel).toBeVisible({ timeout: 30_000 });

        const undoableCountBefore = await panel
            .getByRole(`button`, { name: /undo to here/i })
            .count();
        expect(undoableCountBefore).toBeGreaterThan(0);

        // Focus the body before firing the hotkey — clicking inside the
        // panel would steal focus into one of its controls and the
        // search Input would intercept Ctrl+Z as a text-undo.
        await page.locator(`body`).press(`Control+z`);

        await expect(
            panel.getByRole(`button`, { name: /undo to here/i })
        ).toHaveCount(undoableCountBefore - 1);
    });
});
