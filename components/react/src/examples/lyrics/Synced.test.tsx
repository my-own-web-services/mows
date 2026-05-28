import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import SyncedModule from "./Synced";

// Stub HTMLMediaElement so the example's <audio> doesn't throw when its
// imperative `play`/`load` are called by the AudioPlayer ref. jsdom does
// not implement these.
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
    // jsdom doesn't implement scrollTo; the Lyrics auto-scroll path
    // calls it on the inner container, so stub it.
    Object.defineProperty(HTMLElement.prototype, `scrollTo`, {
        configurable: true,
        value: vi.fn()
    });
});

describe(`<SyncedExample>`, () => {
    it(`drives the audio element's currentTime when a lyric line is clicked`, () => {
        // This is the canonical demo other MOWS frontends will copy.
        // The integration contract: clicking a line invokes
        // AudioPlayerHandle.seekTo through `playerRef`, which writes
        // the timestamp into `audio.currentTime`. A regression in
        // either side (Lyrics' onSeek wiring or AudioPlayer's handle)
        // breaks this wiring without any unit test catching it.
        const { container } = render(<SyncedModule.Example />);
        const audio = container.querySelector(`audio`);
        if (!audio) throw new Error(`audio element missing from example`);
        // Fake duration so AudioPlayer's clamp doesn't reject the seek.
        Object.defineProperty(audio, `duration`, {
            configurable: true,
            value: 240
        });
        act(() => {
            audio.dispatchEvent(new Event(`loadedmetadata`));
        });

        // Find a known line — "I was praying to the lord for some fun"
        // is at 01:09.76 → 69.76 s in the bundled LRC.
        const line = screen
            .getAllByTestId(`lyrics-line`)
            .find((l) =>
                l.textContent?.includes(`I was praying to the lord for some fun`)
            );
        if (!line) throw new Error(`expected lyric line missing`);
        act(() => {
            fireEvent.click(line);
        });
        expect(audio.currentTime).toBeCloseTo(69.76, 1);
    });
});
