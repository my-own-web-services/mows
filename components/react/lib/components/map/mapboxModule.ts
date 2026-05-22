/**
 * Single dynamic-import boundary for the underlying map library
 * (MapLibre GL JS). MapLibre is the open-source successor of mapbox-gl
 * v1 with an identical runtime API but no Mapbox access-token
 * requirement — critical for tokenless tile providers (OpenFreeMap,
 * demotiles, self-hosted). mapbox-gl v3 refuses to render non-`mapbox://`
 * styles without a paid token and the canvas goes black, which is the
 * exact failure mode the v0 implementation hit.
 *
 * Loaded lazily so the ~800 kB JS + CSS bundle never enters a consumer's
 * initial payload until a `<Map>` actually mounts.
 */

import type * as MapLibre from "maplibre-gl";

/**
 * Public alias re-exposed for component code. Kept named `MapboxNamespace`
 * because the React surface still calls the prop `mapStyle` and the
 * component class `Map` — and MapLibre is a drop-in replacement for the
 * v1 mapbox-gl namespace shape, so any consumer typing against
 * `mapbox-gl` types will find every member here.
 */
export type MapboxNamespace = typeof MapLibre;

let cached: Promise<MapboxNamespace> | null = null;

export const loadMapbox = (): Promise<MapboxNamespace> => {
    if (cached) return cached;
    cached = (async () => {
        // Side-effect CSS import — Vite splits this into its own chunk
        // so the stylesheet only ships when a Map actually mounts.
        await import(`maplibre-gl/dist/maplibre-gl.css`);
        const mod = await import(`maplibre-gl`);
        // MapLibre publishes named exports plus a default that re-exports
        // the namespace; pick whichever the bundler gives us.
        return (mod.default ?? mod) as unknown as MapboxNamespace;
    })();
    return cached;
};
