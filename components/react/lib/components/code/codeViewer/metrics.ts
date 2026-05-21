// Single source of truth for the `fitContent` layout. The Suspense
// fallback in `CodeViewer.tsx` and the Monaco wrapper in
// `MonacoCodeEditor.tsx` both derive their height from these constants
// so the skeleton and the mounted editor occupy the *exact* same
// vertical space — no layout shift on lazy-chunk load.
//
// The values here are not free parameters: they are the Monaco editor
// options used in `MonacoCodeEditor.tsx`. Changing one without the
// other will reintroduce a shift.
//
// - `MONACO_LINE_HEIGHT_PX` is the explicit `lineHeight` editor option.
// - `MONACO_VERTICAL_CHROME_PX` is the wrapper's combined top + bottom
//   border (each 1px from the `border` utility). Monaco itself runs at
//   `padding: { top: 0, bottom: 0 }` so it contributes no extra
//   vertical chrome. With `box-sizing: border-box` (Tailwind default),
//   the wrapper's `height` includes the border, so we add it back to
//   the line-count height.

export const MONACO_LINE_HEIGHT_PX = 21;
export const MONACO_VERTICAL_CHROME_PX = 2;

/**
 * Returns the exact wrapper height needed to display `code` without any
 * vertical scroll in `fitContent` mode. Assumes:
 *
 * - `lineHeight = MONACO_LINE_HEIGHT_PX`
 * - no editor padding
 * - `wordWrap: "off"` (one source line == one rendered line)
 * - 1px top + 1px bottom border on the wrapper
 *
 * `MonacoCodeEditor` enforces these in fitContent mode; the Suspense
 * fallback uses the same formula so the two heights are identical.
 */
export const estimateFitContentHeight = (code: string): number => {
    const lines = Math.max(1, code.split(`\n`).length);
    return lines * MONACO_LINE_HEIGHT_PX + MONACO_VERTICAL_CHROME_PX;
};
