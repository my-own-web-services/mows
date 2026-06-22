import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import { type MowsMapStyle } from "../../../lib/mapStyles";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";
import MapStylePicker from "./MapStylePicker";

const STYLES: MowsMapStyle[] = [
    { id: `light-tiles`, name: `Light Tiles`, url: `https://example/light.json`, mode: `light` },
    { id: `dark-tiles`, name: `Dark Tiles`, url: `https://example/dark.json`, mode: `dark` },
    { id: `satellite`, name: `Satellite`, url: `https://example/satellite.json` }
];

const buildContext = (setMapStyle = vi.fn()): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `t`, maxRecentActions: 5 });
    const hm = new HotkeyManager(am, { configStorageKey: `t-hk`, defaultHotkeys: {} });
    return {
        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: () => Promise.resolve(),
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        t: baseEn,
        currentLanguage: undefined,
        themes: [],
        languages: [],
        actionManager: am,
        hotkeyManager: hm,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined,
        mapStyles: STYLES,
        currentMapStyle: STYLES[0],
        setMapStyle,
        currentTemperatureUnit: `celsius`,
        setTemperatureUnit: () => undefined
    } as unknown as MowsContextType;
};

describe(`MapStylePicker`, () => {
    it(`lists every map style in standalone mode`, () => {
        render(
            <MowsContext.Provider value={buildContext()}>
                <MapStylePicker standalone />
            </MowsContext.Provider>
        );
        expect(screen.getByText(`Light Tiles`)).toBeInTheDocument();
        expect(screen.getByText(`Dark Tiles`)).toBeInTheDocument();
        expect(screen.getByText(`Satellite`)).toBeInTheDocument();
    });

    it(`fires setMapStyle on the surrounding context when a style is picked`, async () => {
        const user = userEvent.setup();
        const setMapStyle = vi.fn();
        render(
            <MowsContext.Provider value={buildContext(setMapStyle)}>
                <MapStylePicker standalone />
            </MowsContext.Provider>
        );
        await user.click(screen.getByText(`Dark Tiles`));
        expect(setMapStyle).toHaveBeenCalledWith(STYLES[1]);
    });

    it(`renders the popover trigger with the current map style by default`, () => {
        render(
            <MowsContext.Provider value={buildContext()}>
                <MapStylePicker />
            </MowsContext.Provider>
        );
        const trigger = screen.getByTitle(baseEn.mapStylePicker.selectMapStyle);
        expect(trigger).toHaveTextContent(`Light Tiles`);
    });
});
