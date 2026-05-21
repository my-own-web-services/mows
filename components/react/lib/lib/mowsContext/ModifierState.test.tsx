import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NO_MODIFIERS } from "./ActionManager";
import { __resetModifierStateForTests, useModifierState } from "./ModifierState";

const fire = (type: `keydown` | `keyup`, init: KeyboardEventInit) => {
    act(() => {
        window.dispatchEvent(new KeyboardEvent(type, init));
    });
};

describe(`useModifierState`, () => {
    afterEach(() => {
        __resetModifierStateForTests();
    });

    it(`starts at NO_MODIFIERS`, () => {
        const { result } = renderHook(() => useModifierState());
        expect(result.current).toEqual(NO_MODIFIERS);
    });

    it(`reflects Shift held`, () => {
        const { result } = renderHook(() => useModifierState());
        fire(`keydown`, { key: `Shift`, shiftKey: true });
        expect(result.current.shift).toBe(true);
        fire(`keyup`, { key: `Shift`, shiftKey: false });
        expect(result.current.shift).toBe(false);
    });

    it(`tracks composite chords (Shift + Alt)`, () => {
        const { result } = renderHook(() => useModifierState());
        fire(`keydown`, { key: `Shift`, shiftKey: true });
        fire(`keydown`, { key: `Alt`, shiftKey: true, altKey: true });
        expect(result.current).toEqual({
            shift: true,
            alt: true,
            ctrl: false,
            meta: false
        });
    });

    it(`resets to NO_MODIFIERS on window blur`, () => {
        const { result } = renderHook(() => useModifierState());
        fire(`keydown`, { key: `Shift`, shiftKey: true });
        expect(result.current.shift).toBe(true);
        act(() => {
            window.dispatchEvent(new Event(`blur`));
        });
        expect(result.current).toEqual(NO_MODIFIERS);
    });

    it(`re-renders subscribers when modifiers change`, () => {
        let renderCount = 0;
        renderHook(() => {
            renderCount++;
            return useModifierState();
        });
        const initialRenders = renderCount;
        fire(`keydown`, { key: `Shift`, shiftKey: true });
        expect(renderCount).toBeGreaterThan(initialRenders);
    });
});
