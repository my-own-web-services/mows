import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ControlBar from "./ControlBar";
import type { PlayerStatus, VariantOption } from "./types";

// Radix's DropdownMenu reads from `hasPointerCapture` / `releasePointerCapture`
// on the trigger element when the user clicks. jsdom doesn't implement those.
beforeAll(() => {
    if (!Element.prototype.hasPointerCapture) {
        Element.prototype.hasPointerCapture = vi.fn(() => false);
    }
    if (!Element.prototype.releasePointerCapture) {
        Element.prototype.releasePointerCapture = vi.fn();
    }
    if (!Element.prototype.setPointerCapture) {
        Element.prototype.setPointerCapture = vi.fn();
    }
    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = vi.fn();
    }
});

const baseStatus: PlayerStatus = {
    playing: false,
    buffering: false,
    currentTime: 0,
    duration: 600,
    volume: 1,
    muted: false,
    playbackRate: 1,
    fullscreen: false,
    pictureInPicture: false,
    nativeFallback: false,
    textTracksVisible: false
};

const variantsUnsorted: VariantOption[] = [
    { id: 1, height: 180, width: 320, bandwidth: 321_000, label: `abr`, active: false },
    { id: 2, height: 720, width: 1280, bandwidth: 5_000_000, label: `abr`, active: false },
    { id: 3, height: 2160, width: 3840, bandwidth: 15_000_000, label: `abr`, active: false },
    { id: 4, height: 1080, width: 1920, bandwidth: 10_000_000, label: `abr`, active: false },
    { id: 5, height: 432, width: 768, bandwidth: 2_000_000, label: `abr`, active: false },
    { id: 6, height: 576, width: 1024, bandwidth: 3_200_000, label: `abr`, active: false }
];

const noop = () => undefined;

const renderBar = (variants: VariantOption[]) =>
    render(
        <ControlBar
            status={baseStatus}
            variants={variants}
            textTracks={[]}
            autoVariantActive
            visible
            onTogglePlay={noop}
            onSeek={noop}
            onVolume={noop}
            onToggleMute={noop}
            onSelectVariant={vi.fn()}
            onSelectTextTrack={noop}
            onSetPlaybackRate={noop}
            onTogglePictureInPicture={noop}
            onToggleFullscreen={noop}
        />
    );

describe(`ControlBar quality menu`, () => {
    it(`shows variants sorted highest → lowest by vertical resolution`, async () => {
        renderBar(variantsUnsorted);
        await userEvent.setup().click(screen.getByRole(`button`, { name: `Quality` }));
        const menu = screen.getByRole(`menu`);
        const items = within(menu)
            .getAllByRole(`menuitemradio`)
            .map((el) => el.textContent ?? ``);
        // First entry is the "Auto" toggle, rest must be height-desc.
        expect(items[0]).toMatch(/Auto/);
        expect(items.slice(1)).toEqual([
            expect.stringContaining(`2160p`),
            expect.stringContaining(`1080p`),
            expect.stringContaining(`720p`),
            expect.stringContaining(`576p`),
            expect.stringContaining(`432p`),
            expect.stringContaining(`180p`)
        ]);
    });

    it(`renders the right tier badge for each resolution`, async () => {
        renderBar(variantsUnsorted);
        await userEvent.setup().click(screen.getByRole(`button`, { name: `Quality` }));
        const menu = screen.getByRole(`menu`);

        // 2160p → 4K, 1080p → Full HD, 720p → HD, 576p → SD
        const find = (resolution: string) =>
            within(menu)
                .getAllByRole(`menuitemradio`)
                .find((el) => el.textContent?.includes(resolution))!;

        expect(find(`2160p`).textContent).toContain(`4K`);
        expect(find(`1080p`).textContent).toContain(`Full HD`);
        expect(find(`720p`).textContent).toContain(`HD`);
        expect(find(`576p`).textContent).toContain(`SD`);
        expect(find(`432p`).textContent).toContain(`SD`);
        expect(find(`180p`).textContent).toContain(`SD`);
        // 720p → HD must NOT show "Full HD" or "4K"
        expect(find(`720p`).textContent).not.toMatch(/Full HD|4K/);
    });

    it(`hides the Quality menu entirely when only a single variant is exposed`, () => {
        renderBar([variantsUnsorted[0]]);
        expect(screen.queryByRole(`button`, { name: `Quality` })).not.toBeInTheDocument();
    });

    it(`surfaces the Auto-picked variant on the Quality button and in the menu`, async () => {
        // Mark the 1080p variant as the one Shaka's ABR is currently
        // playing — the badge + label should pick it up.
        const variantsWithActive = variantsUnsorted.map((v) => ({
            ...v,
            active: v.height === 1080
        }));
        render(
            <ControlBar
                status={baseStatus}
                variants={variantsWithActive}
                textTracks={[]}
                autoVariantActive
                visible
                onTogglePlay={noop}
                onSeek={noop}
                onVolume={noop}
                onToggleMute={noop}
                onSelectVariant={vi.fn()}
                onSelectTextTrack={noop}
                onSetPlaybackRate={noop}
                onTogglePictureInPicture={noop}
                onToggleFullscreen={noop}
            />
        );
        // Collapsed button: aria-label includes the live resolution and the
        // height is visible to sighted users.
        const button = screen.getByRole(`button`, { name: /Quality · 1080p/ });
        expect(button.textContent).toContain(`1080p`);
        // Menu's Auto row labels what Auto picked.
        await userEvent.setup().click(button);
        const autoItem = screen
            .getAllByRole(`menuitemradio`)
            .find((el) => el.textContent?.startsWith(`Auto`))!;
        expect(autoItem.textContent).toContain(`Auto`);
        expect(autoItem.textContent).toContain(`1080p`);
        // The auto entry also shows the tier badge (Full HD).
        expect(autoItem.textContent).toContain(`Full HD`);
    });

    it(`omits the resolution badge on the Quality button when no variant is active yet`, () => {
        // No variant marked active (tracks resolved but ABR hasn't picked
        // one yet) → button stays a plain icon button.
        renderBar(variantsUnsorted);
        const button = screen.getByRole(`button`, { name: `Quality` });
        expect(button.textContent ?? ``).not.toMatch(/\d+p/);
    });
});

