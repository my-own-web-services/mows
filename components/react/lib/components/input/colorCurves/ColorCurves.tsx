import { RotateCcw } from "lucide-react";
import {
    forwardRef,
    useCallback,
    useId,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    COLOR_CURVES_CHANNELS,
    DEFAULT_COLOR_CURVES_VALUE,
    type ColorCurvesChannel,
    type ColorCurvesHistogram,
    type ColorCurvesValue
} from "./applyCurves";
import {
    IDENTITY_CURVE,
    normaliseCurvePoints,
    sampleCurve,
    type ColorCurvePoint
} from "./curveMath";

export interface ColorCurvesStrings {
    readonly channelRgb: string;
    readonly channelRed: string;
    readonly channelGreen: string;
    readonly channelBlue: string;
    readonly resetChannel: string;
    readonly resetAll: string;
    readonly addPoint: string;
    readonly editorAriaLabel: string;
    readonly pointAriaLabel: (index: number, total: number) => string;
}

export const DEFAULT_COLOR_CURVES_STRINGS: ColorCurvesStrings = {
    channelRgb: `RGB`,
    channelRed: `R`,
    channelGreen: `G`,
    channelBlue: `B`,
    resetChannel: `Reset channel`,
    resetAll: `Reset all`,
    addPoint: `Add point`,
    editorAriaLabel: `Color curves editor`,
    pointAriaLabel: (index, total) => `Curve point ${index + 1} of ${total}`
};

export interface ColorCurvesProps {
    readonly value: ColorCurvesValue;
    readonly onChange: (value: ColorCurvesValue) => void;
    /**
     * Active channel. When omitted, the component owns the channel
     * selection internally and renders a 4-button channel switcher.
     */
    readonly channel?: ColorCurvesChannel;
    readonly onChannelChange?: (channel: ColorCurvesChannel) => void;
    /**
     * Optional histogram backdrop — usually computed from the source
     * image via `computeColorCurvesHistogram`.
     */
    readonly histogram?: ColorCurvesHistogram;
    readonly showHistogram?: boolean;
    /** Square edge length in pixels. */
    readonly size?: number;
    readonly disabled?: boolean;
    readonly hideResetAll?: boolean;
    readonly strings?: Partial<ColorCurvesStrings>;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly id?: string;
    readonly ariaLabel?: string;
}

interface ChannelStyle {
    readonly key: ColorCurvesChannel;
    readonly stroke: string;
    readonly point: string;
    readonly histogram: string;
    readonly histogramOpacity: number;
    readonly label: keyof ColorCurvesStrings;
}

const CHANNEL_STYLES: Record<ColorCurvesChannel, ChannelStyle> = {
    rgb: {
        key: `rgb`,
        stroke: `var(--foreground)`,
        point: `var(--foreground)`,
        histogram: `var(--foreground)`,
        histogramOpacity: 0.18,
        label: `channelRgb`
    },
    r: {
        key: `r`,
        stroke: `#ef4444`,
        point: `#ef4444`,
        histogram: `#ef4444`,
        histogramOpacity: 0.32,
        label: `channelRed`
    },
    g: {
        key: `g`,
        stroke: `#22c55e`,
        point: `#22c55e`,
        histogram: `#22c55e`,
        histogramOpacity: 0.3,
        label: `channelGreen`
    },
    b: {
        key: `b`,
        stroke: `#3b82f6`,
        point: `#3b82f6`,
        histogram: `#3b82f6`,
        histogramOpacity: 0.36,
        label: `channelBlue`
    }
};

const SAMPLES = 96;
const POINT_TOLERANCE = 0.04;
const DELETE_DRAG_DISTANCE = 0.18;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const channelPath = (
    points: ReadonlyArray<ColorCurvePoint>,
    size: number
): string => {
    let d = ``;
    for (let i = 0; i <= SAMPLES; i++) {
        const x = i / SAMPLES;
        const y = sampleCurve(points, x);
        const px = x * size;
        const py = (1 - y) * size;
        d += i === 0 ? `M ${px.toFixed(2)} ${py.toFixed(2)}` : ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
    }
    return d;
};

