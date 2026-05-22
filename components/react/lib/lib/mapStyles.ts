/**
 * Map style catalogue used by `<Map>` and `<MapStylePicker>`.
 *
 * A `MowsMapStyle` is a thin wrapper around a MapLibre style definition
 * — either a URL pointing at a style.json or an inline style object.
 * `<Map>` is rendered with maplibre-gl, which also reads Mapbox-format
 * style URLs (so `mapbox://styles/...` works when an `accessToken` is
 * supplied), but the default catalogue ships fully tokenless styles.
 *
 * Apps override or extend the catalogue via the `mapStyles` prop on
 * `<MowsProvider>` exactly like `themes` / `codeThemes`.
 */

export interface MowsMapStyle {
    readonly id: string;
    readonly name: string;
    /**
     * Style URL (`https://...style.json` or `mapbox://styles/...`) **or**
     * an inline MapLibre style object. maplibre-gl resolves both.
     */
    readonly url: string | Record<string, unknown>;
    /**
     * Access token for styles that need one (`mapbox://` and Mapbox-
     * hosted tile endpoints). When set, `<Map>` installs a
     * `transformRequest` that appends `access_token=…` to every tile
     * request. Tokenless styles (OpenFreeMap, demotiles, self-hosted
     * tile servers) leave this undefined.
     */
    readonly accessToken?: string;
    /** Hint for the picker — drives the dark/light swatch. */
    readonly mode?: `dark` | `light`;
    /** Attribution shown next to the picker entry (not the map). */
    readonly attribution?: string;
}

/**
 * Tokenless defaults — all four styles render without an access token,
 * so `<Map>` works out of the box in the docs site and in any consumer
 * that hasn't wired up a Mapbox account. Liberty / Bright / Dark all
 * include OSM data including `fill-extrusion-3d` building layers, so
 * pitching the camera lights up 3D buildings in cities; the MapLibre
 * demotiles entry is kept around as a low-data fallback.
 */
export const defaultMapStyles: MowsMapStyle[] = [
    {
        id: `openfreemap-liberty`,
        name: `OpenFreeMap Liberty`,
        url: `https://tiles.openfreemap.org/styles/liberty`,
        mode: `light`,
        attribution: `© OpenFreeMap / OpenStreetMap`
    },
    {
        id: `openfreemap-bright`,
        name: `OpenFreeMap Bright`,
        url: `https://tiles.openfreemap.org/styles/bright`,
        mode: `light`,
        attribution: `© OpenFreeMap / OpenStreetMap`
    },
    {
        id: `openfreemap-positron`,
        name: `OpenFreeMap Positron`,
        url: `https://tiles.openfreemap.org/styles/positron`,
        mode: `light`,
        attribution: `© OpenFreeMap / OpenStreetMap`
    },
    {
        id: `openfreemap-dark`,
        name: `OpenFreeMap Dark`,
        url: `https://tiles.openfreemap.org/styles/dark`,
        mode: `dark`,
        attribution: `© OpenFreeMap / OpenStreetMap`
    },
    {
        id: `maplibre-demo`,
        name: `MapLibre Demo`,
        url: `https://demotiles.maplibre.org/style.json`,
        mode: `light`,
        attribution: `© MapLibre`
    }
];
