import {
    AlertCircle,
    Download,
    Loader2,
    Pause,
    Play,
    Rewind,
    Volume1,
    Volume2,
    VolumeX,
    FastForward
} from "lucide-react";
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type ReactNode
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { Slider } from "../../ui/slider";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "../../ui/tooltip";
import PlaybackRateControl from "../playbackRateControl/PlaybackRateControl";
import Waveform from "./Waveform";
import {
    DEFAULT_AUDIO_PLAYER_STRINGS,
    formatAudioTimestamp,
    type AudioPlayerStrings,
    type AudioPlayerVariant
} from "./types";

const SEEK_STEP_SECONDS = 5;
const VOLUME_STEP = 0.1;
const VOLUME_SLIDER_MAX = 1;

// Negatives → 0. Above duration → clamp to duration once it is known.
// When duration is unknown (NaN/0 before `loadedmetadata`) the value passes
// through; the browser will clamp it itself once metadata arrives, and we
// don't want to artificially pin the request to 0 in the meantime.
const clampSeekSeconds = (
    audioElement: HTMLAudioElement,
    seconds: number
): number => {
    const duration = audioElement.duration;
    const upper =
        Number.isFinite(duration) && duration > 0 ? duration : Infinity;
    return Math.max(0, Math.min(seconds, upper));
};

/**
 * Imperative handle exposed via `forwardRef`. Wire a ref to an
 * `<AudioPlayer>` to drive playback from outside the component — for
 * instance, to seek the audio when a synced lyric line is clicked.
 *
 * Before the underlying `<audio>` element mounts, mutating methods
 * (`seekTo`, `play`, `pause`) are no-ops, and accessor methods return
 * safe defaults (`getCurrentTime` / `getDuration` → `0`, `getElement`
 * → `null`), so callers can fire them without guarding.
 */
export interface AudioPlayerHandle {
    /**
     * Move playback to `seconds`. Negatives clamp to `0`; values above
     * `duration` clamp to `duration` once metadata is loaded. Non-finite
     * inputs (`NaN`, `Infinity`) are ignored.
     */
    readonly seekTo: (seconds: number) => void;
    /**
     * Start playback. Returns the underlying `HTMLAudioElement.play()`
     * promise so callers can observe browser autoplay rejection via
     * `.catch()`. Resolves immediately when the element hasn't mounted yet.
     */
    readonly play: () => Promise<void>;
    /** Pause playback. */
    readonly pause: () => void;
    /** Current playback position in seconds. */
    readonly getCurrentTime: () => number;
    /** Total media duration in seconds. `0` before metadata loads. */
    readonly getDuration: () => number;
    /**
     * Escape hatch returning the underlying `<audio>` element. Prefer
     * the typed methods above; reach for this only when you need APIs
     * the typed surface doesn't cover (Web Audio pipelines,
     * media-source extensions, etc.).
     */
    readonly getElement: () => HTMLAudioElement | null;
}

export interface AudioPlayerProps {
    /** Resolved audio URL. Consumers are responsible for any token / signed
     * URL resolution before passing this in. */
    readonly src: string;
    /** Optional display title shown in the `card` variant. */
    readonly title?: string;
    /** Optional secondary line (artist, podcast name, etc.) shown in the
     * `card` variant under the title. */
    readonly subtitle?: string;
    /** Optional artwork URL shown on the left of the `card` variant. */
    readonly artwork?: string;
    /** Pre-computed waveform peaks in [0, 1]. When omitted, a deterministic
     * procedural waveform is generated from `src`. */
    readonly peaks?: ReadonlyArray<number>;
    /** Visual variant. `bar` is a compact single-row player suitable for
     * lists and table cells; `card` is the full hero layout with artwork +
     * metadata stacked over a tall waveform. */
    readonly variant?: AudioPlayerVariant;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** When true, autoplays on mount. Browsers require muted autoplay; if
     * the source isn't muted the playback request may be rejected and the
     * UI stays paused. */
    readonly autoPlay?: boolean;
    readonly loop?: boolean;
    /** `crossOrigin` to set on the underlying `<audio>` tag; needed when
     * the source must support range requests from a different origin. */
    readonly crossOrigin?: `anonymous` | `use-credentials`;
    readonly preload?: `none` | `metadata` | `auto`;
    /** When false, the download button is hidden in the trailing action
     * group. Defaults to true. */
    readonly downloadable?: boolean;
    /** Optional filename suggestion for the download anchor. */
    readonly downloadName?: string;
    /** Translation overrides. Defaults to English. */
    readonly strings?: Partial<AudioPlayerStrings>;
    /** Optional slot rendered to the right of the timestamp in the `bar`
     * variant (or under the subtitle in the `card` variant). Useful for
     * badges, source chips, etc. */
    readonly trailing?: ReactNode;
    readonly onPlay?: () => void;
    readonly onPause?: () => void;
    readonly onEnded?: () => void;
    readonly onTimeUpdate?: (currentTime: number, duration: number) => void;
    readonly onError?: (error: MediaError | null) => void;
}