const histogramPath = (
    bins: ReadonlyArray<number>,
    size: number
): string => {
    let max = 1;
    for (const v of bins) if (v > max) max = v;
    // log-compress so a single huge bin (e.g. solid background)
    // doesn't flatten everything else into a baseline.
    const lmax = Math.log(1 + max);
    let d = `M 0 ${size}`;
    const n = bins.length;
    for (let i = 0; i < n; i++) {
        const v = Math.log(1 + (bins[i] ?? 0));
        const px = (i / (n - 1)) * size;
        const py = size - (v / lmax) * size;
        d += ` L ${px.toFixed(2)} ${py.toFixed(2)}`;
    }
    d += ` L ${size} ${size} Z`;
    return d;
};

const replaceChannel = (
    value: ColorCurvesValue,
    channel: ColorCurvesChannel,
    points: ReadonlyArray<ColorCurvePoint>
): ColorCurvesValue => ({
    ...value,
    [channel]: normaliseCurvePoints(points)
});

interface DragState {
    readonly pointIndex: number;
    readonly pointerId: number;
}

/**
 * `<ColorCurves>` — Lightroom/Photoshop-style tonal curve editor.
 *
 * Renders a square graphing surface (input on x, output on y) for the
 * selected channel. Click on the curve to add a point, drag points
 * to reshape, drag a non-endpoint point far outside the surface to
 * delete it. Endpoint x-coordinates are pinned but their y can be
 * dragged for black-point / white-point control.
 *
 * The component itself is purely a value editor — applying the curve
 * to actual pixels is done by feeding the resulting `ColorCurvesValue`
 * to `applyColorCurvesToImageData()` against a canvas's image data.
 */
