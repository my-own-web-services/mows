import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCodeThemes } from "../../lib/codeThemes";
import baseEn from "../../lib/languages/en-US/default";
import { defaultMapStyles, type MowsMapStyle } from "../../lib/mapStyles";
import { ActionManager } from "../../lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../lib/mowsContext/MowsContext";

interface MapMock {
    constructorArgs: { transformRequest?: (url: string) => { url: string } } & Record<string, unknown>;
    listeners: Map<string, (event?: unknown) => void>;
    setStyleCalls: unknown[];
    setProjectionCalls: unknown[];
    removed: boolean;
    bearing: number;
    pitch: number;
    zoomCalls: { dir: `in` | `out` }[];
    easeToCalls: unknown[];
    flyToCalls: unknown[];
    on(name: string, fn: (event?: unknown) => void): MapMock;
    setStyle(style: unknown): void;
    setProjection(projection: unknown): void;
    remove(): void;
    fire(name: string, event?: unknown): void;
    getCenter(): { lng: number; lat: number };
    getZoom(): number;
    getBearing(): number;
    getPitch(): number;
    zoomIn(): void;
    zoomOut(): void;
    easeTo(args: { bearing?: number; pitch?: number }): void;
    flyTo(args: unknown): void;
}

interface MarkerMock {
    element: HTMLElement;
    lngLat: [number, number] | null;
    added: boolean;
    removed: boolean;
}

// vi.mock is hoisted above all top-level declarations, so module-scope
// arrays declared with `const` would be in the TDZ when the factory
// first runs. vi.hoisted() runs eagerly with the mock setup, sidestepping
// the issue and giving the test body access to the same arrays.
const { mapInstances, markerInstances } = vi.hoisted(() => {
    return {
        mapInstances: [] as MapMock[],
        markerInstances: [] as MarkerMock[]
    };
});

