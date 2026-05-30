import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { log } from "@/lib/logging";
import { type MowsMapStyle } from "@/lib/mapStyles";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import { Info, LocateFixed, LocateOff, Minus, Plus, X } from "lucide-react";
import type * as MapLibre from "maplibre-gl";
import * as React from "react";
import { type CSSProperties, PureComponent, createRef } from "react";
import { loadMapbox, type MapboxNamespace } from "./mapboxModule";

export interface MapView {
    readonly longitude: number;
    readonly latitude: number;
    readonly zoom?: number;
    readonly bearing?: number;
    readonly pitch?: number;
}

export interface MapProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    /**
     * Override the active style for this map instance. When omitted the
     * component subscribes to `currentMapStyle` on `MowsContext` and live
     * follows the user's pick from the settings panel.
     */
    readonly mapStyle?: MowsMapStyle;
    /** Initial camera position. Defaults to `{ 0, 0, 1 }` (world view). */
    readonly initialView?: MapView;
    /**
     * Whether the user can pan / zoom / rotate. Defaults to `true`. Set
     * `false` for static map snapshots inside cards / previews.
     */
    readonly interactive?: boolean;
    /** Sync map state into the URL hash. Defaults to `false`. */
    readonly hash?: boolean;
    /**
     * Camera projection. `globe` (default) gives the WGS84 sphere with
     * the same Mercator pan/zoom feel up close, then smoothly inflates
     * to a globe when zoomed out. `mercator` pins the classic flat
     * Web Mercator view at every zoom level. MapLibre's globe support
     * landed in v5; downgrades or styles that target Mercator-only
     * features should pass `mercator`.
     */
    readonly projection?: `globe` | `mercator`;
    /**
     * Show the custom themed zoom + compass control stack overlaid on the
     * top-right of the map. Defaults to `true`. The compass arrow points
     * red toward north and follows the live bearing; double-click resets
     * bearing + pitch to 0.
     */
    readonly showControls?: boolean;
    /**
     * Override the access token resolved from the active style. Most map
     * styles MapLibre renders don't need one, but Mapbox-hosted style
     * URLs do — pass it through here if you swap in such a style.
     */
    readonly accessToken?: string;
    /** Fired once the map's first style is fully loaded. */
    readonly onLoad?: (map: MapLibre.Map) => void;
    /** Fired whenever the camera comes to rest after a user gesture. */
    readonly onMoveEnd?: (view: MapView) => void;
    /**
     * Fired when the user clicks (taps) anywhere on the map canvas.
     * Receives the projected longitude/latitude under the pointer plus
     * the raw maplibre-gl event for callers that need pixel coordinates
     * or rendered features (e.g. `event.target.queryRenderedFeatures`).
     */
    readonly onClick?: (
        event: { longitude: number; latitude: number },
        rawEvent: MapLibre.MapMouseEvent
    ) => void;
}

interface UserLocation {
    readonly longitude: number;
    readonly latitude: number;
}

interface MapState {
    readonly status: `loading` | `ready` | `error`;
    readonly errorMessage?: string;
    /** Live bearing in degrees, updated as the user rotates the map. */
    readonly bearing: number;
    /** Live pitch in degrees, updated as the user tilts the map. */
    readonly pitch: number;
    /** Whether the geolocation watch is active. */
    readonly tracking: boolean;
    /** Most recent geolocation fix; `null` until the first reading. */
    readonly userLocation: UserLocation | null;
    /** Whether the attribution panel is expanded (vs. collapsed to an `i` icon). */
    readonly attributionOpen: boolean;
}

/**
 * Map renderer backed by MapLibre GL JS, loaded lazily on first mount so
 * the library + its CSS never enter a consumer's initial bundle.
 *
 * Without a `mapStyle` prop the component follows `currentMapStyle` from
 * `MowsContext` — switching styles in the settings panel reflows every
 * mounted Map in the app.
 */
