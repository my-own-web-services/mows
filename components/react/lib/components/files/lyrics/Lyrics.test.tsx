import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import Lyrics from "./Lyrics";
import {
    findActiveLineIndex,
    findActiveWordIndex,
    formatLrcTime,
    parseLrc
} from "./types";

// Shared helpers for the active/inactive layout-stability suite.
const sizeClasses = (el: Element): string[] =>
    Array.from(el.classList).filter((c) =>
        /^(sm:)?text-(xs|sm|base|lg|xl|2xl|3xl)$/.test(c)
    );

// Explicit safe-list of classes that may differ between the active and
// any inactive line. Anything outside this list — including padding,
// leading, size, width, height, gap — would shift the row's layout
// signature when a line becomes active, which is exactly the
// regression these tests defend against.
const ALLOWED_ACTIVE_CLASSES = new Set([
    `text-foreground`,
    `text-muted-foreground`,
    `text-primary`,
    `text-accent-foreground`,
    `font-semibold`,
    `font-bold`,
    `font-medium`,
    `font-normal`,
    `cursor-pointer`
]);
const ALLOWED_ACTIVE_PREFIX_REGEX = /^(opacity-|hover:|focus-visible:)/;
// Patterns explicitly forbidden as deltas. A new class added under one
// of these prefixes can grow or shrink the row.
const LAYOUT_SHIFTING_PATTERNS: ReadonlyArray<RegExp> = [
    /^(sm:)?text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/,
    /^leading-/,
    /^px-/,
    /^py-/,
    /^p-/,
    /^space-/,
    /^h-/,
    /^min-h-/,
    /^max-h-/,
    /^w-/,
    /^min-w-/,
    /^max-w-/,
    /^gap-/
];
const isAllowedActiveDelta = (cls: string): boolean => {
    if (LAYOUT_SHIFTING_PATTERNS.some((p) => p.test(cls))) return false;
    if (ALLOWED_ACTIVE_CLASSES.has(cls)) return true;
    return ALLOWED_ACTIVE_PREFIX_REGEX.test(cls);
};

beforeAll(() => {
    // jsdom doesn't implement scrollTo; stub it so the auto-scroll path
    // doesn't throw during render.
    Object.defineProperty(HTMLElement.prototype, `scrollTo`, {
        configurable: true,
        value: vi.fn()
    });
});

const SAMPLE_LRC = `[ti:Imagine]
[ar:John Lennon]
[al:Imagine]
[00:00.00]Imagine there's no heaven
[00:05.50]It's easy if you try
[00:10.20]No hell below us
[00:15.10]Above us only sky
[00:20.30]Imagine all the people
[00:25.40]Living for today`;

const SAMPLE_LRC_ENHANCED = `[00:00.00]<00:00.00>Hello <00:00.50>world <00:01.20>now
[00:02.00]<00:02.00>Second <00:02.30>line`;

