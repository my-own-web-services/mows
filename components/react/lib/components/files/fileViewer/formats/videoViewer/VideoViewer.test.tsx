import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom doesn't implement HTMLMediaElement.play/pause/load; stub them so the
// component's `videoEl.play()` / `videoEl.load()` calls don't throw.
beforeAll(() => {
    Object.defineProperty(HTMLMediaElement.prototype, `play`, {
        configurable: true,
        value: vi.fn(async function play(this: HTMLMediaElement) {
            this.dispatchEvent(new Event(`play`));
        })
    });
    Object.defineProperty(HTMLMediaElement.prototype, `pause`, {
        configurable: true,
        value: vi.fn(function pause(this: HTMLMediaElement) {
            this.dispatchEvent(new Event(`pause`));
        })
    });
    Object.defineProperty(HTMLMediaElement.prototype, `load`, {
        configurable: true,
        value: vi.fn()
    });
});

interface MockPlayer {
    attach: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    getVariantTracks: ReturnType<typeof vi.fn>;
    getTextTracks: ReturnType<typeof vi.fn>;
    getConfiguration: ReturnType<typeof vi.fn>;
    configure: ReturnType<typeof vi.fn>;
    selectVariantTrack: ReturnType<typeof vi.fn>;
    selectTextTrack: ReturnType<typeof vi.fn>;
}

// Tests claim the latest constructed player here. Sharing module-level state
// like this is what lets the per-test `vi.mock` factory return a fresh
// player and lets the test reach in to inspect it.
const playerInstances: MockPlayer[] = [];
const isShakaSupported = vi.fn(() => true);
const ensurePolyfills = vi.fn();
const PlayerCtor = vi.fn(() => {
    const player: MockPlayer = {
        attach: vi.fn(async () => undefined),
        load: vi.fn(async () => undefined),
        destroy: vi.fn(async () => undefined),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getVariantTracks: vi.fn(() => []),
        getTextTracks: vi.fn(() => []),
        getConfiguration: vi.fn(() => ({ abr: { enabled: true } })),
        configure: vi.fn(),
        selectVariantTrack: vi.fn(),
        selectTextTrack: vi.fn()
    };
    playerInstances.push(player);
    return player;
});

vi.mock(`./shakaModule`, () => ({
    ensurePolyfills,
    isShakaSupported,
    shaka: {
        Player: PlayerCtor,
        util: { Error: class ShakaError extends Error {} }
    }
}));

// Import lazily so the mock above is established first.
const importVideoViewer = async () => (await import(`./VideoViewer`)).default;

