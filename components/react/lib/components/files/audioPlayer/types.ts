export interface AudioPlayerStrings {
    readonly play: string;
    readonly pause: string;
    readonly mute: string;
    readonly unmute: string;
    readonly volume: string;
    readonly seek: string;
    readonly seekTo: string;
    readonly skipBackward: string;
    readonly skipForward: string;
    readonly playbackRate: string;
    readonly download: string;
    readonly errorTitle: string;
    readonly errorRetry: string;
    readonly loading: string;
    readonly waveform: string;
}

export const DEFAULT_AUDIO_PLAYER_STRINGS: AudioPlayerStrings = {
    play: `Play`,
    pause: `Pause`,
    mute: `Mute`,
    unmute: `Unmute`,
    volume: `Volume`,
    seek: `Seek`,
    seekTo: `Seek to`,
    skipBackward: `Skip backward`,
    skipForward: `Skip forward`,
    playbackRate: `Playback speed`,
    download: `Download`,
    errorTitle: `Playback failed`,
    errorRetry: `Retry`,
    loading: `Loading…`,
    waveform: `Waveform`
};

export const AUDIO_PLAYBACK_RATES: ReadonlyArray<number> = [
    0.75, 1, 1.25, 1.5, 1.75, 2
];

export type AudioPlayerVariant = `bar` | `card` | `minimal`;

export const formatAudioTimestamp = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return `0:00`;
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, `0`)}:${s.toString().padStart(2, `0`)}`;
    }
    return `${m}:${s.toString().padStart(2, `0`)}`;
};
