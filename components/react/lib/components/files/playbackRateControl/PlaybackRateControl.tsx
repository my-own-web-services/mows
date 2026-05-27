import { Gauge } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Slider } from "../../ui/slider";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "../../ui/tooltip";

/** Default presets used by both AudioPlayer and VideoViewer. Mirrors the
 * canonical set surfaced by YouTube / browser media controls so users
 * recognise the steps. */
export const DEFAULT_PLAYBACK_RATES: ReadonlyArray<number> = [
    0.5, 0.75, 1, 1.25, 1.5, 1.75, 2
];

/** Continuous-slider bounds. Lower bound matches the slowest Chrome will
 * honour without muting audio; upper bound matches the upper end of
 * YouTube's range. */
export const DEFAULT_RATE_MIN = 0.25;
export const DEFAULT_RATE_MAX = 3;
export const DEFAULT_RATE_STEP = 0.05;

export const clampPlaybackRate = (
    rate: number,
    min: number = DEFAULT_RATE_MIN,
    max: number = DEFAULT_RATE_MAX,
    step: number = DEFAULT_RATE_STEP
): number => {
    if (!Number.isFinite(rate)) return 1;
    return Math.min(max, Math.max(min, Math.round(rate / step) * step));
};

/** Format with up to two decimals, trimming trailing zeros so "1.00" → "1"
 * and "1.25" stays "1.25". The trim matters for the tiny corner badge that
 * overlays the gauge icon. */
export const formatPlaybackRate = (rate: number): string => {
    const fixed = rate.toFixed(2);
    return fixed.replace(/\.?0+$/, ``);
};

export interface PlaybackRateControlStrings {
    /** Label on the trigger button + popover heading. */
    readonly label: string;
}

export const DEFAULT_PLAYBACK_RATE_CONTROL_STRINGS: PlaybackRateControlStrings = {
    label: `Playback speed`
};

export interface PlaybackRateControlProps {
    /** Current playback rate (1 = real-time). */
    readonly rate: number;
    /** Called with the next rate when the user drags the slider or picks
     * a preset chip. The caller is responsible for forwarding the value
     * to the media element. */
    readonly onChange: (rate: number) => void;
    /** Optional preset chips. Defaults to {@link DEFAULT_PLAYBACK_RATES}.
     * Set to an empty array to hide the chip row entirely. */
    readonly presets?: ReadonlyArray<number>;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    /** Translations / overrides for the trigger button's aria-label. */
    readonly strings?: Partial<PlaybackRateControlStrings>;
    /** Extra classes on the trigger button. */
    readonly className?: string;
    /** Visual tone of the trigger button. Use `light` over media
     * surfaces (white-on-translucent) and `default` over neutral chrome. */
    readonly tone?: `default` | `light`;
    /** Size of the trigger button — mirrors shadcn button sizes. */
    readonly size?: `icon-xs` | `icon-sm` | `icon` | `icon-lg`;
    /** Where the popover should align relative to the trigger. */
    readonly align?: `start` | `center` | `end`;
    /** Width of the popover content. Default is wide enough to fit 7
     * preset chips on one row without wrapping. */
    readonly popoverWidth?: CSSProperties[`width`];
    /** Optional slot rendered above the slider — e.g. a "Reset" affordance
     * or a contextual hint. */
    readonly headerExtra?: ReactNode;
    /** Forwarded to PopoverContent so embedding contexts (e.g. video
     * surfaces that toggle play/pause on background clicks) can stop the
     * pointer-down from bubbling out of the popover. */
    readonly onPopoverPointerDown?: (event: React.PointerEvent) => void;
}

/**
 * Trigger button + popover with a continuous slider and preset chips for
 * picking the media playback rate. Used by `<AudioPlayer>` and
 * `<VideoViewer>` so both surfaces share the exact same UX (and any future
 * tuning lands in one place).
 *
 * Double-clicking the slider resets to the natural 1× rate; the popover
 * also exposes the canonical preset chips so a user can land on the rate
 * they want with a single click.
 */
export const PlaybackRateControl = ({
    rate,
    onChange,
    presets = DEFAULT_PLAYBACK_RATES,
    min = DEFAULT_RATE_MIN,
    max = DEFAULT_RATE_MAX,
    step = DEFAULT_RATE_STEP,
    strings,
    className,
    tone = `default`,
    size = `icon-sm`,
    align = `end`,
    popoverWidth = `22rem`,
    headerExtra,
    onPopoverPointerDown
}: PlaybackRateControlProps) => {
    const t = { ...DEFAULT_PLAYBACK_RATE_CONTROL_STRINGS, ...strings };
    const formattedRate = formatPlaybackRate(rate);

    const triggerToneClasses =
        tone === `light` ? `text-white hover:bg-white/15 hover:text-white` : undefined;

    return (
        <TooltipProvider delayDuration={400}>
            <Popover>
                <PopoverTrigger asChild>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                type={`button`}
                                aria-label={t.label}
                                size={size}
                                variant={`ghost`}
                                className={cn(`relative`, triggerToneClasses, className)}
                            >
                                <Gauge />
                                {rate !== 1 && (
                                    <span
                                        className={`absolute right-0 bottom-0 rounded bg-primary px-1 text-[9px] leading-none font-semibold text-primary-foreground`}
                                    >
                                        {formattedRate}×
                                    </span>
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t.label}</TooltipContent>
                    </Tooltip>
                </PopoverTrigger>
                <PopoverContent
                    align={align}
                    style={{ width: popoverWidth }}
                    onPointerDown={onPopoverPointerDown}
                >
                    <div className={`flex items-center justify-between gap-2`}>
                        <span className={`text-sm font-medium`}>{t.label}</span>
                        <div className={`flex items-center gap-2`}>
                            {headerExtra}
                            <span className={`text-sm tabular-nums text-muted-foreground`}>
                                {formattedRate}×
                            </span>
                        </div>
                    </div>
                    <Slider
                        aria-label={t.label}
                        value={[rate]}
                        min={min}
                        max={max}
                        step={step}
                        onValueChange={(v) => onChange(clampPlaybackRate(v[0], min, max, step))}
                        // Double-click anywhere on the slider resets to the
                        // natural 1× rate. The preset chips below document
                        // the same affordance.
                        onDoubleClick={() => onChange(1)}
                        className={`mt-3`}
                    />
                    {presets.length > 0 && (
                        <div className={`mt-3 flex flex-nowrap items-center gap-1`}>
                            {presets.map((preset) => (
                                <Button
                                    key={preset}
                                    type={`button`}
                                    size={`sm`}
                                    variant={
                                        Math.abs(rate - preset) < 0.001 ? `default` : `outline`
                                    }
                                    className={`h-7 flex-1 px-2 text-xs`}
                                    onClick={() => onChange(preset)}
                                >
                                    {preset}×
                                </Button>
                            ))}
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </TooltipProvider>
    );
};

export default PlaybackRateControl;
