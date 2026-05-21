// Pure key-binding logic. Receives the raw event + current state and returns
// an action descriptor; the component decides how to apply it. Splitting
// this out makes the bindings unit-testable without rendering React.

export type VideoKeyAction =
    | { kind: `togglePlay` }
    | { kind: `seekBy`; seconds: number }
    | { kind: `setVolumeDelta`; delta: number }
    | { kind: `toggleMute` }
    | { kind: `toggleFullscreen` }
    | { kind: `setPlaybackRate`; rate: number }
    | { kind: `togglePictureInPicture` }
    | { kind: `toggleCaptions` };

const SEEK_SECONDS = 5;
const VOLUME_STEP = 0.1;

export interface KeyBindingInput {
    readonly key: string;
    readonly shiftKey: boolean;
    readonly metaKey: boolean;
    readonly ctrlKey: boolean;
    readonly altKey: boolean;
}

export const resolveVideoKeyAction = (event: KeyBindingInput): VideoKeyAction | null => {
    // Browser-native shortcuts (Cmd+F / Ctrl+F find page, Cmd+R reload, …)
    // must keep working; never claim modified key combinations.
    if (event.metaKey || event.ctrlKey || event.altKey) return null;
    switch (event.key) {
        case ` `:
        case `Spacebar`:
        case `k`:
        case `K`:
            return { kind: `togglePlay` };
        case `ArrowLeft`:
            return { kind: `seekBy`, seconds: -SEEK_SECONDS };
        case `ArrowRight`:
            return { kind: `seekBy`, seconds: SEEK_SECONDS };
        case `ArrowUp`:
            return { kind: `setVolumeDelta`, delta: VOLUME_STEP };
        case `ArrowDown`:
            return { kind: `setVolumeDelta`, delta: -VOLUME_STEP };
        case `m`:
        case `M`:
            return { kind: `toggleMute` };
        case `f`:
        case `F`:
            return { kind: `toggleFullscreen` };
        case `p`:
        case `P`:
            return { kind: `togglePictureInPicture` };
        case `c`:
        case `C`:
            return { kind: `toggleCaptions` };
        case `<`:
            return { kind: `setPlaybackRate`, rate: -1 };
        case `>`:
            return { kind: `setPlaybackRate`, rate: 1 };
        default:
            return null;
    }
};

const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_MINUTE = 60;

export const formatTimestamp = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return `0:00`;
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / SECONDS_IN_HOUR);
    const minutes = Math.floor((totalSeconds % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE);
    const remainingSeconds = totalSeconds % SECONDS_IN_MINUTE;
    const minutesText = hours > 0 ? String(minutes).padStart(2, `0`) : String(minutes);
    const secondsText = String(remainingSeconds).padStart(2, `0`);
    return hours > 0 ? `${hours}:${minutesText}:${secondsText}` : `${minutesText}:${secondsText}`;
};