vi.mock(`./mapboxModule`, () => {
    class FakeMap {
        constructorArgs: MapMock[`constructorArgs`];
        listeners: Map<string, (event?: unknown) => void>;
        setStyleCalls: unknown[];
        removed: boolean;
        bearing: number;
        pitch: number;
        zoomCalls: { dir: `in` | `out` }[];
        easeToCalls: unknown[];
        flyToCalls: unknown[];
        setProjectionCalls: unknown[];
        constructor(args: MapMock[`constructorArgs`]) {
            this.constructorArgs = args;
            this.listeners = new Map();
            this.setStyleCalls = [];
            this.setProjectionCalls = [];
            this.removed = false;
            this.bearing = 0;
            this.pitch = 0;
            this.zoomCalls = [];
            this.easeToCalls = [];
            this.flyToCalls = [];
            mapInstances.push(this as unknown as MapMock);
        }
        on(name: string, fn: (event?: unknown) => void) {
            this.listeners.set(name, fn);
            return this;
        }
        setStyle(style: unknown) {
            this.setStyleCalls.push(style);
        }
        setProjection(projection: unknown) {
            this.setProjectionCalls.push(projection);
        }
        remove() {
            this.removed = true;
        }
        fire(name: string, event?: unknown) {
            this.listeners.get(name)?.(event);
        }
        getCenter() {
            return { lng: 1, lat: 2 };
        }
        getZoom() {
            return 3;
        }
        getBearing() {
            return this.bearing;
        }
        getPitch() {
            return this.pitch;
        }
        zoomIn() {
            this.zoomCalls.push({ dir: `in` });
        }
        zoomOut() {
            this.zoomCalls.push({ dir: `out` });
        }
        easeTo(args: { bearing?: number; pitch?: number }) {
            this.easeToCalls.push(args);
        }
        flyTo(args: unknown) {
            this.flyToCalls.push(args);
        }
    }
    class FakeMarker {
        record: MarkerMock;
        constructor(opts: { element: HTMLElement }) {
            this.record = {
                element: opts.element,
                lngLat: null,
                added: false,
                removed: false
            };
            markerInstances.push(this.record);
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
    return { loadMapbox: () => Promise.resolve({ Map: FakeMap, Marker: FakeMarker }) };
});

import MowsMap from "./Map";

const buildContext = (
    overrides: Partial<MowsContextType> = {}
): MowsContextType => {
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
        mapStyles: defaultMapStyles,
        currentMapStyle: defaultMapStyles[0],
        setMapStyle: () => undefined,
        ...overrides
    } as unknown as MowsContextType;
};

type MowsMapProps = React.ComponentProps<typeof MowsMap>;

const renderMap = (props: Partial<MowsMapProps> = {}, context?: MowsContextType) =>
    render(
        <MowsContext.Provider value={context ?? buildContext()}>
            <MowsMap {...props} />
        </MowsContext.Provider>
    );

const waitForReady = async () => {
    await waitFor(() => expect(mapInstances).toHaveLength(1));
    // Mirror maplibre's real event order — `style.load` fires before
    // `load` so the projection has been re-asserted by the time the
    // component flips into the `ready` state.
    act(() => mapInstances[0]!.fire(`style.load`));
    act(() => mapInstances[0]!.fire(`load`));
};

describe(`<Map>`, () => {
    afterEach(() => {
        mapInstances.length = 0;
        markerInstances.length = 0;
    });

    it(`shows a loading skeleton until the lazy chunk resolves`, () => {
        const { container } = renderMap();
        expect(container.querySelector(`.animate-pulse`)).not.toBeNull();
    });

    it(`instantiates a maplibre-gl Map with the context's current style by default`, async () => {
        renderMap();
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        const cfg = mapInstances[0]!.constructorArgs as { style: unknown };
        expect(cfg.style).toBe(defaultMapStyles[0].url);
    });

    it(`uses the explicit mapStyle prop over the context value when provided`, async () => {
        const explicit: MowsMapStyle = {
            id: `explicit`,
            name: `Explicit`,
            url: `https://example.com/explicit.json`
        };
        renderMap({ mapStyle: explicit });
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        const cfg = mapInstances[0]!.constructorArgs as { style: unknown };
        expect(cfg.style).toBe(explicit.url);
    });

    it(`installs a transformRequest that appends the active style's accessToken`, async () => {
        const tokened: MowsMapStyle = {
            id: `tokened`,
            name: `Tokened`,
            url: `https://api.mapbox.com/styles/v1/example/foo`,
            accessToken: `pk.test_token`
        };
        renderMap({ mapStyle: tokened });
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        const transform = mapInstances[0]!.constructorArgs.transformRequest;
        expect(transform).toBeTypeOf(`function`);
        const { url } = transform!(`https://api.mapbox.com/v4/tiles/0/0/0.png`);
        expect(url).toContain(`access_token=pk.test_token`);
    });

    it(`calls setStyle when the context's current map style changes`, async () => {
        const ctxA = buildContext();
        const { rerender } = render(
            <MowsContext.Provider value={ctxA}>
                <MowsMap />
            </MowsContext.Provider>
        );
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        const ctxB = buildContext({ currentMapStyle: defaultMapStyles[1] });
        rerender(
            <MowsContext.Provider value={ctxB}>
                <MowsMap />
            </MowsContext.Provider>
        );
        await waitFor(() => expect(mapInstances[0]!.setStyleCalls).toHaveLength(1));
        expect(mapInstances[0]!.setStyleCalls[0]).toBe(defaultMapStyles[1].url);
    });

    it(`fires onLoad once the underlying map emits "load"`, async () => {
        const onLoad = vi.fn();
        renderMap({ onLoad });
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        act(() => mapInstances[0]!.fire(`load`));
        expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it(`fires onMoveEnd with the current camera on moveend`, async () => {
        const onMoveEnd = vi.fn();
        renderMap({ onMoveEnd });
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        act(() => mapInstances[0]!.fire(`moveend`));
        expect(onMoveEnd).toHaveBeenCalledWith({
            longitude: 1,
            latitude: 2,
            zoom: 3,
            bearing: 0,
            pitch: 0
        });
    });

    it(`calls map.remove() on unmount`, async () => {
        const { unmount } = renderMap();
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        unmount();
        expect(mapInstances[0]!.removed).toBe(true);
    });

    it(`renders themed zoom + compass controls once the map is ready`, async () => {
        renderMap();
        await waitForReady();
        // Buttons are aria-labelled, so they show up via role queries.
        expect(await screen.findByRole(`button`, { name: `Zoom in` })).toBeInTheDocument();
        expect(screen.getByRole(`button`, { name: `Zoom out` })).toBeInTheDocument();
        expect(
            screen.getByRole(`button`, { name: /Compass/ })
        ).toBeInTheDocument();
    });

    it(`hides the controls when showControls is false`, async () => {
        renderMap({ showControls: false });
        await waitForReady();
        expect(screen.queryByRole(`button`, { name: `Zoom in` })).toBeNull();
    });

    it(`clicking zoom buttons calls the corresponding maplibre methods`, async () => {
        const user = userEvent.setup();
        renderMap();
        await waitForReady();
        await user.click(await screen.findByRole(`button`, { name: `Zoom in` }));
        await user.click(screen.getByRole(`button`, { name: `Zoom out` }));
        expect(mapInstances[0]!.zoomCalls).toEqual([{ dir: `in` }, { dir: `out` }]);
    });

    it(`clicking the compass eases the camera back to bearing+pitch 0`, async () => {
        const user = userEvent.setup();
        renderMap();
        await waitForReady();
        const compass = await screen.findByRole(`button`, { name: /Compass/ });
        await user.click(compass);
        expect(mapInstances[0]!.easeToCalls).toEqual([{ bearing: 0, pitch: 0 }]);
    });

    it(`hides the attribution text until the info button is clicked`, async () => {
        const user = userEvent.setup();
        renderMap();
        await waitForReady();
        // Collapsed: text is absent, info icon button is present.
        expect(screen.queryByText(defaultMapStyles[0].attribution!)).toBeNull();
        const info = await screen.findByRole(`button`, {
            name: `Show map attribution`
        });
        await user.click(info);
        // Expanded: text is visible, button label flips to "Hide".
        expect(
            await screen.findByText(defaultMapStyles[0].attribution!)
        ).toBeInTheDocument();
        expect(
            screen.getByRole(`button`, { name: `Hide map attribution` })
        ).toBeInTheDocument();
    });

    it(`renders the attribution button at the same size as the other control buttons`, async () => {
        renderMap();
        await waitForReady();
        // The top-right column anchors the canonical button size; the
        // bottom-right attribution button must match exactly so the two
        // columns line up on the right edge.
        const reference = screen.getByRole(`button`, { name: `Zoom in` });
        const attribution = screen.getByRole(`button`, {
            name: `Show map attribution`
        });
        const refSize = [...reference.classList].filter((c) => /^(h|w)-/.test(c));
        const attrSize = [...attribution.classList].filter((c) => /^(h|w)-/.test(c));
        expect(attrSize.sort()).toEqual(refSize.sort());
        expect(attrSize).toContain(`h-8`);
        expect(attrSize).toContain(`w-8`);
    });

    it(`keeps the map control buttons fully opaque on hover with a visible feedback colour`, async () => {
        renderMap();
        await waitForReady();
        // The shadcn `secondary` variant ships `hover:bg-secondary/80`,
        // which makes the button background 80% opaque on hover. Over
        // the map canvas that bleed-through reads as "the button just
        // vanished" — wrong for overlay controls. Every map button must
        // pin its hover to a solid accent colour (tailwind-merge
        // resolves the conflict in favour of the later class).
        const names = [
            `Zoom in`,
            `Zoom out`,
            `Compass — reset bearing to north`,
            `Show your location`,
            `Show map attribution`
        ];
        for (const name of names) {
            const btn = screen.getByRole(`button`, { name });
            const hoverBg = [...btn.classList].filter(
                (c) => c.startsWith(`hover:bg-`)
            );
            // Exactly one hover:bg-* survives merging — and it must be
            // an opaque colour (no `/N` opacity suffix) and a different
            // colour than the default so hovering produces visible
            // feedback.
            expect(hoverBg).toEqual([`hover:bg-accent`]);
            expect(btn.classList).toContain(`hover:text-accent-foreground`);
        }
    });

    it(`defaults the camera to globe projection on style.load`, async () => {
        renderMap();
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        // No projection call until the style fires `style.load` — calling
        // setProjection before the v8 style finishes loading races the
        // style-spec loader and gets clobbered back to mercator.
        expect(mapInstances[0]!.setProjectionCalls).toEqual([]);
        act(() => mapInstances[0]!.fire(`style.load`));
        expect(mapInstances[0]!.setProjectionCalls).toEqual([{ type: `globe` }]);
    });

    it(`switches to mercator projection when explicitly requested`, async () => {
        renderMap({ projection: `mercator` });
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        act(() => mapInstances[0]!.fire(`style.load`));
        expect(mapInstances[0]!.setProjectionCalls).toEqual([{ type: `mercator` }]);
    });

    it(`re-applies the projection on every subsequent style.load`, async () => {
        // Settings-panel style switch fires setStyle, which fires another
        // style.load. The flat-map regression that motivated this test
        // was exactly that the projection wasn't re-asserted on the
        // second style.load, so a switch from Liberty → Dark dropped
        // back to mercator silently.
        renderMap();
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        act(() => mapInstances[0]!.fire(`style.load`));
        act(() => mapInstances[0]!.fire(`style.load`));
        expect(mapInstances[0]!.setProjectionCalls).toEqual([
            { type: `globe` },
            { type: `globe` }
        ]);
    });

    it(`disables maplibre's native attribution control`, async () => {
        renderMap();
        await waitFor(() => expect(mapInstances).toHaveLength(1));
        expect(
            mapInstances[0]!.constructorArgs.attributionControl
        ).toBe(false);
    });

    it(`renders the location-toggle button in the "off" state initially`, async () => {
        renderMap();
        await waitForReady();
        const btn = await screen.findByRole(`button`, {
            name: `Show your location`
        });
        expect(btn).toHaveAttribute(`aria-pressed`, `false`);
    });

    it(`clicking the location button starts a geolocation watch and flies to the first fix`, async () => {
        const user = userEvent.setup();
        const watchPosition = vi.fn(
            (success: PositionCallback) => {
                queueMicrotask(() =>
                    success({
                        coords: {
                            longitude: 13.4,
                            latitude: 52.5,
                            accuracy: 5,
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null,
                            speed: null
                        },
                        timestamp: Date.now()
                    } as GeolocationPosition)
                );
                return 42;
            }
        );
        const clearWatch = vi.fn();
        Object.defineProperty(navigator, `geolocation`, {
            value: { watchPosition, clearWatch },
            configurable: true
        });

        renderMap();
        await waitForReady();
        await user.click(await screen.findByRole(`button`, { name: `Show your location` }));
        expect(watchPosition).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(mapInstances[0]!.flyToCalls).toHaveLength(1));
        expect(mapInstances[0]!.flyToCalls[0]).toEqual({
            center: [13.4, 52.5],
            zoom: 14
        });
        // Marker is mounted on the map with the new fix.
        expect(markerInstances).toHaveLength(1);
        expect(markerInstances[0]!.lngLat).toEqual([13.4, 52.5]);
        expect(markerInstances[0]!.added).toBe(true);
    });

    it(`right-clicking the location button while tracking stops the watch`, async () => {
        const user = userEvent.setup();
        const watchPosition = vi.fn(() => 99);
        const clearWatch = vi.fn();
        Object.defineProperty(navigator, `geolocation`, {
            value: { watchPosition, clearWatch },
            configurable: true
        });
        renderMap();
        await waitForReady();
        const btn = await screen.findByRole(`button`, { name: `Show your location` });
        await user.click(btn);
        // While tracking the button's name flips.
        const tracking = await screen.findByRole(`button`, {
            name: `Recenter on your location`
        });
        await user.pointer({ keys: `[MouseRight]`, target: tracking });
        expect(clearWatch).toHaveBeenCalledWith(99);
    });

    it(`the compass SVG rotates with the live bearing`, async () => {
        const { container } = renderMap();
        await waitForReady();
        const inst = mapInstances[0]!;
        inst.bearing = 90;
        act(() => inst.fire(`rotate`));
        await waitFor(() => {
            const svg = container.querySelector(`button[aria-label^="Compass"] svg`) as SVGElement | null;
            expect(svg).not.toBeNull();
            // -bearing because the rose visually swings to compensate
            // for the camera heading.
            expect(svg!.getAttribute(`style`)).toMatch(/rotate\(-90deg\)/);
        });
    });
});
