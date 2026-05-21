import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";
import {
    MarkersPlugin,
    type MarkerConfig,
    type SelectMarkerEvent
} from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/markers-plugin/index.css";
import { PureComponent, type CSSProperties, createRef } from "react";
import { Skeleton } from "../../../../ui/skeleton";
import { cn } from "../../../../../lib/utils";

/**
 * Marker configuration accepted by `<Image360Viewer>`.
 *
 * **SECURITY:** Photo Sphere Viewer's `MarkerConfig` supports `html`
 * and `tooltip.content` fields that the plugin renders verbatim into
 * the DOM. If you feed user-controlled metadata into these fields, you
 * MUST sanitise it first (DOMPurify is the usual choice) — otherwise a
 * malicious marker payload becomes a stored-XSS sink. For untrusted
 * content prefer image markers (`image`) or polygon markers with plain
 * text tooltips; only use `html`/`tooltip.content` for hard-coded UI.
 */
export type Image360ViewerMarker = MarkerConfig;

export interface Image360ViewerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly src: string;
    readonly alt?: string;
    /**
     * Photo Sphere Viewer "navbar" config. `false` hides it (default),
     * `true` shows the default bar, or pass an array of button ids.
     */
    readonly navbar?: boolean | string[];
    /**
     * Initial zoom level 0..100, where 0 maps to `maxFov` (widest) and 100
     * maps to `minFov` (tightest). Default keeps the initial FOV close to
     * Photo Sphere Viewer's stock 90°.
     */
    readonly defaultZoomLvl?: number;
    /** Tightest allowed field of view, in degrees. Default 10°. */
    readonly minFov?: number;
    /** Widest allowed field of view, in degrees. Default 140°. */
    readonly maxFov?: number;
    /**
     * Fired whenever the viewer's yaw changes. Receives the bearing in
     * degrees [0, 360) — PSV's yaw (radians) converted to degrees — so the
     * value can be fed straight into a `Compass`.
     */
    readonly onHeadingChange?: (degrees: number) => void;
    /**
     * Optional markers / hotspots / waypoints overlaid on the sphere.
     * Backed by `@photo-sphere-viewer/markers-plugin` — accepts HTML
     * markers, image markers, polygon overlays, and tooltips. Markers
     * have an `id`, a position (`{ yaw, pitch }` or `{ textureX,
     * textureY }`), and an optional `data` payload that's echoed back on
     * `onMarkerClick`.
     *
     * Updating this prop diff-replaces the live marker set via
     * `setMarkers`, so virtual-tour-style navigation between scenes works
     * by swapping `src` AND the marker list at the same time.
     */
    readonly markers?: ReadonlyArray<Image360ViewerMarker>;
    /**
     * Fired when the user clicks one of the rendered markers. Receives
     * the original marker config plus its `data` payload (typed `unknown`
     * — consumers cast to their own waypoint shape). Use this to swap
     * `src` to another panorama, route to a different page, open an
     * info panel, etc.
     */
    readonly onMarkerClick?: (marker: Image360ViewerMarker) => void;
    /**
     * Enable Photo Sphere Viewer's post-drag inertial glide so panning
     * keeps moving for a beat after the pointer releases. Default
     * `false` — most documentation use cases prefer a snappy 1:1
     * pointer-to-yaw mapping. Flip to `true` for cinematic walkthroughs
     * where smooth deceleration reads better.
     */
    readonly smoothTransitions?: boolean;
    /**
     * When `src` changes, smoothly crossfade between the old and new
     * panorama (PSV's stock behaviour). Default `false` — instead, the
     * old panorama is hidden by a Skeleton overlay the instant the swap
     * starts so the cut reads as deliberate rather than as a slow blend
     * between unrelated scenes. Flip to `true` for cinematic
     * walkthroughs where a crossfade between adjacent scenes reads
     * better. Has no effect on the initial mount.
     */
    readonly crossfadeOnSwitch?: boolean;
}

interface Image360ViewerState {
    /**
     * True between the moment `src` changes and the moment PSV's
     * `setPanorama` resolves. Drives the Skeleton overlay so the old
     * panorama disappears as soon as the swap starts (rather than
     * lingering until the new texture is ready). Initial mount leaves
     * this `false` — no overlay on first paint.
     */
    readonly isSwitching: boolean;
}

export default class Image360Viewer extends PureComponent<
    Image360ViewerProps,
    Image360ViewerState