describe(`ControlBar chapters`, () => {
    const chapters = [
        { id: `a`, title: `Cold open`, startTime: 0 },
        { id: `b`, title: `Act II`, startTime: 50 },
        { id: `c`, title: `Finale`, startTime: 80 }
    ];
    const renderWithChapters = (status: PlayerStatus = baseStatus) =>
        render(
            <ControlBar
                status={{ ...status, duration: 100 }}
                variants={[]}
                textTracks={[]}
                chapters={chapters}
                autoVariantActive
                visible
                onTogglePlay={noop}
                onSeek={noop}
                onVolume={noop}
                onToggleMute={noop}
                onSelectVariant={noop}
                onSelectTextTrack={noop}
                onSetPlaybackRate={noop}
                onTogglePictureInPicture={noop}
                onToggleFullscreen={noop}
            />
        );
    it(`renders a marker for every chapter past the bar's start`, () => {
        const { container } = renderWithChapters();
        // Chapter at 0 is skipped (redundant with the slider edge); the
        // other two appear as 1 px-wide spans positioned by percent.
        const markers = container.querySelectorAll(`span[title]`);
        const titles = Array.from(markers).map((m) => m.getAttribute(`title`));
        expect(titles).toEqual([`Act II`, `Finale`]);
        // 50/100 = 50% and 80/100 = 80%.
        expect((markers[0] as HTMLElement).style.left).toBe(`50%`);
        expect((markers[1] as HTMLElement).style.left).toBe(`80%`);
    });
    it(`hides chapter markers entirely when no duration is known`, () => {
        const { container } = render(
            <ControlBar
                status={{ ...baseStatus, duration: 0 }}
                variants={[]}
                textTracks={[]}
                chapters={chapters}
                autoVariantActive
                visible
                onTogglePlay={noop}
                onSeek={noop}
                onVolume={noop}
                onToggleMute={noop}
                onSelectVariant={noop}
                onSelectTextTrack={noop}
                onSetPlaybackRate={noop}
                onTogglePictureInPicture={noop}
                onToggleFullscreen={noop}
            />
        );
        expect(container.querySelectorAll(`span[title]`)).toHaveLength(0);
    });
});