beforeEach(() => {
    playerInstances.length = 0;
    isShakaSupported.mockReturnValue(true);
    PlayerCtor.mockClear();
    ensurePolyfills.mockClear();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe(`VideoViewer`, () => {
    it(`installs Shaka polyfills and constructs one Player per mount`, async () => {
        const VideoViewer = await importVideoViewer();
        render(<VideoViewer src={`https://example.test/clip.mp4`} mimeType={`video/mp4`} />);
        await waitFor(() => {
            expect(ensurePolyfills).toHaveBeenCalledTimes(1);
            expect(PlayerCtor).toHaveBeenCalledTimes(1);
            expect(playerInstances[0].attach).toHaveBeenCalled();
            expect(playerInstances[0].load).toHaveBeenCalledWith(
                `https://example.test/clip.mp4`
            );
        });
    });

    it(`uses native <video controls> when Shaka is not supported`, async () => {
        isShakaSupported.mockReturnValue(false);
        const VideoViewer = await importVideoViewer();
        const { container } = render(
            <VideoViewer src={`https://example.test/clip.mp4`} mimeType={`video/mp4`} />
        );
        expect(PlayerCtor).not.toHaveBeenCalled();
        const video = container.querySelector(`video`)!;
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute(`controls`);
        // No custom control bar should render in native fallback mode.
        expect(screen.queryByRole(`toolbar`)).not.toBeInTheDocument();
    });

    it(`re-uses the same Player when src changes and calls load() again`, async () => {
        const VideoViewer = await importVideoViewer();
        const { rerender } = render(
            <VideoViewer src={`https://example.test/a.mp4`} mimeType={`video/mp4`} />
        );
        await waitFor(() => expect(playerInstances).toHaveLength(1));
        const player = playerInstances[0];
        await waitFor(() =>
            expect(player.load).toHaveBeenCalledWith(`https://example.test/a.mp4`)
        );

        rerender(<VideoViewer src={`https://example.test/b.mp4`} mimeType={`video/mp4`} />);
        await waitFor(() => {
            expect(player.load).toHaveBeenCalledWith(`https://example.test/b.mp4`);
            // No additional player constructed on src change.
            expect(playerInstances).toHaveLength(1);
            expect(PlayerCtor).toHaveBeenCalledTimes(1);
        });
    });

    it(`destroys the Player on unmount`, async () => {
        const VideoViewer = await importVideoViewer();
        const { unmount } = render(
            <VideoViewer src={`https://example.test/clip.mp4`} mimeType={`video/mp4`} />
        );
        await waitFor(() => expect(playerInstances).toHaveLength(1));
        const player = playerInstances[0];
        unmount();
        expect(player.destroy).toHaveBeenCalled();
    });

    it(`renders the custom control bar when Shaka is supported`, async () => {
        const VideoViewer = await importVideoViewer();
        render(<VideoViewer src={`https://example.test/clip.mp4`} mimeType={`video/mp4`} />);
        await waitFor(() => {
            // The ControlBar uses role="toolbar"
            expect(screen.getByRole(`toolbar`)).toBeInTheDocument();
        });
    });

    it(`Play/Pause control toggles HTMLMediaElement state`, async () => {
        const VideoViewer = await importVideoViewer();
        const { container } = render(
            <VideoViewer src={`https://example.test/clip.mp4`} mimeType={`video/mp4`} />
        );
        const video = container.querySelector(`video`)!;
        const playBtn = await screen.findByRole(`button`, { name: /^Play$/i });
        await act(async () => {
            fireEvent.click(playBtn);
        });
        expect(video.play).toHaveBeenCalled();
        // After the synthetic `play` event fires from our stub, the button
        // re-labels to "Pause".
        await screen.findByRole(`button`, { name: /^Pause$/i });
    });

    it(`Mute button toggles the underlying video.muted property`, async () => {
        const VideoViewer = await importVideoViewer();
        const { container } = render(
            <VideoViewer src={`https://example.test/clip.mp4`} mimeType={`video/mp4`} />
        );
        const video = container.querySelector(`video`)!;
        expect(video.muted).toBe(false);
        const muteBtn = await screen.findByRole(`button`, { name: /^Mute$/i });
        await act(async () => {
            fireEvent.click(muteBtn);
        });
        expect(video.muted).toBe(true);
        await screen.findByRole(`button`, { name: /^Unmute$/i });
    });

    it(`Spacebar keypress on the wrapper toggles play/pause`, async () => {
        // QA-19: the previous version only asserted that Space → play. We
        // need the second half — Space → pause — so a regression where the
        // handler always calls play() doesn't slip past.
        const VideoViewer = await importVideoViewer();
        const { container } = render(
            <VideoViewer src={`https://example.test/clip.mp4`} mimeType={`video/mp4`} />
        );
        const wrapper = container.querySelector(`.VideoViewer`)!;
        const video = container.querySelector(`video`)!;

        await act(async () => {
            fireEvent.keyDown(wrapper, { key: ` `, code: `Space` });
        });
        expect(video.play).toHaveBeenCalled();

        // Force the element into the playing state so the toggle resolves
        // to "pause" instead of being a second `play()` call.
        Object.defineProperty(video, `paused`, { configurable: true, value: false });
        await act(async () => {
            fireEvent.keyDown(wrapper, { key: ` `, code: `Space` });
        });
        expect(video.pause).toHaveBeenCalled();
    });
});
