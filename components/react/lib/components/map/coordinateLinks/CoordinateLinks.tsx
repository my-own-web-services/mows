import { cn } from "@/lib/utils";
import { type CSSProperties } from "react";
import { useMemo } from "react";
import {
    resolveProviders,
    type MapProvider,
    type MapProviderId
} from "./providers";

export interface CoordinateLinksProps {
    /** Latitude in decimal degrees, `-90` ≤ value ≤ `90`. */
    readonly latitude: number;
    /** Longitude in decimal degrees, `-180` ≤ value ≤ `180`. */
    readonly longitude: number;
    /**
     * Zoom level passed to providers that honour it (OSM, Bing, plus
     * the `geo:` query string). Defaults to `14` — close enough to
     * identify a street block without over-zooming on rural points.
     */
    readonly zoom?: number;
    /**
     * Either built-in provider ids or full {@link MapProvider} records.
     * Defaults to `geo, openstreetmap, google, bing, apple` — pass an
     * explicit list to add a custom provider or to subset / reorder the
     * defaults.
     */
    readonly providers?: ReadonlyArray<MapProviderId | MapProvider>;
    /**
     * Optional heading rendered above the link list. Use to mark up the
     * block when several CoordinateLinks groups appear on one surface;
     * leave undefined for the bare default.
     */
    readonly label?: string;
    /**
     * Decimal places used when a provider derives its label from the
     * coordinate (currently just the `geo` built-in). Defaults to `5`
     * (≈ 1 m precision).
     */
    readonly precision?: number;
    /**
     * Prefix used in each link's `aria-label` ("Open in <provider>:
     * <coordinate>"). Override to translate the announcement.
     */
    readonly openInLabel?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

const isFiniteNumber = (n: unknown): n is number =>
    typeof n === `number` && Number.isFinite(n);

const validateCoordinate = (latitude: number, longitude: number) => {
    if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
        throw new Error(
            `<CoordinateLinks> latitude/longitude must be finite numbers (got latitude=${latitude}, longitude=${longitude})`
        );
    }
    if (latitude < -90 || latitude > 90) {
        throw new Error(
            `<CoordinateLinks> latitude must be in [-90, 90] (got ${latitude})`
        );
    }
    if (longitude < -180 || longitude > 180) {
        throw new Error(
            `<CoordinateLinks> longitude must be in [-180, 180] (got ${longitude})`
        );
    }
};

const formatReadout = (lat: number, lng: number, precision: number): string =>
    `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;

const resolveLabel = (
    provider: MapProvider,
    latitude: number,
    longitude: number,
    precision: number
): string =>
    typeof provider.label === `function`
        ? provider.label(latitude, longitude, precision)
        : provider.label;

/**
 * Renders a coordinate as plain, underlined links to popular online
 * map providers — one per registered provider, stacked vertically.
 * The first link is a `geo:` URI whose text is the coordinate itself,
 * mirroring what the OS-registered map app receives. Designed to feel
 * like default-styled browser anchors so the component slots into any
 * surrounding surface without bringing its own chrome.
 */
export const CoordinateLinks = ({
    latitude,
    longitude,
    zoom,
    providers,
    label,
    precision = 5,
    openInLabel = `Open in`,
    className,
    style
}: CoordinateLinksProps) => {
    // Surface a bad coordinate during render so the example is the
    // boundary, not "links produce 404s in production".
    validateCoordinate(latitude, longitude);

    const resolved = useMemo(() => resolveProviders(providers), [providers]);
    const readout = formatReadout(latitude, longitude, precision);

    return (
        <div
            className={cn(`CoordinateLinks flex w-full flex-col gap-1`, className)}
            style={style}
        >
            {label && (
                <p
                    className={`m-0 text-sm font-medium text-foreground`}
                    data-testid={`coordinate-links-label`}
                >
                    {label}
                </p>
            )}
            <ul className={`m-0 flex list-none flex-col gap-0.5 p-0`}>
                {resolved.map((provider) => {
                    const href = provider.buildUrl(latitude, longitude, zoom);
                    const text = resolveLabel(provider, latitude, longitude, precision);
                    const ariaLabel = `${openInLabel} ${provider.id === `geo` ? `default map app` : text}: ${readout}`;
                    return (
                        <li key={provider.id}>
                            <a
                                href={href}
                                target={`_blank`}
                                rel={`noopener noreferrer`}
                                aria-label={ariaLabel}
                                data-provider={provider.id}
                                className={`text-primary underline underline-offset-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring`}
                            >
                                {text}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default CoordinateLinks;
