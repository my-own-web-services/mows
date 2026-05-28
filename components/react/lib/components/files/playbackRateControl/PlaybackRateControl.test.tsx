import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import PlaybackRateControl, {
    clampPlaybackRate,
    formatPlaybackRate,
    DEFAULT_PLAYBACK_RATES
} from "./PlaybackRateControl";

const Harness = ({
    initial = 1,
    onRateChange
}: {
    readonly initial?: number;
    readonly onRateChange?: (rate: number) => void;
}) => {
    const [rate, setRate] = useState(initial);
    return (
        <PlaybackRateControl
            rate={rate}
            onChange={(next) => {
                setRate(next);
                onRateChange?.(next);
            }}
        />
    );
};

describe(`PlaybackRateControl`, () => {
    it(`renders a trigger button that is wired up to the popover (regression for stacked-asChild)`, () => {
        // Regression: previously the trigger nested
        // <PopoverTrigger asChild><Tooltip>…<TooltipTrigger asChild><Button/>…</TooltipTrigger></Tooltip></PopoverTrigger>
        // so PopoverTrigger's Slot tried to clone <Tooltip> (a stateful
        // wrapper) instead of the <Button>. The button rendered with no
        // popover wiring at all — click did nothing. Reproducing here by
        // asserting the trigger carries Radix's Popover-trigger props.
        render(<Harness />);
        const trigger = screen.getByRole(`button`, { name: `Playback speed` });
        expect(trigger).toHaveAttribute(`aria-haspopup`, `dialog`);
        expect(trigger).toHaveAttribute(`aria-expanded`, `false`);
    });

    it(`opens the popover with the slider + preset chips on click`, () => {
        render(<Harness />);
        const trigger = screen.getByRole(`button`, { name: `Playback speed` });
        act(() => {
            fireEvent.click(trigger);
        });
        expect(trigger).toHaveAttribute(`aria-expanded`, `true`);
        // Each canonical preset chip is rendered as a button in the popover.
        for (const preset of DEFAULT_PLAYBACK_RATES) {
            expect(
                screen.getByRole(`button`, { name: `${preset}×` })
            ).toBeInTheDocument();
        }
    });

    it(`fires onChange with the picked preset rate`, () => {
        const onChange = vi.fn();
        render(<Harness onRateChange={onChange} />);
        const trigger = screen.getByRole(`button`, { name: `Playback speed` });
        act(() => {
            fireEvent.click(trigger);
        });
        const twoX = screen.getByRole(`button`, { name: `2×` });
        act(() => {
            fireEvent.click(twoX);
        });
        expect(onChange).toHaveBeenLastCalledWith(2);
    });

    it(`shows the current rate badge once it diverges from 1×`, () => {
        render(<Harness initial={1.5} />);
        // Badge appears inside the trigger button; sanity-check the rendered text.
        const trigger = screen.getByRole(`button`, { name: `Playback speed` });
        expect(trigger.textContent).toContain(`1.5×`);
    });

    it(`does not render the badge at 1× to avoid visual clutter at the default`, () => {
        render(<Harness initial={1} />);
        const trigger = screen.getByRole(`button`, { name: `Playback speed` });
        // Trigger has only the Gauge icon when rate is 1; no "1×" badge.
        expect(trigger.textContent).not.toContain(`×`);
    });
});

describe(`clampPlaybackRate`, () => {
    it(`clamps below the min`, () => {
        expect(clampPlaybackRate(0.1)).toBeCloseTo(0.25, 2);
    });
    it(`clamps above the max`, () => {
        expect(clampPlaybackRate(10)).toBeCloseTo(3, 2);
    });
    it(`snaps to the nearest step`, () => {
        expect(clampPlaybackRate(1.234)).toBeCloseTo(1.25, 2);
    });
    it(`returns 1 for non-finite input`, () => {
        expect(clampPlaybackRate(Number.NaN)).toBe(1);
        expect(clampPlaybackRate(Number.POSITIVE_INFINITY)).toBe(1);
    });
});

describe(`formatPlaybackRate`, () => {
    it(`trims trailing zeros so 1.00 renders as "1"`, () => {
        expect(formatPlaybackRate(1)).toBe(`1`);
        expect(formatPlaybackRate(1.5)).toBe(`1.5`);
        expect(formatPlaybackRate(1.25)).toBe(`1.25`);
        // Fractional that would round to a clean form
        expect(formatPlaybackRate(0.5)).toBe(`0.5`);
    });
});