describe(`parseLrc`, () => {
    it(`parses metadata tags`, () => {
        const parsed = parseLrc(SAMPLE_LRC);
        expect(parsed.metadata.title).toBe(`Imagine`);
        expect(parsed.metadata.artist).toBe(`John Lennon`);
        expect(parsed.metadata.album).toBe(`Imagine`);
    });

    it(`parses timestamped lines into a sorted list`, () => {
        const parsed = parseLrc(SAMPLE_LRC);
        expect(parsed.lines).toHaveLength(6);
        expect(parsed.lines[0].time).toBe(0);
        expect(parsed.lines[0].text).toBe(`Imagine there's no heaven`);
        expect(parsed.lines[1].time).toBeCloseTo(5.5, 2);
        expect(parsed.lines[5].time).toBeCloseTo(25.4, 2);
    });

    it(`projects end-times from neighbouring start-times`, () => {
        const parsed = parseLrc(SAMPLE_LRC);
        expect(parsed.lines[0].endTime).toBeCloseTo(5.5, 2);
        expect(parsed.lines[5].endTime).toBeUndefined();
    });

    it(`expands repeated timestamps into separate lines`, () => {
        const parsed = parseLrc(`[00:01.00][00:10.00][00:20.00]Chorus`);
        expect(parsed.lines).toHaveLength(3);
        expect(parsed.lines.map((l) => l.time)).toEqual([1, 10, 20]);
        expect(parsed.lines.every((l) => l.text === `Chorus`)).toBe(true);
    });

    it(`parses enhanced LRC karaoke timings into words`, () => {
        const parsed = parseLrc(SAMPLE_LRC_ENHANCED);
        const first = parsed.lines[0];
        expect(first.words).toBeDefined();
        expect(first.words).toHaveLength(3);
        expect(first.words?.[0].text).toBe(`Hello`);
        expect(first.words?.[0].time).toBeCloseTo(0, 2);
        expect(first.words?.[1].time).toBeCloseTo(0.5, 2);
        expect(first.words?.[2].time).toBeCloseTo(1.2, 2);
        // The plain-text form strips the inline markers.
        expect(first.text).toBe(`Hello world now`);
    });

    it(`applies the [offset:ms] correction`, () => {
        const parsed = parseLrc(`[offset:500]\n[00:01.00]a\n[00:02.00]b`);
        expect(parsed.lines[0].time).toBeCloseTo(0.5, 2);
        expect(parsed.lines[1].time).toBeCloseTo(1.5, 2);
    });

    it(`ignores lines without timestamps or metadata`, () => {
        const parsed = parseLrc(`# this is a comment\n[00:01.00]kept`);
        expect(parsed.lines).toHaveLength(1);
        expect(parsed.lines[0].text).toBe(`kept`);
    });

    it(`accepts plain (un-timed) text without crashing`, () => {
        const parsed = parseLrc(`just some prose with no timestamps`);
        expect(parsed.lines).toHaveLength(0);
    });
});

describe(`findActiveLineIndex`, () => {
    const lines = parseLrc(SAMPLE_LRC).lines;

    it(`returns -1 before the first timestamp`, () => {
        expect(findActiveLineIndex(lines, -1)).toBe(-1);
    });

    it(`returns the line whose start is the largest <= time`, () => {
        expect(findActiveLineIndex(lines, 0)).toBe(0);
        expect(findActiveLineIndex(lines, 4)).toBe(0);
        expect(findActiveLineIndex(lines, 5.5)).toBe(1);
        expect(findActiveLineIndex(lines, 21)).toBe(4);
        expect(findActiveLineIndex(lines, 999)).toBe(5);
    });

    it(`handles empty input`, () => {
        expect(findActiveLineIndex([], 12)).toBe(-1);
    });
});

describe(`findActiveWordIndex`, () => {
    const enhanced = parseLrc(SAMPLE_LRC_ENHANCED).lines[0];

    it(`returns -1 when no words are timed yet`, () => {
        expect(findActiveWordIndex(enhanced, -1)).toBe(-1);
    });

    it(`tracks the active word as time progresses`, () => {
        expect(findActiveWordIndex(enhanced, 0)).toBe(0);
        expect(findActiveWordIndex(enhanced, 0.6)).toBe(1);
        expect(findActiveWordIndex(enhanced, 5)).toBe(2);
    });

    it(`returns -1 when the line has no word-level timings`, () => {
        expect(findActiveWordIndex({ time: 0, text: `x` }, 1)).toBe(-1);
    });
});

