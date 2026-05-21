import { AlertTriangle, Loader2, Pause, Play } from "lucide-react";
import * as React from "react";
import { PureComponent, createRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "../../../../../lib/utils";
import { log } from "../../../../../lib/logging";
import { MowsContext } from "../../../../../lib/mowsContext/MowsContext";
import { Button } from "../../../../ui/button";
import ControlBar from "./ControlBar";
import { VideoFrameGrabber } from "./frameGrabber";
import { resolveVideoKeyAction } from "./keyboard";
import { isVideoMimeType } from "./mimeType";
import {
    DEFAULT_STRINGS,
    type Chapter,
    type ImageTrackOption,
    type PlayerStatus,
    type TextTrackOption,
    type ThumbnailFrame,
    type VariantOption,
    type VideoViewerStrings
} from "./types";
import { ensurePolyfills, isShakaSupported, shaka, type ShakaPlayer } from "./shakaModule";

const CONTROL_AUTOHIDE_MS = 2500;
const VOLUME_CLAMP_MIN = 0;
// HTMLMediaElement.volume is hard-capped at 1.0 by spec; anything above
// is delivered through a Web Audio GainNode. 4.0 (= 400 %) gives enough
// headroom to rescue genuinely quiet sources without sliding into the
// distortion-dominant zone. A DynamicsCompressorNode in the audio graph
// catches peaks so the higher gain stays usable.
const VOLUME_CLAMP_MAX = 4;

const clampVolume = (v: number): number =>
    Math.max(VOLUME_CLAMP_MIN, Math.min(VOLUME_CLAMP_MAX, v));

const supportsPip = (): boolean =>
    typeof document !== `undefined` && `pictureInPictureEnabled` in document
        && Boolean((document as Document & { pictureInPictureEnabled: boolean }).pictureInPictureEnabled);

const initialStatus = (): PlayerStatus => ({
    playing: false,
    buffering: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    fullscreen: false,
    pictureInPicture: false,
    nativeFallback: false,
    textTracksVisible: false
});

export interface VideoViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly src: string;
    readonly mimeType: string;
    /** Display name surfaced on the `<video>` element (aria-label + downloads). */
    readonly name?: string;
    /** Whether to attempt autoplay (muted-autoplay friendly). Defaults to false. */
    readonly autoplay?: boolean;
    /** Initial muted state. Defaults to false. */
    readonly muted?: boolean;
    /** Loop playback. */
    readonly loop?: boolean;
    /** Optional poster shown before playback starts. */
    readonly poster?: string;
    /** YouTube-style chapters. When provided, the seek bar renders a tick at
     * each chapter boundary and the hover/drag tooltip surfaces the
     * matching chapter title above the timestamp. Sorted by `startTime`
     * before rendering. */
    readonly chapters?: ReadonlyArray<Chapter>;
    /** Override built-in English strings (used by consumers that own translation). */
    readonly strings?: Partial<VideoViewerStrings>;
}

interface VideoViewerState {
    readonly status: PlayerStatus;
    readonly variants: ReadonlyArray<VariantOption>;
    readonly textTracks: ReadonlyArray<TextTrackOption>;
    readonly imageTracks: ReadonlyArray<ImageTrackOption>;
    readonly autoVariantActive: boolean;
    readonly controlsVisible: boolean;
    readonly error: string | null;
    /** Splash icon shown momentarily at the centre of the player when the
     * user toggles playback by clicking the surface. Cleared once the CSS
     * animation completes. Null when no splash is active. */
    readonly splash: `play` | `pause` | null;
    /** Monotonically increasing key so each splash starts a fresh CSS
     * animation even when the same icon would otherwise be reused. */
    readonly splashKey: number;
}

const toVariantOption = (track: shaka.extern.Track): VariantOption => ({
    id: track.id,
    height: track.height,
    width: track.width,
    bandwidth: track.bandwidth,
    label: track.label ?? `${track.height ?? `?`}p`,
    active: track.active
});

