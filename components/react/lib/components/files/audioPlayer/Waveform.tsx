import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

export interface WaveformProps {
    /** Pre-computed waveform peaks in the [0, 1] range. When omitted, a
     * deterministic procedural waveform is derived from `seed` so every
     * track has a stable, recognisable shape without server-side analysis. */
    readonly peaks?: ReadonlyArray<number>;
    /** Stable string (usually the source URL or track id) used to seed the
     * procedural waveform when `peaks` is not supplied. The same seed
     * always produces the same bars — the silhouette becomes part of the
     * track's identity. */
    readonly seed?: string;
    /** Progress in the [0, 1] range. Bars to the left of this point render
     * filled; bars to the right render dim. */
    readonly progress: number;
    /** Called with a value in [0, 1] when the user clicks or drags. */
    readonly onSeek?: (progress: number) => void;
    /** Optional override for the bar count; otherwise the waveform fills the
     * available width using `barWidth` + `barGap`. */
    readonly barCount?: number;
    readonly barWidth?: number;
    readonly barGap?: number;
    /** Accessible label, e.g. "Waveform for ‘Track title'". */
    readonly ariaLabel?: string;
    readonly className?: string;
    readonly disabled?: boolean;
}

// Deterministic hash → seed for the procedural waveform. djb2 with the xor
// variant: fast, good enough mixing for a UI shape, no external dependency.
const hashString = (s: string): number => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    }
    return h || 1;
};

// Tiny seeded PRNG so the procedural waveform stays identical across
// renders for the same seed. Mulberry32 is small and produces well-mixed
// output for our purposes.
const mulberry32 = (seed: number): (() => number) => {
    let t = seed >>> 0;
    return () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = t;
        r = Math.imul(r ^ (r >>> 15), r | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
};

// Build a waveform shape that feels like a real track: a soft attack at the
// front, a mid section with varying energy, and a tail. The shape envelope is
// modulated by per-bar noise so two adjacent bars never look identical.
const proceduralPeaks = (seed: string, count: number): number[] => {
    const rand = mulberry32(hashString(seed));
    // Two slowly drifting oscillators give the waveform a "song-like"
    // envelope (loud chorus / quieter verse) rather than uniform noise.
    const freq1 = 0.5 + rand() * 1.5;
    const freq2 = 1.5 + rand() * 2.5;
    const phase1 = rand() * Math.PI * 2;
    const phase2 = rand() * Math.PI * 2;
    const peaks: number[] = [];
    for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        // Soft fade in/out at the edges so the track "starts" and "ends"
        // visually instead of being clipped flat.
        const edgeFade = Math.sin(Math.PI * t);
        const envelope =
            0.55 +
            0.25 * Math.sin(freq1 * Math.PI * 2 * t + phase1) +
            0.15 * Math.sin(freq2 * Math.PI * 2 * t + phase2);
        const noise = 0.35 + rand() * 0.65;
        const value = Math.max(0.08, Math.min(1, envelope * edgeFade * noise));
        peaks.push(value);
    }
    return peaks;
};

