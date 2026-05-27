import * as React from "react";
import { cn } from "@/lib/utils";

type TimelineStatus = `default` | `success` | `warning` | `error` | `info`;

interface TimelineRange {
    /** Start of the range, in epoch milliseconds (UTC). */
    from: number;
    /** End of the range, in epoch milliseconds (UTC). */
    to: number;
}

type TimeInput = number | Date | string;

interface TimelineEvent {
    /** Stable identifier — used as React key and passed to `onEventClick`. */
    id: string;
    /**
     * Event start. Accepts an epoch ms number, a `Date`, or anything
     * `new Date(...)` accepts (ISO strings, etc.). Converted to epoch ms
     * internally.
     */
    timestamp: TimeInput;
    /**
     * Optional end. When present, the event is rendered as a range bar
     * spanning `[timestamp, endTimestamp]`. When absent, the event is a
     * point marker at `timestamp`.
     */
    endTimestamp?: TimeInput;
    /** Label that appears above the marker when there's room. */
    title?: React.ReactNode;
    /** Longer text shown in the marker's tooltip / hover affordance. */
    description?: React.ReactNode;
    /** Drives marker colour. */
    status?: TimelineStatus;
    /** Replaces the dot/bar marker with an icon (rendered in a 24×24 chip). */
    icon?: React.ReactNode;
}

interface TimelineLabels {
    resetZoom: string;
    panLeft: string;
    panRight: string;
    zoomIn: string;
    zoomOut: string;
    scrubber: string;
    leftHandle: string;
    rightHandle: string;
}

const DEFAULT_LABELS: TimelineLabels = {
    resetZoom: `Reset zoom`,
    panLeft: `Pan left`,
    panRight: `Pan right`,
    zoomIn: `Zoom in`,
    zoomOut: `Zoom out`,
    scrubber: `Timeline scrubber — drag to pan, drag the edges to zoom`,
    leftHandle: `Resize from left (zoom)`,
    rightHandle: `Resize from right (zoom)`
};

interface TimelineProps extends Omit<React.HTMLAttributes<HTMLDivElement>, `onChange`> {
    /** Earliest possible time. The scrubber spans `[from, to]`. */
    from: TimeInput;
    /** Latest possible time. The scrubber spans `[from, to]`. */
    to: TimeInput;
    /** Events to plot on the track. Order is not significant. */
    events?: ReadonlyArray<TimelineEvent>;
    /**
     * Controlled visible range. When provided, the component will not
     * update its own view range — supply `onViewRangeChange` to react to
     * pan/zoom gestures.
     */
    viewRange?: TimelineRange;
    /**
     * Initial visible range for the uncontrolled mode. Defaults to the
     * full `[from, to]` window.
     */
    defaultViewRange?: TimelineRange;
    /**
     * Fires whenever the user pans or zooms. In controlled mode this is
     * the only way to react to gestures; in uncontrolled mode it is
     * called *in addition to* the internal state update.
     */
    onViewRangeChange?: (range: TimelineRange) => void;
    /**
     * Smallest allowable view window (in ms). Caps how far a user can
     * zoom in. Defaults to `1000` (one second).
     */
    minViewRangeMs?: number;
    /**
     * Playhead timestamp — drawn as a vertical line across the track
     * and as a tick on the scrubber. When omitted, no playhead is shown.
     *
     * Combine with `onCurrentTimeChange` for video-editor-style scrubbing:
     * clicking or dragging anywhere on the track (or dragging the
     * playhead grip) moves the playhead to that timestamp.
     */
    currentTime?: TimeInput;
    /**
     * Uncontrolled seed for the playhead. Ignored when `currentTime` is
     * provided.
     */
    defaultCurrentTime?: TimeInput;
    /**
     * Fires when the user moves the playhead (track click, track drag,
     * or playhead-grip drag). Providing this enables interactive
     * scrubbing — without it, the playhead is a read-only marker.
     */
    onCurrentTimeChange?: (timestamp: number) => void;
    /** Fires when a marker is clicked. */
    onEventClick?: (event: TimelineEvent) => void;
    /**
     * Override the tick label format. Defaults to a locale-aware
     * `Intl.DateTimeFormat` that adapts to the visible range (date
     * granularity for multi-day spans, time of day for single-day,
     * seconds for narrow zooms).
     */
    formatTickLabel?: (date: Date, range: TimelineRange) => string;
    /**
     * Override the (optional) heading label rendered above the track.
     * Pass an empty node to hide it.
     */
    title?: React.ReactNode;
    /** Override the accessible labels. Merged with the defaults. */
    labels?: Partial<TimelineLabels>;
}