const toTextTrackOption = (track: shaka.extern.TextTrack): TextTrackOption => ({
    id: track.id,
    language: track.language ?? ``,
    label: track.label ?? track.language ?? `?`,
    kind: track.kind ?? ``,
    active: track.active
});

const toImageTrackOption = (track: shaka.extern.ImageTrack): ImageTrackOption => ({
    id: track.id,
    width: track.width,
    height: track.height,
    bandwidth: track.bandwidth
});

const toThumbnailFrame = (t: shaka.extern.Thumbnail): ThumbnailFrame => ({
    uri: t.uris[0] ?? ``,
    width: t.width,
    height: t.height,
    sprite: t.sprite,
    positionX: t.positionX,
    positionY: t.positionY,
    imageWidth: t.imageWidth,
    imageHeight: t.imageHeight,
    startTime: t.startTime,
    duration: t.duration
});

export default class VideoViewer extends PureComponent<VideoViewerProps, VideoViewerState> {
    // Picks up translated control labels (`t.videoViewer.*`) when the
    // viewer is rendered inside a <MowsProvider>. Falls back to the
    // English DEFAULT_STRINGS otherwise; explicit `props.strings` wins.
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;
    private wrapperRef = createRef<HTMLDivElement>();
    private videoRef = createRef<HTMLVideoElement>();
    private player: ShakaPlayer | null = null;
    private cancelled = false;
    private hideTimer: ReturnType<typeof setTimeout> | null = null;
    /** Lazily-initialised fallback frame grabber for progressive video/* sources
     * that don't expose Shaka image tracks. We only mount the hidden video
     * once the consumer actually scrubs the seek bar — that's when the cost
     * starts to matter. */
    private frameGrabber: VideoFrameGrabber | null = null;
    private frameGrabberSrc: string | null = null;
    /** Lazily-allocated 160×90 canvas reused for `captureCurrentFrame`. */
    private liveCaptureCanvas: HTMLCanvasElement | null = null;
    private liveCaptureCtx: CanvasRenderingContext2D | null = null;
    /** Lazily-created Web Audio nodes used to boost volume above 1.0.
     * HTMLMediaElement.volume is hard-capped at 1.0, so values >1 route
     * through a GainNode instead. The AudioContext is owned by this
     * instance and closed on unmount. */
    private audioContext: AudioContext | null = null;
    private mediaElementSource: MediaElementAudioSourceNode | null = null;
    private compressorNode: DynamicsCompressorNode | null = null;
    private gainNode: GainNode | null = null;
    /** Once a captureCurrentFrame throws a SecurityError (the canvas is
     * tainted because the source isn't CORS-clean), short-circuit every
     * subsequent call. The seek-bar tile then falls back to the hidden
     * grabber or to timestamp-only — without spamming `(in promise)`
     * exceptions to the console on every drag tick. */
    private captureBlocked = false;

    state: VideoViewerState = {
        status: initialStatus(),
        variants: [],
        textTracks: [],
        imageTracks: [],
        autoVariantActive: true,
        controlsVisible: true,
        error: null,
        splash: null,
        splashKey: 0
    };

    componentDidMount = (): void => {
        ensurePolyfills();
        const useNative = !isShakaSupported();
        this.setState((s) => ({
            status: { ...s.status, nativeFallback: useNative }
        }));
        if (useNative) {
            this.bindVideoEvents();
            return;
        }
        const videoEl = this.videoRef.current;
        if (!videoEl) return;
        const player = new shaka.Player();
        this.player = player;
        player.addEventListener(`trackschanged`, this.handleTracksChanged);
        player.addEventListener(`adaptation`, this.handleTracksChanged);
        player.addEventListener(`buffering`, this.handleBufferingEvent);
        player.addEventListener(`error`, this.handleShakaError);
        void this.attachAndLoad(player, videoEl, this.props.src);
        this.bindVideoEvents();
        document.addEventListener(`fullscreenchange`, this.handleFullscreenChange);
    };

