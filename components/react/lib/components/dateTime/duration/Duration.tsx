import { cn } from "@/lib/utils";
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties
} from "react";
import {
    DURATION_VARIANTS,
    formatDurationParts,
    splitDuration,
    type DurationUnit,
    type DurationVariant
} from "./format";

export type { DurationVariant, DurationPart, DurationUnit } from "./format";

export interface DurationProps {
    /**
     * Length of the duration in seconds. Floored to a whole second;
     * negative and non-finite values are treated as zero and render
     * as `<1 [minUnit]`.
     */
    readonly seconds: number;
    /**
     * Force a specific verbosity instead of letting the component pick
     * the largest variant that fits the available width. Useful inside
     * fixed-width chips, tables, or print layouts where ResizeObserver
     * measurement would be wasted work.
     */
    readonly variant?: DurationVariant;
    /**
     * Coarsest precision to surface — `"s"` (default), `"min"`, `"h"`,
     * or `"d"`. Sub-`minUnit` precision is dropped entirely; the
     * component never shows a `0 [unit]` part. When the input is below
     * the requested precision (e.g. 30 s at `minUnit="min"`) the
     * visible label collapses to `<1 [unit]`.
     */
    readonly minUnit?: DurationUnit;
    /**
     * Override the screen-reader label. Defaults to the full
     * (`long`-variant) string so assistive tech always hears the
     * verbose form, even when the visible label is collapsed.
     */
    readonly ariaLabel?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

const useIsoLayoutEffect =
    typeof window === `undefined` ? useEffect : useLayoutEffect;

/**
 * Renders a duration like `1 h 10 min` and adapts the label verbosity
 * to the container's width. With no `variant` override the component
 * measures the wrapper via `ResizeObserver` and picks the most verbose
 * label that still fits — degrading `1 h 10 min` → `1 h 10 m` →
 * `1 h 10` as the surrounding column shrinks.
 *
 * The component is `inline-block` and clips overflow; let the parent
 * decide how wide it should be. For a screen reader, the `aria-label`
 * stays on the verbose form regardless of the visible variant.
 */
export const Duration = ({
    seconds,
    variant,
    minUnit = `s`,
    ariaLabel,
    className,
    style
}: DurationProps) => {
    const wrapperRef = useRef<HTMLSpanElement | null>(null);
    const probeRef = useRef<HTMLSpanElement | null>(null);
    const [autoVariant, setAutoVariant] = useState<DurationVariant>(`long`);

    const parts = useMemo(() => splitDuration(seconds, minUnit), [seconds, minUnit]);
    const strings = useMemo(
        () => ({
            long: formatDurationParts(parts, `long`),
            medium: formatDurationParts(parts, `medium`),
            short: formatDurationParts(parts, `short`)
        }),
        [parts]
    );

    const active: DurationVariant = variant ?? autoVariant;
    const visible = strings[active];

    useIsoLayoutEffect(() => {
        if (variant !== undefined) return;
        const wrapper = wrapperRef.current;
        const probe = probeRef.current;
        if (!wrapper || !probe) return;
        const parent = wrapper.parentElement;

        const pick = () => {
            // The wrapper is `inline-block + max-w-full`, so when the
            // visible text is shorter than the slot the wrapper shrinks
            // to content width — measuring it would lock the picked
            // variant at whatever we picked last time. Use the parent's
            // content-box width as the actual "available" budget so the
            // pick is recomputed against the slot, not the current text.
            let available: number;
            if (parent) {
                // `clientWidth` already excludes borders but still
                // includes padding, so subtract the resolved padding
                // to get the parent's content-box width.
                const cs = window.getComputedStyle(parent);
                const padL = parseFloat(cs.paddingLeft) || 0;
                const padR = parseFloat(cs.paddingRight) || 0;
                available = parent.clientWidth - padL - padR;
            } else {
                available = wrapper.clientWidth;
            }

            for (const candidate of DURATION_VARIANTS) {
                probe.textContent = strings[candidate];
                const required = probe.getBoundingClientRect().width;
                if (required <= available) {
                    setAutoVariant(candidate);
                    return;
                }
            }
            setAutoVariant(`short`);
        };

        pick();
        if (typeof ResizeObserver === `undefined`) return;
        const ro = new ResizeObserver(pick);
        // Observe whichever element actually drives the slot width.
        ro.observe(parent ?? wrapper);
        return () => ro.disconnect();
    }, [variant, strings.long, strings.medium, strings.short]);

    return (
        <span
            ref={wrapperRef}
            className={cn(
                // `inline-block` + `max-w-full` lets the wrapper sit
                // inline like a number while still being clamped to a
                // narrower parent slot. The parent's content-box width
                // becomes the wrapper's `clientWidth`, which is what
                // the ResizeObserver pass reads to pick the variant.
                `Duration relative inline-block max-w-full overflow-hidden whitespace-nowrap align-baseline`,
                className
            )}
            style={style}
            data-variant={active}
            aria-label={ariaLabel ?? strings.long}
        >
            <span
                ref={probeRef}
                aria-hidden={true}
                className={`pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap`}
                data-testid={`duration-probe`}
            />
            <span aria-hidden={true} data-testid={`duration-visible`}>
                {visible}
            </span>
        </span>
    );
};

export default Duration;