const ColorCurves = forwardRef<HTMLDivElement, ColorCurvesProps>(
    (
        {
            value,
            onChange,
            channel,
            onChannelChange,
            histogram,
            showHistogram = true,
            size = 320,
            disabled,
            hideResetAll,
            strings,
            className,
            style,
            id,
            ariaLabel
        },
        ref
    ) => {
        const mergedStrings: ColorCurvesStrings = {
            ...DEFAULT_COLOR_CURVES_STRINGS,
            ...strings
        };
        const reactId = useId();
        const editorId = id ?? `color-curves-${reactId}`;

        const [internalChannel, setInternalChannel] =
            useState<ColorCurvesChannel>(`rgb`);
        const activeChannel = channel ?? internalChannel;
        const setActiveChannel = useCallback(
            (next: ColorCurvesChannel) => {
                if (channel === undefined) setInternalChannel(next);
                onChannelChange?.(next);
            },
            [channel, onChannelChange]
        );

        const svgRef = useRef<SVGSVGElement | null>(null);
        const dragRef = useRef<DragState | null>(null);
        const [activePointIndex, setActivePointIndex] = useState<number | null>(
            null
        );

        const activePoints = useMemo(
            () => normaliseCurvePoints(value[activeChannel]),
            [value, activeChannel]
        );

        const channelStyle = CHANNEL_STYLES[activeChannel];

        const localCoordsFromEvent = useCallback(
            (event: ReactPointerEvent<SVGElement>): { x: number; y: number } => {
                const svg = svgRef.current;
                if (!svg) return { x: 0, y: 0 };
                const rect = svg.getBoundingClientRect();
                const x = clamp01((event.clientX - rect.left) / rect.width);
                const y = clamp01(1 - (event.clientY - rect.top) / rect.height);
                return { x, y };
            },
            []
        );

        const updatePoint = useCallback(
            (pointIndex: number, x: number, y: number, deletable: boolean) => {
                const current = normaliseCurvePoints(value[activeChannel]);
                if (pointIndex < 0 || pointIndex >= current.length) return;
                const isEndpoint =
                    pointIndex === 0 || pointIndex === current.length - 1;
                // A drag that pulls a non-endpoint point well outside the
                // [0,1] surface deletes it — matches Lightroom / Curves.
                if (
                    deletable &&
                    !isEndpoint &&
                    (y < -DELETE_DRAG_DISTANCE ||
                        y > 1 + DELETE_DRAG_DISTANCE ||
                        x < -DELETE_DRAG_DISTANCE ||
                        x > 1 + DELETE_DRAG_DISTANCE)
                ) {
                    const next = current.filter((_, i) => i !== pointIndex);
                    onChange(replaceChannel(value, activeChannel, next));
                    setActivePointIndex(null);
                    dragRef.current = null;
                    return;
                }

                const cx = clamp01(x);
                const cy = clamp01(y);
                const next = current.map((p) => ({ ...p }));
                if (isEndpoint) {
                    // Endpoints stay pinned to their x position but the
                    // y is free — that's how black/white-point control
                    // works in every curves UI.
                    next[pointIndex] = { x: current[pointIndex]!.x, y: cy };
                } else {
                    const prev = current[pointIndex - 1]!;
                    const nxt = current[pointIndex + 1]!;
                    const epsilon = 0.001;
                    const minX = prev.x + epsilon;
                    const maxX = nxt.x - epsilon;
                    next[pointIndex] = {
                        x: Math.min(Math.max(cx, minX), maxX),
                        y: cy
                    };
                }
                onChange(replaceChannel(value, activeChannel, next));
            },
            [activeChannel, value, onChange]
        );

        const findPointAt = useCallback(
            (x: number, y: number): number => {
                const pts = normaliseCurvePoints(value[activeChannel]);
                let bestIdx = -1;
                let bestDist = POINT_TOLERANCE;
                for (let i = 0; i < pts.length; i++) {
                    const p = pts[i]!;
                    const dx = p.x - x;
                    const dy = p.y - y;
                    const d = Math.hypot(dx, dy);
                    if (d < bestDist) {
                        bestDist = d;
                        bestIdx = i;
                    }
                }
                return bestIdx;
            },
            [value, activeChannel]
        );

        const capturePointer = (
            target: Element,
            pointerId: number
        ): void => {
            // jsdom doesn't implement setPointerCapture, and SVG elements in
            // some older browsers lack it too — capture is a "nice to have"
            // for cross-element drags, not load-bearing for the editor.
            const fn = (
                target as Element & {
                    setPointerCapture?: (id: number) => void;
                }
            ).setPointerCapture;
            if (typeof fn === `function`) fn.call(target, pointerId);
        };

        const releasePointer = (
            target: Element,
            pointerId: number
        ): void => {
            const fn = (
                target as Element & {
                    releasePointerCapture?: (id: number) => void;
                }
            ).releasePointerCapture;
            if (typeof fn === `function`) fn.call(target, pointerId);
        };

        const handleSurfacePointerDown = (
            event: ReactPointerEvent<SVGElement>
        ) => {
            if (disabled) return;
            event.preventDefault();
            const { x, y } = localCoordsFromEvent(event);
            const existingIndex = findPointAt(x, y);
            if (existingIndex >= 0) {
                dragRef.current = {
                    pointIndex: existingIndex,
                    pointerId: event.pointerId
                };
                setActivePointIndex(existingIndex);
                capturePointer(event.currentTarget, event.pointerId);
                return;
            }
            // Add a new point on the curve at x, snapped to the existing
            // curve's y so the click feels precise.
            const pts = normaliseCurvePoints(value[activeChannel]);
            const newPoint: ColorCurvePoint = { x, y };
            const next = [...pts, newPoint];
            const normalised = normaliseCurvePoints(next);
            const insertedAt = normalised.findIndex(
                (p) =>
                    Math.abs(p.x - newPoint.x) < 1e-6 &&
                    Math.abs(p.y - newPoint.y) < 1e-6
            );
            onChange(replaceChannel(value, activeChannel, normalised));
            dragRef.current = {
                pointIndex: Math.max(0, insertedAt),
                pointerId: event.pointerId
            };
            setActivePointIndex(Math.max(0, insertedAt));
            capturePointer(event.currentTarget, event.pointerId);
        };

        const handlePointerMove = (event: ReactPointerEvent<SVGElement>) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            event.preventDefault();
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const x = (event.clientX - rect.left) / rect.width;
            const y = 1 - (event.clientY - rect.top) / rect.height;
            updatePoint(drag.pointIndex, x, y, true);
        };

        const handlePointerUp = (event: ReactPointerEvent<SVGElement>) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            releasePointer(event.currentTarget, event.pointerId);
            dragRef.current = null;
        };

        const handlePointKeyDown = (
            event: KeyboardEvent<SVGCircleElement>,
            pointIndex: number
        ) => {
            if (disabled) return;
            const pts = normaliseCurvePoints(value[activeChannel]);
            const p = pts[pointIndex];
            if (!p) return;
            const step = event.shiftKey ? 0.05 : 0.01;
            if (
                event.key === `ArrowLeft` ||
                event.key === `ArrowRight` ||
                event.key === `ArrowUp` ||
                event.key === `ArrowDown`
            ) {
                event.preventDefault();
                let nx = p.x;
                let ny = p.y;
                if (event.key === `ArrowLeft`) nx -= step;
                if (event.key === `ArrowRight`) nx += step;
                if (event.key === `ArrowUp`) ny += step;
                if (event.key === `ArrowDown`) ny -= step;
                updatePoint(pointIndex, nx, ny, false);
            } else if (
                (event.key === `Delete` || event.key === `Backspace`) &&
                pointIndex !== 0 &&
                pointIndex !== pts.length - 1
            ) {
                event.preventDefault();
                const next = pts.filter((_, i) => i !== pointIndex);
                onChange(replaceChannel(value, activeChannel, next));
                setActivePointIndex(null);
            }
        };

        const handleResetChannel = () => {
            onChange(replaceChannel(value, activeChannel, IDENTITY_CURVE));
            setActivePointIndex(null);
        };

        const handleResetAll = () => {
            onChange({ ...DEFAULT_COLOR_CURVES_VALUE });
            setActivePointIndex(null);
        };

        const histPath = useMemo(
            () =>
                showHistogram && histogram
                    ? histogramPath(histogram[activeChannel], size)
                    : ``,
            [showHistogram, histogram, activeChannel, size]
        );

        const curvePath = useMemo(
            () => channelPath(activePoints, size),
            [activePoints, size]
        );

        const gridLines = useMemo(() => {
            const lines: { x1: number; y1: number; x2: number; y2: number }[] =
                [];
            for (let i = 1; i < 4; i++) {
                const t = (i / 4) * size;
                lines.push({ x1: t, y1: 0, x2: t, y2: size });
                lines.push({ x1: 0, y1: t, x2: size, y2: t });
            }
            return lines;
        }, [size]);

        return (
            <div
                ref={ref}
                id={editorId}
                style={style}
                className={cn(
                    `inline-flex w-full max-w-md flex-col gap-3 select-none`,
                    disabled && `pointer-events-none opacity-60`,
                    className
                )}
                role="group"
                aria-label={ariaLabel ?? mergedStrings.editorAriaLabel}
            >
                <div
                    className={`flex flex-wrap items-center justify-between gap-2`}
                >
                    <div
                        className={`inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-xs`}
                        role="tablist"
                    >
                        {COLOR_CURVES_CHANNELS.map((ch) => {
                            const styleEntry = CHANNEL_STYLES[ch];
                            const label = mergedStrings[styleEntry.label];
                            const isActive = ch === activeChannel;
                            return (
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    key={ch}
                                    onClick={() => setActiveChannel(ch)}
                                    disabled={disabled}
                                    className={cn(
                                        `relative inline-flex h-7 w-9 items-center justify-center rounded-sm font-mono text-[11px] tracking-wider transition`,
                                        isActive
                                            ? `bg-background text-foreground shadow-sm`
                                            : `text-muted-foreground hover:text-foreground`
                                    )}
                                >
                                    <span
                                        className={`absolute inset-x-2 bottom-0.5 h-[2px] rounded-full`}
                                        style={{
                                            backgroundColor: styleEntry.stroke,
                                            opacity: isActive ? 1 : 0.55
                                        }}
                                        aria-hidden
                                    />
                                    <span className={`relative`}>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <div className={`flex items-center gap-1`}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleResetChannel}
                            disabled={disabled}
                            className={`h-7 gap-1 px-2 text-xs`}
                            title={mergedStrings.resetChannel}
                        >
                            <RotateCcw className={`size-3`} aria-hidden />
                            <span>{mergedStrings.resetChannel}</span>
                        </Button>
                        {!hideResetAll && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleResetAll}
                                disabled={disabled}
                                className={`h-7 px-2 text-xs text-muted-foreground hover:text-foreground`}
                            >
                                {mergedStrings.resetAll}
                            </Button>
                        )}
                    </div>
                </div>

                <div
                    className={`relative w-full overflow-hidden rounded-md border bg-card`}
                    style={{ aspectRatio: `1 / 1` }}
                >
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${size} ${size}`}
                        width={`100%`}
                        height={`100%`}
                        preserveAspectRatio={`none`}
                        onPointerDown={handleSurfacePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        className={cn(
                            `block touch-none`,
                            disabled ? `cursor-not-allowed` : `cursor-crosshair`
                        )}
                        data-testid={`color-curves-surface`}
                    >
                        <defs>
                            <linearGradient
                                id={`${editorId}-x-axis`}
                                x1="0"
                                y1="0"
                                x2="1"
                                y2="0"
                            >
                                <stop offset="0%" stopColor="black" />
                                <stop offset="100%" stopColor="white" />
                            </linearGradient>
                            <linearGradient
                                id={`${editorId}-y-axis`}
                                x1="0"
                                y1="1"
                                x2="0"
                                y2="0"
                            >
                                <stop offset="0%" stopColor="black" />
                                <stop offset="100%" stopColor="white" />
                            </linearGradient>
                        </defs>

                        {/* Axis gradient bars — left edge for output, bottom for input. */}
                        <rect
                            x="0"
                            y={size - 8}
                            width={size}
                            height="8"
                            fill={`url(#${editorId}-x-axis)`}
                            opacity="0.55"
                        />
                        <rect
                            x="0"
                            y="0"
                            width="8"
                            height={size}
                            fill={`url(#${editorId}-y-axis)`}
                            opacity="0.55"
                        />

                        {/* Quartile grid lines. */}
                        {gridLines.map((line, i) => (
                            <line
                                key={i}
                                x1={line.x1}
                                y1={line.y1}
                                x2={line.x2}
                                y2={line.y2}
                                stroke={`var(--border)`}
                                strokeWidth={`1`}
                                opacity={`0.5`}
                            />
                        ))}

                        {/* Diagonal identity reference. */}
                        <line
                            x1="0"
                            y1={size}
                            x2={size}
                            y2="0"
                            stroke={`var(--border)`}
                            strokeWidth="1"
                            strokeDasharray="3 4"
                            opacity="0.7"
                        />

                        {showHistogram && histogram && (
                            <path
                                d={histPath}
                                fill={channelStyle.histogram}
                                opacity={channelStyle.histogramOpacity}
                                pointerEvents={`none`}
                            />
                        )}

                        <path
                            d={curvePath}
                            fill="none"
                            stroke={channelStyle.stroke}
                            strokeWidth={`2`}
                            strokeLinecap={`round`}
                            strokeLinejoin={`round`}
                            pointerEvents={`none`}
                        />

                        {activePoints.map((p, i) => {
                            const cx = p.x * size;
                            const cy = (1 - p.y) * size;
                            const isActivePoint = i === activePointIndex;
                            return (
                                <g key={i}>
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={isActivePoint ? 9 : 7}
                                        fill={`transparent`}
                                        stroke={channelStyle.point}
                                        strokeOpacity={isActivePoint ? 0.35 : 0}
                                        strokeWidth={`8`}
                                        pointerEvents={`none`}
                                    />
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={isActivePoint ? 5 : 4}
                                        fill={`var(--card)`}
                                        stroke={channelStyle.point}
                                        strokeWidth={`2`}
                                        tabIndex={0}
                                        role={`slider`}
                                        aria-label={mergedStrings.pointAriaLabel(
                                            i,
                                            activePoints.length
                                        )}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={Math.round(p.y * 100)}
                                        aria-orientation={`vertical`}
                                        onFocus={() => setActivePointIndex(i)}
                                        onKeyDown={(event) =>
                                            handlePointKeyDown(event, i)
                                        }
                                        onPointerDown={(event) => {
                                            event.stopPropagation();
                                            if (disabled) return;
                                            dragRef.current = {
                                                pointIndex: i,
                                                pointerId: event.pointerId
                                            };
                                            setActivePointIndex(i);
                                            capturePointer(
                                                event.currentTarget,
                                                event.pointerId
                                            );
                                        }}
                                        className={cn(
                                            `outline-none focus-visible:ring-2 focus-visible:ring-ring`,
                                            disabled
                                                ? `cursor-not-allowed`
                                                : `cursor-grab active:cursor-grabbing`
                                        )}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    <div
                        className={`pointer-events-none absolute right-2 top-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground`}
                        aria-hidden
                    >
                        {mergedStrings[channelStyle.label]}
                    </div>
                </div>
            </div>
        );
    }
);
ColorCurves.displayName = `ColorCurves`;

export default ColorCurves;