    componentDidUpdate = (prev: VideoViewerProps): void => {
        if (prev.src !== this.props.src) this.reload(this.props.src);
    };

    private reload = (src: string): void => {
        const videoEl = this.videoRef.current;
        if (!videoEl) return;
        this.setState((s) => ({
            status: { ...s.status, currentTime: 0, buffering: true },
            variants: [],
            textTracks: [],
            imageTracks: [],
            error: null
        }));
        const player = this.player;
        if (!player) {
            videoEl.src = src;
            videoEl.load();
            return;
        }
        void player.load(src).catch((err: unknown) => this.handleLoadError(err));
    };

    componentWillUnmount = (): void => {
        this.cancelled = true;
        if (this.hideTimer !== null) clearTimeout(this.hideTimer);
        document.removeEventListener(`fullscreenchange`, this.handleFullscreenChange);
        const videoEl = this.videoRef.current;
        if (videoEl) {
            videoEl.removeEventListener(`enterpictureinpicture`, this.handlePipEnter);
            videoEl.removeEventListener(`leavepictureinpicture`, this.handlePipLeave);
        }
        if (this.frameGrabber) {
            this.frameGrabber.destroy();
            this.frameGrabber = null;
            this.frameGrabberSrc = null;
        }
        const player = this.player;
        this.player = null;
        if (player) void player.destroy();
    };

    private attachAndLoad = async (
        player: ShakaPlayer,
        videoEl: HTMLVideoElement,
        src: string
    ): Promise<void> => {
        try {
            await player.attach(videoEl);
            if (this.cancelled) return;
            await player.load(src);
        } catch (err: unknown) {
            if (this.cancelled) return;
            this.handleLoadError(err);
        }
    };

    private bindVideoEvents = (): void => {
        const v = this.videoRef.current;
        if (!v) return;
        v.addEventListener(`enterpictureinpicture`, this.handlePipEnter);
        v.addEventListener(`leavepictureinpicture`, this.handlePipLeave);
    };

    private handleLoadError = (err: unknown): void => {
        const message =
            err instanceof shaka.util.Error
                ? `Shaka error (code ${err.code}, category ${err.category})`
                : err instanceof Error
                  ? err.message
                  : `Unknown playback error`;
        this.setState({ error: message });
    };

    private handleShakaError = (e: Event): void => {
        const detail = (e as Event & { detail?: shaka.util.Error }).detail;
        if (detail) this.handleLoadError(detail);
    };

    private handleBufferingEvent = (e: Event): void => {
        const buffering = (e as Event & { buffering?: boolean }).buffering ?? false;
        this.setState((s) => ({ status: { ...s.status, buffering } }));
    };

    private handleTracksChanged = (): void => {
        const player = this.player;
        if (!player) return;
        const variants = player.getVariantTracks().map(toVariantOption);
        const textTracks = player.getTextTracks().map(toTextTrackOption);
        const imageTracks = player.getImageTracks().map(toImageTrackOption);
        const abrEnabled = player.getConfiguration().abr?.enabled ?? true;
        const anyActive = textTracks.some((t) => t.active);
        this.setState((s) => ({
            variants,
            textTracks,
            imageTracks,
            autoVariantActive: abrEnabled,
            status: { ...s.status, textTracksVisible: anyActive }
        }));
    };