interface StatusTokens {
    text: string;
    bg: string;
    bgSoft: string;
    border: string;
}

const STATUS_TOKENS: Record<TimelineStatus, StatusTokens> = {
    default: {
        text: `text-foreground`,
        bg: `bg-foreground`,
        bgSoft: `bg-muted`,
        border: `border-border`
    },
    success: {
        text: `text-emerald-600 dark:text-emerald-400`,
        bg: `bg-emerald-500`,
        bgSoft: `bg-emerald-500/15`,
        border: `border-emerald-500/60`
    },
    warning: {
        text: `text-amber-600 dark:text-amber-400`,
        bg: `bg-amber-500`,
        bgSoft: `bg-amber-500/15`,
        border: `border-amber-500/60`
    },
    error: {
        text: `text-destructive`,
        bg: `bg-destructive`,
        bgSoft: `bg-destructive/15`,
        border: `border-destructive/60`
    },
    info: {
        text: `text-sky-600 dark:text-sky-400`,
        bg: `bg-sky-500`,
        bgSoft: `bg-sky-500/15`,
        border: `border-sky-500/60`
    }
};

const toMs = (value: TimeInput): number => {
    if (typeof value === `number`) return value;
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value).getTime();
    if (Number.isNaN(parsed)) {
        throw new Error(`Timeline: cannot parse timestamp "${String(value)}"`);
    }
    return parsed;
};

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const clampRange = (
    range: TimelineRange,
    full: TimelineRange,
    minSpan: number
): TimelineRange => {
    const fullSpan = full.to - full.from;
    // A min span that exceeds the full window would force the range to
    // overshoot one of its boundaries; cap it so the window remains valid.
    const effectiveMinSpan = Math.min(minSpan, fullSpan);
    const span = Math.max(
        effectiveMinSpan,
        Math.min(range.to - range.from, fullSpan)
    );
    let from = range.from;
    let to = from + span;
    if (from < full.from) {
        from = full.from;
        to = from + span;
    }
    if (to > full.to) {
        to = full.to;
        from = to - span;
    }
    return { from, to };
};

// Nice tick intervals from a second up to a year — picked so a 4–10
// tick window always lands on a human-readable boundary instead of a
// fractional millisecond stride.
const TICK_INTERVALS_MS = [
    1_000,
    5_000,
    15_000,
    30_000,
    60_000,
    5 * 60_000,
    15 * 60_000,
    30 * 60_000,
    60 * 60_000,
    3 * 60 * 60_000,
    6 * 60 * 60_000,
    12 * 60 * 60_000,
    24 * 60 * 60_000,
    7 * 24 * 60 * 60_000,
    30 * 24 * 60 * 60_000,
    90 * 24 * 60 * 60_000,
    365 * 24 * 60 * 60_000
];

const pickTickInterval = (span: number, targetCount = 6): number => {
    const ideal = span / targetCount;
    let best = TICK_INTERVALS_MS[0];
    for (const candidate of TICK_INTERVALS_MS) {
        if (candidate <= ideal) best = candidate;
    }
    return best;
};

