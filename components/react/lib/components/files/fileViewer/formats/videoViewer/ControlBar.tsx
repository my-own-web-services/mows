import {
    Captions,
    CaptionsOff,
    Gauge,
    Maximize,
    Minimize,
    Pause,
    PictureInPicture2,
    Play,
    SlidersHorizontal,
    Volume1,
    Volume2,
    VolumeX
} from "lucide-react";
import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent,
    type PointerEvent
} from "react";
import { cn } from "@/lib/utils";
import { Badge } from "../../../../ui/badge";
import { Button } from "../../../../ui/button";
import SeekPreview from "./SeekPreview";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../../../../ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../ui/popover";
import { Slider } from "../../../../ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../ui/tooltip";
import { formatTimestamp } from "./keyboard";
import {
    DEFAULT_STRINGS,
    PLAYBACK_RATES,
    chapterAt,
    type Chapter,
    type PlayerStatus,
    type TextTrackOption,
    type ThumbnailFetcher,
    type ThumbnailFrame,
    type VariantOption,
    type VideoViewerStrings
} from "./types";

const AUTO_VARIANT_ID = -1;
const NO_TEXT_TRACK_ID = -1;
const ABR_LABEL = `abr`;
const SLIDER_MAX = 1000;

// Playback rate continuous range. Lower bound matches the slowest Chrome will
// honour without muting audio (0.0625 in practice, but 0.25 is the lowest
// people actually use). Upper bound matches the upper end of YouTube's range.
const RATE_MIN = 0.25;
const RATE_MAX = 3;
const RATE_STEP = 0.05;

const clampRate = (rate: number): number => {
    if (!Number.isFinite(rate)) return 1;
    return Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(rate / RATE_STEP) * RATE_STEP));
};

const formatRate = (rate: number): string => {
    // Use up to two decimals but drop trailing zeros so "1.00" → "1", "1.25"
    // stays "1.25". The trim matters for the tiny corner badge that
    // overlays the gauge icon.
    const fixed = rate.toFixed(2);
    return fixed.replace(/\.?0+$/, ``);
};

const formatBandwidth = (bandwidth: number): string => {
    if (bandwidth >= 1_000_000) return `${(bandwidth / 1_000_000).toFixed(1)} Mbps`;
    return `${Math.round(bandwidth / 1000)} kbps`;
};

interface QualityTier {
    readonly label: string;
    readonly variant: `default` | `info` | `success` | `warning`;
}

// Industry-conventional tier labels mapped to vertical resolution. We pick the
// thresholds at the standard rung heights (2160/1440/1080/720); anything
// below 720 is just "SD". The Badge variant is set to keep top tiers visually
// distinct without needing custom colour tokens.
const qualityTierFor = (height: number | null): QualityTier | null => {
    if (!height) return null;
    if (height >= 4320) return { label: `8K`, variant: `default` };
    if (height >= 2160) return { label: `4K`, variant: `default` };
    if (height >= 1440) return { label: `2K`, variant: `info` };
    if (height >= 1080) return { label: `Full HD`, variant: `info` };
    if (height >= 720) return { label: `HD`, variant: `success` };
    if (height >= 1) return { label: `SD`, variant: `warning` };
    return null;
};

const formatVariantLabel = (variant: VariantOption): string => {
    if (variant.height) return `${variant.height}p · ${formatBandwidth(variant.bandwidth)}`;
    if (variant.label && variant.label !== ABR_LABEL) return variant.label;
    return formatBandwidth(variant.bandwidth);
};

