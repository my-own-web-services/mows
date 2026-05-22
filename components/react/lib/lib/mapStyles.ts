/**
 * Map style catalogue used by `<Map>` and `<MapStylePicker>`.
 *
 * A `MowsMapStyle` is a thin wrapper around a Mapbox / MapLibre style
 * definition — either a URL pointing at a style.json (or `mapbox://`
 * style id) or an inline style object. The renderer is mapbox-gl, which
 * also accepts MapLibre-compatible style URLs, so the default catalogue
 * ships tokenless MapLibre demo styles plus the standard Mapbox style
 * ids (consumers attach an `accessToken` to use those).
 *
 * Apps override or extend the catalogue via the `mapStyles` prop on
 * `<MowsProvider>` exactly like `themes` / `codeThemes`.
 */

export interface MowsMapStyle {
    readonly id: string;
    readonly name: string;
    /**
     * Style URL (`https://...style.json` or `mapbox://styles/...`) **or**
     * an inline Mapbox style object. mapbox-gl resolves both.
     */
    readonly url: string | Record<string, unknown>;
    /**
     * Mapbox access token required by this style. Only needed for
     * `mapbox://` URLs and tile endpoints behind mapbox.com — tokenless
     * styles (MapLibre demotiles, OpenFreeMap, self-hosted tile servers)
     * leave this undefined. When set, `<Map>` calls
     * `mapboxgl.accessToken = …` before instantiating the map.
     */
    readonly accessToken?: string;
    /** Hint for the picker — drives the dark/light swatch. */
    readonly mode?: `dark` | `light`;
    /** Attribution shown next to the picker entry (not the map). */
    readonly attribution?: string;
}

/**
 * Tokenless defaults — all three render without an access token so the
 * Map component works out of the box in the docs site and in any
 * consumer that hasn't wired up a Mapbox account yet.
 */
export const defaultMapStyles: MowsMapStyle[] = [
    {
        id: `maplibre-demo`,
        name: `MapLibre Demo`,
        url: `https://demotiles.maplibre.org/style.json`,
        mode: `light`,
        attribution: `© MapLibre`
    },
    {
        id: `openfreemap-liberty`,
        name: `OpenFreeMap Liberty`,
        url: `https://tiles.openfreemap.org/styles/liberty`,
        mode: `light`,
        attribution: `© OpenFreeMap / OpenStreetMap`
    },
    {
        id: `openfreemap-dark`,
        name: `OpenFreeMap Dark`,
        url: `https://tiles.openfreemap.org/styles/dark`,
        mode: `dark`,
        attribution: `© OpenFreeMap / OpenStreetMap`
    }
];
