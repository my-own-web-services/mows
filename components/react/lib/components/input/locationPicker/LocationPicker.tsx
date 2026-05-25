import Map, { type MapView } from "@/components/map/Map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type * as MapLibre from "maplibre-gl";
import { loadMapbox } from "@/components/map/mapboxModule";
import { MapPin, X } from "lucide-react";
import * as React from "react";
import { type CSSProperties, PureComponent, createRef } from "react";
import { MowsContext } from "@/lib/mowsContext/MowsContext";

// Marker palette — a fixed vivid fill that pops on any map tile, plus a
// halo whose tone flips with the active style. `text-primary` (the
// previous setup) inherited the theme accent, which on a dark theme + a
// dark map style left the marker indistinguishable from the canvas. A
// fixed amber-with-contrasting-outline reads cleanly on light tiles
// (cream / sand / paper styles) AND on dark tiles (satellite, dark
// basemaps) without depending on what the consuming app picks for its
// theme accent.
const MARKER_FILL = `#f59e0b`; // amber-500
const MARKER_HALO_FOR_LIGHT_MAP = `#0a0a0a`; // dark outline against bright tiles
const MARKER_HALO_FOR_DARK_MAP = `#ffffff`; // light outline against dark tiles

const buildMarkerSvg = (mapMode: `dark` | `light` | undefined): string => {
    const halo = mapMode === `dark` ? MARKER_HALO_FOR_DARK_MAP : MARKER_HALO_FOR_LIGHT_MAP;
    // `paint-order="stroke"` paints the halo first so the fill stays a
    // crisp amber teardrop rather than getting blended into the halo at
    // the seam.
    return `<svg viewBox="0 0 24 24" class="h-7 w-7 drop-shadow" aria-hidden="true" data-map-mode="${mapMode ?? `light`}"><path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 12 8 12s8-6.5 8-12a8 8 0 0 0-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="${MARKER_FILL}" stroke="${halo}" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke"/></svg>`;
};

export interface PickedLocation {
    readonly longitude: number;
    readonly latitude: number;
}

export interface LocationPickerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Controlled value — the currently selected point, or `null` for none. */
    readonly value?: PickedLocation | null;
    /** Uncontrolled seed. Ignored when `value` is set. */
    readonly defaultValue?: PickedLocation | null;
    /** Fired with the new point each time the user clicks the map or clears. */
    readonly onChange?: (next: PickedLocation | null) => void;
    /** Initial camera. Defaults to the world view. */
    readonly initialView?: MapView;
    /** Whether to show a "Clear selection" button when a point is picked. */
    readonly clearable?: boolean;
    /** Fixed height for the embedded map. Defaults to `400px`. */
    readonly height?: number | string;
}

interface LocationPickerState {
    readonly internal: PickedLocation | null;
}

/**
 * Form-style location input. Wraps `<Map>` and turns map clicks into a
 * single picked point; renders a themed pin marker at the selection.
 *
 * Controlled (`value` + `onChange`) and uncontrolled (`defaultValue`)
 * usage are both supported. A small readout strip below the map shows
 * the resolved longitude / latitude rounded to 5 decimals (≈ 1 m) so
 * callers can copy the value without inspecting React state.
 */
export default class LocationPicker extends PureComponent<
    LocationPickerProps,
    LocationPickerState