> {
    state: Image360ViewerState = { isSwitching: false };

    private containerRef = createRef<HTMLDivElement>();
    private viewer: Viewer | null = null;
    // True-north offset in degrees, sourced from the panorama's
    // `GPano:PoseHeadingDegrees` XMP tag when present. Refreshed every
    // time PSV finishes loading a panorama; remains 0 when the source
    // ships no pose metadata.
    private headingOffsetDeg = 0;

    componentDidMount = () => {
        if (!this.containerRef.current) return;
        const minFov = this.props.minFov ?? 10;
        const maxFov = this.props.maxFov ?? 140;
        // Default the initial zoom to the level that produces a ~90° FOV
        // (Photo Sphere Viewer's stock default) for the configured FOV
        // range. PSV's zoom level is 0..100 where 0 maps to `maxFov`.
        const defaultZoomLvl =
            this.props.defaultZoomLvl ??
            (maxFov === minFov
                ? 0
                : Math.max(0, Math.min(100, ((maxFov - 90) / (maxFov - minFov)) * 100)));
        const initialMarkers = this.props.markers
            ? (this.props.markers as MarkerConfig[])
            : [];
        this.viewer = new Viewer({
            container: this.containerRef.current,
            panorama: this.props.src,
            navbar: this.props.navbar ?? false,
            defaultZoomLvl,
            // PSV's built-in circular loader is hidden via CSS in render();
            // blank `loadingTxt` keeps the text node empty so nothing leaks
            // through if a consumer ever re-enables the loader styles.
            loadingTxt: ``,
            // Snappy pan by default: disable Photo Sphere Viewer's
            // post-drag glide. The default ease makes large pans feel
            // laggy; this maps the pointer 1:1 to yaw/pitch so the image
            // stops the instant the pointer stops. Pass
            // `smoothTransitions` to opt back into the cinematic glide.
            moveInertia: this.props.smoothTransitions === true,
            minFov,
            maxFov,
            plugins: [[MarkersPlugin, { markers: initialMarkers }]]
        });
        this.viewer.addEventListener(`position-updated`, this.handlePosition);
        // Photo Sphere Viewer fires `panorama-loaded` once the panorama
        // texture + its XMP `panoData` are ready. We read `poseHeading`
        // from that payload to north-align the compass bearings we emit.
        this.viewer.addEventListener(
            `panorama-loaded`,
            this.handlePanoramaLoaded as never
        );
        // Wire marker clicks. `select-marker` fires for ANY marker
        // interaction (click on a hotspot, tap on a polygon), regardless
        // of marker type, so a single handler covers HTML markers + image
        // markers + polygons uniformly.
        const markersPlugin = this.viewer.getPlugin(MarkersPlugin) as
            | MarkersPlugin
            | null;
        markersPlugin?.addEventListener(`select-marker`, this.handleMarkerSelect);
    };

    private handleMarkerSelect = (event: SelectMarkerEvent) => {
        const onMarkerClick = this.props.onMarkerClick;
        if (!onMarkerClick) return;
        onMarkerClick(event.marker.config as Image360ViewerMarker);
    };

    private handlePanoramaLoaded = (event: {
        data?: { panoData?: { poseHeading?: number } };
    }) => {
        // GPano `PoseHeadingDegrees` carries the compass bearing of the
        // panorama's reference (centre) column. PSV exposes it as
        // `panoData.poseHeading`. Reset to 0 when the new panorama ships
        // no pose data so the bearing stays consistent across scene swaps.
        const pose = event?.data?.panoData?.poseHeading;
        this.headingOffsetDeg =
            typeof pose === `number` && Number.isFinite(pose) ? pose : 0;
    };

    private handlePosition = (event: { position: { yaw: number; pitch: number } }) => {
        const onHeadingChange = this.props.onHeadingChange;
        if (!onHeadingChange) return;
        // PSV yaw is radians, 0..2π. Convert to degrees and shift by the
        // panorama's pose-heading offset (if its XMP supplies one) so the
        // value lands as a true compass bearing 0..360 that drops straight
        // into a Compass without extra math upstream.
        const yawDeg = (event.position.yaw * 180) / Math.PI;
        const bearing = (((yawDeg + this.headingOffsetDeg) % 360) + 360) % 360;
        onHeadingChange(bearing);
    };

    componentDidUpdate = (previousProps: Image360ViewerProps) => {
        if (!this.viewer) return;
        if (previousProps.src !== this.props.src) {
            // Hard-cut default: hide the old panorama with a Skeleton the
            // instant the swap starts, and tell PSV to skip its crossfade
            // animation (`transition: false`) so the new texture pops in
            // without blending. `showLoader: false` keeps PSV's own
            // circular loader suppressed even if the CSS rule below ever
            // regresses. `crossfadeOnSwitch` opts back into PSV's stock
            // cinematic blend and skips the Skeleton overlay.
            const crossfade = this.props.crossfadeOnSwitch === true;
            if (!crossfade) this.setState({ isSwitching: true });
            const clearSwitching = () => {
                if (!crossfade) this.setState({ isSwitching: false });
            };
            void this.viewer
                .setPanorama(this.props.src, {
                    transition: crossfade,
                    showLoader: false
                })
                .then(clearSwitching)
                .catch(clearSwitching);
        }
        // Diff the marker list by identity — if the parent passes a new
        // array (e.g. swapped scenes in a virtual tour), refresh the
        // plugin's live set in one shot via `setMarkers`. Shallow-equal
        // arrays are no-ops because PureComponent's render bail-out
        // already prevents `componentDidUpdate` from firing for them.
        if (previousProps.markers !== this.props.markers) {
            const markersPlugin = this.viewer.getPlugin(MarkersPlugin) as
                | MarkersPlugin
                | null;
            markersPlugin?.setMarkers(
                this.props.markers
                    ? ([...this.props.markers] as MarkerConfig[])
                    : []
            );
        }
    };

    componentWillUnmount = () => {
        this.viewer?.destroy();
        this.viewer = null;
    };

    render = () => {
        return (
            <div
                aria-label={this.props.alt}
                style={{ ...this.props.style }}
                className={cn(
                    `Image360Viewer relative h-full w-full`,
                    this.props.className
                )}
            >
                <div
                    ref={this.containerRef}
                    // `[&_*]:cursor-grab` / `[&_*]:active:cursor-grabbing`
                    // overrides Photo Sphere Viewer's default move/grabbing
                    // cursors on the canvas + every descendant, so users see
                    // a hand instead of the four-arrow move pointer.
                    //
                    // `[&_.psv-loader-container]:!hidden` removes PSV's
                    // built-in circular loader — no in-app loading indicator
                    // is shown while the panorama loads.
                    className={`h-full w-full cursor-grab [&_*]:cursor-grab active:cursor-grabbing active:[&_*]:cursor-grabbing [&_.psv-loader-container]:!hidden`}
                />
            </div>
        );
    };
}
