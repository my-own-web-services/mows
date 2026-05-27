import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import Lyrics from "./Lyrics";
import { findActiveLineIndex, findActiveWordIndex, parseLrc } from "./types";

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
});
