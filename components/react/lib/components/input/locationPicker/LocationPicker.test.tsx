import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../../lib/codeThemes";
import baseEn from "../../../lib/languages/en-US/default";
import { defaultMapStyles } from "../../../lib/mapStyles";
import { ActionManager } from "../../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../lib/mowsContext/MowsContext";

// LocationPicker doesn't talk to mapbox/maplibre directly — it goes
// through <Map>. Stub Map out so we can assert the picker's behaviour
// without bringing maplibre-gl into jsdom.
interface MapStub {
    onClick?: (event: { longitude: number; latitude: number }) => void;
    onLoad?: (map: unknown) => void;
}
const { mapStubs } = vi.hoisted(() => ({ mapStubs: [] as MapStub[] }));

vi.mock(`@/components/map/Map`, () => {
    const FakeMap = (props: MapStub) => {
        mapStubs.push(props);
        // Fire onLoad asynchronously the same way maplibre would, so
        // the picker's syncMarker path runs.
        queueMicrotask(() => props.onLoad?.({ /* fake map */ } as unknown));
        return <div data-testid={`map-stub`} />;
    };
    return { default: FakeMap };
});

// LocationPicker also imports loadMapbox to create the pin marker.
// Stub the loader + a fake Marker class so we can observe the marker's
// lifecycle without WebGL.
interface MarkerStub {
    lngLat: [number, number] | null;
    added: boolean;
    removed: boolean;
}
const { markers } = vi.hoisted(() => ({ markers: [] as MarkerStub[] }));

vi.mock(`@/components/map/mapboxModule`, () => {
    class FakeMarker {
        record: MarkerStub;
        constructor() {
            this.record = { lngLat: null, added: false, removed: false };
            markers.push(this.record);
        }
        setLngLat(lngLat: [number, number]) {
            this.record.lngLat = lngLat;
            return this;
        }
        addTo() {
            this.record.added = true;
            return this;
        }
        remove() {
            this.record.removed = true;
        }
    }
    return { loadMapbox: () => Promise.resolve({ Marker: FakeMarker }) };
});

import LocationPicker from "./LocationPicker";

const buildContext = (): MowsContextType => {
    const am = new ActionManager({ recentActionsStorageKey: `lp`, maxRecentActions: 5 });
    const hm = new HotkeyManager(am, { configStorageKey: `lp-hk`, defaultHotkeys: {} });
    return {
        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `lp`,
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
        mapStyles: defaultMapStyles,
        currentMapStyle: defaultMapStyles[0],
        setMapStyle: () => undefined
    } as unknown as MowsContextType;
};

const renderPicker = (props: Partial<React.ComponentProps<typeof LocationPicker>> = {}) =>
    render(
        <MowsContext.Provider value={buildContext()}>
            <LocationPicker {...props} />
        </MowsContext.Provider>
    );

describe(`<LocationPicker>`, () => {
    it(`renders the map stub and the empty-state hint`, () => {
        mapStubs.length = 0;
        markers.length = 0;
        renderPicker();
        expect(screen.getByTestId(`map-stub`)).toBeInTheDocument();
        expect(
            screen.getByText(`Click the map to pick a location`)
        ).toBeInTheDocument();
    });

    it(`uncontrolled: a map click updates the internal value and shows the readout`, () => {
        mapStubs.length = 0;
        markers.length = 0;
        renderPicker();
        const stub = mapStubs.at(-1)!;
        act(() => stub.onClick?.({ longitude: 13.4, latitude: 52.5 }));
        expect(screen.getByText(/52\.50000, 13\.40000/)).toBeInTheDocument();
    });

    it(`controlled: a map click fires onChange but leaves the visible value alone`, () => {
        mapStubs.length = 0;
        markers.length = 0;
        const onChange = vi.fn();
        renderPicker({ value: null, onChange });
        act(() => mapStubs.at(-1)!.onClick?.({ longitude: 5, latitude: 6 }));
        expect(onChange).toHaveBeenCalledWith({ longitude: 5, latitude: 6 });
        // Visible value didn't change because `value` is still null.
        expect(
            screen.getByText(`Click the map to pick a location`)
        ).toBeInTheDocument();
    });

    it(`the Clear button resets the picked value to null`, async () => {
        const user = userEvent.setup();
        mapStubs.length = 0;
        markers.length = 0;
        const onChange = vi.fn();
        renderPicker({ defaultValue: { longitude: 1, latitude: 2 }, onChange });
        await user.click(
            screen.getByRole(`button`, { name: `Clear picked location` })
        );
        expect(onChange).toHaveBeenLastCalledWith(null);
        expect(
            screen.getByText(`Click the map to pick a location`)
        ).toBeInTheDocument();
    });

    it(`mounts a pin marker on the map once the first value is set`, async () => {
        mapStubs.length = 0;
        markers.length = 0;
        renderPicker({ defaultValue: { longitude: 1, latitude: 2 } });
        // onLoad fires via queueMicrotask, then syncMarker awaits loadMapbox.
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(markers.length).toBeGreaterThanOrEqual(1);
        expect(markers[0]!.lngLat).toEqual([1, 2]);
        expect(markers[0]!.added).toBe(true);
    });
});
