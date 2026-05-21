import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useMemo, type CSSProperties } from "react";

export interface CompassMarker {
    /** Bearing in degrees, 0 = North, increases clockwise. */
    readonly bearing: number;
    /** Short label shown directly on the bar. */
    readonly label: string;
    /** Optional className applied to the marker label. */
    readonly className?: string;
}

export interface CompassProps {
    /**
     * Current viewing direction (yaw), in degrees. 0 = North, 90 = East,
     * 180 = South, 270 = West. Values are normalised modulo 360 so callers
     * can feed raw yaw without worrying about wraparound.
     */
    readonly heading: number;
    /**
     * Total horizontal field of view shown on the bar, in degrees. Smaller
     * values zoom the bar in (each pixel covers fewer degrees); larger
     * values show more of the horizon at once. Default 120°.
     */
    readonly fieldOfView?: number;
    /**
     * Tick interval in degrees. Default 15°. Major ticks (multiples of 30°)
     * get a longer tick mark; every cardinal direction gets a label.
     */
    readonly tickInterval?: number;
    /**
     * Additional bearings to label on the bar (e.g. waypoints). Cardinal
     * directions (N/E/S/W) are always shown by default.
     */
    readonly markers?: readonly CompassMarker[];
    /**
     * Hide the default N/E/S/W (+ NE/SE/SW/NW) cardinal labels — useful
     * when the caller wants a bare bar driven purely by `markers`.
     */
    readonly hideCardinals?: boolean;
    /**
     * Optional readout shown below the bar (e.g. "127°  ESE"). Pass `null`
     * to hide it; default renders the integer-rounded heading.
     */
    readonly readout?: React.ReactNode | null;
    /**
     * Reduce vertical height — useful for HUD overlays where the compass
     * is a subtle indicator rather than a primary control. Shrinks the bar
     * track and ticks; the readout chip (if rendered) keeps its proportions.
     */
    readonly compact?: boolean;
    readonly className?: string;
    readonly style?: CSSProperties;
}

const CARDINALS: CompassMarker[] = [
    { bearing: 0, label: `N`, className: `font-semibold` },
    { bearing: 45, label: `NE` },
    { bearing: 90, label: `E`, className: `font-semibold` },
    { bearing: 135, label: `SE` },
    { bearing: 180, label: `S`, className: `font-semibold` },
    { bearing: 225, label: `SW` },
    { bearing: 270, label: `W`, className: `font-semibold` },
    { bearing: 315, label: `NW` }
];

const normalize = (deg: number): number => ((deg % 360) + 360) % 360;

// Signed delta in (-180, 180] so the bar always picks the short way around.
const signedDelta = (target: number, heading: number): number => {
    let d = normalize(target) - normalize(heading);
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
};

const headingToCardinal = (deg: number): string => {
    const n = normalize(deg);
    const dirs = [`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`];
    return dirs[Math.round(n / 45) % 8];
};

/**
 * Compass — HUD-style horizontal compass bar.
 *
 * Renders a scrollable strip of tick marks + bearing labels, centered on
 * the current heading. Designed to be driven by anything that exposes a
 * yaw value: the `Image360Viewer`'s `position-updated` event, a 3D
 * controller, a vehicle telemetry feed, etc.
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │   NW       N        NE       E        SE       S        SW    │
 *   │   …  |  |  |  | ▼ |  |  |  |  …                                │
 *   └──────────────────────┬──────────────┬───────────────────────────┘
 *                          │  127°  ESE  │
 *                          └──────────────┘
 *
 * The strip translates left/right as `heading` changes; the centre marker
 * stays pinned. The readout hangs from the bar as a tag-style chip with
 * the same background, so it stays legible when the compass is overlaid
 * on imagery (e.g. a 360° panorama or video).
 */
export const Compass = ({
    heading,
    fieldOfView = 120,
    tickInterval = 15,
    markers,
    hideCardinals = false,
    readout,
    compact = false,
    className,
    style
}: CompassProps) => {
    const allMarkers = useMemo<CompassMarker[]>(
        () => [
            ...(hideCardinals ? [] : CARDINALS),
            ...(markers ?? [])
        ],
        [hideCardinals, markers]
    );

    // Build the tick list once per (fov, tickInterval) pair. Only render
    // ticks within ± fov/2 of the current heading; outside that they'd be
    // clipped anyway.
    const halfFov = fieldOfView / 2;
    const ticks = useMemo(() => {
        const out: { bearing: number; major: boolean }[] = [];
        const startBearing = Math.ceil((normalize(heading) - halfFov) / tickInterval) * tickInterval;
        for (let b = startBearing; b <= normalize(heading) + halfFov; b += tickInterval) {
            out.push({ bearing: b, major: b % 30 === 0 });
        }
        return out;
    }, [heading, halfFov, tickInterval]);

    // Convert a bearing into a horizontal percentage offset inside the bar.
    // 50% = centre = current heading; 0% = left edge; 100% = right edge.
    const offsetPct = (bearing: number) => 50 + (signedDelta(bearing, heading) / fieldOfView) * 100;

    return (
        <div
            style={style}
            className={cn(`Compass flex w-full flex-col items-center`, className)}
        >
            <div
                className={cn(
                    `bg-card border-border relative w-full overflow-hidden rounded-md border`,
                    compact ? `h-6` : `h-10`
                )}
            >
                {/* Edge fades to soften ticks scrolling in/out. */}
                <div className={`from-card pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r to-transparent`} />
                <div className={`from-card pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l to-transparent`} />

                {/* Ticks */}
                {ticks.map((t) => {
                    const left = offsetPct(t.bearing);
                    if (left < 0 || left > 100) return null;
                    return (
                        <div
                            key={t.bearing}
                            className={cn(
                                `bg-muted-foreground/60 absolute top-0 w-px`,
                                compact
                                    ? t.major ? `h-2` : `h-1.5`
                                    : t.major ? `h-3` : `h-2`
                            )}
                            style={{ left: `${left}%` }}
                        />
                    );
                })}

                {/* Labels */}
                {allMarkers.map((m) => {
                    const left = offsetPct(m.bearing);
                    if (left < 0 || left > 100) return null;
                    return (
                        <div
                            key={`${m.bearing}-${m.label}`}
                            className={cn(
                                `text-foreground absolute bottom-0.5 -translate-x-1/2 text-xs leading-none`,
                                m.className
                            )}
                            style={{ left: `${left}%` }}
                        >
                            {m.label}
                        </div>
                    );
                })}

                {/* Centre marker — chevron pointing down at the current
                    bearing. Replaces the previous line+triangle indicator so
                    the active heading reads as a single, lighter glyph. */}
                <ChevronDown
                    aria-hidden
                    className={cn(
                        `text-primary absolute left-1/2 z-20 -translate-x-1/2`,
                        compact ? `top-0 size-3` : `top-0 size-4`
                    )}
                    strokeWidth={2.5}
                />
            </div>
            {readout !== null && (
                // Hangs from the centre of the bar as a tag-style chip with its
                // own background, so the heading stays readable when the
                // compass is overlaid on imagery (panoramas, video, maps).
                <div
                    className={cn(
                        `bg-card border-border text-foreground rounded-b-md border border-t-0 leading-none tabular-nums`,
                        compact ? `px-1.5 py-px text-[10px]` : `px-2 py-0.5 text-xs`
                    )}
                >
                    {readout ?? `${Math.round(normalize(heading))}°  ${headingToCardinal(heading)}`}
                </div>
            )}
        </div>
    );
};

export default Compass;