    private getThumbnailAt = async (time: number): Promise<ThumbnailFrame | null> => {
        const player = this.player;
        const tracks = this.state.imageTracks;
        // 1. Prefer Shaka's native image tracks when the manifest exposes them.
        if (player && tracks.length > 0) {
            // Prefer the largest image track (highest pixel area). For most
            // manifests there's only one, but DASH allows multiple — picking
            // the biggest gives the sharpest preview.
            const best = [...tracks].sort(
                (a, b) =>
                    (b.width ?? 0) * (b.height ?? 0) -
                    (a.width ?? 0) * (a.height ?? 0)
            )[0];
            try {
                const thumb = await player.getThumbnails(best.id, time);
                if (thumb && thumb.uris[0]) return toThumbnailFrame(thumb);
            } catch (error: unknown) {
                log.debug(`VideoViewer: shaka thumbnails unavailable, falling back to frame-grab`, error);
            }
        }
        // 2. Frame-grab fallback: only for progressive video/* sources where a
        // plain <video src> can decode it without MSE. DASH/HLS manifests that
        // don't expose image tracks return null — we'd need a second Shaka
        // instance to scrub, which is out of scope.
        if (isVideoMimeType(this.props.mimeType)) {
            const grabber = this.ensureFrameGrabber();
            if (grabber) return grabber.getThumbnail(time);
        }
        return null;
    };

    private ensureFrameGrabber = (): VideoFrameGrabber | null => {
        if (typeof document === `undefined`) return null;
        if (this.frameGrabber && this.frameGrabberSrc === this.props.src) {
            return this.frameGrabber;
        }
        if (this.frameGrabber) {
            this.frameGrabber.destroy();
            this.frameGrabber = null;
        }
        this.frameGrabber = new VideoFrameGrabber(this.props.src);
        this.frameGrabberSrc = this.props.src;
        return this.frameGrabber;
    };

    private handleTimeUpdate = (): void => {
        const v = this.videoRef.current;
        if (!v) return;
        this.setState((s) => ({
            status: { ...s.status, currentTime: v.currentTime }
        }));
    };

    private handleLoadedMetadata = (): void => {
        const v = this.videoRef.current;
        if (!v) return;
        this.setState((s) => ({
            status: { ...s.status, duration: v.duration, buffering: false }
        }));
    };

    private handlePlay = (): void =>
        this.setState((s) => ({ status: { ...s.status, playing: true } }));
    private handlePause = (): void =>
        this.setState((s) => ({ status: { ...s.status, playing: false } }));
    private handleVolumeChange = (): void => {
        const v = this.videoRef.current;
        if (!v) return;
        this.setState((s) => {
            // When the user has pushed volume above 1.0 the GainNode owns
            // the displayed level — v.volume is pinned at 1.0 and reading
            // it back would erase the boost. Preserve s.status.volume.
            if (s.status.volume > 1) {
                return { status: { ...s.status, muted: v.muted } };
            }
            return { status: { ...s.status, volume: v.volume, muted: v.muted } };
        });
    };
    private handleRateChange = (): void => {
        const v = this.videoRef.current;
        if (!v) return;
        this.setState((s) => ({
            status: { ...s.status, playbackRate: v.playbackRate }
        }));
    };
    private handleEnded = (): void =>
        this.setState((s) => ({
            status: { ...s.status, playing: false, currentTime: s.status.duration }
        }));

    private handlePipEnter = (): void =>
        this.setState((s) => ({ status: { ...s.status, pictureInPicture: true } }));
    private handlePipLeave = (): void =>
        this.setState((s) => ({ status: { ...s.status, pictureInPicture: false } }));
    private handleFullscreenChange = (): void => {
        const fullscreen = document.fullscreenElement === this.wrapperRef.current;
        this.setState((s) => ({ status: { ...s.status, fullscreen } }));
    };

    private togglePlay = (): void => {
        const v = this.videoRef.current;
        if (!v) return;
        if (v.paused) {
            void v.play().catch((err: unknown) => this.handleLoadError(err));
        } else {
            v.pause();
        }
    };