export interface ControlBarProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly status: PlayerStatus;
    readonly variants: ReadonlyArray<VariantOption>;
    readonly textTracks: ReadonlyArray<TextTrackOption>;
    /** Sorted YouTube-style chapter list. Empty / undefined hides the
     * markers and the chapter title in the seek preview tooltip. */
    readonly chapters?: ReadonlyArray<Chapter>;
    readonly autoVariantActive: boolean;
    readonly visible: boolean;
    readonly strings?: Partial<VideoViewerStrings>;
    /** Whether the source exposes any image (thumbnail) tracks. Set to false
     * to render a timestamp-only preview during hover/drag. */
    readonly hasThumbnails?: boolean;
    /** Resolves the thumbnail frame for a given time. Pre-bound to the
     * active manifest's image track; returns null when no thumbnail covers
     * the requested instant. */
    readonly getThumbnail?: ThumbnailFetcher;
    /** Captures the currently-decoded frame from the main `<video>` element.
     * Used during seek-bar drag so the floating preview tile shows the
     * exact frame the user sees in the player (which the hidden frame-
     * grabber video can't guarantee — it seeks on its own schedule). */
    readonly captureCurrentFrame?: () => Promise<ThumbnailFrame | null>;
    readonly onTogglePlay: () => void;
    readonly onSeek: (seconds: number) => void;
    readonly onVolume: (level: number) => void;
    readonly onToggleMute: () => void;
    readonly onSelectVariant: (variantId: number | null) => void;
    readonly onSelectTextTrack: (textTrackId: number | null) => void;
    readonly onSetPlaybackRate: (rate: number) => void;
    readonly onTogglePictureInPicture: () => void;
    readonly onToggleFullscreen: () => void;
    /** Bubbles pointer-down on the control surface so the parent can keep the
     * focus ring; the seek slider/dropdowns shouldn't toggle play on click. */
    readonly onSurfacePointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}