describe(`<Lyrics>`, () => {
    it(`renders the scrolling variant by default`, () => {
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} />);
        const root = screen.getByTestId(`lyrics`);
        expect(root).toHaveAttribute(`data-variant`, `scrolling`);
    });

    it(`renders the compact variant when variant="compact"`, () => {
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} variant={`compact`} />);
        const root = screen.getByTestId(`lyrics`);
        expect(root).toHaveAttribute(`data-variant`, `compact`);
    });

    it(`marks the active line with data-active=true`, () => {
        render(<Lyrics source={SAMPLE_LRC} currentTime={6} />);
        const lines = screen.getAllByTestId(`lyrics-line`);
        // currentTime=6 -> second line ("It's easy if you try") is active.
        const activeLines = lines.filter((l) => l.getAttribute(`data-active`) === `true`);
        expect(activeLines).toHaveLength(1);
        expect(activeLines[0]).toHaveTextContent(`It's easy if you try`);
        expect(activeLines[0]).toHaveAttribute(`aria-current`, `true`);
    });

    it(`updates the active line when currentTime advances`, () => {
        const { rerender } = render(<Lyrics source={SAMPLE_LRC} currentTime={0} />);
        let active = screen
            .getAllByTestId(`lyrics-line`)
            .find((l) => l.getAttribute(`data-active`) === `true`);
        expect(active).toHaveTextContent(`Imagine there's no heaven`);

        rerender(<Lyrics source={SAMPLE_LRC} currentTime={11} />);
        active = screen
            .getAllByTestId(`lyrics-line`)
            .find((l) => l.getAttribute(`data-active`) === `true`);
        expect(active).toHaveTextContent(`No hell below us`);
    });

    it(`renders all lines from the parsed source`, () => {
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} />);
        expect(screen.getAllByTestId(`lyrics-line`)).toHaveLength(6);
    });

    it(`renders metadata title + artist as a header`, () => {
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} />);
        expect(screen.getByText(`Imagine`)).toBeInTheDocument();
        expect(screen.getByText(`John Lennon`)).toBeInTheDocument();
    });

    it(`renders a custom header when provided`, () => {
        render(
            <Lyrics
                source={SAMPLE_LRC}
                currentTime={0}
                header={<p data-testid={`custom-header`}>Custom</p>}
            />
        );
        expect(screen.getByTestId(`custom-header`)).toBeInTheDocument();
    });

    it(`shows the empty state when the source has no lines`, () => {
        render(<Lyrics source={``} currentTime={0} />);
        const root = screen.getByTestId(`lyrics`);
        expect(root).toHaveAttribute(`data-state`, `empty`);
        expect(screen.getByText(`No lyrics`)).toBeInTheDocument();
    });

    it(`renders a custom empty state when provided`, () => {
        render(
            <Lyrics
                source={``}
                currentTime={0}
                emptyState={<p data-testid={`custom-empty`}>nothing</p>}
            />
        );
        expect(screen.getByTestId(`custom-empty`)).toBeInTheDocument();
    });

    it(`fires onSeek when a line is clicked`, () => {
        const onSeek = vi.fn();
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} onSeek={onSeek} />);
        const target = screen
            .getAllByTestId(`lyrics-line`)
            .find((l) => l.textContent?.includes(`No hell below us`));
        expect(target).toBeDefined();
        fireEvent.click(target!);
        expect(onSeek).toHaveBeenCalledWith(10.2);
    });

    it(`does not wire click handlers when onSeek is omitted`, () => {
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} />);
        const lines = screen.getAllByTestId(`lyrics-line`);
        // Without onSeek, lines must not advertise an interactive role.
        for (const line of lines) {
            expect(line).not.toHaveAttribute(`role`, `button`);
        }
    });

    it(`fires onSeek on Enter when focused`, () => {
        const onSeek = vi.fn();
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} onSeek={onSeek} />);
        const target = screen
            .getAllByTestId(`lyrics-line`)
            .find((l) => l.textContent?.includes(`Above us only sky`)) as HTMLElement;
        target.focus();
        fireEvent.keyDown(target, { key: `Enter` });
        expect(onSeek).toHaveBeenCalledWith(15.1);
    });

    it(`renders word-level karaoke timings`, () => {
        render(<Lyrics source={SAMPLE_LRC_ENHANCED} currentTime={0.6} />);
        const words = screen.getAllByTestId(`lyrics-word`);
        // First line has three words: Hello, world, now.
        expect(words.length).toBeGreaterThanOrEqual(3);
        // currentTime=0.6 -> second word ("world") is active.
        const active = words.find((w) => w.getAttribute(`data-active`) === `true`);
        expect(active).toHaveTextContent(`world`);
    });

    it(`accepts a pre-parsed ParsedLyrics value`, () => {
        const parsed = parseLrc(SAMPLE_LRC);
        render(<Lyrics source={parsed} currentTime={6} />);
        const lines = screen.getAllByTestId(`lyrics-line`);
        expect(lines).toHaveLength(6);
        const active = lines.find((l) => l.getAttribute(`data-active`) === `true`);
        expect(active).toHaveTextContent(`It's easy if you try`);
    });

    // Regression: in the compact variant, the active line was bumped to
    // `text-base sm:text-lg` while inactive lines stayed at `text-sm`,
    // so highlighting a line visibly resized its row and shoved the
    // following lines down. Pin the font-size classes so active +
    // inactive share the same vertical metric.
    it.each([[`scrolling`], [`compact`]] as const)(
        `keeps font-size stable between active and inactive lines (%s)`,
        (variant) => {
            render(<Lyrics source={SAMPLE_LRC} currentTime={6} variant={variant} />);
            const lines = screen.getAllByTestId(`lyrics-line`);
            const active = lines.find((l) => l.getAttribute(`data-active`) === `true`)!;
            const inactive = lines.find((l) => l.getAttribute(`data-active`) !== `true`)!;
            expect(sizeClasses(active).sort()).toEqual(sizeClasses(inactive).sort());
        }
    );

    // Defends a stricter contract: an active line never has a different
    // *layout* signature than inactive. The class delta between them is
    // restricted to an explicit safe-list (weight/colour/opacity/hover/
    // focus) and explicitly rejects anything matching a known
    // layout-shifting prefix (text-size, leading, padding, width, …) so
    // a future "make the active line bigger" change is forced to opt
    // out of these tests explicitly.
    it.each([[`scrolling`], [`compact`]] as const)(
        `active line only differs from inactive in weight/colour/opacity (%s)`,
        (variant) => {
            render(<Lyrics source={SAMPLE_LRC} currentTime={6} variant={variant} />);
            const lines = screen.getAllByTestId(`lyrics-line`);
            const active = lines.find((l) => l.getAttribute(`data-active`) === `true`)!;
            const inactive = lines.find((l) => l.getAttribute(`data-active`) !== `true`)!;
            const activeSet = new Set(active.classList);
            const inactiveSet = new Set(inactive.classList);
            const onlyOnActive = [...activeSet].filter((c) => !inactiveSet.has(c));
            const onlyOnInactive = [...inactiveSet].filter((c) => !activeSet.has(c));
            for (const cls of [...onlyOnActive, ...onlyOnInactive]) {
                expect(
                    isAllowedActiveDelta(cls),
                    `unexpected class delta between active and inactive: ${cls}`
                ).toBe(true);
            }
        }
    );

    // The line uses `transition-colors` (not `transition-all`). The
    // previous `transition-all` setting also animated layout shifts when
    // a different size class was applied, which visibly jumped the row.
    // Pin `transition-colors` so the animation can never grow back into
    // layout properties.
    it(`uses transition-colors (not transition-all) on lines`, () => {
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} />);
        const line = screen.getAllByTestId(`lyrics-line`)[0];
        expect(line).toHaveClass(`transition-colors`);
        for (const cls of line.classList) {
            expect(cls).not.toBe(`transition-all`);
        }
    });

    // Long content must wrap inside the existing row — not extend the
    // row horizontally past the container. We can't measure pixels in
    // jsdom but we can verify the structural primitives that allow
    // wrapping survive: the row is a block, the karaoke inline-flex
    // container declares `flex-wrap`, and nothing on the row pins a
    // fixed width or whitespace-nowrap.
    it(`renders a plain-text line as a block-level <li> so the browser can wrap it`, () => {
        const longLrc = `[00:00.00]${`hold steady, breathe slow, the river keeps going onward and onward `.repeat(8)}`;
        render(<Lyrics source={longLrc} currentTime={0} />);
        const line = screen.getAllByTestId(`lyrics-line`)[0];
        // <li> defaults to block display; we never set whitespace-nowrap
        // or a fixed inline width that would prevent wrap.
        expect(line.tagName).toBe(`LI`);
        for (const cls of line.classList) {
            expect(cls).not.toMatch(/^whitespace-nowrap$/);
            expect(cls).not.toMatch(/^w-\[/);
            expect(cls).not.toMatch(/^min-w-\[/);
        }
    });

    it(`wraps very long karaoke content via flex-wrap on the inline word container`, () => {
        // Long enhanced LRC line — many word markers so the line is much
        // wider than any reasonable container. The wrap primitive must
        // be present so the layout never forces horizontal overflow.
        const markers = Array.from(
            { length: 30 },
            (_, i) => `<${formatLrcTime(i * 0.4)}>word${i}`
        ).join(` `);
        const longEnhanced = `[00:00.00]${markers}`;
        render(<Lyrics source={longEnhanced} currentTime={0} />);
        const words = screen.getAllByTestId(`lyrics-word`);
        expect(words.length).toBeGreaterThanOrEqual(30);
        const wordContainer = words[0].parentElement!;
        const classes = Array.from(wordContainer.classList);
        expect(classes).toContain(`flex-wrap`);
        // No whitespace-nowrap anywhere up the chain — otherwise the
        // karaoke row would refuse to wrap.
        let walker: HTMLElement | null = wordContainer;
        while (walker && walker.getAttribute(`data-testid`) !== `lyrics`) {
            for (const cls of walker.classList) {
                expect(cls).not.toMatch(/^whitespace-nowrap$/);
            }
            walker = walker.parentElement;
        }
    });

    it(`renders consistent typography regardless of the line's text length`, () => {
        // Two lines: one trivial, one extreme. Both must end up with the
        // same set of size + leading + display classes so neither row
        // can grow disproportionately.
        const longText = `the river keeps going, onward, onward, `.repeat(20);
        const source = `[00:00.00]a\n[00:10.00]${longText}`;
        render(<Lyrics source={source} currentTime={0} />);
        const [shortLine, longLine] = screen.getAllByTestId(`lyrics-line`);
        const structural = (el: Element): string[] =>
            Array.from(el.classList)
                .filter((c) =>
                    /^(sm:)?text-(xs|sm|base|lg|xl|2xl)$|^leading-|^px-|^py-|^rounded/.test(c)
                )
                .sort();
        expect(structural(shortLine)).toEqual(structural(longLine));
    });

    it(`does not impose a fixed width on the scroll viewport`, () => {
        // Pin the scrolling container's overflow direction so a row that
        // happens to be wider than the viewport still wraps rather than
        // forcing horizontal overflow.
        render(<Lyrics source={SAMPLE_LRC} currentTime={0} />);
        const scroll = screen.getByTestId(`lyrics-scroll`);
        const classes = Array.from(scroll.classList);
        // overflow-y-auto is fine; the row should never request
        // horizontal scroll, so we explicitly forbid overflow-x-*.
        for (const cls of classes) {
            expect(cls).not.toMatch(/^overflow-x-/);
        }
    });

    it(`shows the empty state for a whitespace-only source`, () => {
        render(<Lyrics source={`   \n   \n`} currentTime={0} />);
        expect(screen.getByTestId(`lyrics`)).toHaveAttribute(`data-state`, `empty`);
    });

    it(`shows the empty state for a source with only metadata`, () => {
        // Title + artist tags but no timed lines — the component must
        // still show the empty state, since there's nothing to sync.
        render(<Lyrics source={`[ti:Only metadata]\n[ar:Nobody]`} currentTime={0} />);
        expect(screen.getByTestId(`lyrics`)).toHaveAttribute(`data-state`, `empty`);
    });

    it(`shows the empty state when given a pre-parsed value with no lines`, () => {
        render(
            <Lyrics
                source={{ lines: [], metadata: {} }}
                currentTime={0}
            />
        );
        expect(screen.getByTestId(`lyrics`)).toHaveAttribute(`data-state`, `empty`);
    });

    it(`marks the last line active when currentTime exceeds the final timestamp`, () => {
        // Integration mirror of the findActiveLineIndex(lines, 999)
        // boundary unit test. A regression in the component's active-
        // index wiring (e.g. swapping `<=` for `<`) would let the last
        // line silently fall out of "active" past its timestamp.
        render(<Lyrics source={SAMPLE_LRC} currentTime={999} />);
        const lines = screen.getAllByTestId(`lyrics-line`);
        const active = lines.find((l) => l.getAttribute(`data-active`) === `true`);
        expect(active).toHaveTextContent(`Living for today`);
    });
});

describe(`formatLrcTime`, () => {
    it(`formats whole seconds with two fractional digits and a 5-char ss`, () => {
        expect(formatLrcTime(0)).toBe(`00:00.00`);
        expect(formatLrcTime(5.5)).toBe(`00:05.50`);
        expect(formatLrcTime(63.25)).toBe(`01:03.25`);
    });

    it(`round-trips through parseLrc as a line timestamp`, () => {
        const original = 42.75;
        const parsed = parseLrc(`[${formatLrcTime(original)}]hi`);
        expect(parsed.lines).toHaveLength(1);
        expect(parsed.lines[0].time).toBeCloseTo(original, 2);
    });

    it(`clamps negatives and non-finite values to 00:00.00`, () => {
        expect(formatLrcTime(-1)).toBe(`00:00.00`);
        expect(formatLrcTime(Number.NaN)).toBe(`00:00.00`);
        expect(formatLrcTime(Number.POSITIVE_INFINITY)).toBe(`00:00.00`);
    });
});
