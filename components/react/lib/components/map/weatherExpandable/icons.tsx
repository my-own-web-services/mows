/**
 * Lucide-icon counterpart to `resolveWeatherEmoji`. Maps the same
 * Bright Sky / WMO icon vocabulary to a monochrome `lucide-react`
 * component so callers who prefer flat stroke icons over colour emoji
 * can opt in via `glyphStyle="icon"`.
 *
 * Kept in its own module (not co-located in `types.ts`) so consumers
 * who only need the type / emoji helpers don't pull in any icon
 * components.
 */

import {
    Cloud,
    CloudFog,
    CloudHail,
    CloudLightning,
    CloudMoon,
    CloudRain,
    CloudSnow,
    CloudSun,
    Moon,
    Snowflake,
    Sun,
    Thermometer,
    Wind,
    type LucideIcon
} from "lucide-react";

/**
 * Resolve a weather icon key to the matching `lucide-react` component.
 * Mirrors the keys handled by [`resolveWeatherEmoji`]; unknown values
 * fall through to a thermometer so the layout stays stable.
 */
export const resolveWeatherLucideIcon = (
    icon: string | null | undefined
): LucideIcon => {
    switch (icon) {
        case `clear-day`:
            return Sun;
        case `clear-night`:
            return Moon;
        case `partly-cloudy-day`:
            return CloudSun;
        case `partly-cloudy-night`:
            return CloudMoon;
        case `cloudy`:
            return Cloud;
        case `fog`:
            return CloudFog;
        case `wind`:
            return Wind;
        case `rain`:
            return CloudRain;
        case `sleet`:
            return CloudSnow;
        case `snow`:
            return Snowflake;
        case `hail`:
            return CloudHail;
        case `thunderstorm`:
            return CloudLightning;
        default:
            return Thermometer;
    }
};
