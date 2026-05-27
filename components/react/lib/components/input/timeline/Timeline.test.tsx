import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timeline, type TimelineEvent } from "./Timeline";

const TRACK_WIDTH_PX = 1000;
const FROM = Date.UTC(2026, 0, 1, 0, 0, 0);
const TO = Date.UTC(2026, 0, 1, 10, 0, 0); // 10 hours later
const FULL_SPAN = TO - FROM;

// Mock every element to report a deterministic width so we can compute
// expected positions exactly.
const mockRect = (width = TRACK_WIDTH_PX) =>
    vi
        .spyOn(HTMLElement.prototype, `getBoundingClientRect`)
        .mockImplementation(function (this: HTMLElement) {
            return {
                x: 0,
                y: 0,
                top: 0,
                left: 0,
                right: width,
                bottom: 60,
                width,
                height: 60,
                toJSON: () => ({})
            } as DOMRect;
        });

const sampleEvents: TimelineEvent[] = [
    { id: `a`, timestamp: FROM + 1 * 3600_000, title: `Build`, status: `info` },
    {
        id: `b`,
        timestamp: FROM + 3 * 3600_000,
        title: `Deploy`,
        status: `success`
    },
    {
        id: `c`,
        timestamp: FROM + 5 * 3600_000,
        endTimestamp: FROM + 7 * 3600_000,
        title: `Rollout`,
        status: `warning`
    },
    {
        id: `d`,
        timestamp: FROM + 9 * 3600_000,
        title: `Failure`,
        status: `error`
    }
];

const getTrack = (root: HTMLElement): HTMLElement => {
    const el = root.querySelector(`[data-slot="track"]`);
    if (!el) throw new Error(`track not found`);
    return el as HTMLElement;
};

const getScrubber = (root: HTMLElement): HTMLElement => {
    const el = root.querySelector(`[data-slot="scrubber"]`);
    if (!el) throw new Error(`scrubber not found`);
    return el as HTMLElement;
};

const getThumb = (root: HTMLElement): HTMLElement => {
    const el = root.querySelector(`[data-slot="thumb"]`);
    if (!el) throw new Error(`thumb not found`);
    return el as HTMLElement;
};

const getEvent = (root: HTMLElement, id: string): HTMLElement | null =>
    root.querySelector(`[data-event-id="${id}"]`);

const drag = (target: Element, fromX: number, toX: number) => {
    act(() => {
        target.dispatchEvent(
            new PointerEvent(`pointerdown`, {
                clientX: fromX,
                button: 0,
                bubbles: true,
                cancelable: true
            })
        );
    });
    act(() => {
        window.dispatchEvent(
            new PointerEvent(`pointermove`, {
                clientX: toX,
                bubbles: true
            })
        );
    });
    act(() => {
        window.dispatchEvent(
            new PointerEvent(`pointerup`, { clientX: toX, bubbles: true })
        );
    });
};

