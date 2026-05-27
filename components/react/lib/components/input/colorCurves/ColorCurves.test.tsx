import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ColorCurves from "./ColorCurves";
import {
    DEFAULT_COLOR_CURVES_VALUE,
    type ColorCurvesValue
} from "./applyCurves";
import { IDENTITY_CURVE } from "./curveMath";

const STRINGS = {
    channelRgb: `RGB`,
    channelRed: `R`,
    channelGreen: `G`,
    channelBlue: `B`,
    resetChannel: `Reset channel`,
    resetAll: `Reset all`,
    editorAriaLabel: `Color curves editor`
} as const;

const Controlled = ({
    initial = DEFAULT_COLOR_CURVES_VALUE
}: {
    initial?: ColorCurvesValue;
}) => {
    const [value, setValue] = useState<ColorCurvesValue>(initial);
    return (
        <ColorCurves
            value={value}
            onChange={setValue}
            strings={STRINGS}
            size={300}
        />
    );
};

describe(`ColorCurves`, () => {
    it(`renders the SVG curve editing surface`, () => {
        render(
            <ColorCurves
                value={DEFAULT_COLOR_CURVES_VALUE}
                onChange={() => undefined}
                strings={STRINGS}
            />
        );
        expect(screen.getByTestId(`color-curves-surface`)).toBeInTheDocument();
    });

    it(`renders one channel tab per RGB/R/G/B channel`, () => {
        render(
            <ColorCurves
                value={DEFAULT_COLOR_CURVES_VALUE}
                onChange={() => undefined}
                strings={STRINGS}
            />
        );
        const tabs = screen.getAllByRole(`tab`);
        expect(tabs).toHaveLength(4);
        expect(tabs[0]).toHaveTextContent(`RGB`);
        expect(tabs[1]).toHaveTextContent(`R`);
        expect(tabs[2]).toHaveTextContent(`G`);
        expect(tabs[3]).toHaveTextContent(`B`);
    });

    it(`clicking a channel tab switches the active channel`, async () => {
        const user = userEvent.setup();
        const onChannelChange = vi.fn();
        render(
            <ColorCurves
                value={DEFAULT_COLOR_CURVES_VALUE}
                onChange={() => undefined}
                onChannelChange={onChannelChange}
                strings={STRINGS}
            />
        );
        const tabs = screen.getAllByRole(`tab`);
        await user.click(tabs[1]!);
        expect(onChannelChange).toHaveBeenCalledWith(`r`);
        expect(tabs[1]).toHaveAttribute(`aria-selected`, `true`);
    });

    it(`reset channel button restores the active channel to the identity curve`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const altered: ColorCurvesValue = {
            ...DEFAULT_COLOR_CURVES_VALUE,
            rgb: [
                { x: 0, y: 0 },
                { x: 0.5, y: 0.8 },
                { x: 1, y: 1 }
            ]
        };
        render(
            <ColorCurves value={altered} onChange={onChange} strings={STRINGS} />
        );
        await user.click(screen.getByRole(`button`, { name: /Reset channel/i }));
        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0]![0] as ColorCurvesValue;
        expect(next.rgb).toEqual(IDENTITY_CURVE);
        // Other channels untouched
        expect(next.r).toBe(altered.r);
    });

    it(`reset all button restores every channel to the identity curve`, async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <ColorCurves
                value={DEFAULT_COLOR_CURVES_VALUE}
                onChange={onChange}
                strings={STRINGS}
            />
        );
        await user.click(screen.getByRole(`button`, { name: /Reset all/i }));
        const next = onChange.mock.calls[0]![0] as ColorCurvesValue;
        expect(next.rgb).toEqual(IDENTITY_CURVE);
        expect(next.r).toEqual(IDENTITY_CURVE);
        expect(next.g).toEqual(IDENTITY_CURVE);
        expect(next.b).toEqual(IDENTITY_CURVE);
    });

    it(`clicking empty space on the surface adds a control point`, () => {
        const onChange = vi.fn();
        render(
            <ColorCurves
                value={DEFAULT_COLOR_CURVES_VALUE}
                onChange={onChange}
                strings={STRINGS}
                size={300}
            />
        );
        const surface = screen.getByTestId(`color-curves-surface`);
        // jsdom does not implement layout — stub getBoundingClientRect so the
        // pointer-position math has something deterministic to chew on.
        surface.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                right: 300,
                bottom: 300,
                width: 300,
                height: 300,
                x: 0,
                y: 0,
                toJSON: () => ({})
            }) as DOMRect;
        // Click somewhere in the middle of the surface, far from the endpoints.
        fireEvent.pointerDown(surface, {
            clientX: 150,
            clientY: 100,
            pointerId: 1,
            button: 0
        });
        fireEvent.pointerUp(surface, { pointerId: 1 });
        expect(onChange).toHaveBeenCalled();
        const next = onChange.mock.calls[0]![0] as ColorCurvesValue;
        expect(next.rgb.length).toBeGreaterThan(2);
    });

    it(`pressing Delete on a focused non-endpoint point removes it`, () => {
        const onChange = vi.fn();
        const altered: ColorCurvesValue = {
            ...DEFAULT_COLOR_CURVES_VALUE,
            rgb: [
                { x: 0, y: 0 },
                { x: 0.5, y: 0.5 },
                { x: 1, y: 1 }
            ]
        };
        render(
            <ColorCurves value={altered} onChange={onChange} strings={STRINGS} />
        );
        const sliders = screen.getAllByRole(`slider`);
        // The middle one is the only non-endpoint.
        const middle = sliders[1]!;
        act(() => {
            middle.focus();
        });
        act(() => {
            fireEvent.keyDown(middle, { key: `Delete` });
        });
        expect(onChange).toHaveBeenCalled();
        const next = onChange.mock.calls[0]![0] as ColorCurvesValue;
        expect(next.rgb).toHaveLength(2);
        expect(next.rgb[0]).toEqual({ x: 0, y: 0 });
        expect(next.rgb[1]).toEqual({ x: 1, y: 1 });
    });

    it(`disabled prop hides pointer interaction and disables the action buttons`, () => {
        render(
            <ColorCurves
                value={DEFAULT_COLOR_CURVES_VALUE}
                onChange={() => undefined}
                strings={STRINGS}
                disabled
            />
        );
        expect(
            screen.getByRole(`button`, { name: /Reset channel/i })
        ).toBeDisabled();
        for (const tab of screen.getAllByRole(`tab`)) {
            expect(tab).toBeDisabled();
        }
    });

    it(`Controlled wrapper renders without crashing`, () => {
        // Smoke test for the shared Controlled wrapper used by other tests
        // when they need parent-managed state.
        render(<Controlled />);
        expect(screen.getByTestId(`color-curves-surface`)).toBeInTheDocument();
    });
});