const defaultTickFormatter = (date: Date, range: TimelineRange): string => {
    const span = range.to - range.from;
    const day = 24 * 60 * 60_000;
    if (span >= 90 * day) {
        return date.toLocaleDateString(undefined, {
            month: `short`,
            year: `numeric`
        });
    }
    if (span >= 2 * day) {
        return date.toLocaleDateString(undefined, {
            month: `short`,
            day: `2-digit`
        });
    }
    if (span >= 2 * 60 * 60_000) {
        return date.toLocaleTimeString(undefined, {
            hour: `2-digit`,
            minute: `2-digit`
        });
    }
    if (span >= 2 * 60_000) {
        return date.toLocaleTimeString(undefined, {
            hour: `2-digit`,
            minute: `2-digit`,
            second: `2-digit`
        });
    }
    return date.toLocaleTimeString(undefined, {
        minute: `2-digit`,
        second: `2-digit`
    });
};

const useElementWidth = <T extends HTMLElement>(): [
    React.RefObject<T | null>,
    number
] => {
    const ref = React.useRef<T | null>(null);
    const [width, setWidth] = React.useState(0);
    React.useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return;
        const measure = () => setWidth(node.getBoundingClientRect().width);
        measure();
        if (typeof ResizeObserver === `undefined`) return;
        const ro = new ResizeObserver(measure);
        ro.observe(node);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
};

interface PointerDragOptions {
    onMove: (deltaX: number, ev: PointerEvent) => void;
    onEnd?: (ev: PointerEvent) => void;
    cursor?: string;
}

const startPointerDrag = (
    event: React.PointerEvent,
    options: PointerDragOptions
) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    if (options.cursor) document.body.style.cursor = options.cursor;
    document.body.style.userSelect = `none`;
    const onMove = (ev: PointerEvent) => {
        options.onMove(ev.clientX - startX, ev);
    };
    const onUp = (ev: PointerEvent) => {
        window.removeEventListener(`pointermove`, onMove);
        window.removeEventListener(`pointerup`, onUp);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        options.onEnd?.(ev);
    };
    window.addEventListener(`pointermove`, onMove);
    window.addEventListener(`pointerup`, onUp);
};

interface MarkerVisualProps {
    status: TimelineStatus;
    icon?: React.ReactNode;
}

const PointMarker: React.FC<MarkerVisualProps> = ({ status, icon }) => {
    const tokens = STATUS_TOKENS[status];
    if (icon) {
        return (
            <span
                className={cn(
                    `flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition-transform group-hover:scale-110`,
                    tokens.border,
                    tokens.bgSoft,
                    tokens.text,
                    `[&_svg]:h-3 [&_svg]:w-3`
                )}
            >
                {icon}
            </span>
        );
    }
    return (
        <span
            className={cn(
                `flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 bg-background shadow-sm transition-transform group-hover:scale-125`,
                tokens.border
            )}
        >
            <span className={cn(`h-1.5 w-1.5 rounded-full`, tokens.bg)} />
        </span>
    );
};

/**
 * Premiere-Pro-style timeline. Renders a continuous horizontal time axis
 * with events plotted at their real timestamps, plus a resizable scrubber
 * underneath that lets the user pan (drag the thumb middle) and zoom
 * (drag the thumb edges).
 *
 * The full window is `[from, to]`. The visible window is the view range,
 * which can be controlled (`viewRange` + `onViewRangeChange`) or
 * uncontrolled (`defaultViewRange`, defaults to the full window).
 *
 * @example Basic — full window visible
 * ```tsx
 * <Timeline
 *     from={Date.UTC(2026, 0, 1)}
 *     to={Date.UTC(2026, 0, 2)}
 *     events={[
 *         { id: "a", timestamp: Date.UTC(2026, 0, 1, 9), title: "Build start" },
 *         { id: "b", timestamp: Date.UTC(2026, 0, 1, 10), title: "Deploy", status: "success" },
 *         { id: "c", timestamp: Date.UTC(2026, 0, 1, 14), title: "Rollout", status: "info" }
 *     ]}
 * />
 * ```
 *
 * @example Controlled zoom + range events
 * ```tsx
 * const [view, setView] = React.useState({ from: start, to: end });
 * <Timeline
 *     from={start}
 *     to={end}
 *     viewRange={view}
 *     onViewRangeChange={setView}
 *     events={[
 *         {
 *             id: "deploy",
 *             timestamp: start + 60_000,
 *             endTimestamp: start + 5 * 60_000,
 *             title: "Deployment",
 *             status: "success"
 *         }
 *     ]}
 * />
 * ```
 */