> {
    // `currentMapStyle.mode` is the signal the marker SVG keys off. Reading
    // it via the static contextType keeps the picker re-rendering whenever
    // the user swaps map styles in the settings panel.
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    private mapRef = createRef<MapLibre.Map>();
    private marker: MapLibre.Marker | null = null;
    // Held alongside the Marker so a style-mode change can repaint the
    // SVG in place without ripping the marker off the map.
    private markerEl: HTMLDivElement | null = null;

    constructor(props: LocationPickerProps) {
        super(props);
        this.state = { internal: props.defaultValue ?? null };
    }

    componentDidMount = () => {
        if (this.props.value !== undefined) {
            void this.syncMarker(this.props.value);
        } else if (this.state.internal) {
            void this.syncMarker(this.state.internal);
        }
    };

    componentDidUpdate = (prevProps: LocationPickerProps) => {
        // Marker position update.
        const current = this.activeValue();
        const previous =
            prevProps.value !== undefined ? prevProps.value : this.state.internal;
        if (current?.longitude !== previous?.longitude || current?.latitude !== previous?.latitude) {
            void this.syncMarker(current);
        }

        // Marker appearance update. Triggered by a context change since
        // PureComponent still re-renders on consumed-context changes; we
        // repaint the existing element's SVG in place rather than
        // tearing the Marker down.
        const desired = buildMarkerSvg(this.context?.currentMapStyle?.mode);
        if (this.markerEl && this.markerEl.innerHTML !== desired) {
            this.markerEl.innerHTML = desired;
        }
    };

    componentWillUnmount = () => {
        if (this.marker) {
            this.marker.remove();
            this.marker = null;
        }
        this.markerEl = null;
    };

    private activeValue = (): PickedLocation | null => {
        return this.props.value !== undefined ? this.props.value : this.state.internal;
    };

    private handleMapLoad = (map: MapLibre.Map) => {
        // Stash the live map so syncMarker can attach the pin once the
        // first style is up. Don't use a Marker before this fires — the
        // map's `getContainer()` would race against the canvas being
        // mounted, which yields an off-by-one pixel position.
        (this.mapRef as { current: MapLibre.Map | null }).current = map;
        const seed = this.activeValue();
        if (seed) void this.syncMarker(seed);
    };

    private handleMapClick = (event: PickedLocation) => {
        if (this.props.value === undefined) {
            this.setState({ internal: event });
        }
        this.props.onChange?.(event);
    };

    private handleClear = () => {
        if (this.props.value === undefined) {
            this.setState({ internal: null });
        }
        this.props.onChange?.(null);
    };

    private syncMarker = async (next: PickedLocation | null) => {
        const map = this.mapRef.current;
        if (!map) return;
        if (!next) {
            if (this.marker) {
                this.marker.remove();
                this.marker = null;
                this.markerEl = null;
            }
            return;
        }
        const lngLat: [number, number] = [next.longitude, next.latitude];
        if (this.marker) {
            this.marker.setLngLat(lngLat);
            return;
        }
        const mapboxNs = await loadMapbox();
        // Map may have unmounted while we were waiting for the chunk.
        if (this.mapRef.current !== map) return;
        const el = document.createElement(`div`);
        el.className = `flex h-7 w-7 items-center justify-center`;
        el.innerHTML = buildMarkerSvg(this.context?.currentMapStyle?.mode);
        this.markerEl = el;
        // Anchor `bottom` so the tip of the pin sits at the picked
        // coordinates, not its centroid.
        this.marker = new mapboxNs.Marker({ element: el, anchor: `bottom` })
            .setLngLat(lngLat)
            .addTo(map);
    };

    render = () => {
        const { className, style, height = 400, clearable = true, initialView } = this.props;
        const value = this.activeValue();

        const view: MapView = value
            ? {
                  longitude: value.longitude,
                  latitude: value.latitude,
                  zoom: initialView?.zoom ?? 6,
                  bearing: initialView?.bearing,
                  pitch: initialView?.pitch
              }
            : initialView ?? { longitude: 0, latitude: 0, zoom: 1 };

        return (
            <div
                className={cn(`LocationPicker flex w-full flex-col gap-2`, className)}
                style={style}
            >
                <div
                    className={`w-full overflow-hidden rounded-md border`}
                    style={{ height }}
                >
                    <Map
                        initialView={view}
                        onLoad={this.handleMapLoad}
                        onClick={this.handleMapClick}
                    />
                </div>
                <div
                    className={`flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm`}
                >
                    <div className={`flex min-w-0 items-center gap-2`}>
                        <MapPin className={`h-4 w-4 shrink-0 text-primary`} aria-hidden />
                        {value ? (
                            <span className={`truncate font-mono text-xs`}>
                                {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
                            </span>
                        ) : (
                            <span className={`text-muted-foreground`}>
                                Click the map to pick a location
                            </span>
                        )}
                    </div>
                    {clearable && value && (
                        <Button
                            variant={`ghost`}
                            size={`sm`}
                            onClick={this.handleClear}
                            aria-label={`Clear picked location`}
                        >
                            <X className={`h-4 w-4`} />
                        </Button>
                    )}
                </div>
            </div>
        );
    };
}
