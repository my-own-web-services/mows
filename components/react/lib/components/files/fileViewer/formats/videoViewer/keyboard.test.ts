import { describe, expect, it } from "vitest";
import { formatTimestamp, resolveVideoKeyAction, type KeyBindingInput } from "./keyboard";

const press = (key: string, modifiers: Partial<KeyBindingInput> = {}): KeyBindingInput => ({
    key,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...modifiers
});

describe(`resolveVideoKeyAction`, () => {
    it(`maps space and k to togglePlay`, () => {
        expect(resolveVideoKeyAction(press(` `))).toEqual({ kind: `togglePlay` });
        expect(resolveVideoKeyAction(press(`k`))).toEqual({ kind: `togglePlay` });
        expect(resolveVideoKeyAction(press(`K`))).toEqual({ kind: `togglePlay` });
    });
    it(`maps arrow left / right to ±5 second seek`, () => {
        expect(resolveVideoKeyAction(press(`ArrowLeft`))).toEqual({
            kind: `seekBy`,
            seconds: -5
        });
        expect(resolveVideoKeyAction(press(`ArrowRight`))).toEqual({
            kind: `seekBy`,
            seconds: 5
        });
    });
    it(`maps arrow up / down to ±0.1 volume delta`, () => {
        expect(resolveVideoKeyAction(press(`ArrowUp`))).toEqual({
            kind: `setVolumeDelta`,
            delta: 0.1
        });
        expect(resolveVideoKeyAction(press(`ArrowDown`))).toEqual({
            kind: `setVolumeDelta`,
            delta: -0.1
        });
    });
    it(`maps m, f, p, c to their respective toggles`, () => {
        expect(resolveVideoKeyAction(press(`m`))).toEqual({ kind: `toggleMute` });
        expect(resolveVideoKeyAction(press(`f`))).toEqual({ kind: `toggleFullscreen` });
        expect(resolveVideoKeyAction(press(`p`))).toEqual({ kind: `togglePictureInPicture` });
        expect(resolveVideoKeyAction(press(`c`))).toEqual({ kind: `toggleCaptions` });
    });
    it(`returns null when modifier keys are held (browser shortcuts win)`, () => {
        // Without this guard, Cmd+F (find page) would be hijacked by fullscreen.
        expect(resolveVideoKeyAction(press(`f`, { metaKey: true }))).toBeNull();
        expect(resolveVideoKeyAction(press(` `, { ctrlKey: true }))).toBeNull();
        expect(resolveVideoKeyAction(press(`m`, { altKey: true }))).toBeNull();
    });
    it(`returns null for unmapped keys`, () => {
        expect(resolveVideoKeyAction(press(`Tab`))).toBeNull();
        expect(resolveVideoKeyAction(press(`Enter`))).toBeNull();
        expect(resolveVideoKeyAction(press(`a`))).toBeNull();
    });
});

describe(`formatTimestamp`, () => {
    it(`formats sub-hour durations as M:SS`, () => {
        expect(formatTimestamp(0)).toBe(`0:00`);
        expect(formatTimestamp(5)).toBe(`0:05`);
        expect(formatTimestamp(65)).toBe(`1:05`);
        expect(formatTimestamp(3599)).toBe(`59:59`);
    });
    it(`formats hour-or-longer durations as H:MM:SS`, () => {
        expect(formatTimestamp(3600)).toBe(`1:00:00`);
        expect(formatTimestamp(3661)).toBe(`1:01:01`);
        expect(formatTimestamp(86399)).toBe(`23:59:59`);
    });
    it(`handles non-finite / negative input safely`, () => {
        expect(formatTimestamp(Number.NaN)).toBe(`0:00`);
        expect(formatTimestamp(-12)).toBe(`0:00`);
        expect(formatTimestamp(Number.POSITIVE_INFINITY)).toBe(`0:00`);
    });
});