const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
    (
        {
            from,
            to,
            events = [],
            viewRange,
            defaultViewRange,
            onViewRangeChange,
            minViewRangeMs = 1_000,
            currentTime,
            defaultCurrentTime,
            onCurrentTimeChange,
            onEventClick,
            formatTickLabel,
            title,
            labels,
            className,
            ...props
        },
        ref
    ) => {
        const fullRange = React.useMemo<TimelineRange>(
            () => ({ from: toMs(from), to: toMs(to) }),
            [from, to]
        );
        if (fullRange.to <= fullRange.from) {
            throw new Error(
                `Timeline: \`to\` must be strictly after \`from\` (got from=${fullRange.from}, to=${fullRange.to})`
            );
        }

        const mergedLabels = React.useMemo(
            () => ({ ...DEFAULT_LABELS, ...labels }),
            [labels]
        );

        const [uncontrolledRange, setUncontrolledRange] =
            React.useState<TimelineRange>(() =>
                clampRange(
                    defaultViewRange ?? fullRange,
                    fullRange,
                    minViewRangeMs
                )
            );

        // Re-clamp the uncontrolled range whenever the *full* window shrinks
        // or grows underneath us — otherwise a view range from the previous
        // full window can leak through and render outside the new bounds.
        const lastFullRangeRef = React.useRef(fullRange);
        React.useEffect(() => {
            if (
                lastFullRangeRef.current.from !== fullRange.from ||
                lastFullRangeRef.current.to !== fullRange.to
            ) {
                lastFullRangeRef.current = fullRange;
                if (viewRange === undefined) {
                    setUncontrolledRange((prev) =>
                        clampRange(prev, fullRange, minViewRangeMs)
                    );
                }
            }
        }, [fullRange, minViewRangeMs, viewRange]);

        const activeRange = viewRange ?? uncontrolledRange;
        const isControlled = viewRange !== undefined;

        const commitRange = React.useCallback(
            (next: TimelineRange) => {
                const clamped = clampRange(next, fullRange, minViewRangeMs);
                if (!isControlled) setUncontrolledRange(clamped);
                onViewRangeChange?.(clamped);
            },
            [fullRange, isControlled, minViewRangeMs, onViewRangeChange]
        );

        const [trackRef, trackWidth] = useElementWidth<HTMLDivElement>();
        const [scrubberRef, scrubberWidth] = useElementWidth<HTMLDivElement>();

        const viewSpan = activeRange.to - activeRange.from;
        const fullSpan = fullRange.to - fullRange.from;
        const tickInterval = pickTickInterval(viewSpan);
        const firstTick =
            Math.ceil(activeRange.from / tickInterval) * tickInterval;
        const ticks: number[] = [];
        for (
            let t = firstTick;
            t <= activeRange.to && ticks.length < 24;
            t += tickInterval
        ) {
            ticks.push(t);
        }

        const formatter = formatTickLabel ?? defaultTickFormatter;

        const xForTime = React.useCallback(
            (timestamp: number, width: number, range: TimelineRange) => {
                if (range.to === range.from) return 0;
                return ((timestamp - range.from) / (range.to - range.from)) * width;
            },
            []
        );

        const [uncontrolledTime, setUncontrolledTime] = React.useState<
            number | null
        >(() =>
            defaultCurrentTime != null ? toMs(defaultCurrentTime) : null
        );
        const playhead =
            currentTime != null
                ? toMs(currentTime)
                : onCurrentTimeChange !== undefined || defaultCurrentTime != null
                  ? uncontrolledTime
                  : null;
        const isTimeControlled = currentTime !== undefined;
        const isInteractive = onCurrentTimeChange !== undefined;

        const commitTime = React.useCallback(
            (next: number) => {
                const clamped = clamp(next, fullRange.from, fullRange.to);
                if (!isTimeControlled) setUncontrolledTime(clamped);
                onCurrentTimeChange?.(clamped);
            },
            [fullRange.from, fullRange.to, isTimeControlled, onCurrentTimeChange]
        );

        const timeForClientX = (
            clientX: number,
            rect: DOMRect
        ): number => {
            const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
            return activeRange.from + ratio * (activeRange.to - activeRange.from);
        };

        const handleTrackPointerDown = (
            event: React.PointerEvent<HTMLDivElement>
        ) => {
            if (event.button !== 0) return;
            if (!isInteractive) return;
            const trackEl = event.currentTarget;
            const rect = trackEl.getBoundingClientRect();
            // Move playhead to the click position immediately so the
            // gesture feels like a scrub from frame one.
            commitTime(timeForClientX(event.clientX, rect));
            startPointerDrag(event, {
                cursor: `ew-resize`,
                onMove: (_deltaX, ev) => {
                    commitTime(timeForClientX(ev.clientX, rect));
                }
            });
        };

        const handlePlayheadPointerDown = (
            event: React.PointerEvent<HTMLDivElement>
        ) => {
            if (event.button !== 0) return;
            if (!isInteractive) return;
            event.stopPropagation();
            const trackEl = trackRef.current;
            if (!trackEl) return;
            const rect = trackEl.getBoundingClientRect();
            startPointerDrag(event, {
                cursor: `ew-resize`,
                onMove: (_deltaX, ev) => {
                    commitTime(timeForClientX(ev.clientX, rect));
                }
            });
        };

        const handleScrubberThumbPointerDown = (
            event: React.PointerEvent<HTMLDivElement>
        ) => {
            const startRange = activeRange;
            const widthSnapshot = scrubberWidth;
            if (widthSnapshot <= 0) return;
            startPointerDrag(event, {
                cursor: `grabbing`,
                onMove: (deltaX) => {
                    const deltaMs = (deltaX * fullSpan) / widthSnapshot;
                    commitRange({
                        from: startRange.from + deltaMs,
                        to: startRange.to + deltaMs
                    });
                }
            });
        };

        const handleResizePointerDown = (
            side: `left` | `right`
        ) => (event: React.PointerEvent<HTMLDivElement>) => {
            const startRange = activeRange;
            const widthSnapshot = scrubberWidth;
            if (widthSnapshot <= 0) return;
            startPointerDrag(event, {
                cursor: `ew-resize`,
                onMove: (deltaX) => {
                    const deltaMs = (deltaX * fullSpan) / widthSnapshot;
                    if (side === `left`) {
                        const nextFrom = Math.min(
                            startRange.to - minViewRangeMs,
                            Math.max(fullRange.from, startRange.from + deltaMs)
                        );
                        commitRange({ from: nextFrom, to: startRange.to });
                    } else {
                        const nextTo = Math.max(
                            startRange.from + minViewRangeMs,
                            Math.min(fullRange.to, startRange.to + deltaMs)
                        );
                        commitRange({ from: startRange.from, to: nextTo });
                    }
                }
            });
        };

        const handleScrubberTrackClick = (
            event: React.PointerEvent<HTMLDivElement>
        ) => {
            // Clicking outside the thumb recenters the view on the click
            // position. We deliberately skip this when the user is mid-drag
            // (which is handled by the thumb / handle pointer-down).
            if (event.target !== event.currentTarget) return;
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            const center = fullRange.from + ratio * fullSpan;
            commitRange({
                from: center - viewSpan / 2,
                to: center + viewSpan / 2
            });
        };

        const renderEvent = (event: TimelineEvent) => {
            const start = toMs(event.timestamp);
            const end = event.endTimestamp != null ? toMs(event.endTimestamp) : null;
            const status = event.status ?? `default`;
            const tokens = STATUS_TOKENS[status];

            if (end != null && end > start) {
                // Range event — render only if it intersects the view.
                if (end < activeRange.from || start > activeRange.to) return null;
                const visibleStart = Math.max(start, activeRange.from);
                const visibleEnd = Math.min(end, activeRange.to);
                const x = xForTime(visibleStart, trackWidth, activeRange);
                const width = Math.max(
                    2,
                    xForTime(visibleEnd, trackWidth, activeRange) - x
                );
                return (
                    <button
                        key={event.id}
                        type={`button`}
                        data-event-id={event.id}
                        data-status={status}
                        data-range={`true`}
                        onClick={() => onEventClick?.(event)}
                        title={
                            typeof event.title === `string`
                                ? event.title
                                : undefined
                        }
                        className={cn(
                            `group absolute top-1/2 flex h-6 -translate-y-1/2 items-center gap-1.5 overflow-hidden rounded-md border px-2 text-xs font-medium shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`,
                            tokens.border,
                            tokens.bgSoft,
                            tokens.text
                        )}
                        style={{ left: x, width }}
                    >
                        {event.icon ? (
                            <span className={`[&_svg]:h-3 [&_svg]:w-3`}>
                                {event.icon}
                            </span>
                        ) : null}
                        <span className={`truncate`}>{event.title}</span>
                    </button>
                );
            }

            if (start < activeRange.from || start > activeRange.to) return null;
            const x = xForTime(start, trackWidth, activeRange);
            return (
                <button
                    key={event.id}
                    type={`button`}
                    data-event-id={event.id}
                    data-status={status}
                    onClick={() => onEventClick?.(event)}
                    title={
                        typeof event.title === `string` ? event.title : undefined
                    }
                    className={cn(
                        `group absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm`
                    )}
                    style={{ left: x }}
                >
                    {event.title ? (
                        <span
                            className={cn(
                                `pointer-events-none max-w-[10rem] truncate rounded-sm bg-background/90 px-1.5 py-0.5 text-[10px] font-medium leading-none shadow-sm ring-1 backdrop-blur`,
                                tokens.border,
                                tokens.text
                            )}
                        >
                            {event.title}
                        </span>
                    ) : null}
                    <PointMarker status={status} icon={event.icon} />
                </button>
            );
        };

        const renderScrubberMiniEvent = (event: TimelineEvent) => {
            const start = toMs(event.timestamp);
            const end = event.endTimestamp != null ? toMs(event.endTimestamp) : null;
            const status = event.status ?? `default`;
            const tokens = STATUS_TOKENS[status];
            const x = xForTime(start, scrubberWidth, fullRange);
            if (end != null && end > start) {
                const w = Math.max(
                    1,
                    xForTime(end, scrubberWidth, fullRange) - x
                );
                return (
                    <span
                        key={event.id}
                        aria-hidden
                        className={cn(
                            `absolute top-1/2 h-1 -translate-y-1/2 rounded-full`,
                            tokens.bg
                        )}
                        style={{ left: x, width: w }}
                    />
                );
            }
            return (
                <span
                    key={event.id}
                    aria-hidden
                    className={cn(
                        `absolute top-1/2 h-1.5 w-0.5 -translate-y-1/2 rounded-full`,
                        tokens.bg
                    )}
                    style={{ left: x }}
                />
            );
        };

        const thumbLeft =
            fullSpan > 0
                ? ((activeRange.from - fullRange.from) / fullSpan) * scrubberWidth
                : 0;
        const thumbWidth =
            fullSpan > 0
                ? Math.max(16, (viewSpan / fullSpan) * scrubberWidth)
                : scrubberWidth;

        const playheadX =
            playhead != null
                ? xForTime(playhead, trackWidth, activeRange)
                : null;
        const playheadVisible =
            playhead != null &&
            playhead >= activeRange.from &&
            playhead <= activeRange.to;

        const playheadScrubberX =
            playhead != null
                ? xForTime(playhead, scrubberWidth, fullRange)
                : null;

        const isZoomed = viewSpan < fullSpan;

        const resetZoom = () => commitRange(fullRange);

        const headingId = React.useId();

        return (
            <div
                ref={ref}
                // The track is inherently directional: time flows forward
                // along the +x axis, so the whole component renders in LTR
                // even when nested inside dir="rtl". Without this, flex
                // reverses the scrubber handles' order (left ↔ right) and
                // pointer-delta math inverts. Arabic / Hebrew text inside
                // `title` still flows correctly via Unicode bidi rules.
                dir={`ltr`}
                role={`group`}
                aria-roledescription={`timeline`}
                aria-labelledby={title ? headingId : undefined}
                className={cn(
                    `flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm`,
                    className
                )}
                {...props}
            >
                {title || isZoomed ? (
                    <div className={`flex items-center justify-between gap-2`}>
                        {title ? (
                            <div
                                id={headingId}
                                className={`text-sm font-semibold text-foreground`}
                            >
                                {title}
                            </div>
                        ) : (
                            <span />
                        )}
                        {isZoomed ? (
                            <button
                                type={`button`}
                                onClick={resetZoom}
                                className={`rounded-sm px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                            >
                                {mergedLabels.resetZoom}
                            </button>
                        ) : null}
                    </div>
                ) : null}

                {/* Tick row — labels at the very edges are anchored to the
                    track edge instead of being centred over the tick, so
                    "00:00" / "19:00" never clip past the container. The 1-px
                    tick mark itself stays centred on the actual x. */}
                <div
                    aria-hidden
                    className={`relative h-5 select-none border-b border-border/60 text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}
                >
                    <div
                        className={`relative h-full`}
                        style={{ width: trackWidth || `100%` }}
                    >
                        {trackWidth > 0
                            ? ticks.map((t) => {
                                  const x = xForTime(t, trackWidth, activeRange);
                                  // Anchor labels by proximity to the edge.
                                  // The threshold is a rough half-width for
                                  // the longest expected label ("Sep 2026"
                                  // type strings at ~10px).
                                  const EDGE_THRESHOLD = 32;
                                  const labelTransform =
                                      x < EDGE_THRESHOLD
                                          ? `translateX(0)`
                                          : x > trackWidth - EDGE_THRESHOLD
                                            ? `translateX(-100%)`
                                            : `translateX(-50%)`;
                                  return (
                                      <div
                                          key={t}
                                          className={`absolute top-0 h-full`}
                                          style={{ left: x }}
                                      >
                                          <span
                                              className={`absolute top-0 whitespace-nowrap leading-none`}
                                              style={{ transform: labelTransform }}
                                          >
                                              {formatter(new Date(t), activeRange)}
                                          </span>
                                          <span
                                              className={`absolute bottom-0 left-0 h-1.5 w-px -translate-x-1/2 bg-border`}
                                          />
                                      </div>
                                  );
                              })
                            : null}
                    </div>
                </div>

                {/* Track */}
                <div
                    ref={trackRef}
                    data-slot={`track`}
                    role={`presentation`}
                    onPointerDown={handleTrackPointerDown}
                    className={cn(
                        `relative h-20 select-none overflow-hidden rounded-md border border-border/60 bg-muted/30`,
                        isInteractive ? `cursor-ew-resize` : ``
                    )}
                >
                    {/* axis line */}
                    <span
                        aria-hidden
                        className={`absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border`}
                    />
                    {trackWidth > 0
                        ? ticks.map((t) => (
                              <span
                                  key={`grid-${t}`}
                                  aria-hidden
                                  className={`absolute top-0 h-full w-px bg-border/30`}
                                  style={{
                                      left: xForTime(t, trackWidth, activeRange)
                                  }}
                              />
                          ))
                        : null}
                    {trackWidth > 0
                        ? events.map((event) => renderEvent(event))
                        : null}
                    {playheadVisible && playheadX != null ? (
                        <div
                            data-slot={`playhead`}
                            className={cn(
                                `absolute top-0 h-full w-px bg-primary`,
                                !isInteractive && `pointer-events-none`
                            )}
                            style={{ left: playheadX }}
                        >
                            {/* grip — wider hit zone for pointer drag */}
                            <div
                                role={isInteractive ? `slider` : undefined}
                                aria-orientation={`vertical`}
                                aria-valuemin={
                                    isInteractive ? fullRange.from : undefined
                                }
                                aria-valuemax={
                                    isInteractive ? fullRange.to : undefined
                                }
                                aria-valuenow={
                                    isInteractive
                                        ? Math.round(playhead ?? 0)
                                        : undefined
                                }
                                onPointerDown={
                                    isInteractive
                                        ? handlePlayheadPointerDown
                                        : undefined
                                }
                                className={cn(
                                    `absolute left-1/2 top-0 flex h-full -translate-x-1/2 flex-col items-center`,
                                    isInteractive
                                        ? `cursor-ew-resize`
                                        : `pointer-events-none`
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={`relative h-3 w-3 -translate-y-1 rounded-sm bg-primary shadow ring-2 ring-background`}
                                />
                                <span
                                    aria-hidden
                                    className={`pointer-events-none absolute inset-y-0 -left-2 w-4`}
                                />
                            </div>
                        </div>
                    ) : null}
                </div>

                {/*
                    Scrubber — styled to match the shadcn ScrollArea
                    scrollbar (see `lib/components/ui/scroll-area.tsx`):
                    a thin transparent rail with a `bg-border` rounded-full
                    thumb. The Timeline keeps two extras that a plain
                    scrollbar doesn't need: resize handles flush with the
                    thumb edges (slightly darker, so they read as grippable
                    on hover) and tiny event ticks in the rail that hint
                    where the data lives even when fully zoomed out.
                */}
                <div
                    className={`group/scrubber relative flex h-2.5 w-full touch-none select-none items-center`}
                >
                    <div
                        ref={scrubberRef}
                        data-slot={`scrubber`}
                        role={`slider`}
                        aria-label={mergedLabels.scrubber}
                        aria-valuemin={fullRange.from}
                        aria-valuemax={fullRange.to}
                        aria-valuenow={Math.round(
                            (activeRange.from + activeRange.to) / 2
                        )}
                        onPointerDown={handleScrubberTrackClick}
                        className={`relative h-full w-full cursor-pointer rounded-full bg-muted/30`}
                    >
                        {/* mini event markers — kept subtle so they don't
                             compete with the thumb visually */}
                        {scrubberWidth > 0
                            ? events.map((event) =>
                                  renderScrubberMiniEvent(event)
                              )
                            : null}
                        {playheadScrubberX != null ? (
                            <span
                                aria-hidden
                                className={`pointer-events-none absolute top-0 h-full w-px bg-primary/70`}
                                style={{ left: playheadScrubberX }}
                            />
                        ) : null}

                        {/* thumb */}
                        <div
                            data-slot={`thumb`}
                            role={`presentation`}
                            onPointerDown={handleScrubberThumbPointerDown}
                            className={`absolute inset-y-0 flex cursor-grab items-stretch rounded-full bg-border transition-colors hover:bg-foreground/40 active:cursor-grabbing`}
                            style={{ left: thumbLeft, width: thumbWidth }}
                        >
                            <div
                                data-slot={`handle-left`}
                                role={`separator`}
                                aria-orientation={`vertical`}
                                aria-label={mergedLabels.leftHandle}
                                onPointerDown={handleResizePointerDown(`left`)}
                                className={`relative w-1.5 shrink-0 cursor-ew-resize rounded-l-full bg-foreground/20 transition-colors hover:bg-foreground/50`}
                            >
                                {/* widen the hit zone past the visible rail */}
                                <span
                                    aria-hidden
                                    className={`pointer-events-auto absolute inset-y-[-3px] -left-1 w-3`}
                                />
                            </div>
                            <div className={`flex-1`} />
                            <div
                                data-slot={`handle-right`}
                                role={`separator`}
                                aria-orientation={`vertical`}
                                aria-label={mergedLabels.rightHandle}
                                onPointerDown={handleResizePointerDown(`right`)}
                                className={`relative w-1.5 shrink-0 cursor-ew-resize rounded-r-full bg-foreground/20 transition-colors hover:bg-foreground/50`}
                            >
                                <span
                                    aria-hidden
                                    className={`pointer-events-auto absolute inset-y-[-3px] -right-1 w-3`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
);
Timeline.displayName = `Timeline`;

export {
    Timeline,
    type TimelineEvent,
    type TimelineLabels,
    type TimelineProps,
    type TimelineRange,
    type TimelineStatus
};
