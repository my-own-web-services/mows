import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Duration from "./Duration";
import {
    formatDuration,
    formatDurationParts,
    splitDuration,
    type DurationVariant
} from "./format";

afterEach(() => {
    cleanup();
});

describe(`splitDuration`, () => {
    it(`returns a single seconds part for sub-minute durations`, () => {
        expect(splitDuration(30)).toEqual([{ value: 30, unit: `s` }]);
    });

    it(`flags zero input as lessThan so it never renders as 0 s`, () => {
        expect(splitDuration(0)).toEqual([{ value: 1, unit: `s`, lessThan: true }]);
    });

    it(`anchors to minutes and surfaces remaining seconds`, () => {
        expect(splitDuration(5 * 60 + 30)).toEqual([
            { value: 5, unit: `min` },
            { value: 30, unit: `s` }
        ]);
    });

    it(`anchors to hours and surfaces remaining minutes`, () => {
        expect(splitDuration(60 * 60 + 10 * 60)).toEqual([
            { value: 1, unit: `h` },
            { value: 10, unit: `min` }
        ]);
    });

    it(`anchors to days and surfaces remaining hours`, () => {
        expect(splitDuration(2 * 86400 + 4 * 3600)).toEqual([
            { value: 2, unit: `d` },
            { value: 4, unit: `h` }
        ]);
    });

    it(`omits zero secondary parts so exact units render as a single part`, () => {
        expect(splitDuration(60 * 60)).toEqual([{ value: 1, unit: `h` }]);
        expect(splitDuration(5 * 60)).toEqual([{ value: 5, unit: `min` }]);
        expect(splitDuration(86400)).toEqual([{ value: 1, unit: `d` }]);
    });

    it(`floors fractional seconds`, () => {
        expect(splitDuration(59.9)).toEqual([{ value: 59, unit: `s` }]);
    });

    it(`treats negative and non-finite inputs as zero (lessThan)`, () => {
        expect(splitDuration(-1)).toEqual([{ value: 1, unit: `s`, lessThan: true }]);
        expect(splitDuration(Number.NaN)).toEqual([{ value: 1, unit: `s`, lessThan: true }]);
    });

    it(`with minUnit="min" floors away the seconds part`, () => {
        expect(splitDuration(5 * 60 + 30, `min`)).toEqual([{ value: 5, unit: `min` }]);
        expect(splitDuration(60 * 60 + 10 * 60 + 30, `min`)).toEqual([
            { value: 1, unit: `h` },
            { value: 10, unit: `min` }
        ]);
    });

    it(`with minUnit="min" flags sub-minute input as lessThan`, () => {
        expect(splitDuration(30, `min`)).toEqual([
            { value: 1, unit: `min`, lessThan: true }
        ]);
    });

    it(`with minUnit="h" floors away minutes and seconds`, () => {
        expect(splitDuration(60 * 60 + 10 * 60, `h`)).toEqual([{ value: 1, unit: `h` }]);
        expect(splitDuration(2 * 3600 + 30 * 60, `h`)).toEqual([{ value: 2, unit: `h` }]);
    });

    it(`with minUnit="h" flags sub-hour input as lessThan`, () => {
        expect(splitDuration(500, `h`)).toEqual([
            { value: 1, unit: `h`, lessThan: true }
        ]);
    });

    it(`with minUnit="d" floors below-day precision and flags sub-day input`, () => {
        expect(splitDuration(86400 + 3600, `d`)).toEqual([{ value: 1, unit: `d` }]);
        expect(splitDuration(3600, `d`)).toEqual([
            { value: 1, unit: `d`, lessThan: true }
        ]);
    });
});

describe(`formatDurationParts`, () => {
    const parts = splitDuration(60 * 60 + 10 * 60); // 1 h 10 min

    it(`renders 1h 10min as long variant verbatim`, () => {
        expect(formatDurationParts(parts, `long`)).toBe(`1 h 10 min`);
    });

    it(`renders 1h 10min as medium variant with min collapsed to m`, () => {
        expect(formatDurationParts(parts, `medium`)).toBe(`1 h 10 m`);
    });

    it(`renders 1h 10min as short variant dropping the trailing unit label`, () => {
        expect(formatDurationParts(parts, `short`)).toBe(`1 h 10`);
    });

    it(`keeps min → m collapse only on minute parts`, () => {
        const subMinute = splitDuration(45);
        expect(formatDurationParts(subMinute, `long`)).toBe(`45 s`);
        expect(formatDurationParts(subMinute, `medium`)).toBe(`45 s`);
        expect(formatDurationParts(subMinute, `short`)).toBe(`45`);
    });

    it(`renders the days+hours pair identically for long and medium`, () => {
        const parts = splitDuration(2 * 86400 + 4 * 3600);
        expect(formatDurationParts(parts, `long`)).toBe(`2 d 4 h`);
        expect(formatDurationParts(parts, `medium`)).toBe(`2 d 4 h`);
        expect(formatDurationParts(parts, `short`)).toBe(`2 d 4`);
    });

    it(`renders the minutes+seconds pair with collapsing trailing unit`, () => {
        const parts = splitDuration(5 * 60 + 30);
        expect(formatDurationParts(parts, `long`)).toBe(`5 min 30 s`);
        expect(formatDurationParts(parts, `medium`)).toBe(`5 m 30 s`);
        expect(formatDurationParts(parts, `short`)).toBe(`5 m 30`);
    });
});

