import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SeekPreview from "./SeekPreview";
import type { ThumbnailFrame } from "./types";

const singleImageFrame: ThumbnailFrame = {
    uri: `https://example.test/thumb.jpg`,
    width: 160,
    height: 90,
    sprite: false,
    positionX: 0,
    positionY: 0,
    imageWidth: 160,
    imageHeight: 90,
    startTime: 0,
    duration: 0
};

const spriteFrame: ThumbnailFrame = {
    uri: `https://example.test/sprite.jpg`,
    width: 80, // sprite tile is 80×45 in source coords
    height: 45,
    sprite: true,
    positionX: 80, // second column on the first row
    positionY: 0,
    imageWidth: 320, // sprite is 4×N tiles wide
    imageHeight: 180,
    startTime: 0,
    duration: 0
};

describe(`SeekPreview`, () => {
    it(`renders the timestamp pill even when no thumbnail is available`, () => {
        render(
            <SeekPreview
                time={75}
                thumbnail={null}
                trackX={120}
                trackWidth={400}
            />
        );
        expect(screen.getByText(`1:15`)).toBeInTheDocument();
        // No thumbnail AND consumer can't produce one → no tile rendered.
        const tooltip = screen.getByRole(`tooltip`);
        const bgs = tooltip.querySelectorAll(`[style*="background-image"]`);
        expect(bgs).toHaveLength(0);
    });

    it(`renders a placeholder tile when thumbnails are wired up but not yet loaded`, () => {
        // hasThumbnails=true, thumbnail=null → user is dragging into a frame
        // the grabber hasn't decoded yet. The tile must still appear above
        // the timestamp so the preview doesn't disappear / show a stale
        // frame from a different time.
        const { container } = render(
            <SeekPreview
                time={42}
                thumbnail={null}
                hasThumbnails
                trackX={200}
                trackWidth={400}
            />
        );
        // Tile is present (the inner div with width/height styles).
        const tile = container.querySelector(`div[aria-hidden]`);
        expect(tile).toBeInTheDocument();
        // No background-image yet — only the placeholder.
        expect(tile?.getAttribute(`style`) ?? ``).not.toContain(`background-image`);
        // Spinner placeholder is visible.
        expect(container.querySelector(`svg.animate-spin`)).toBeInTheDocument();
        // Timestamp still shown.
        expect(screen.getByText(`0:42`)).toBeInTheDocument();
    });

    it(`clamps the centred preview so it never floats off-screen`, () => {
        const { rerender, getByRole } = render(
            <SeekPreview time={0} thumbnail={null} trackX={0} trackWidth={400} />
        );
        // 0px is the far left — the preview must shift right so its centre
        // sits at min = (PREVIEW_WIDTH/2 + PADDING) = 84.
        let tooltip = getByRole(`tooltip`);
        expect(tooltip.style.left).toBe(`84px`);
        rerender(
            <SeekPreview time={100} thumbnail={null} trackX={400} trackWidth={400} />
        );
        tooltip = getByRole(`tooltip`);
        // 400px (far right) → centre clamped to (trackWidth - half - padding) = 316.
        expect(tooltip.style.left).toBe(`316px`);
    });

    it(`renders a single-image thumbnail with contain background-size`, () => {
        const { container } = render(
            <SeekPreview
                time={0}
                thumbnail={singleImageFrame}
                trackX={200}
                trackWidth={400}
            />
        );
        const bg = container.querySelector(`[style*="background-image"]`) as HTMLElement;
        expect(bg).toBeInTheDocument();
        expect(bg.style.backgroundImage).toContain(`thumb.jpg`);
        expect(bg.style.backgroundSize).toBe(`contain`);
        // jsdom normalises the shorthand `center` to `center center`.
        expect(bg.style.backgroundPosition).toMatch(/^center( center)?$/);
    });

    it(`renders a sprite-sheet thumbnail with scaled size + negative offset`, () => {
        const { container } = render(
            <SeekPreview
                time={0}
                thumbnail={spriteFrame}
                trackX={200}
                trackWidth={400}
            />
        );
        const bg = container.querySelector(`[style*="background-image"]`) as HTMLElement;
        expect(bg).toBeInTheDocument();
        // scaleX = 160 / 80 = 2, scaleY = 90 / 45 = 2.
        // backgroundSize = (imageWidth × scaleX) × (imageHeight × scaleY)
        //                = (320 × 2) × (180 × 2) = "640px 360px"
        expect(bg.style.backgroundSize).toBe(`640px 360px`);
        // backgroundPosition = -(positionX × scaleX) -(positionY × scaleY)
        //                    = -(80 × 2) -(0 × 2) = "-160px 0px"
        expect(bg.style.backgroundPosition).toBe(`-160px 0px`);
        expect(bg.style.backgroundImage).toContain(`sprite.jpg`);
    });
});
