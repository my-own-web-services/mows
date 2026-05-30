import { test, expect } from "@playwright/test";

// Regression: moving the Slider node's slider on the NodeEditor docs page
// used to wipe every edge. Root cause was the example regenerating its
// `nodes` array from a `useMemo` on every render, which makes xyflow's
// `adoptUserNodes` rebuild each internal node, reset `measured` +
// `handleBounds`, and flip `nodesInitialized` back to false — so
// `getEdgePosition` returned null for every edge and the SVG layer
// drew nothing. This test asserts the edge survives slider changes.

test.describe(`NodeEditor docs page`, () => {
    test.setTimeout(60_000);

    test(`edges stay rendered while the slider value changes`, async ({ page }) => {
        await page.goto(`/NodeEditor`);

        // Wait until the example has mounted: the slider node renders a
        // role="slider" thumb, and the initial Slider→Doubler edge
        // renders as one `.react-flow__edge-path`.
        const slider = page.locator(`[role="slider"]`).first();
        await expect(slider).toBeVisible({ timeout: 30_000 });
        const edgePath = page.locator(`.react-flow__edge-path`);
        await expect(edgePath).toHaveCount(1);

        // Drive the value via the keyboard API — Radix Slider treats
        // ArrowRight/Left as a step increment. Each press triggers the
        // React re-render that used to wipe `measured`. We sample the
        // edge count between bursts so a single regression-flake won't
        // hide behind a final passing assertion.
        await slider.focus();

        for (let i = 0; i < 10; i++) await page.keyboard.press(`ArrowRight`);
        await expect(slider).toHaveAttribute(`aria-valuenow`, `17`);
        await expect(edgePath).toHaveCount(1);

        for (let i = 0; i < 25; i++) await page.keyboard.press(`ArrowRight`);
        await expect(slider).toHaveAttribute(`aria-valuenow`, `42`);
        await expect(edgePath).toHaveCount(1);

        for (let i = 0; i < 50; i++) await page.keyboard.press(`ArrowLeft`);
        await expect(slider).toHaveAttribute(`aria-valuenow`, `0`);
        await expect(edgePath).toHaveCount(1);
    });
});
