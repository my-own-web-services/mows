import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import AudioPlayer from "./AudioPlayer";

// jsdom doesn't implement HTMLMediaElement.play/pause/load; stub them so the
// component's `audioEl.play()` / `audioEl.load()` calls don't throw, and so
// our tests can observe the resulting `play` / `pause` events.
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
    // The global vitest setup also stubs ResizeObserver via `vi.fn()`, but
    // the way `vi.fn()` interacts with `new` in some setups can leave `obs`
    // as the empty constructor `this` instead of the mock's return value.
    // Re-stub here with a plain class so `new ResizeObserver()` reliably
    // yields an instance whose `observe`/`disconnect` are callable.
    class StubResizeObserver {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    }
    (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
        StubResizeObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
    vi.restoreAllMocks();
});

const TEST_SRC = `https://example.test/track.mp3`;

const dispatchMediaEvent = (audio: HTMLAudioElement, type: string): void => {
    act(() => {
        audio.dispatchEvent(new Event(type));
    });
};

const fakeAudioWithDuration = (audio: HTMLAudioElement, duration: number): void => {
    Object.defineProperty(audio, `duration`, {
        configurable: true,
        value: duration
    });
    dispatchMediaEvent(audio, `loadedmetadata`);
};

describe(`AudioPlayer`, () => {
    it(`renders the bar variant by default`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const root = container.querySelector(`[data-testid="audio-player"]`);
        expect(root).toBeInTheDocument();
        expect(root).toHaveAttribute(`data-variant`, `bar`);
    });

    it(`renders the card variant when variant="card"`, () => {
        const { container } = render(
            <AudioPlayer src={TEST_SRC} variant={`card`} title={`Test`} subtitle={`Artist`} />
        );
        const root = container.querySelector(`[data-testid="audio-player"]`);
        expect(root).toHaveAttribute(`data-variant`, `card`);
        expect(screen.getByText(`Test`)).toBeInTheDocument();
        expect(screen.getByText(`Artist`)).toBeInTheDocument();
    });

    it(`shows Play when paused and Pause when playing`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);

        expect(screen.getByRole(`button`, { name: `Play` })).toBeInTheDocument();
        dispatchMediaEvent(audio, `play`);
        expect(screen.getByRole(`button`, { name: `Pause` })).toBeInTheDocument();
        dispatchMediaEvent(audio, `pause`);
        expect(screen.getByRole(`button`, { name: `Play` })).toBeInTheDocument();
    });

    it(`clicking play triggers audio.play()`, async () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        const playSpy = vi.spyOn(audio, `play`);

        await act(async () => {
            fireEvent.click(screen.getByRole(`button`, { name: `Play` }));
        });
        expect(playSpy).toHaveBeenCalledOnce();
    });

    it(`clicking mute toggles the audio element's muted flag`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);

        fireEvent.click(screen.getByRole(`button`, { name: `Mute` }));
        expect(audio.muted).toBe(true);
        // After mute, the same button is relabelled Unmute.
        fireEvent.click(screen.getByRole(`button`, { name: `Unmute` }));
        expect(audio.muted).toBe(false);
    });

    it(`renders the duration once metadata is loaded`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        fakeAudioWithDuration(audio, 75); // 1:15

        const time = container.querySelector(`[data-testid="audio-time"]`);
        expect(time?.textContent).toContain(`1:15`);
    });

    it(`Space key on the root toggles playback`, async () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        const playSpy = vi.spyOn(audio, `play`);
        const root = container.querySelector(
            `[data-testid="audio-player"]`
        ) as HTMLElement;

        root.focus();
        await act(async () => {
            fireEvent.keyDown(root, { key: ` ` });
        });
        expect(playSpy).toHaveBeenCalled();
    });

    it(`ArrowRight skips forward by the seek step`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        fakeAudioWithDuration(audio, 120);

        const root = container.querySelector(
            `[data-testid="audio-player"]`
        ) as HTMLElement;
        root.focus();
        fireEvent.keyDown(root, { key: `ArrowRight` });
        // Default skip is 5 s
        expect(audio.currentTime).toBeCloseTo(5);
    });

    it(`ArrowUp raises the volume by one step`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        act(() => {
            audio.volume = 0.5;
            audio.dispatchEvent(new Event(`volumechange`));
        });

        const root = container.querySelector(
            `[data-testid="audio-player"]`
        ) as HTMLElement;
        root.focus();
        act(() => {
            fireEvent.keyDown(root, { key: `ArrowUp` });
        });
        expect(audio.volume).toBeCloseTo(0.6);
    });

    it(`renders a waveform slider with progress=0 by default`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const wave = container.querySelector(`[data-testid="audio-waveform"]`);
        expect(wave).toBeInTheDocument();
        expect(wave).toHaveAttribute(`aria-valuenow`, `0`);
    });

    it(`accepts custom string overrides`, () => {
        render(
            <AudioPlayer
                src={TEST_SRC}
                strings={{ play: `Lecture`, mute: `Couper le son` }}
            />
        );
        expect(screen.getByRole(`button`, { name: `Lecture` })).toBeInTheDocument();
        expect(
            screen.getByRole(`button`, { name: `Couper le son` })
        ).toBeInTheDocument();
    });

    it(`surfaces an error row when the media element emits error`, () => {
        const { container } = render(<AudioPlayer src={TEST_SRC} />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        Object.defineProperty(audio, `error`, {
            configurable: true,
            value: { code: 3 } as MediaError
        });
        dispatchMediaEvent(audio, `error`);
        expect(screen.getByRole(`alert`)).toHaveTextContent(`Playback failed`);
        expect(screen.getByRole(`button`, { name: `Retry` })).toBeInTheDocument();
    });

    it(`uses provided peaks instead of the procedural waveform`, () => {
        // Two players with very different seeds should still share the same
        // bar layout if explicit peaks are passed.
        const peaks = [0.2, 0.5, 0.8, 0.4, 0.1];
        const { container: a } = render(
            <AudioPlayer src={`https://a.test/a.mp3`} peaks={peaks} />
        );
        const { container: b } = render(
            <AudioPlayer src={`https://z.test/z.mp3`} peaks={peaks} />
        );
        const aBars = a.querySelectorAll(
            `[data-testid="audio-waveform"] > span`
        );
        const bBars = b.querySelectorAll(
            `[data-testid="audio-waveform"] > span`
        );
        expect(aBars.length).toBe(peaks.length);
        expect(bBars.length).toBe(peaks.length);
    });

    it(`seeks proportionally when the waveform is clicked (regression for the explicit-peaks slack bug)`, () => {
        // Prior bug: bars used a fixed pixel width and the wrapper was
        // wider than the cumulative bar width, so clicks near the right
        // edge of the bars mapped to a ratio < 1. Now bars stretch to
        // fill the wrapper, so a click at 75 % of the wrapper width must
        // seek to 75 % of the duration regardless of the bar count.
        const { container } = render(
            <AudioPlayer src={TEST_SRC} peaks={[0.1, 0.5, 0.9, 0.4, 0.2]} />
        );
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        fakeAudioWithDuration(audio, 100);

        const wave = container.querySelector(
            `[data-testid="audio-waveform"]`
        ) as HTMLElement;
        // jsdom returns a zero-size rect by default; fake one so the seek
        // math has real bounds to project onto.
        wave.getBoundingClientRect = () => ({
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 400,
            bottom: 40,
            width: 400,
            height: 40,
            toJSON: () => undefined
        });

        // Click at 75 % of the wrapper — should seek to 75 % of 100 s = 75 s.
        act(() => {
            fireEvent.pointerDown(wave, {
                clientX: 300,
                clientY: 20,
                pointerId: 1
            });
        });
        expect(audio.currentTime).toBeCloseTo(75, 1);
    });

    it(`renders the minimal variant with a slider instead of a waveform`, () => {
        const { container } = render(
            <AudioPlayer src={TEST_SRC} variant={`minimal`} />
        );
        const root = container.querySelector(`[data-testid="audio-player"]`);
        expect(root).toHaveAttribute(`data-variant`, `minimal`);
        // Minimal variant must not render the waveform — the seek
        // affordance is a plain shadcn Slider so the visual chrome is
        // intentionally lighter.
        expect(
            container.querySelector(`[data-testid="audio-waveform"]`)
        ).toBeNull();
        // The play button + at least one slider thumb must be present.
        // Radix Slider doesn't propagate aria-label to the thumb, so we
        // count by role rather than name (the minimal variant renders
        // two thumbs: seek + volume).
        expect(screen.getByRole(`button`, { name: `Play` })).toBeInTheDocument();
        expect(screen.getAllByRole(`slider`).length).toBeGreaterThanOrEqual(1);
    });

    it(`minimal variant slider seeks the audio element when dragged`, () => {
        const { container } = render(
            <AudioPlayer src={TEST_SRC} variant={`minimal`} />
        );
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing`);
        fakeAudioWithDuration(audio, 200);

        // First slider thumb is the seek thumb (the seek slider is rendered
        // before the volume slider in the DOM). Radix doesn't expose the
        // aria-label on the thumb, so we identify by order rather than name.
        const sliders = screen.getAllByRole(`slider`);
        const seekThumb = sliders[0];
        act(() => {
            seekThumb.focus();
            fireEvent.keyDown(seekThumb, { key: `End` });
        });
        // End jumps to max — should map to ratio 1 → duration 200.
        expect(audio.currentTime).toBeCloseTo(200, 1);
    });
});