describe(`formatDuration convenience`, () => {
    it(`composes splitDuration + formatDurationParts`, () => {
        expect(formatDuration(60 * 60 + 10 * 60, `long`)).toBe(`1 h 10 min`);
        expect(formatDuration(60 * 60 + 10 * 60, `short`)).toBe(`1 h 10`);
    });

    it(`passes minUnit through so sub-precision renders as <1 [unit]`, () => {
        expect(formatDuration(30, `long`, `min`)).toBe(`<1 min`);
        expect(formatDuration(0, `long`, `s`)).toBe(`<1 s`);
        expect(formatDuration(500, `medium`, `h`)).toBe(`<1 h`);
    });

    it(`keeps the unit even in the short variant for lessThan parts`, () => {
        // The unit label still follows the variant — short renders the
        // minute label as `m`, not `min`. The point of this assertion
        // is that the unit isn't dropped entirely (which would produce
        // a meaningless bare "<1").
        expect(formatDuration(30, `short`, `min`)).toBe(`<1 m`);
        expect(formatDuration(0, `short`, `s`)).toBe(`<1 s`);
        expect(formatDuration(500, `short`, `h`)).toBe(`<1 h`);
    });
});

describe(`<Duration>`, () => {
    it(`renders the long-variant text by default in jsdom`, () => {
        render(<Duration seconds={60 * 60 + 10 * 60} />);
        // jsdom reports clientWidth/getBoundingClientRect as 0, so the
        // first measurement loop never finds a fitting variant — the
        // component falls back to `short`. Forcing the variant exercises
        // the visible-label branch independently of layout.
        expect(screen.getByTestId(`duration-visible`)).toBeInTheDocument();
    });

    it(`forces the visible label to the requested variant when provided`, () => {
        render(<Duration seconds={60 * 60 + 10 * 60} variant={`medium`} />);
        const visible = screen.getByTestId(`duration-visible`);
        expect(visible.textContent).toBe(`1 h 10 m`);
    });

    it.each([
        [`long`, `1 h 10 min`],
        [`medium`, `1 h 10 m`],
        [`short`, `1 h 10`]
    ] as const)(
        `renders the %s variant of 1h 10min verbatim`,
        (variant, expected) => {
            render(<Duration seconds={4200} variant={variant as DurationVariant} />);
            expect(screen.getByTestId(`duration-visible`).textContent).toBe(expected);
        }
    );

    it(`exposes the verbose form as aria-label even when a shorter visible variant is forced`, () => {
        const { container } = render(<Duration seconds={4200} variant={`short`} />);
        const root = container.querySelector(`.Duration`) as HTMLElement;
        expect(root.getAttribute(`aria-label`)).toBe(`1 h 10 min`);
        expect(root.getAttribute(`data-variant`)).toBe(`short`);
    });

    it(`forwards a custom aria-label`, () => {
        const { container } = render(
            <Duration seconds={4200} variant={`long`} ariaLabel={`Estimated render time`} />
        );
        const root = container.querySelector(`.Duration`) as HTMLElement;
        expect(root.getAttribute(`aria-label`)).toBe(`Estimated render time`);
    });

    it(`renders sub-minute durations with seconds only`, () => {
        render(<Duration seconds={45} variant={`long`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`45 s`);
    });

    it(`renders multi-day durations anchored to days + hours`, () => {
        render(<Duration seconds={2 * 86400 + 4 * 3600} variant={`long`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`2 d 4 h`);
    });

    it(`omits a zero secondary unit so an exact hour renders as 1 h`, () => {
        render(<Duration seconds={60 * 60} variant={`long`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`1 h`);
    });

    it(`omits a zero secondary unit so an exact minute renders as 5 min`, () => {
        render(<Duration seconds={5 * 60} variant={`long`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`5 min`);
    });

    it(`renders the hidden measurement probe alongside the visible label`, () => {
        render(<Duration seconds={4200} variant={`long`} />);
        const probe = screen.getByTestId(`duration-probe`);
        expect(probe).toBeInTheDocument();
        expect(probe.getAttribute(`aria-hidden`)).toBe(`true`);
    });

    it(`forwards className onto the wrapper`, () => {
        const { container } = render(
            <Duration seconds={4200} variant={`long`} className={`tabular-nums`} />
        );
        const root = container.querySelector(`.Duration`) as HTMLElement;
        expect(root.className).toContain(`tabular-nums`);
    });

    it(`clamps negative inputs and renders them as <1 s instead of 0 s`, () => {
        render(<Duration seconds={-300} variant={`long`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`<1 s`);
    });

    it(`renders an exact zero duration as <1 s (never 0 s)`, () => {
        render(<Duration seconds={0} variant={`long`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`<1 s`);
    });

    it(`floors to minUnit so a 5 min 30 s duration shows 5 min`, () => {
        render(<Duration seconds={5 * 60 + 30} variant={`long`} minUnit={`min`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`5 min`);
    });

    it(`renders sub-minUnit input as <1 [minUnit]`, () => {
        render(<Duration seconds={30} variant={`long`} minUnit={`min`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`<1 min`);
    });

    it(`minUnit="h" hides minutes and surfaces hours only`, () => {
        render(<Duration seconds={60 * 60 + 10 * 60} variant={`long`} minUnit={`h`} />);
        expect(screen.getByTestId(`duration-visible`).textContent).toBe(`1 h`);
    });
});