    /** Trigger the YouTube-style centred play/pause splash icon. Reads
     * the current paused state to decide which icon to show — call AFTER
     * the new state has been written. */
    private flashSplash = (kind: `play` | `pause`): void => {
        this.setState((s) => ({ splash: kind, splashKey: s.splashKey + 1 }));
    };
    private clearSplash = (): void => {
        if (this.state.splash !== null) this.setState({ splash: null });
    };
    /**
     * Seek the player to the given absolute time, in seconds. Exposed as a
     * public method so consumers can jump to a chapter / cue via a ref
     * (`<VideoViewer ref={r} chapters={…} />` then `r.current?.seekTo(t)`).
     */
    seekTo = (seconds: number): void => {
        const v = this.videoRef.current;
        if (!v) return;
        const max = Number.isFinite(v.duration) ? v.duration : seconds;
        v.currentTime = Math.max(0, Math.min(max, seconds));
    };

    /**
     * Snapshot the main `<video>` element's currently-decoded frame into a
     * 160×90 JPEG blob. Used by the seek-bar preview during drag so the
     * floating tile shows *exactly* the frame the user sees in the player
     * (the hidden grabber video lags slightly because it seeks on its own
     * schedule). Returns null when no frame is decoded yet or when the
     * canvas would be tainted by a CORS-less video source.
     */
    captureCurrentFrame = async (): Promise<ThumbnailFrame | null> => {
        if (this.captureBlocked) return null;
        const v = this.videoRef.current;
        if (!v || v.videoWidth === 0 || v.videoHeight === 0) return null;
        if (typeof document === `undefined`) return null;
        if (!this.liveCaptureCanvas || !this.liveCaptureCtx) {
            this.liveCaptureCanvas = document.createElement(`canvas`);
            this.liveCaptureCanvas.width = 160;
            this.liveCaptureCanvas.height = 90;
            this.liveCaptureCtx = this.liveCaptureCanvas.getContext(`2d`);
        }
        const canvas = this.liveCaptureCanvas;
        const ctx = this.liveCaptureCtx;
        if (!ctx) return null;
        const scale = Math.min(160 / v.videoWidth, 90 / v.videoHeight);
        const dw = v.videoWidth * scale;
        const dh = v.videoHeight * scale;
        ctx.fillStyle = `#000`;
        ctx.fillRect(0, 0, 160, 90);
        try {
            ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight, (160 - dw) / 2, (90 - dh) / 2, dw, dh);
        } catch (error: unknown) {
            log.debug(`VideoViewer: drawImage failed (likely tainted canvas — cross-origin without CORS)`, error);
            this.captureBlocked = true;
            return null;
        }
        return new Promise<ThumbnailFrame | null>((resolve) => {
            try {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(null);
                            return;
                        }
                        resolve({
                            uri: URL.createObjectURL(blob),
                            width: 160,
                            height: 90,
                            sprite: false,
                            positionX: 0,
                            positionY: 0,
                            imageWidth: 160,
                            imageHeight: 90,
                            startTime: v.currentTime,
                            duration: 0
                        });
                    },
                    `image/jpeg`,
                    0.7
                );
            } catch (error: unknown) {
                log.debug(`VideoViewer: canvas.toBlob blocked (tainted canvas)`, error);
                this.captureBlocked = true;
                resolve(null);
            }
        });
    };
    private seekBy = (delta: number): void => this.seekTo(this.state.status.currentTime + delta);
    private ensureGainNode = (): GainNode | null => {
        if (this.gainNode) {
            // Browsers auto-suspend AudioContexts when the tab loses
            // focus, OS power-management kicks in, or other contexts on
            // the page compete for resources. Resume on every reuse so a
            // boost set hours ago still produces audio when the user
            // returns to the tab.
            this.resumeAudio();
            return this.gainNode;
        }
        const v = this.videoRef.current;
        if (!v || typeof window === `undefined`) return null;
        const AC = window.AudioContext ?? (window as Window & {
            webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;
        if (!AC) return null;
        try {
            this.audioContext = new AC();
            this.mediaElementSource = this.audioContext.createMediaElementSource(v);
            // Compressor sits between source and gain so high boosts don't
            // clip ugly. Defaults: threshold -24 dB, ratio 4:1, fast
            // attack, soft knee. Sources that don't peak near 0 dB stay
            // essentially unchanged, so 1.0× sounds like the native path.
            this.compressorNode = this.audioContext.createDynamicsCompressor();
            this.gainNode = this.audioContext.createGain();
            this.mediaElementSource.connect(this.compressorNode);
            this.compressorNode.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);
            // Fresh AudioContexts default to 'suspended' until a user
            // gesture resumes them. Without this call the source would
            // be rerouted through Web Audio but produce no sound at all.
            this.resumeAudio();
            return this.gainNode;
        } catch (error: unknown) {
            // createMediaElementSource throws if called twice for the same
            // element, and AudioContext construction can fail without a
            // user gesture. Fall back gracefully — the caller will clamp
            // the visible level at 1.0.
            log.debug(`VideoViewer: AudioContext setup failed`, error);
            return null;
        }
    };

    private resumeAudio = (): void => {
        const ac = this.audioContext;
        if (!ac) return;
        if (ac.state === `suspended`) {
            void ac.resume().catch(() => {
                // Resume can be rejected if no user gesture has happened
                // yet; the next click on the player surface will pick it
                // back up because togglePlay() triggers playback which
                // counts as a gesture.
            });
        }
    };

    private setVolume = (level: number): void => {
        const v = this.videoRef.current;
        if (!v) return;
        const clamped = clampVolume(level);
        if (clamped > 1) {
            const gain = this.ensureGainNode();
            if (gain) {
                v.volume = 1;
                gain.gain.value = clamped;
            } else {
                v.volume = 1;
            }
        } else {
            v.volume = clamped;
            if (this.gainNode) this.gainNode.gain.value = 1;
        }
        if (clamped > 0 && v.muted) v.muted = false;
        // The volumechange event from setting v.volume only sees values
        // up to 1.0; push the boosted level into state directly so the
        // displayed % reflects what the user asked for.
        this.setState((s) => ({ status: { ...s.status, volume: clamped } }));
    };
    private toggleMute = (): void => {
        const v = this.videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
    };
    private setPlaybackRate = (rate: number): void => {
        const v = this.videoRef.current;
        if (!v) return;
        v.playbackRate = rate;
    };
    private togglePictureInPicture = (): void => {
        const v = this.videoRef.current;
        if (!v || !supportsPip()) return;
        if (this.state.status.pictureInPicture) {
            void document.exitPictureInPicture();
        } else {
            void v.requestPictureInPicture().catch((err: unknown) => this.handleLoadError(err));
        }
    };
    private toggleFullscreen = (): void => {
        const wrapper = this.wrapperRef.current;
        if (!wrapper) return;
        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void wrapper.requestFullscreen().catch((err: unknown) => this.handleLoadError(err));
        }
    };
    private toggleCaptions = (): void => {
        const player = this.player;
        if (!player) return;
        const tracks = this.state.textTracks;
        if (tracks.length === 0) return;
        if (this.state.status.textTracksVisible) {
            player.selectTextTrack(null);
            this.setState((s) => ({
                status: { ...s.status, textTracksVisible: false }
            }));
            return;
        }
        const matchingTrack = player.getTextTracks().find((t) => t.id === tracks[0].id);
        if (matchingTrack) player.selectTextTrack(matchingTrack);
        this.setState((s) => ({
            status: { ...s.status, textTracksVisible: true }
        }));
    };
    private selectVariant = (variantId: number | null): void => {
        const player = this.player;
        if (!player) return;
        if (variantId === null) {
            player.configure({ abr: { enabled: true } });
            this.setState({ autoVariantActive: true });
            return;
        }
        const track = player.getVariantTracks().find((t) => t.id === variantId);
        if (!track) return;
        player.configure({ abr: { enabled: false } });
        player.selectVariantTrack(track, true);
        this.setState({ autoVariantActive: false });
    };
    private selectTextTrack = (textTrackId: number | null): void => {
        const player = this.player;
        if (!player) return;
        if (textTrackId === null) {
            player.selectTextTrack(null);
            this.setState((s) => ({
                status: { ...s.status, textTracksVisible: false }
            }));
            return;
        }
        const track = player.getTextTracks().find((t) => t.id === textTrackId);
        if (!track) return;
        player.selectTextTrack(track);
        this.setState((s) => ({
            status: { ...s.status, textTracksVisible: true }
        }));
    };

    private scheduleControlsHide = (): void => {
        if (this.hideTimer !== null) clearTimeout(this.hideTimer);
        if (!this.state.status.playing) return;
        this.hideTimer = setTimeout(() => {
            if (this.cancelled) return;
            this.setState({ controlsVisible: false });
        }, CONTROL_AUTOHIDE_MS);
    };
    private showControls = (): void => {
        if (!this.state.controlsVisible) this.setState({ controlsVisible: true });
        this.scheduleControlsHide();
    };
    private handlePointerMove = (): void => this.showControls();
    private handlePointerLeave = (): void => {
        if (this.state.status.playing) this.setState({ controlsVisible: false });
    };
    private handleSurfaceClick = (e: MouseEvent<HTMLDivElement>): void => {
        if (e.target !== e.currentTarget && e.target !== this.videoRef.current) return;
        // Pick the icon BEFORE toggling: a click while playing transitions
        // into pause, so the splash should show the pause icon.
        const v = this.videoRef.current;
        const wasPlaying = v ? !v.paused : this.state.status.playing;
        this.togglePlay();
        this.flashSplash(wasPlaying ? `pause` : `play`);
    };
    private handleSurfaceDoubleClick = (e: MouseEvent<HTMLDivElement>): void => {
        if (e.target !== e.currentTarget && e.target !== this.videoRef.current) return;
        this.toggleFullscreen();
    };
    private handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
        const action = resolveVideoKeyAction(e);
        if (!action) return;
        e.preventDefault();
        switch (action.kind) {
            case `togglePlay`:
                return this.togglePlay();
            case `seekBy`:
                return this.seekBy(action.seconds);
            case `setVolumeDelta`:
                return this.setVolume(clampVolume(this.state.status.volume + action.delta));
            case `toggleMute`:
                return this.toggleMute();
            case `toggleFullscreen`:
                return this.toggleFullscreen();
            case `togglePictureInPicture`:
                return this.togglePictureInPicture();
            case `toggleCaptions`:
                return this.toggleCaptions();
            case `setPlaybackRate`: {
                const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                const i = rates.indexOf(this.state.status.playbackRate);
                const next = rates[Math.max(0, Math.min(rates.length - 1, i + action.rate))];
                return this.setPlaybackRate(next);
            }
        }
    };

    render = () => {
        const { src, mimeType, name, autoplay, muted, loop, poster, strings, className, style } =
            this.props;
        // Strings precedence: explicit prop > MowsContext translation > built-in English.
        const contextStrings = this.context?.t?.videoViewer;
        const t = { ...DEFAULT_STRINGS, ...(contextStrings ?? {}), ...strings };
        // Pass the merged strings down to the ControlBar / SeekPreview so
        // they see the same locale.
        const childStrings: Partial<VideoViewerStrings> = { ...(contextStrings ?? {}), ...strings };
        const useNative = this.state.status.nativeFallback;
        return (
            <div
                ref={this.wrapperRef}
                tabIndex={0}
                role={`region`}
                aria-label={name ?? `video`}
                style={style}
                onPointerMove={this.handlePointerMove}
                onPointerLeave={this.handlePointerLeave}
                onClick={this.handleSurfaceClick}
                onDoubleClick={this.handleSurfaceDoubleClick}
                onKeyDown={this.handleKeyDown}
                className={cn(
                    `VideoViewer relative flex h-full w-full items-center justify-center overflow-hidden bg-black select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`,
                    className
                )}
            >
                <video
                    ref={this.videoRef}
                    className={`h-full w-full object-contain`}
                    src={useNative ? src : undefined}
                    controls={useNative}
                    autoPlay={autoplay}
                    muted={muted}
                    loop={loop}
                    poster={poster}
                    playsInline
                    // Anonymous-CORS the element so `captureCurrentFrame`
                    // (canvas.drawImage(video) + toBlob) doesn't taint
                    // the canvas. Cross-origin sources that don't return
                    // CORS headers still play — the capture just fails
                    // gracefully via captureBlocked.
                    crossOrigin={`anonymous`}
                    aria-label={name ? `${name} (${mimeType})` : mimeType}
                    onTimeUpdate={this.handleTimeUpdate}
                    onLoadedMetadata={this.handleLoadedMetadata}
                    onPlay={this.handlePlay}
                    onPause={this.handlePause}
                    onVolumeChange={this.handleVolumeChange}
                    onRateChange={this.handleRateChange}
                    onEnded={this.handleEnded}
                />

                {this.state.status.buffering && !this.state.error && (
                    <div
                        className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40`}
                    >
                        <Loader2
                            className={`h-10 w-10 animate-spin text-white/85`}
                            aria-label={t.loading}
                        />
                    </div>
                )}

                {this.state.splash && (
                    <div
                        key={this.state.splashKey}
                        className={`pointer-events-none absolute inset-0 flex items-center justify-center`}
                    >
                        <div
                            // YouTube-style splash: starts small + opaque,
                            // grows to ~1.3× while fading out over 600 ms.
                            // The `onAnimationEnd` on this element clears
                            // the splash state so the same key can be
                            // re-flashed on the next click.
                            onAnimationEnd={this.clearSplash}
                            className={`flex h-20 w-20 items-center justify-center rounded-full bg-black/60 text-white`}
                            style={{
                                animation: `mows-video-splash 600ms ease-out forwards`
                            }}
                        >
                            {this.state.splash === `play` ? (
                                <Play className={`h-9 w-9 fill-white`} />
                            ) : (
                                <Pause className={`h-9 w-9 fill-white`} />
                            )}
                        </div>
                        <style>
                            {`@keyframes mows-video-splash { from { transform: scale(0.7); opacity: 0.95; } to { transform: scale(1.4); opacity: 0; } }`}
                        </style>
                    </div>
                )}

                {this.state.error && (
                    <div
                        role={`alert`}
                        className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4 text-center text-white`}
                    >
                        <AlertTriangle className={`h-8 w-8 text-red-400`} />
                        <p className={`text-sm font-medium`}>{t.errorTitle}</p>
                        <p className={`max-w-md text-xs text-white/70`}>{this.state.error}</p>
                        <Button
                            size={`sm`}
                            variant={`outline`}
                            onClick={() => this.reload(this.props.src)}
                            className={`bg-white/10 text-white hover:bg-white/20`}
                        >
                            {t.errorRetry}
                        </Button>
                    </div>
                )}

                {!useNative && (
                    <ControlBar
                        status={this.state.status}
                        variants={this.state.variants}
                        textTracks={this.state.textTracks}
                        chapters={this.props.chapters}
                        hasThumbnails={
                            this.state.imageTracks.length > 0 ||
                            isVideoMimeType(this.props.mimeType)
                        }
                        getThumbnail={this.getThumbnailAt}
                        captureCurrentFrame={this.captureCurrentFrame}
                        autoVariantActive={this.state.autoVariantActive}
                        visible={this.state.controlsVisible || !this.state.status.playing}
                        strings={childStrings}
                        onTogglePlay={this.togglePlay}
                        onSeek={this.seekTo}
                        onVolume={this.setVolume}
                        onToggleMute={this.toggleMute}
                        onSelectVariant={this.selectVariant}
                        onSelectTextTrack={this.selectTextTrack}
                        onSetPlaybackRate={this.setPlaybackRate}
                        onTogglePictureInPicture={this.togglePictureInPicture}
                        onToggleFullscreen={this.toggleFullscreen}
                    />
                )}
            </div>
        );
    };
}