export default class Map extends PureComponent<MapProps, MapState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    private containerRef = createRef<HTMLDivElement>();
    private map: MapLibre.Map | null = null;
    private mapboxNs: MapboxNamespace | null = null;
    private appliedStyleId: string | null = null;
    private watchId: number | null = null;
    private userMarker: MapLibre.Marker | null = null;
    // Bumped in componentWillUnmount so an in-flight initialise() still
    // awaiting the lazy maplibre chunk knows to bail. React 18 StrictMode
    // calls cDM → cWU → cDM on the SAME class instance in dev — without
    // per-call tokening, the first cDM's Map would be created after its
    // own cWU and leak beneath the second mount's Map. Symptom: compass
    // / zoom controls act on an off-screen map.
    private initToken = 0;

    state: MapState = {
        status: `loading`,
        bearing: 0,
        pitch: 0,
        tracking: false,
        userLocation: null,
        attributionOpen: false
    };

    componentDidMount = () => {
        void this.initialise();
    };

    componentDidUpdate = () => {
        // Context changes don't reach `prevProps`, so compare against the
        // last id we actually applied to the live map. This catches both
        // prop overrides and settings-panel-driven context switches.
        const nextStyle = this.activeStyle();
        if (
            this.map &&
            this.mapboxNs &&
            nextStyle &&
            nextStyle.id !== this.appliedStyleId
        ) {
            this.applyStyle(nextStyle);
        }
    };

    componentWillUnmount = () => {
        this.initToken++;
        this.stopTracking();
        if (this.userMarker) {
            this.userMarker.remove();
            this.userMarker = null;
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    };

    private activeStyle = (): MowsMapStyle | undefined => {
        return this.props.mapStyle ?? this.context?.currentMapStyle;
    };

    private resolveAccessToken = (style: MowsMapStyle): string | undefined => {
        return this.props.accessToken ?? style.accessToken;
    };

    private applyStyle = (style: MowsMapStyle) => {
        if (!this.map) return;
        this.map.setStyle(style.url as MapLibre.StyleSpecification | string);
        this.appliedStyleId = style.id;
    };

    private initialise = async () => {
        const container = this.containerRef.current;
        const style = this.activeStyle();
        if (!container || !style) {
            this.setState({
                status: `error`,
                errorMessage: !container ? `Map container missing` : `No map style available`
            });
            return;
        }

        const myToken = this.initToken;

        let mapboxNs: MapboxNamespace;
        try {
            mapboxNs = await loadMapbox();
        } catch (err) {
            log.error(`Failed to load maplibre-gl`, err);
            this.setState({
                status: `error`,
                errorMessage: (err as Error).message
            });
            return;
        }

        // Bail if componentWillUnmount ran (and bumped initToken) while
        // the maplibre chunk was loading — checking the ref alone is not
        // enough because React 18 StrictMode reuses the same class
        // instance (and its ref) across the dev-only double-mount cycle.
        if (myToken !== this.initToken || !this.containerRef.current) return;

        this.mapboxNs = mapboxNs;

        const { initialView, interactive = true, hash = false, projection = `globe` } =
            this.props;
        const token = this.resolveAccessToken(style);

        const mapOptions: MapLibre.MapOptions = {
            container,
            style: style.url as MapLibre.StyleSpecification | string,
            center: [initialView?.longitude ?? 0, initialView?.latitude ?? 0],
            zoom: initialView?.zoom ?? 1,
            bearing: initialView?.bearing ?? 0,
            pitch: initialView?.pitch ?? 0,
            interactive,
            hash,
            // MapLibre's stock attribution control fights the theme
            // (white pill on dark surfaces, custom font). We render our
            // own expandable info badge below.
            attributionControl: false
        };
        // MapLibre accepts `transformRequest` per-request token injection;
        // attach only when one is supplied so tokenless styles stay clean.
        if (token) {
            mapOptions.transformRequest = (url) => ({
                url: url.includes(`access_token=`)
                    ? url
                    : url + (url.includes(`?`) ? `&` : `?`) + `access_token=` + token
            });
        }

        try {
            this.map = new mapboxNs.Map(mapOptions);
        } catch (err) {
            log.error(`Failed to create maplibre-gl Map`, err);
            this.setState({
                status: `error`,
                errorMessage: (err as Error).message
            });
            return;
        }

        this.appliedStyleId = style.id;

        // Projection isn't a constructor option in maplibre-gl. Calling
        // setProjection() before the first style finishes loading races
        // the style-spec loader — for v8 styles without a `projection`
        // field (e.g. every OpenFreeMap style) maplibre re-applies its
        // default (mercator) once the style lands, silently flattening
        // the globe. Re-asserting on every `style.load` makes the
        // projection survive both the initial mount and any later
        // setStyle() (settings-panel style switch).
        const applyProjection = () => {
            if (!this.map) return;
            try {
                this.map.setProjection({ type: projection });
            } catch (err) {
                log.warn(`setProjection failed; falling back to mercator`, err);
            }
        };
        this.map.on(`style.load`, applyProjection);

        this.map.on(`load`, () => {
            this.setState({ status: `ready` });
            if (this.map) this.props.onLoad?.(this.map);
        });

        // `rotate` + `pitch` fire continuously during the gesture; that
        // keeps the compass arrow tracking the camera at frame rate.
        const syncOrientation = () => {
            if (!this.map) return;
            this.setState({
                bearing: this.map.getBearing(),
                pitch: this.map.getPitch()
            });
        };
        this.map.on(`rotate`, syncOrientation);
        this.map.on(`pitch`, syncOrientation);

        this.map.on(`moveend`, () => {
            if (!this.map) return;
            const center = this.map.getCenter();
            this.props.onMoveEnd?.({
                longitude: center.lng,
                latitude: center.lat,
                zoom: this.map.getZoom(),
                bearing: this.map.getBearing(),
                pitch: this.map.getPitch()
            });
        });

        this.map.on(`click`, (event) => {
            this.props.onClick?.(
                { longitude: event.lngLat.lng, latitude: event.lngLat.lat },
                event
            );
        });

        this.map.on(`error`, (event) => {
            // maplibre-gl emits soft errors (e.g. failed tile request)
            // that should not flip the whole component into an error
            // state. Just log; the user can pan/zoom to retry.
            log.warn(`maplibre-gl error`, event.error);
        });
    };

    private handleZoomIn = () => {
        this.map?.zoomIn();
    };

    private handleZoomOut = () => {
        this.map?.zoomOut();
    };

    private handleCompassReset = () => {
        this.map?.easeTo({ bearing: 0, pitch: 0 });
    };

    private startTracking = () => {
        if (!(`geolocation` in navigator)) {
            log.warn(`navigator.geolocation unavailable; cannot start tracking`);
            return;
        }
        if (this.watchId !== null) return;
        this.setState({ tracking: true });
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const next: UserLocation = {
                    longitude: position.coords.longitude,
                    latitude: position.coords.latitude
                };
                const hadFix = this.state.userLocation !== null;
                this.setState({ userLocation: next });
                this.updateUserMarker(next);
                // First fix → fly there. Subsequent fixes just slide the
                // marker so the user isn't yanked off course while
                // exploring.
                if (!hadFix && this.map) {
                    this.map.flyTo({
                        center: [next.longitude, next.latitude],
                        zoom: Math.max(this.map.getZoom(), 14)
                    });
                }
            },
            (err) => {
                log.warn(`geolocation watchPosition failed`, err);
                this.stopTracking();
            },
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );
    };

    private stopTracking = () => {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        if (this.userMarker) {
            this.userMarker.remove();
            this.userMarker = null;
        }
        // Keep the last fix around so re-enabling shows the dot
        // instantly, but flip the tracking flag back off.
        this.setState({ tracking: false });
    };

    private handleToggleTracking = () => {
        const { tracking, userLocation } = this.state;
        if (tracking) {
            // Active + have a fix → recenter; no fix yet → cancel.
            if (userLocation && this.map) {
                this.map.flyTo({
                    center: [userLocation.longitude, userLocation.latitude],
                    zoom: Math.max(this.map.getZoom(), 14)
                });
                return;
            }
            this.stopTracking();
            return;
        }
        this.startTracking();
    };

    private updateUserMarker = (location: UserLocation) => {
        if (!this.map || !this.mapboxNs) return;
        const lngLat: [number, number] = [location.longitude, location.latitude];
        if (this.userMarker) {
            this.userMarker.setLngLat(lngLat);
            return;
        }
        // Themed dot: primary fill + ring. We hand-roll the element so it
        // picks up the same `bg-primary` / `border-background` tokens the
        // rest of the UI uses (instead of MapLibre's default blue dot).
        const el = document.createElement(`div`);
        el.className = `h-3 w-3 rounded-full bg-primary border-2 border-background shadow-md`;
        el.setAttribute(`aria-label`, `Your location`);
        this.userMarker = new this.mapboxNs.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(this.map);
    };

    private toggleAttribution = () => {
        this.setState((s) => ({ attributionOpen: !s.attributionOpen }));
    };

    render = () => {
        const { className, style, showControls = true } = this.props;
        const {
            status,
            errorMessage,
            bearing,
            pitch,
            tracking,
            userLocation,
            attributionOpen
        } = this.state;
        const activeStyle = this.activeStyle();

        return (
            <div
                className={cn(
                    `MowsMap relative h-full w-full overflow-hidden rounded-md`,
                    className
                )}
                style={style}
            >
                <div
                    ref={this.containerRef}
                    data-testid={`mows-map-container`}
                    className={`h-full w-full`}
                />

                {showControls && status === `ready` && (
                    <div
                        className={`absolute right-2 top-2 z-10 flex flex-col gap-1`}
                        // Stop map drag/click hand-off so the buttons feel
                        // like first-class UI, not transparent overlays.
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onContextMenu={(e) => e.stopPropagation()}
                    >
                        <Button
                            variant={`secondary`}
                            size={`icon`}
                            onClick={this.handleZoomIn}
                            title={`Zoom in`}
                            aria-label={`Zoom in`}
                            className={`h-8 w-8 shadow-md hover:bg-accent hover:text-accent-foreground`}
                        >
                            <Plus className={`h-4 w-4`} />
                        </Button>
                        <Button
                            variant={`secondary`}
                            size={`icon`}
                            onClick={this.handleZoomOut}
                            title={`Zoom out`}
                            aria-label={`Zoom out`}
                            className={`h-8 w-8 shadow-md hover:bg-accent hover:text-accent-foreground`}
                        >
                            <Minus className={`h-4 w-4`} />
                        </Button>
                        <Button
                            variant={`secondary`}
                            size={`icon`}
                            onClick={this.handleCompassReset}
                            title={`Reset bearing to north`}
                            aria-label={`Compass — reset bearing to north`}
                            className={`h-8 w-8 shadow-md hover:bg-accent hover:text-accent-foreground`}
                        >
                            <CompassRose bearing={bearing} pitch={pitch} />
                        </Button>
                        <Button
                            variant={`secondary`}
                            size={`icon`}
                            onClick={this.handleToggleTracking}
                            // Right-click while tracking is the "stop"
                            // gesture (omniviv pattern). Plain left-click
                            // recenters if we already have a fix.
                            onContextMenu={(e) => {
                                if (tracking) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    this.stopTracking();
                                }
                            }}
                            aria-pressed={tracking}
                            title={
                                tracking
                                    ? userLocation
                                        ? `Recenter on your location (right-click to stop)`
                                        : `Waiting for location fix… (right-click to stop)`
                                    : `Show your location`
                            }
                            aria-label={
                                tracking ? `Recenter on your location` : `Show your location`
                            }
                            className={`h-8 w-8 shadow-md hover:bg-accent hover:text-accent-foreground`}
                        >
                            {tracking ? (
                                <LocateFixed
                                    className={cn(
                                        `h-4 w-4`,
                                        userLocation
                                            ? `text-primary`
                                            : `text-muted-foreground animate-pulse`
                                    )}
                                />
                            ) : (
                                <LocateOff className={`h-4 w-4`} />
                            )}
                        </Button>
                    </div>
                )}

                {status === `ready` && activeStyle?.attribution && (
                    <div
                        className={`absolute bottom-2 right-2 z-10 flex items-center gap-1`}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {attributionOpen && (
                            <div
                                className={`rounded-sm border bg-background/90 px-2 py-1 text-[10px] leading-tight text-muted-foreground shadow-sm backdrop-blur-sm max-w-[60vw]`}
                                role={`note`}
                                aria-label={`Map attribution`}
                            >
                                {activeStyle.attribution}
                            </div>
                        )}
                        {/*
                          Size + iconography matches the top-right control
                          stack (h-8 w-8 with h-4 w-4 icons). Keeps the
                          right edge aligned with that column — both
                          wrappers anchor at `right-2`, so equal button
                          widths put their right edges on the same line
                          while the attribution button stays pinned to
                          the bottom corner.
                        */}
                        <Button
                            variant={`secondary`}
                            size={`icon`}
                            onClick={this.toggleAttribution}
                            aria-expanded={attributionOpen}
                            aria-label={
                                attributionOpen ? `Hide map attribution` : `Show map attribution`
                            }
                            title={
                                attributionOpen ? `Hide map attribution` : `Show map attribution`
                            }
                            className={`h-8 w-8 shadow-md hover:bg-accent hover:text-accent-foreground`}
                        >
                            {attributionOpen ? (
                                <X className={`h-4 w-4`} />
                            ) : (
                                <Info className={`h-4 w-4`} />
                            )}
                        </Button>
                    </div>
                )}

                {status === `loading` && (
                    <Skeleton
                        aria-hidden
                        className={`absolute inset-0 h-full w-full rounded-md`}
                    />
                )}
                {status === `error` && (
                    <div
                        role={`alert`}
                        className={`absolute inset-0 flex items-center justify-center bg-background/90 p-4 text-center text-sm text-destructive`}
                    >
                        {errorMessage ?? `Map failed to load`}
                    </div>
                )}
            </div>
        );
    };
}

interface CompassRoseProps {
    readonly bearing: number;
    readonly pitch: number;
}

/**
 * Two-triangle compass rose. The red triangle always points to true
 * north (the icon rotates by `-bearing` so its visible tip swings to
 * compensate for the map's heading); the primary-coloured triangle
 * marks south. `rotateX(${pitch}deg)` gives the rose a 3D tilt that
 * mirrors the camera pitch — a quiet but legible "you are looking at
 * the world this way" cue, copied from the omniviv pattern.
 */
const CompassRose = ({ bearing, pitch }: CompassRoseProps) => (
    <svg
        className={`h-4 w-4`}
        viewBox={`0 0 24 24`}
        style={{
            transform: `rotateX(${pitch}deg) rotate(${-bearing}deg)`,
            transition: `transform 60ms linear`
        }}
        aria-hidden
    >
        <polygon points={`12,2 8,12 16,12`} className={`fill-red-500`} />
        <polygon points={`12,22 8,12 16,12`} className={`fill-primary`} />
    </svg>
);