export const Waveform = ({
    peaks,
    seed,
    progress,
    onSeek,
    barCount,
    barWidth = 3,
    barGap = 2,
    ariaLabel,
    className,
    disabled
}: WaveformProps) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [measuredWidth, setMeasuredWidth] = useState(0);

    useLayoutEffect(() => {
        const node = wrapRef.current;
        if (!node) return;
        const measure = () => setMeasuredWidth(node.getBoundingClientRect().width);
        measure();
        const obs = new ResizeObserver(measure);
        obs.observe(node);
        return () => obs.disconnect();
    }, []);

    // Decide how many bars to render. When `peaks` is provided we respect its
    // length; otherwise we tile bars across the measured width so the
    // procedural shape always fills the container exactly.
    const effectiveCount = useMemo(() => {
        if (peaks && peaks.length > 0) return peaks.length;
        if (barCount && barCount > 0) return barCount;
        if (measuredWidth <= 0) return 64;
        const per = barWidth + barGap;
        return Math.max(8, Math.floor(measuredWidth / per));
    }, [peaks, barCount, measuredWidth, barWidth, barGap]);

    const data = useMemo(() => {
        if (peaks && peaks.length > 0) return peaks;
        return proceduralPeaks(seed ?? `default-waveform`, effectiveCount);
    }, [peaks, seed, effectiveCount]);

    const seekFromClientX = (clientX: number): void => {
        const node = wrapRef.current;
        if (!node || disabled) return;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0) return;
        // Flexbox renders bars right-to-left when `direction: rtl`, so
        // bar 0 (and therefore "progress = 0") sits at the right edge.
        // The click ratio must be measured from the visually-leading edge
        // — the right in RTL — otherwise clicks invert. The DOM-attribute
        // fallback handles environments (jsdom in tests) where inherited
        // `dir` doesn't propagate into computed style.
        const isRtl =
            getComputedStyle(node).direction === `rtl` ||
            node.closest(`[dir="rtl"]`) !== null ||
            document.dir === `rtl`;
        const linearRatio = (clientX - rect.left) / rect.width;
        const ratio = Math.max(
            0,
            Math.min(1, isRtl ? 1 - linearRatio : linearRatio)
        );
        onSeek?.(ratio);
    };

    // Pointer-capture is guarded with `typeof === "function"` because jsdom
    // doesn't implement the Pointer Events API on HTMLElement; in real
    // browsers capture is what keeps the drag scrubbing past the wrapper
    // bounds.
    const handlePointerDown = (e: PointerEvent<HTMLDivElement>): void => {
        if (disabled || !onSeek) return;
        const target = e.currentTarget as HTMLDivElement;
        if (typeof target.setPointerCapture === `function`) {
            target.setPointerCapture(e.pointerId);
        }
        seekFromClientX(e.clientX);
    };
    const handlePointerMove = (e: PointerEvent<HTMLDivElement>): void => {
        if (disabled || !onSeek) return;
        const target = e.currentTarget as HTMLDivElement;
        if (typeof target.hasPointerCapture !== `function`) return;
        if (!target.hasPointerCapture(e.pointerId)) return;
        seekFromClientX(e.clientX);
    };
    const handlePointerUp = (e: PointerEvent<HTMLDivElement>): void => {
        const target = e.currentTarget as HTMLDivElement;
        if (typeof target.hasPointerCapture !== `function`) return;
        if (!target.hasPointerCapture(e.pointerId)) return;
        target.releasePointerCapture(e.pointerId);
    };

    const clampedProgress = Math.max(0, Math.min(1, progress));
    const playedIndex = Math.floor(clampedProgress * data.length);

    // Bars distribute proportionally across the wrapper instead of using a
    // fixed pixel width. That way explicit `peaks` arrays (which may not
    // match the count needed to exactly fill the container at a fixed bar
    // width) still cover the full clickable area — otherwise the right
    // edge of the wrapper would be empty space and clicks there would map
    // to a ratio less than 1 even though the user intends to seek to the
    // end. `barWidth` is now a visual cap; bars never grow beyond it.
    // `barCount`/`barWidth`/`barGap` only steer the procedural-waveform
    // density when no peaks are supplied (see `effectiveCount`).
    return (
        <div
            ref={wrapRef}
            role={`slider`}
            aria-label={ariaLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clampedProgress * 100)}
            aria-disabled={disabled || undefined}
            data-testid={`audio-waveform`}
            className={cn(
                `AudioWaveform group/wave relative flex h-full w-full select-none items-center`,
                onSeek && !disabled
                    ? `cursor-pointer`
                    : `cursor-default`,
                className
            )}
            style={{
                gap: `${barGap}px`
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            {data.map((v, i) => {
                const isPlayed = i < playedIndex;
                const isHead = i === playedIndex;
                return (
                    <span
                        key={i}
                        aria-hidden
                        // Each bar takes an equal share of the wrapper —
                        // `flex: 1 1 0` overrides the default `auto` basis
                        // and lets every bar stretch. `maxWidth: barWidth`
                        // caps growth so a very wide container with few
                        // bars doesn't render absurdly thick rectangles.
                        style={{
                            flex: `1 1 0`,
                            maxWidth: `${barWidth}px`,
                            height: `${Math.max(8, Math.round(v * 100))}%`
                        }}
                        className={cn(
                            `inline-block min-w-px rounded-full transition-colors`,
                            isPlayed
                                ? `bg-primary`
                                : isHead
                                  ? `bg-primary/80`
                                  : `bg-foreground/20 group-hover/wave:bg-foreground/30`,
                            disabled && `opacity-40`
                        )}
                    />
                );
            })}
        </div>
    );
};

export default Waveform;