interface PlayerStatus {
    readonly playing: boolean;
    readonly buffering: boolean;
    readonly currentTime: number;
    readonly duration: number;
    readonly volume: number;
    readonly muted: boolean;
    readonly playbackRate: number;
    readonly error: MediaError | null;
}

const INITIAL_STATUS: PlayerStatus = {
    playing: false,
    buffering: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    error: null
};

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
    (
        {
            src,
            title,
            subtitle,
            artwork,
            peaks,
            variant = `bar`,
            className,
            style,
            autoPlay = false,
            loop = false,
            crossOrigin,
            preload = `metadata`,
            downloadable = true,
            downloadName,
            strings,
            trailing,
            onPlay,
            onPause,
            onEnded,
            onTimeUpdate,
            onError
        },
        ref
    ) => {
    const t = useMemo(
        () => ({ ...DEFAULT_AUDIO_PLAYER_STRINGS, ...strings }),
        [strings]
    );
    const audioRef = useRef<HTMLAudioElement>(null);
    const [status, setStatus] = useState<PlayerStatus>(INITIAL_STATUS);
    // While the user is mid-drag on the waveform, hold the seek value
    // locally and only commit to the audio element on release. Writing
    // through on every tick causes seek thrash on slow sources.
    const [scrubProgress, setScrubProgress] = useState<number | null>(null);

    // Stash the callback props in a ref so the event-listener effect can
    // depend on `[]` and stay attached for the component's lifetime.
    // Without this, an inline `onTimeUpdate={(t) => …}` on the parent
    // would tear down + reinstall all 11 listeners on every render and
    // race the user's volume drag during the re-sync block below.
    const callbacksRef = useRef({ onPlay, onPause, onEnded, onTimeUpdate, onError });
    callbacksRef.current = { onPlay, onPause, onEnded, onTimeUpdate, onError };

    // Side-effect: wire audio element events to local status. We keep this
    // logic in one effect so the listeners share a single closure over
    // `setStatus` and there's no listener-leak hazard from staggered
    // attach/detach.
    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;

        const onLoaded = () => {
            setStatus((s) => ({
                ...s,
                duration: Number.isFinite(el.duration) ? el.duration : 0,
                error: null
            }));
        };
        const onTime = () => {
            setStatus((s) => ({ ...s, currentTime: el.currentTime }));
            callbacksRef.current.onTimeUpdate?.(el.currentTime, el.duration);
        };
        const onPlayEvt = () => {
            setStatus((s) => ({ ...s, playing: true, buffering: false }));
            callbacksRef.current.onPlay?.();
        };
        const onPauseEvt = () => {
            setStatus((s) => ({ ...s, playing: false }));
            callbacksRef.current.onPause?.();
        };
        const onWaiting = () => setStatus((s) => ({ ...s, buffering: true }));
        const onPlaying = () => setStatus((s) => ({ ...s, buffering: false }));
        const onVolume = () =>
            setStatus((s) => ({ ...s, volume: el.volume, muted: el.muted }));
        const onRate = () =>
            setStatus((s) => ({ ...s, playbackRate: el.playbackRate }));
        const onEndedEvt = () => {
            setStatus((s) => ({ ...s, playing: false }));
            callbacksRef.current.onEnded?.();
        };
        const onErr = () => {
            setStatus((s) => ({
                ...s,
                error: el.error,
                playing: false,
                buffering: false
            }));
            callbacksRef.current.onError?.(el.error);
        };

        el.addEventListener(`loadedmetadata`, onLoaded);
        el.addEventListener(`durationchange`, onLoaded);
        el.addEventListener(`timeupdate`, onTime);
        el.addEventListener(`play`, onPlayEvt);
        el.addEventListener(`pause`, onPauseEvt);
        el.addEventListener(`waiting`, onWaiting);
        el.addEventListener(`playing`, onPlaying);
        el.addEventListener(`volumechange`, onVolume);
        el.addEventListener(`ratechange`, onRate);
        el.addEventListener(`ended`, onEndedEvt);
        el.addEventListener(`error`, onErr);

        // Sync initial volume / rate to local state in case the element
        // started with non-defaults.
        setStatus((s) => ({
            ...s,
            volume: el.volume,
            muted: el.muted,
            playbackRate: el.playbackRate
        }));

        return () => {
            el.removeEventListener(`loadedmetadata`, onLoaded);
            el.removeEventListener(`durationchange`, onLoaded);
            el.removeEventListener(`timeupdate`, onTime);
            el.removeEventListener(`play`, onPlayEvt);
            el.removeEventListener(`pause`, onPauseEvt);
            el.removeEventListener(`waiting`, onWaiting);
            el.removeEventListener(`playing`, onPlaying);
            el.removeEventListener(`volumechange`, onVolume);
            el.removeEventListener(`ratechange`, onRate);
            el.removeEventListener(`ended`, onEndedEvt);
            el.removeEventListener(`error`, onErr);
        };
    }, []);

    const togglePlay = useCallback((): void => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) {
            void el.play().catch(() => {
                // Browsers reject autoplay without a user gesture; the
                // resulting rejection surfaces via the error listener or
                // is harmless when the user retries explicitly.
            });
        } else {
            el.pause();
        }
    }, []);

    const seekTo = useCallback((seconds: number): void => {
        const el = audioRef.current;
        if (!el || !Number.isFinite(seconds)) return;
        const target = clampSeekSeconds(el, seconds);
        el.currentTime = target;
        // Optimistic local mirror so the visible play-head doesn't lag a
        // frame behind. The subsequent `timeupdate` event will overwrite
        // with whatever value the element actually settled on (browsers
        // may snap to a keyframe).
        setStatus((s) => ({ ...s, currentTime: target }));
    }, []);

    const playMedia = useCallback((): Promise<void> => {
        const el = audioRef.current;
        if (!el) return Promise.resolve();
        return el.play();
    }, []);

    const pauseMedia = useCallback((): void => {
        audioRef.current?.pause();
    }, []);

    const getCurrentTime = useCallback(
        (): number => audioRef.current?.currentTime ?? 0,
        []
    );

    const getDuration = useCallback((): number => {
        const duration = audioRef.current?.duration;
        return Number.isFinite(duration) ? (duration as number) : 0;
    }, []);

    const getElement = useCallback(
        (): HTMLAudioElement | null => audioRef.current,
        []
    );

    // Imperative handle is built from the internal callbacks above so
    // the public ref path and the slider/keyboard paths share a single
    // implementation. Deps list the stable `useCallback` values
    // explicitly so any future capture changes are caught.
    useImperativeHandle(
        ref,
        () => ({
            seekTo,
            play: playMedia,
            pause: pauseMedia,
            getCurrentTime,
            getDuration,
            getElement
        }),
        [seekTo, playMedia, pauseMedia, getCurrentTime, getDuration, getElement]
    );

    const skipBy = useCallback(
        (delta: number): void => {
            const el = audioRef.current;
            if (!el) return;
            seekTo((el.currentTime || 0) + delta);
        },
        [seekTo]
    );

    const setVolume = useCallback((next: number): void => {
        const el = audioRef.current;
        if (!el) return;
        const clamped = Math.max(0, Math.min(1, next));
        el.volume = clamped;
        // Adjusting volume away from zero should auto-unmute. This mirrors
        // YouTube/Spotify behavior so the user doesn't have to also click
        // the unmute button after dragging the volume up.
        if (clamped > 0 && el.muted) el.muted = false;
    }, []);

    const toggleMute = useCallback((): void => {
        const el = audioRef.current;
        if (!el) return;
        el.muted = !el.muted;
    }, []);

    const setPlaybackRate = useCallback((rate: number): void => {
        const el = audioRef.current;
        if (!el) return;
        el.playbackRate = rate;
    }, []);

    const handleWaveformScrub = useCallback(
        (ratio: number): void => {
            const el = audioRef.current;
            if (!el || !el.duration) return;
            setScrubProgress(ratio);
            seekTo(ratio * el.duration);
        },
        [seekTo]
    );

    // Release the scrub-override the moment the audio element catches up.
    // Without this the slider could be pinned to the drag-end ratio after
    // play resumed, making the head appear stuck for a frame.
    useEffect(() => {
        if (scrubProgress === null) return;
        const id = window.setTimeout(() => setScrubProgress(null), 250);
        return () => window.clearTimeout(id);
    }, [scrubProgress, status.currentTime]);

    const progress = useMemo(() => {
        if (scrubProgress !== null) return scrubProgress;
        if (!status.duration) return 0;
        return Math.max(0, Math.min(1, status.currentTime / status.duration));
    }, [scrubProgress, status.currentTime, status.duration]);

    const displayedTime = scrubProgress !== null && status.duration > 0
        ? scrubProgress * status.duration
        : status.currentTime;

    const playLabel = status.playing ? t.pause : t.play;
    const muteLabel = status.muted || status.volume === 0 ? t.unmute : t.mute;
    const VolumeIcon = status.muted || status.volume === 0
        ? VolumeX
        : status.volume < 0.5
          ? Volume1
          : Volume2;

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        // Keep the affordances scoped to the root — don't hijack typing in
        // upstream inputs that might land inside the player.
        if (e.target !== e.currentTarget) return;
        switch (e.key) {
            case ` `:
            case `k`:
            case `K`:
                e.preventDefault();
                togglePlay();
                break;
            case `ArrowLeft`:
                e.preventDefault();
                skipBy(-SEEK_STEP_SECONDS);
                break;
            case `ArrowRight`:
                e.preventDefault();
                skipBy(SEEK_STEP_SECONDS);
                break;
            case `ArrowUp`:
                e.preventDefault();
                setVolume(status.volume + VOLUME_STEP);
                break;
            case `ArrowDown`:
                e.preventDefault();
                setVolume(status.volume - VOLUME_STEP);
                break;
            case `m`:
            case `M`:
                e.preventDefault();
                toggleMute();
                break;
            default:
                break;
        }
    };

    const isCard = variant === `card`;
    const isMinimal = variant === `minimal`;

    const audio = (
        <audio
            ref={audioRef}
            src={src}
            autoPlay={autoPlay}
            loop={loop}
            preload={preload}
            crossOrigin={crossOrigin}
            // Hidden — the visual surface is entirely custom. We still
            // render a real <audio> so screen readers can land on the
            // element directly and so the browser's media key bindings
            // work without extra glue.
            className={`sr-only`}
        >
            {/* The browser figures out the MIME type from the URL; no
              * <source> tag needed for the single-source case. */}
        </audio>
    );

    const playButton = (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type={`button`}
                    onClick={togglePlay}
                    aria-label={playLabel}
                    aria-pressed={status.playing}
                    size={isCard ? `icon-lg` : `icon`}
                    variant={`default`}
                    disabled={Boolean(status.error)}
                    className={cn(
                        `relative shrink-0 rounded-full shadow-sm`,
                        isCard && `h-14 w-14`
                    )}
                >
                    {status.buffering ? (
                        <Loader2 className={`animate-spin`} />
                    ) : status.playing ? (
                        <Pause className={cn(isCard && `!size-6`)} />
                    ) : (
                        <Play className={cn(`translate-x-[1px]`, isCard && `!size-6`)} />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{playLabel}</TooltipContent>
        </Tooltip>
    );

    const skipButtons = (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type={`button`}
                        onClick={() => skipBy(-SEEK_STEP_SECONDS)}
                        aria-label={t.skipBackward}
                        size={`icon-sm`}
                        variant={`ghost`}
                    >
                        <Rewind />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{t.skipBackward}</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type={`button`}
                        onClick={() => skipBy(SEEK_STEP_SECONDS)}
                        aria-label={t.skipForward}
                        size={`icon-sm`}
                        variant={`ghost`}
                    >
                        <FastForward />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{t.skipForward}</TooltipContent>
            </Tooltip>
        </>
    );

    const volumeControl = (
        // Hide the volume slider on narrow widths to keep the bar layout
        // breathable; the mute button remains, so the affordance is never
        // lost — it just collapses gracefully.
        <div className={`hidden items-center gap-1 sm:flex`}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type={`button`}
                        onClick={toggleMute}
                        aria-label={muteLabel}
                        size={`icon-sm`}
                        variant={`ghost`}
                    >
                        <VolumeIcon />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{muteLabel}</TooltipContent>
            </Tooltip>
            <Slider
                aria-label={t.volume}
                value={[status.muted ? 0 : status.volume]}
                min={0}
                max={VOLUME_SLIDER_MAX}
                step={0.01}
                onValueChange={(v) => setVolume(v[0])}
                className={`w-20`}
                data-testid={`audio-volume-slider`}
            />
        </div>
    );

    const rateControl = (
        <PlaybackRateControl
            rate={status.playbackRate}
            onChange={setPlaybackRate}
            strings={{ label: t.playbackRate }}
        />
    );

    const downloadButton = downloadable && src && (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button asChild size={`icon-sm`} variant={`ghost`} aria-label={t.download}>
                    <a href={src} download={downloadName} aria-label={t.download}>
                        <Download />
                    </a>
                </Button>
            </TooltipTrigger>
            <TooltipContent>{t.download}</TooltipContent>
        </Tooltip>
    );

    const timestamp = (
        <span
            className={cn(
                `tabular-nums text-muted-foreground`,
                isCard ? `text-sm` : `text-xs`
            )}
            data-testid={`audio-time`}
        >
            {formatAudioTimestamp(displayedTime)}
            <span aria-hidden className={`mx-1 opacity-50`}>
                /
            </span>
            {formatAudioTimestamp(status.duration)}
        </span>
    );

    const errorRow = status.error && (
        <div
            role={`alert`}
            className={`flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive`}
        >
            <AlertCircle className={`size-3.5`} aria-hidden />
            <span>{t.errorTitle}</span>
            <Button
                size={`sm`}
                variant={`outline`}
                onClick={() => {
                    const el = audioRef.current;
                    if (!el) return;
                    el.load();
                    void el.play().catch(() => undefined);
                }}
                className={`ml-auto h-6 px-2 text-xs`}
            >
                {t.errorRetry}
            </Button>
        </div>
    );

    if (isMinimal) {
        // Minimal variant: no waveform, just a regular shadcn Slider. Use
        // SLIDER_MAX granularity so the thumb glides smoothly even on
        // long sources. The slider is the canonical seek affordance —
        // dragging commits on release through the same `seekTo` path.
        const MINIMAL_SLIDER_MAX = 1000;
        const sliderValue = status.duration > 0
            ? (displayedTime / status.duration) * MINIMAL_SLIDER_MAX
            : 0;
        const handleMinimalSliderChange = (v: number[]): void => {
            if (!status.duration) return;
            const ratio = v[0] / MINIMAL_SLIDER_MAX;
            // Pin scrubProgress so the thumb doesn't snap back while the
            // audio element catches up to the new currentTime.
            setScrubProgress(ratio);
            seekTo(ratio * status.duration);
        };
        return (
            <TooltipProvider delayDuration={400}>
                <div
                    role={`region`}
                    aria-label={title ?? t.seek}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    data-testid={`audio-player`}
                    data-variant={`minimal`}
                    style={style}
                    className={cn(
                        `AudioPlayer flex w-full items-center gap-3 rounded-full border bg-card px-2 py-1.5 text-card-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`,
                        className
                    )}
                >
                    {playButton}
                    <div className={`flex min-w-0 flex-1 items-center gap-3`}>
                        <Slider
                            aria-label={t.seek}
                            value={[sliderValue]}
                            min={0}
                            max={MINIMAL_SLIDER_MAX}
                            step={1}
                            disabled={Boolean(status.error) || !status.duration}
                            onValueChange={handleMinimalSliderChange}
                            className={`min-w-0 flex-1`}
                            data-testid={`audio-seek-slider`}
                        />
                        {timestamp}
                    </div>
                    {errorRow ? (
                        <div className={`max-w-[40%]`}>{errorRow}</div>
                    ) : (
                        <div className={`flex shrink-0 items-center gap-0.5`}>
                            {volumeControl}
                            {rateControl}
                            {downloadButton}
                        </div>
                    )}
                    {trailing ? <div className={`shrink-0`}>{trailing}</div> : null}
                    {audio}
                </div>
            </TooltipProvider>
        );
    }

    if (isCard) {
        return (
            <TooltipProvider delayDuration={400}>
                <div
                    role={`region`}
                    aria-label={title ?? t.waveform}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    data-testid={`audio-player`}
                    data-variant={`card`}
                    style={style}
                    className={cn(
                        `AudioPlayer relative flex w-full flex-col gap-4 overflow-hidden rounded-xl border bg-card p-4 text-card-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-row sm:items-stretch sm:gap-5`,
                        className
                    )}
                >
                    {artwork ? (
                        <div
                            className={`relative aspect-square w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-32`}
                        >
                            <img
                                src={artwork}
                                alt={``}
                                aria-hidden
                                className={`size-full object-cover`}
                            />
                            {/* Soft inner glow that animates while playing — a
                              * single subtle motion cue tying the artwork to
                              * the player state. */}
                            <div
                                aria-hidden
                                className={cn(
                                    `pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-foreground/10 transition-opacity`,
                                    status.playing ? `opacity-100` : `opacity-40`
                                )}
                            />
                        </div>
                    ) : null}

                    <div className={`flex min-w-0 flex-1 flex-col gap-2`}>
                        <div className={`flex min-w-0 items-start gap-3`}>
                            <div className={`min-w-0 flex-1`}>
                                {title ? (
                                    <h3
                                        className={`truncate text-base font-semibold tracking-tight`}
                                        title={title}
                                    >
                                        {title}
                                    </h3>
                                ) : null}
                                {subtitle ? (
                                    <p
                                        className={`truncate text-sm text-muted-foreground`}
                                        title={subtitle}
                                    >
                                        {subtitle}
                                    </p>
                                ) : null}
                                {trailing ? (
                                    <div className={`mt-1`}>{trailing}</div>
                                ) : null}
                            </div>
                            {timestamp}
                        </div>

                        <div className={`h-14 w-full`}>
                            <Waveform
                                seed={src}
                                peaks={peaks}
                                progress={progress}
                                onSeek={handleWaveformScrub}
                                ariaLabel={t.waveform}
                                disabled={Boolean(status.error)}
                            />
                        </div>

                        {errorRow}

                        <div className={`flex items-center gap-1`}>
                            {playButton}
                            <div className={`flex items-center gap-0.5`}>
                                {skipButtons}
                            </div>
                            <div className={`ml-auto flex items-center gap-1`}>
                                {volumeControl}
                                {rateControl}
                                {downloadButton}
                            </div>
                        </div>
                    </div>
                    {audio}
                </div>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider delayDuration={400}>
            <div
                role={`region`}
                aria-label={title ?? t.waveform}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                data-testid={`audio-player`}
                data-variant={`bar`}
                style={style}
                className={cn(
                    `AudioPlayer flex w-full items-center gap-3 rounded-full border bg-card px-2 py-1.5 text-card-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`,
                    className
                )}
            >
                {playButton}
                <div className={`flex min-w-0 flex-1 items-center gap-3`}>
                    <div className={`h-9 min-w-0 flex-1`}>
                        <Waveform
                            seed={src}
                            peaks={peaks}
                            progress={progress}
                            onSeek={handleWaveformScrub}
                            ariaLabel={t.waveform}
                            disabled={Boolean(status.error)}
                        />
                    </div>
                    {timestamp}
                </div>
                {errorRow ? (
                    <div className={`max-w-[40%]`}>{errorRow}</div>
                ) : (
                    <div className={`flex shrink-0 items-center gap-0.5`}>
                        {volumeControl}
                        {rateControl}
                        {downloadButton}
                    </div>
                )}
                {trailing ? <div className={`shrink-0`}>{trailing}</div> : null}
                {audio}
            </div>
        </TooltipProvider>
    );
});

AudioPlayer.displayName = `AudioPlayer`;

export default AudioPlayer;
