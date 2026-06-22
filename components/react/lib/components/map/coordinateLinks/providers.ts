/**
 * Built-in map providers shipped with <CoordinateLinks>. Each entry knows
 * how to turn a (lat, lng [, zoom]) tuple into a URL that opens that
 * coordinate on the provider's web surface. Consumers can extend or
 * replace the list via the `providers` prop.
 */

export type MapProviderId =
    | `geo`
    | `openstreetmap`
    | `google`
    | `bing`
    | `apple`;

export interface MapProvider {
    /** Stable id — used as the React key and the default search-tag. */
    readonly id: string;
    /**
     * Link text. Either a static string (`"Google Maps"`) or a function
     * that derives the label from the coordinate — used by the built-in
     * `geo` provider so its link reads as the lat/lng tuple itself,
     * matching what the OS hands to the registered handler.
     */
    readonly label:
        | string
        | ((latitude: number, longitude: number, precision: number) => string);
    /**
     * Build the destination URL. Zoom is optional; providers that don't
     * accept a zoom param should ignore it. The encoder is the
     * implementation's responsibility — pass raw lat/lng floats.
     */
    readonly buildUrl: (latitude: number, longitude: number, zoom?: number) => string;
}

const fmt = (n: number, decimals = 6): string => {
    // Strip trailing zeros so the URL stays compact ("51.5" not "51.500000").
    // Some providers (Apple, Yandex) strip extra zeros themselves, but the
    // shorter form is friendlier in audit logs and copy-paste.
    return n.toFixed(decimals).replace(/\.?0+$/, ``) || `0`;
};

const DEFAULT_ZOOM = 14;

export const BUILTIN_MAP_PROVIDERS: Readonly<Record<MapProviderId, MapProvider>> = {
    geo: {
        id: `geo`,
        // RFC 5870 — the OS hands the URI to whichever app is registered
        // for geo:. On Android/iOS that's the default maps app; on
        // desktop it depends on the user's protocol-handler config. The
        // link text is the coordinate itself, so a reader can tell at a
        // glance what they're about to open.
        label: (lat, lng, precision) =>
            `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`,
        buildUrl: (lat, lng, zoom) =>
            zoom !== undefined
                ? `geo:${fmt(lat)},${fmt(lng)}?z=${zoom}`
                : `geo:${fmt(lat)},${fmt(lng)}`
    },
    openstreetmap: {
        id: `openstreetmap`,
        label: `OpenStreetMap`,
        buildUrl: (lat, lng, zoom = DEFAULT_ZOOM) =>
            `https://www.openstreetmap.org/?mlat=${fmt(lat)}&mlon=${fmt(lng)}#map=${zoom}/${fmt(
                lat
            )}/${fmt(lng)}`
    },
    google: {
        id: `google`,
        label: `Google Maps`,
        buildUrl: (lat, lng) =>
            `https://www.google.com/maps?q=${fmt(lat)},${fmt(lng)}`
    },
    bing: {
        id: `bing`,
        label: `Bing Maps`,
        buildUrl: (lat, lng, zoom = DEFAULT_ZOOM) =>
            `https://www.bing.com/maps?cp=${fmt(lat)}~${fmt(lng)}&lvl=${zoom}`
    },
    apple: {
        id: `apple`,
        label: `Apple Maps`,
        buildUrl: (lat, lng) => `https://maps.apple.com/?ll=${fmt(lat)},${fmt(lng)}`
    }
};

export const DEFAULT_PROVIDER_ORDER: ReadonlyArray<MapProviderId> = [
    `geo`,
    `openstreetmap`,
    `google`,
    `bing`,
    `apple`
];

/**
 * Normalise the `providers` prop — accept either built-in ids or full
 * provider records — into a single ordered list of fully resolved
 * providers. Unknown string ids throw at call time so a typo doesn't
 * silently render an empty list.
 */
export const resolveProviders = (
    input?: ReadonlyArray<MapProviderId | MapProvider>
): ReadonlyArray<MapProvider> => {
    const source = input ?? DEFAULT_PROVIDER_ORDER;
    return source.map((entry) => {
        if (typeof entry === `string`) {
            const builtin = BUILTIN_MAP_PROVIDERS[entry];
            if (!builtin) {
                throw new Error(
                    `<CoordinateLinks> unknown built-in provider id "${entry}". Known ids: ${Object.keys(
                        BUILTIN_MAP_PROVIDERS
                    ).join(`, `)}`
                );
            }
            return builtin;
        }
        return entry;
    });
};
