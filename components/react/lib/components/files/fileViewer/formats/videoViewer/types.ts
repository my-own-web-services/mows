// Plain shapes the ControlBar consumes. Keeping these decoupled from the
// shaka.extern.* types means the bar can be rendered with synthetic data in
// tests/Storybook without dragging the full shaka type graph in.

export interface VariantOption {
    /** Stable id from shaka — used to call `selectVariantTrack(track)`. */
    readonly id: number;
    readonly height: number | null;
    readonly width: number | null;
    readonly bandwidth: number;
    readonly label: string;
    readonly active: boolean;
}

export interface TextTrackOption {
    readonly id: number;
    readonly language: string;
    readonly label: string;
    readonly kind: string;
    readonly active: boolean;
}

export interface ImageTrackOption {
    readonly id: number;
    readonly width: number | null;
    readonly height: number | null;
    readonly bandwidth: number;
}

/**
 * A single thumbnail returned by Shaka's `player.getThumbnails`. We project
 * the player's `shaka.extern.Thumbnail` into this plain shape so consumers
 * (e.g. tests, alternative renderers) don't have to depend on shaka types.
 */
export interface ThumbnailFrame {
    readonly uri: string;
    /** Rendered thumbnail tile dimensions in CSS pixels. */
    readonly width: number;
    readonly height: number;
    /** True when the URI is a sprite sheet — `positionX/Y` + `imageWidth/Height` describe the tile crop. */
    readonly sprite: boolean;
    readonly positionX: number;
    readonly positionY: number;
    /** Source sprite-sheet dimensions in CSS pixels (only meaningful when `sprite` is true). */
    readonly imageWidth: number;
    readonly imageHeight: number;
    /** Start time and duration of the thumbnail's coverage window, in seconds. */
    readonly startTime: number;
    readonly duration: number;
}

export type ThumbnailFetcher = (timeSeconds: number) => Promise<ThumbnailFrame | null>;

/**
 * A single chapter / section of a video, YouTube-style. Chapters are sorted
 * by `startTime` before being rendered. `endTime` is optional — when
 * omitted, the chapter is treated as extending to the next chapter's start
 * (or to the clip's duration for the last one). The id is only used as a
 * React key; consumers may reuse it freely.
 */
export interface Chapter {
    readonly id: string;
    readonly title: string;
    readonly startTime: number;
    readonly endTime?: number;
}

/** Helper: find which chapter contains `time`. Assumes `chapters` is sorted
 * ascending by `startTime`. Returns the matching chapter or null when the
 * time falls outside every chapter (e.g. before the first one's start). */
export const chapterAt = (
    chapters: ReadonlyArray<Chapter>,
    time: number,
    durationSeconds: number
): Chapter | null => {
    if (chapters.length === 0) return null;
    for (let i = 0; i < chapters.length; i++) {
        const c = chapters[i];
        const end = c.endTime ?? chapters[i + 1]?.startTime ?? durationSeconds;
        if (time >= c.startTime && time < end) return c;
    }
    // Past the last chapter's end — treat as last chapter rather than null
    // so the tooltip never goes blank at the very end of the clip.
    return chapters[chapters.length - 1];
};

export interface PlayerStatus {
    readonly playing: boolean;
    readonly buffering: boolean;
    readonly currentTime: number;
    readonly duration: number;
    readonly volume: number;
    readonly muted: boolean;
    readonly playbackRate: number;
    readonly fullscreen: boolean;
    readonly pictureInPicture: boolean;
    /** True iff this session is using the native `<video controls>` fallback. */
    readonly nativeFallback: boolean;
    readonly textTracksVisible: boolean;
}

export const PLAYBACK_RATES: ReadonlyArray<number> = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export interface VideoViewerStrings {
    readonly play: string;
    readonly pause: string;
    readonly mute: string;
    readonly unmute: string;
    readonly volume: string;
    readonly seek: string;
    /** Tooltip prefix on the seek-bar preview, e.g. "Seek to 1:23". The
     * timestamp itself is appended after a single space. */
    readonly seekTo: string;
    readonly quality: string;
    readonly qualityAuto: string;
    readonly captions: string;
    readonly captionsOff: string;
    readonly playbackRate: string;
    readonly pictureInPicture: string;
    readonly fullscreen: string;
    readonly exitFullscreen: string;
    readonly errorTitle: string;
    readonly errorRetry: string;
    readonly loading: string;
}

export const DEFAULT_STRINGS: VideoViewerStrings = {
    play: `Play`,
    pause: `Pause`,
    mute: `Mute`,
    unmute: `Unmute`,
    volume: `Volume`,
    seek: `Seek`,
    seekTo: `Seek to`,
    quality: `Quality`,
    qualityAuto: `Auto`,
    captions: `Subtitles`,
    captionsOff: `Off`,
    playbackRate: `Playback speed`,
    pictureInPicture: `Picture in picture`,
    fullscreen: `Enter fullscreen`,
    exitFullscreen: `Exit fullscreen`,
    errorTitle: `Playback failed`,
    errorRetry: `Retry`,
    loading: `Loading…`
};