describe(`ControlBar seek bar`, () => {
    const renderSeek = (status: PlayerStatus, onSeek = vi.fn()) =>
        render(
            <ControlBar
                status={status}
                variants={[]}
                textTracks={[]}
                autoVariantActive
                visible
                onTogglePlay={noop}
                onSeek={onSeek}
                onVolume={noop}
                onToggleMute={noop}
                onSelectVariant={noop}
                onSelectTextTrack={noop}
                onSetPlaybackRate={noop}
                onTogglePictureInPicture={noop}
                onToggleFullscreen={noop}
            />
        );

    it(`commits the seek once on release, not on every drag tick`, () => {
        const onSeek = vi.fn();
        renderSeek({ ...baseStatus, duration: 200 }, onSeek);
        // The Radix Slider's keyboard handler fires both onValueChange and
        // onValueCommit on every arrow keypress. Radix exposes role="slider"
        // on the thumb element; aria-label sits on the Root, so we identify
        // the seek slider as the first one (it precedes the volume slider).
        const seekSlider = screen.getAllByRole(`slider`)[0];
        seekSlider.focus();
        fireEvent.keyDown(seekSlider, { key: `ArrowRight`, code: `ArrowRight` });
        expect(onSeek).toHaveBeenCalledTimes(1);
        // Default slider step against a 0..1000 range commits +1 → 1/1000 of duration.
        const [committedSeconds] = onSeek.mock.calls[0];
        expect(committedSeconds).toBeGreaterThan(0);
        expect(committedSeconds).toBeLessThan(1);
    });

    it(`holds the slider at the release position while the video buffers`, () => {
        // The video sits at currentTime=10 of a 200s clip. The user
        // releases at the slider's right edge (sliderValue ≈ SLIDER_MAX),
        // committing a seek to 200s. While the video is still buffering
        // and currentTime hasn't advanced, the slider must stay at the
        // release position — not snap back to 10s.
        const onSeek = vi.fn();
        const status = { ...baseStatus, duration: 200, currentTime: 10 };
        const { rerender } = renderSeek(status, onSeek);
        const seekSlider = screen.getAllByRole(`slider`)[0];
        seekSlider.focus();
        // PageUp is bound by Radix to +10% — a much larger jump than
        // ArrowRight, useful for asserting the slider sticks well above
        // the live currentTime position (5/200 = 2.5% of the bar).
        fireEvent.keyDown(seekSlider, { key: `PageUp`, code: `PageUp` });
        expect(onSeek).toHaveBeenCalledTimes(1);
        // currentTime hasn't caught up yet: rerender with the same status.
        rerender(
            <ControlBar
                status={status}
                variants={[]}
                textTracks={[]}
                autoVariantActive
                visible
                onTogglePlay={noop}
                onSeek={onSeek}
                onVolume={noop}
                onToggleMute={noop}
                onSelectVariant={noop}
                onSelectTextTrack={noop}
                onSetPlaybackRate={noop}
                onTogglePictureInPicture={noop}
                onToggleFullscreen={noop}
            />
        );
        // Slider was at (10/200)*1000 = 50. Radix's PageUp = +10*step → 60.
        // The fix's job is to keep the thumb at 60 while currentTime is
        // still 10. Without it, the thumb would snap back to 50.
        const updatedThumb = screen.getAllByRole(`slider`)[0];
        const value = Number(updatedThumb.getAttribute(`aria-valuenow`));
        const target = onSeek.mock.calls[0][0] as number;
        const expected = (target / 200) * 1000;
        expect(Math.abs(value - expected)).toBeLessThan(2);
        // And critically, it has not snapped back to the live-currentTime
        // position of 50.
        expect(value).not.toBe(50);
    });

    it(`releases the pinned position once currentTime catches up to the seek target`, () => {
        const onSeek = vi.fn();
        const initial = { ...baseStatus, duration: 200, currentTime: 0 };
        const { rerender } = renderSeek(initial, onSeek);
        const seekSlider = screen.getAllByRole(`slider`)[0];
        seekSlider.focus();
        fireEvent.keyDown(seekSlider, { key: `PageUp`, code: `PageUp` });
        const target = onSeek.mock.calls[0][0] as number;
        // Re-render with currentTime arriving at the target (within tolerance).
        rerender(
            <ControlBar
                status={{ ...initial, currentTime: target }}
                variants={[]}
                textTracks={[]}
                autoVariantActive
                visible
                onTogglePlay={noop}
                onSeek={onSeek}
                onVolume={noop}
                onToggleMute={noop}
                onSelectVariant={noop}
                onSelectTextTrack={noop}
                onSetPlaybackRate={noop}
                onTogglePictureInPicture={noop}
                onToggleFullscreen={noop}
            />
        );
        const updatedThumb = screen.getAllByRole(`slider`)[0];
        const value = Number(updatedThumb.getAttribute(`aria-valuenow`));
        // Once the pinned override clears, the slider tracks live currentTime.
        const expected = (target / 200) * 1000;
        expect(Math.abs(value - expected)).toBeLessThan(2);
    });
});