describe(`Timeline`, () => {
    let rectSpy: ReturnType<typeof mockRect>;

    beforeEach(() => {
        rectSpy = mockRect();
    });

    afterEach(() => {
        rectSpy.mockRestore();
    });

    it(`renders track and scrubber chrome with no events`, () => {
        const { container } = render(<Timeline from={FROM} to={TO} />);
        expect(getTrack(container)).toBeInTheDocument();
        expect(getScrubber(container)).toBeInTheDocument();
        expect(getThumb(container)).toBeInTheDocument();
    });

    it(`plots a point event at the correct x position`, () => {
        const { container } = render(
            <Timeline from={FROM} to={TO} events={sampleEvents} />
        );
        // Event 'a' is at FROM + 1h, with span = 10h -> ratio = 0.1 -> 100px
        const eventA = getEvent(container, `a`);
        expect(eventA).toBeInTheDocument();
        expect(eventA!.style.left).toBe(`100px`);
    });

    it(`plots a range event with the correct width`, () => {
        const { container } = render(
            <Timeline from={FROM} to={TO} events={sampleEvents} />
        );
        // Event 'c' spans FROM+5h to FROM+7h -> left=500, width=200
        const eventC = getEvent(container, `c`);
        expect(eventC).toBeInTheDocument();
        expect(eventC).toHaveAttribute(`data-range`, `true`);
        expect(eventC!.style.left).toBe(`500px`);
        expect(eventC!.style.width).toBe(`200px`);
    });

    it(`applies status-driven classes to markers`, () => {
        const { container } = render(
            <Timeline from={FROM} to={TO} events={sampleEvents} />
        );
        expect(getEvent(container, `a`)).toHaveAttribute(
            `data-status`,
            `info`
        );
        expect(getEvent(container, `b`)).toHaveAttribute(
            `data-status`,
            `success`
        );
        expect(getEvent(container, `c`)).toHaveAttribute(
            `data-status`,
            `warning`
        );
        expect(getEvent(container, `d`)).toHaveAttribute(
            `data-status`,
            `error`
        );
    });

    it(`fires onEventClick when a marker is clicked`, () => {
        const onClick = vi.fn();
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                events={sampleEvents}
                onEventClick={onClick}
            />
        );
        const eventA = getEvent(container, `a`);
        fireEvent.click(eventA!);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0]![0]!.id).toBe(`a`);
    });

    it(`hides events outside the current view range`, () => {
        // Zoom into [FROM, FROM+2h]. Only event 'a' should be visible.
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                events={sampleEvents}
                viewRange={{ from: FROM, to: FROM + 2 * 3600_000 }}
            />
        );
        expect(getEvent(container, `a`)).toBeInTheDocument();
        expect(getEvent(container, `b`)).not.toBeInTheDocument();
        expect(getEvent(container, `c`)).not.toBeInTheDocument();
        expect(getEvent(container, `d`)).not.toBeInTheDocument();
    });

    it(`renders the playhead at the currentTime position`, () => {
        const playhead = FROM + 5 * 3600_000; // 50% through
        const { container } = render(
            <Timeline from={FROM} to={TO} currentTime={playhead} />
        );
        const playheadEl = container.querySelector(
            `[data-slot="playhead"]`
        ) as HTMLElement | null;
        expect(playheadEl).toBeInTheDocument();
        expect(playheadEl!.style.left).toBe(`500px`);
    });

    it(`does not render a playhead when currentTime is absent`, () => {
        const { container } = render(<Timeline from={FROM} to={TO} />);
        expect(
            container.querySelector(`[data-slot="playhead"]`)
        ).not.toBeInTheDocument();
    });

    it(`scrubs the playhead when the track is clicked (interactive)`, () => {
        const onChange = vi.fn();
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                currentTime={FROM}
                onCurrentTimeChange={onChange}
            />
        );
        // Click at x=400 -> ratio 0.4 -> FROM + 0.4 * fullSpan
        act(() => {
            getTrack(container).dispatchEvent(
                new PointerEvent(`pointerdown`, {
                    clientX: 400,
                    button: 0,
                    bubbles: true,
                    cancelable: true
                })
            );
        });
        act(() => {
            window.dispatchEvent(
                new PointerEvent(`pointerup`, {
                    clientX: 400,
                    bubbles: true
                })
            );
        });
        expect(onChange).toHaveBeenCalled();
        const expected = FROM + 0.4 * FULL_SPAN;
        expect(onChange.mock.calls[0]![0]!).toBeCloseTo(expected, -1);
    });

    it(`scrubs the playhead on track drag and updates as it moves`, () => {
        const onChange = vi.fn();
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                currentTime={FROM}
                onCurrentTimeChange={onChange}
            />
        );
        drag(getTrack(container), 100, 700);
        // initial down at 100 -> ratio 0.1; final move to 700 -> ratio 0.7
        expect(onChange).toHaveBeenCalled();
        const last = onChange.mock.calls.at(-1)![0]!;
        expect(last).toBeCloseTo(FROM + 0.7 * FULL_SPAN, -1);
    });

    it(`does NOT scrub when no onCurrentTimeChange handler is provided`, () => {
        const { container } = render(
            <Timeline from={FROM} to={TO} currentTime={FROM + 3600_000} />
        );
        const before = (
            container.querySelector(
                `[data-slot="playhead"]`
            ) as HTMLElement
        ).style.left;
        act(() => {
            getTrack(container).dispatchEvent(
                new PointerEvent(`pointerdown`, {
                    clientX: 800,
                    button: 0,
                    bubbles: true,
                    cancelable: true
                })
            );
        });
        // No re-render expected because no state changed.
        const after = (
            container.querySelector(
                `[data-slot="playhead"]`
            ) as HTMLElement
        ).style.left;
        expect(after).toBe(before);
    });

    it(`updates the playhead via uncontrolled defaultCurrentTime`, () => {
        const onChange = vi.fn();
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                defaultCurrentTime={FROM}
                onCurrentTimeChange={onChange}
            />
        );
        act(() => {
            getTrack(container).dispatchEvent(
                new PointerEvent(`pointerdown`, {
                    clientX: 250,
                    button: 0,
                    bubbles: true,
                    cancelable: true
                })
            );
        });
        act(() => {
            window.dispatchEvent(
                new PointerEvent(`pointerup`, {
                    clientX: 250,
                    bubbles: true
                })
            );
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        const playheadEl = container.querySelector(
            `[data-slot="playhead"]`
        ) as HTMLElement;
        expect(playheadEl.style.left).toBe(`250px`);
    });

    it(`pans the view range when the scrubber thumb is dragged`, () => {
        const onRange = vi.fn();
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{ from: FROM, to: FROM + 2 * 3600_000 }}
                onViewRangeChange={onRange}
            />
        );
        // Thumb width = (2h / 10h) * 1000 = 200px. Drag thumb right by 300px.
        drag(getThumb(container), 100, 400);
        expect(onRange).toHaveBeenCalled();
        const last = onRange.mock.calls.at(-1)![0] as {
            from: number;
            to: number;
        };
        // ΔX=300px in a 1000px scrubber over 10h -> 3h shift
        expect(last.from - FROM).toBeCloseTo(3 * 3600_000, -2);
        expect(last.to - last.from).toBeCloseTo(2 * 3600_000, -2);
    });

    it(`zooms when the left scrubber handle is dragged inward`, () => {
        const onRange = vi.fn();
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{ from: FROM, to: TO }}
                onViewRangeChange={onRange}
            />
        );
        const leftHandle = container.querySelector(
            `[data-slot="handle-left"]`
        );
        expect(leftHandle).toBeInTheDocument();
        drag(leftHandle!, 0, 200);
        const last = onRange.mock.calls.at(-1)![0] as {
            from: number;
            to: number;
        };
        // ΔX=200px in a 1000px scrubber -> 2h shift to from
        expect(last.from - FROM).toBeCloseTo(2 * 3600_000, -2);
        expect(last.to).toBe(TO);
    });

    it(`zooms when the right scrubber handle is dragged inward`, () => {
        const onRange = vi.fn();
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{ from: FROM, to: TO }}
                onViewRangeChange={onRange}
            />
        );
        const rightHandle = container.querySelector(
            `[data-slot="handle-right"]`
        );
        expect(rightHandle).toBeInTheDocument();
        drag(rightHandle!, 1000, 700);
        const last = onRange.mock.calls.at(-1)![0] as {
            from: number;
            to: number;
        };
        // ΔX=-300px -> 3h shrink from `to`
        expect(last.from).toBe(FROM);
        expect(TO - last.to).toBeCloseTo(3 * 3600_000, -2);
    });

    it(`clamps zoom to minViewRangeMs`, () => {
        const onRange = vi.fn();
        const minSpan = 60 * 60_000; // one hour
        const { container } = render(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{ from: FROM, to: TO }}
                onViewRangeChange={onRange}
                minViewRangeMs={minSpan}
            />
        );
        // Try to drag right handle all the way left — should stop one hour in.
        drag(
            container.querySelector(`[data-slot="handle-right"]`)!,
            1000,
            0
        );
        const last = onRange.mock.calls.at(-1)![0] as {
            from: number;
            to: number;
        };
        expect(last.to - last.from).toBe(minSpan);
    });

    it(`reset-zoom button appears only when zoomed in and restores the full view`, () => {
        const onRange = vi.fn();
        // Fully zoomed out -> no button.
        const { container, rerender } = render(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{ from: FROM, to: TO }}
                onViewRangeChange={onRange}
            />
        );
        expect(
            Array.from(container.querySelectorAll(`button`)).some((b) =>
                /reset zoom/i.test(b.textContent ?? ``)
            )
        ).toBe(false);

        // Zoomed in -> button appears.
        rerender(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{ from: FROM, to: FROM + 3600_000 }}
                onViewRangeChange={onRange}
            />
        );
        const resetBtn = Array.from(
            container.querySelectorAll(`button`)
        ).find((b) => /reset zoom/i.test(b.textContent ?? ``));
        expect(resetBtn).toBeDefined();
        fireEvent.click(resetBtn!);
        const last = onRange.mock.calls.at(-1)![0] as {
            from: number;
            to: number;
        };
        expect(last.from).toBe(FROM);
        expect(last.to).toBe(TO);
    });

    it(`is fully controllable — does not mutate internal state in controlled mode`, () => {
        const onRange = vi.fn();
        const { container, rerender } = render(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{ from: FROM, to: TO }}
                onViewRangeChange={onRange}
            />
        );
        drag(getThumb(container), 100, 300);
        expect(onRange).toHaveBeenCalled();
        // Parent never updated the controlled value -> thumb stays put.
        expect(getThumb(container).style.left).toBe(`0px`);
        // Once the parent provides a new range, the thumb moves.
        rerender(
            <Timeline
                from={FROM}
                to={TO}
                viewRange={{
                    from: FROM + 3 * 3600_000,
                    to: FROM + 5 * 3600_000
                }}
                onViewRangeChange={onRange}
            />
        );
        expect(getThumb(container).style.left).toBe(`300px`);
    });

    it(`throws when "to" is not strictly after "from"`, () => {
        const spy = vi.spyOn(console, `error`).mockImplementation(() => {});
        expect(() =>
            render(<Timeline from={TO} to={FROM} />)
        ).toThrow(/strictly after/);
        spy.mockRestore();
    });

    it(`renders tick labels in the time-of-day format for sub-day spans`, () => {
        const { container } = render(<Timeline from={FROM} to={TO} />);
        // Tick row has labels — at least one should match HH:MM format.
        const text = container.textContent ?? ``;
        expect(text).toMatch(/\d{1,2}:\d{2}/);
    });

    it(`forces dir="ltr" on its root so the scrubber works inside an RTL ancestor`, () => {
        // Reproduces the bug "rtl scrollbar does not work": inside dir="rtl"
        // the thumb's flex children (left + right handles) would otherwise
        // reverse, swapping handle semantics and inverting pointer math.
        const onRange = vi.fn();
        const { container } = render(
            <div dir={`rtl`}>
                <Timeline
                    from={FROM}
                    to={TO}
                    viewRange={{ from: FROM, to: TO }}
                    onViewRangeChange={onRange}
                />
            </div>
        );
        const root = container.querySelector(
            `[aria-roledescription="timeline"]`
        ) as HTMLElement;
        expect(root.getAttribute(`dir`)).toBe(`ltr`);

        // Drag the right handle inward — should shrink `to`, not `from`.
        const handleRight = container.querySelector(
            `[data-slot="handle-right"]`
        );
        drag(handleRight!, 1000, 800);
        const last = onRange.mock.calls.at(-1)![0] as {
            from: number;
            to: number;
        };
        expect(last.from).toBe(FROM);
        expect(TO - last.to).toBeCloseTo(2 * 3600_000, -2);
    });
});