export const ControlBar = ({
    className,
    style,
    status,
    variants,
    textTracks,
    chapters,
    autoVariantActive,
    visible,
    strings,
    hasThumbnails = false,
    getThumbnail,
    captureCurrentFrame,
    onTogglePlay,
    onSeek,
    onVolume,
    onToggleMute,
    onSelectVariant,
    onSelectTextTrack,
    onSetPlaybackRate,
    onTogglePictureInPicture,
    onToggleFullscreen,
    onSurfacePointerDown
}: ControlBarProps) => {
    const t = { ...DEFAULT_STRINGS, ...strings };
    const seekMax = status.duration > 0 ? status.duration : 0;
    const seekValue = Math.min(status.currentTime, seekMax || status.currentTime);
    // While the user is actively dragging the seek bar, hold the value
    // locally instead of writing through to video.currentTime on every tick.
    // Writing through triggers seek + re-buffer + re-render, which makes the
    // thumb stutter and feel "stuck while loading". The actual seek is
    // committed once on pointer release (`onValueCommit`).
    const [seekDragValue, setSeekDragValue] = useState<number | null>(null);
    // After release we still need to keep the slider pinned to the target
    // until `status.currentTime` actually reaches it; otherwise the thumb
    // snaps back to the pre-seek position for a frame and then jumps
    // forward when buffering completes. `pendingSeekValue` survives until
    // the video confirms it landed close enough — or a watchdog timer
    // fires so we don't get permanently stuck if the seek silently fails.
    const [pendingSeekValue, setPendingSeekValue] = useState<number | null>(null);
    const isSeekDragging = seekDragValue !== null;
    const overrideValue = seekDragValue ?? pendingSeekValue;
    const isOverridden = overrideValue !== null;
    const displayedTime = isOverridden
        ? (overrideValue! / SLIDER_MAX) * (seekMax || 0)
        : seekValue;
    const sliderValue = isOverridden
        ? overrideValue!
        : seekMax > 0
          ? (seekValue / seekMax) * SLIDER_MAX
          : 0;
    const playLabel = status.playing ? t.pause : t.play;

    // Clear the post-commit override once playback has actually reached the
    // target time (≤0.6s tolerance — generous enough for keyframe rounding
    // but tight enough that the slider doesn't visibly settle "late").
    // Cap with a 5-second watchdog so a failed/aborted seek doesn't pin the
    // slider forever.
    useEffect(() => {
        if (pendingSeekValue === null || isSeekDragging) return;
        // If duration has dropped to 0 the source is being switched out —
        // the slider is about to re-render from scratch, drop the stale
        // override.
        if (seekMax === 0) {
            setPendingSeekValue(null);
            return;
        }
        const target = (pendingSeekValue / SLIDER_MAX) * seekMax;
        if (Math.abs(status.currentTime - target) < 0.6) {
            setPendingSeekValue(null);
            return;
        }
        const watchdog = setTimeout(() => setPendingSeekValue(null), 5000);
        return () => clearTimeout(watchdog);
    }, [pendingSeekValue, isSeekDragging, status.currentTime, seekMax]);
    const fullscreenLabel = status.fullscreen ? t.exitFullscreen : t.fullscreen;
    const muteLabel = status.muted || status.volume === 0 ? t.unmute : t.mute;
    const hasVariants = variants.length > 1;
    const hasTextTracks = textTracks.length > 0;
    // Sort variants high → low so the menu reads top-to-bottom from sharpest
    // to lowest. Height is the most user-meaningful axis; fall back to
    // bandwidth so non-video variants (audio-only renditions, no height)
    // still rank consistently.
    const sortedVariants = useMemo(
        () =>
            [...variants].sort((a, b) => {
                const ha = a.height ?? 0;
                const hb = b.height ?? 0;
                if (ha !== hb) return hb - ha;
                return b.bandwidth - a.bandwidth;
            }),
        [variants]
    );
    // Sort + dedupe chapters once per change. Sources sometimes hand us
    // chapters out of order (e.g. derived from a Map) — sorting here keeps
    // the marker logic and the chapter-at-time lookup simple.
    const sortedChapters = useMemo(() => {
        if (!chapters || chapters.length === 0) return [];
        return [...chapters].sort((a, b) => a.startTime - b.startTime);
    }, [chapters]);

    // Throttle live-scrub of the main <video.currentTime> to once per
    // animation frame. Without throttling, every onValueChange (typically
    // 50+ Hz) would fire a fresh HTMLMediaElement seek; the throttled
    // version keeps the player canvas visibly in sync with the cursor at
    // ~60 fps without overloading the browser's seek pipeline.
    const scrubRafRef = useRef<number | null>(null);
    const scrubPendingTimeRef = useRef<number | null>(null);
    useEffect(() => () => {
        if (scrubRafRef.current !== null) cancelAnimationFrame(scrubRafRef.current);
    }, []);

    const handleSeekChange = (value: number[]): void => {
        // UI: pin the slider to the drag position locally so the thumb
        // doesn't stutter while the new range buffers.
        setSeekDragValue(value[0]);
        // Live preview: also point the main <video> at the same time so the
        // player canvas shows the scrubbed frame as the user drags. The rAF
        // gate collapses bursts of drag ticks into one seek per frame.
        if (seekMax > 0) {
            scrubPendingTimeRef.current = (value[0] / SLIDER_MAX) * seekMax;
            if (scrubRafRef.current === null) {
                scrubRafRef.current = requestAnimationFrame(() => {
                    scrubRafRef.current = null;
                    const t = scrubPendingTimeRef.current;
                    if (t !== null) onSeek(t);
                });
            }
        }
    };
    const handleSeekCommit = (value: number[]): void => {
        // Pointer released (or keyboard adjusted) → commit the final
        // position. Throttled drag scrubs may have lagged by a frame, so
        // always re-issue here to land exactly on the released time.
        const ratio = value[0] / SLIDER_MAX;
        if (seekMax > 0) onSeek(ratio * seekMax);
        if (scrubRafRef.current !== null) {
            cancelAnimationFrame(scrubRafRef.current);
            scrubRafRef.current = null;
        }
        scrubPendingTimeRef.current = null;
        // Hand the slider position from the live drag override to the
        // pending-arrival override. The effect above clears it once
        // currentTime catches up (or a 5s watchdog fires).
        setPendingSeekValue(value[0]);
        setSeekDragValue(null);
    };

    // Seek-bar hover + preview state. We track pointer x relative to the
    // slider track so we can position a floating thumbnail/timestamp.
    // During an active drag, Radix captures pointer events on the slider
    // thumb — pointermove on this wrapper stops firing — so we derive the
    // preview x from the slider's current value instead.
    const trackRef = useRef<HTMLDivElement>(null);
    const [trackWidth, setTrackWidth] = useState(0);
    const [hoverX, setHoverX] = useState<number | null>(null);
    const [previewThumbnail, setPreviewThumbnail] = useState<ThumbnailFrame | null>(null);
    const lastThumbReqRef = useRef(0);

    const previewActive = (isSeekDragging || hoverX !== null) && seekMax > 0;
    const previewX = isSeekDragging
        ? (sliderValue / SLIDER_MAX) * trackWidth
        : hoverX ?? 0;
    const previewTime = trackWidth > 0 ? (previewX / trackWidth) * seekMax : 0;

    useLayoutEffect(() => {
        const node = trackRef.current;
        if (!node) return;
        const measure = () => setTrackWidth(node.getBoundingClientRect().width);
        measure();
        const obs = new ResizeObserver(measure);
        obs.observe(node);
        return () => obs.disconnect();
    }, []);

    // Hover preview: keyed on previewTime, uses the dedicated frame
    // grabber. Skipped during drag — the dedicated drag effect below
    // sources the tile from the main player to guarantee an exact match.
    useEffect(() => {
        if (!previewActive || isSeekDragging) {
            if (!previewActive) setPreviewThumbnail(null);
            return;
        }
        if (!getThumbnail || !hasThumbnails) return;
        const requestId = ++lastThumbReqRef.current;
        setPreviewThumbnail(null);
        void getThumbnail(previewTime).then((frame) => {
            if (requestId === lastThumbReqRef.current) setPreviewThumbnail(frame);
        });
    }, [previewActive, isSeekDragging, previewTime, getThumbnail, hasThumbnails]);

    // Drag preview: keyed on status.currentTime so we re-snapshot the main
    // <video> the moment its decoded frame lands at the new position. The
    // captured tile is therefore the same frame the user sees in the
    // player — no separate-grabber drift.
    useEffect(() => {
        if (!isSeekDragging) return;
        if (!captureCurrentFrame || !hasThumbnails) return;
        const requestId = ++lastThumbReqRef.current;
        void captureCurrentFrame().then((frame) => {
            if (requestId === lastThumbReqRef.current && frame) setPreviewThumbnail(frame);
        });
    }, [isSeekDragging, status.currentTime, captureCurrentFrame, hasThumbnails]);

    const handleTrackPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        setHoverX(x);
    };
    const handleTrackPointerLeave = (): void => {
        setHoverX(null);
    };
    // Volume goes 0 – 1.5 (150 %). Anything above 1.0 is honoured by the
    // VideoViewer through a GainNode — see VideoViewer.setVolume. The
    // slider's scale matches the volume value directly (no /SLIDER_MAX
    // scaling) so the 100 % mark sits at a known absolute position.
    // Matches VOLUME_CLAMP_MAX in VideoViewer. 400 % gives enough boost
    // to rescue genuinely quiet sources; the compressor in VideoViewer's
    // audio graph keeps clipping at bay.
    const VOLUME_SLIDER_MAX = 4;
    // Ratio of the interior track that represents the 100 % anchor. Kept
    // unitless so it can multiply a `calc()` length cleanly.
    const VOLUME_HUNDRED_PCT_RATIO = 1 / VOLUME_SLIDER_MAX;
    const [volumeHover, setVolumeHover] = useState(false);
    const effectiveVolume = status.muted ? 0 : status.volume;
    const volumeSliderValue = Math.min(VOLUME_SLIDER_MAX, effectiveVolume);
    const handleVolumeChange = (value: number[]): void => {
        onVolume(Math.max(0, Math.min(VOLUME_SLIDER_MAX, value[0])));
    };
    const handleVolumeDoubleClick = (): void => onVolume(1);
    const stopPropagation = (e: MouseEvent | PointerEvent): void => {
        e.stopPropagation();
    };

    const VolumeIcon = status.muted || status.volume === 0
        ? VolumeX
        : status.volume < 0.5
          ? Volume1
          : Volume2;

    const activeVariantId = autoVariantActive
        ? AUTO_VARIANT_ID
        : variants.find((v) => v.active)?.id ?? AUTO_VARIANT_ID;
    const activeTextTrackId = textTracks.find((tt) => tt.active && status.textTracksVisible)?.id
        ?? NO_TEXT_TRACK_ID;
    // What Shaka's ABR is currently playing. This is the same `active` flag
    // we use to show the radio-checked entry in manual mode, but we surface
    // it on the collapsed Quality button and in the menu's "Auto" row so
    // the user can see which variant Auto landed on.
    const activeVariant = variants.find((v) => v.active);
    const activeVariantTier = qualityTierFor(activeVariant?.height ?? null);
    const activeVariantShort = activeVariant?.height
        ? `${activeVariant.height}p`
        : activeVariant?.label && activeVariant.label !== ABR_LABEL
          ? activeVariant.label
          : null;

    return (
        <TooltipProvider delayDuration={400}>
            <div
                role={`toolbar`}
                aria-label={t.seek}
                onPointerDown={onSurfacePointerDown}
                onClick={stopPropagation}
                style={style}
                className={cn(
                    `VideoViewerControlBar absolute right-0 bottom-0 left-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pt-6 pb-2 text-white transition-opacity duration-200`,
                    visible ? `opacity-100` : `pointer-events-none opacity-0`,
                    className
                )}
            >
                <div
                    ref={trackRef}
                    className={`relative flex items-center gap-2`}
                    onPointerMove={handleTrackPointerMove}
                    onPointerLeave={handleTrackPointerLeave}
                >
                    {/* Chapter markers paint BEFORE the slider so the
                      * draggable thumb visually sits *above* them at its
                      * current position (DOM order = paint order with no
                      * explicit z-index). */}
                    {sortedChapters.length > 0 && seekMax > 0 && (
                        <div
                            aria-hidden
                            className={`pointer-events-none absolute inset-y-0 right-0 left-0 flex items-center`}
                        >
                            {sortedChapters.map((c, i) => {
                                // Skip the very first marker if it sits at
                                // 0s — it's redundant with the bar's edge.
                                if (i === 0 && c.startTime <= 0.001) return null;
                                if (c.startTime <= 0 || c.startTime >= seekMax) return null;
                                const pct = (c.startTime / seekMax) * 100;
                                return (
                                    <span
                                        key={c.id}
                                        title={c.title}
                                        // 3 × 14 px white pill with a soft
                                        // dark outline. Stays visible on
                                        // both bright and dark playback
                                        // content, and protrudes past the
                                        // 6 px track height so the tick
                                        // reads at a glance even on a
                                        // narrow bar.
                                        className={`absolute -translate-x-1/2 rounded-sm bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]`}
                                        style={{
                                            left: `${pct}%`,
                                            width: `3px`,
                                            height: `14px`
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                    <Slider
                        aria-label={t.seek}
                        value={[sliderValue]}
                        min={0}
                        max={SLIDER_MAX}
                        step={1}
                        onValueChange={handleSeekChange}
                        onValueCommit={handleSeekCommit}
                        className={`grow`}
                    />
                    {previewActive && (
                        <SeekPreview
                            time={previewTime}
                            thumbnail={hasThumbnails ? previewThumbnail : null}
                            hasThumbnails={hasThumbnails}
                            chapterTitle={
                                chapterAt(sortedChapters, previewTime, seekMax)?.title ?? null
                            }
                            trackX={previewX}
                            trackWidth={trackWidth}
                            strings={strings}
                        />
                    )}
                </div>

                <div className={`flex items-center gap-1`}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={`ghost`}
                                size={`icon-sm`}
                                aria-label={playLabel}
                                onClick={onTogglePlay}
                                className={`text-white hover:bg-white/15 hover:text-white`}
                            >
                                {status.playing ? <Pause /> : <Play />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{playLabel}</TooltipContent>
                    </Tooltip>

                    <div className={`group/volume flex items-center gap-1`}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={`ghost`}
                                    size={`icon-sm`}
                                    aria-label={muteLabel}
                                    onClick={onToggleMute}
                                    className={`text-white hover:bg-white/15 hover:text-white`}
                                >
                                    <VolumeIcon />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{muteLabel}</TooltipContent>
                        </Tooltip>
                        {/* px-2 = half the 16 px thumb width on each side
                          *  so the thumb at min/max stays fully inside the
                          *  visible track instead of spilling past it. */}
                        <div
                            className={`relative px-2`}
                            onPointerEnter={() => setVolumeHover(true)}
                            onPointerLeave={() => setVolumeHover(false)}
                        >
                            {/* 100 % marker — fixed at 1.0 / VOLUME_SLIDER_MAX of
                              * the interior width (= 66.67 %). The wrapper has
                              * 8 px horizontal padding so we mirror that here. */}
                            <span
                                aria-hidden
                                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-sm bg-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]`}
                                style={{
                                    // 8 px = the wrapper's left padding (half a
                                    // thumb width). 7 px = padding − half the
                                    // marker width so the marker is centred on
                                    // the 100 % position.
                                    left: `calc(${VOLUME_HUNDRED_PCT_RATIO} * (100% - 16px) + 7px)`,
                                    width: `2px`,
                                    height: `10px`
                                }}
                            />
                            <Slider
                                aria-label={t.volume}
                                value={[volumeSliderValue]}
                                min={0}
                                max={VOLUME_SLIDER_MAX}
                                step={0.01}
                                onValueChange={handleVolumeChange}
                                onDoubleClick={handleVolumeDoubleClick}
                                className={`w-24`}
                            />
                            {volumeHover && (
                                <div
                                    role={`tooltip`}
                                    aria-hidden
                                    className={`pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white shadow`}
                                >
                                    {Math.round(effectiveVolume * 100)}%
                                </div>
                            )}
                        </div>
                    </div>

                    <span className={`ml-2 text-xs tabular-nums text-white/85`}>
                        {formatTimestamp(displayedTime)}
                        {` / `}
                        {formatTimestamp(status.duration)}
                    </span>

                    <div className={`ml-auto flex items-center gap-1`}>
                        {hasVariants && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant={`ghost`}
                                        size={activeVariantShort ? `sm` : `icon-sm`}
                                        aria-label={
                                            activeVariantShort
                                                ? `${t.quality} · ${activeVariantShort}`
                                                : t.quality
                                        }
                                        className={`gap-1 px-2 text-white hover:bg-white/15 hover:text-white`}
                                    >
                                        <SlidersHorizontal />
                                        {activeVariantShort && (
                                            <span
                                                className={`text-xs font-semibold tabular-nums`}
                                            >
                                                {activeVariantShort}
                                            </span>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={`end`}>
                                    <DropdownMenuLabel>{t.quality}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuRadioGroup
                                        value={String(activeVariantId)}
                                        onValueChange={(v) => {
                                            const id = Number(v);
                                            onSelectVariant(id === AUTO_VARIANT_ID ? null : id);
                                        }}
                                    >
                                        <DropdownMenuRadioItem
                                            value={String(AUTO_VARIANT_ID)}
                                            className={`gap-2`}
                                        >
                                            <span className={`flex-1`}>
                                                {t.qualityAuto}
                                                {autoVariantActive && activeVariantShort && (
                                                    <span
                                                        className={`ml-2 text-xs text-muted-foreground`}
                                                    >
                                                        ({activeVariantShort})
                                                    </span>
                                                )}
                                            </span>
                                            {autoVariantActive && activeVariantTier && (
                                                <Badge
                                                    variant={activeVariantTier.variant}
                                                    className={`px-1.5 py-0 text-[10px] font-semibold`}
                                                >
                                                    {activeVariantTier.label}
                                                </Badge>
                                            )}
                                        </DropdownMenuRadioItem>
                                        {sortedVariants.map((variant) => {
                                            const tier = qualityTierFor(variant.height);
                                            return (
                                                <DropdownMenuRadioItem
                                                    key={variant.id}
                                                    value={String(variant.id)}
                                                    className={`gap-2`}
                                                >
                                                    <span className={`flex-1`}>
                                                        {formatVariantLabel(variant)}
                                                    </span>
                                                    {tier && (
                                                        <Badge
                                                            variant={tier.variant}
                                                            className={`px-1.5 py-0 text-[10px] font-semibold`}
                                                        >
                                                            {tier.label}
                                                        </Badge>
                                                    )}
                                                </DropdownMenuRadioItem>
                                            );
                                        })}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {hasTextTracks && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant={`ghost`}
                                        size={`icon-sm`}
                                        aria-label={t.captions}
                                        className={`text-white hover:bg-white/15 hover:text-white`}
                                    >
                                        {status.textTracksVisible ? <Captions /> : <CaptionsOff />}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={`end`}>
                                    <DropdownMenuLabel>{t.captions}</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuRadioGroup
                                        value={String(activeTextTrackId)}
                                        onValueChange={(v) => {
                                            const id = Number(v);
                                            onSelectTextTrack(
                                                id === NO_TEXT_TRACK_ID ? null : id
                                            );
                                        }}
                                    >
                                        <DropdownMenuRadioItem
                                            value={String(NO_TEXT_TRACK_ID)}
                                        >
                                            {t.captionsOff}
                                        </DropdownMenuRadioItem>
                                        {textTracks.map((track) => (
                                            <DropdownMenuRadioItem
                                                key={track.id}
                                                value={String(track.id)}
                                            >
                                                {track.label || track.language || `?`}
                                            </DropdownMenuRadioItem>
                                        ))}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={`ghost`}
                                    size={`icon-sm`}
                                    aria-label={t.playbackRate}
                                    className={`relative text-white hover:bg-white/15 hover:text-white`}
                                >
                                    <Gauge />
                                    {status.playbackRate !== 1 && (
                                        <span
                                            className={`absolute right-0 bottom-0 rounded bg-primary px-1 text-[9px] leading-none font-semibold text-primary-foreground`}
                                        >
                                            {formatRate(status.playbackRate)}×
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                align={`end`}
                                // Wider than the default 18 rem so all 7
                                // preset chips fit on a single row without
                                // wrapping into a second line.
                                className={`w-[22rem]`}
                                onPointerDown={(e) => e.stopPropagation()}
                            >
                                <div className={`flex items-center justify-between`}>
                                    <span className={`text-sm font-medium`}>
                                        {t.playbackRate}
                                    </span>
                                    <span className={`text-sm tabular-nums text-muted-foreground`}>
                                        {formatRate(status.playbackRate)}×
                                    </span>
                                </div>
                                <Slider
                                    aria-label={t.playbackRate}
                                    value={[status.playbackRate]}
                                    min={RATE_MIN}
                                    max={RATE_MAX}
                                    step={RATE_STEP}
                                    onValueChange={(v) => onSetPlaybackRate(clampRate(v[0]))}
                                    // Double-click anywhere on the slider
                                    // resets to the natural 1× rate. The
                                    // hint below the slider documents this
                                    // affordance.
                                    onDoubleClick={() => onSetPlaybackRate(1)}
                                    className={`mt-3`}
                                />
                                <div className={`mt-3 flex flex-nowrap items-center gap-1`}>
                                    {PLAYBACK_RATES.map((rate) => (
                                        <Button
                                            key={rate}
                                            type={`button`}
                                            size={`sm`}
                                            variant={
                                                Math.abs(status.playbackRate - rate) < 0.001
                                                    ? `default`
                                                    : `outline`
                                            }
                                            className={`h-7 flex-1 px-2 text-xs`}
                                            onClick={() => onSetPlaybackRate(rate)}
                                        >
                                            {rate}×
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={`ghost`}
                                    size={`icon-sm`}
                                    aria-label={t.pictureInPicture}
                                    onClick={onTogglePictureInPicture}
                                    className={`text-white hover:bg-white/15 hover:text-white`}
                                >
                                    <PictureInPicture2 />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t.pictureInPicture}</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={`ghost`}
                                    size={`icon-sm`}
                                    aria-label={fullscreenLabel}
                                    onClick={onToggleFullscreen}
                                    className={`text-white hover:bg-white/15 hover:text-white`}
                                >
                                    {status.fullscreen ? <Minimize /> : <Maximize />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{fullscreenLabel}</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
};

export default ControlBar;
