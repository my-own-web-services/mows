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
    Sun,
    Thermometer,
    Wind,
    type LucideIcon
} from "lucide-react";

/**
 * Canonical Bright Sky / WMO-style icon names. The set matches the
 * `icon` field returned by Bright Sky (`bright-sky.dev`), which is the
 * de facto interchange shape consumers tend to map their upstream into.
 * Pass-through strings outside this set fall back to the generic
 * thermometer icon and the chip still renders the temperature.
 */
export type WeatherIconName =
    | `clear-day`
    | `clear-night`
    | `partly-cloudy-day`
    | `partly-cloudy-night`
    | `cloudy`
    | `fog`
    | `wind`
    | `rain`
    | `sleet`
    | `snow`
    | `hail`
    | `thunderstorm`;

/**
 * Canonical condition keys. Matches Bright Sky's `condition` field.
 * `dry` is the conventional "nothing falling from the sky" value used
 * when the weather is fine and rainless.
 */
export type WeatherConditionKey =
    | `dry`
    | `fog`
    | `rain`
    | `sleet`
    | `snow`
    | `hail`
    | `thunderstorm`;

/**
 * Which point in time the record describes. Drives the time-label
 * prefix shown in the chip footer ("Now" / "Forecast" / "History").
 */
export type WeatherMode = `current` | `historical` | `forecast`;

/**
 * Structured weather sample. Field names mirror Bright Sky's record
 * shape so consumers can forward upstream payloads verbatim, but every
 * field is optional — missing values are simply omitted from the chip.
 */
export interface WeatherRecord {
    /** Air temperature in degrees Celsius. */
    readonly temperature?: number | null;
    /** Condition key — translated to a label via `strings.condition*`. */
    readonly condition?: WeatherConditionKey | string | null;
    /** Icon hint — mapped to a Lucide glyph. */
    readonly icon?: WeatherIconName | string | null;
    /** Precipitation in millimetres for the sampling period. */
    readonly precipitation?: number | null;
    /** Wind speed in km/h. */
    readonly windSpeed?: number | null;
    /** Relative humidity 0-100. */
    readonly relativeHumidity?: number | null;
}

export interface WeatherChipStrings {
    /** Footer label when `mode="current"`. */
    readonly modeCurrent: string;
    /** Footer label prefix when `mode="forecast"` (concatenated with the formatted time). */
    readonly modeForecast: string;
    /** Footer label prefix when `mode="historical"`. */
    readonly modeHistorical: string;
    /** Separator between the mode label and the formatted time (default `" · "`). */
    readonly modeTimeSeparator: string;
    /** Condition labels. Plain strings — keep short. */
    readonly conditionDry: string;
    readonly conditionFog: string;
    readonly conditionRain: string;
    readonly conditionSleet: string;
    readonly conditionSnow: string;
    readonly conditionHail: string;
    readonly conditionThunderstorm: string;
    /** Shown in place of a missing temperature value. */
    readonly temperaturePlaceholder: string;
    /** `aria-label` for the chip's outer region. */
    readonly title: string;
    /** `aria-label` for the loading spinner. */
    readonly loadingLabel: string;
    /** Unit suffix for temperature (default `°C`). */
    readonly temperatureUnit: string;
    /** Unit suffix for precipitation (default ` mm`). */
    readonly precipitationUnit: string;
    /** Unit suffix for wind (default ` km/h`). */
    readonly windUnit: string;
    /** Unit suffix for humidity (default `%`). */
    readonly humidityUnit: string;
}

export const DEFAULT_WEATHER_CHIP_STRINGS: WeatherChipStrings = {
    modeCurrent: `Now`,
    modeForecast: `Forecast`,
    modeHistorical: `History`,
    modeTimeSeparator: ` · `,
    conditionDry: `Dry`,
    conditionFog: `Fog`,
    conditionRain: `Rain`,
    conditionSleet: `Sleet`,
    conditionSnow: `Snow`,
    conditionHail: `Hail`,
    conditionThunderstorm: `Thunderstorm`,
    temperaturePlaceholder: `—`,
    title: `Weather`,
    loadingLabel: `Loading`,
    temperatureUnit: `°C`,
    precipitationUnit: ` mm`,
    windUnit: ` km/h`,
    humidityUnit: `%`
};

/**
 * Map a Bright Sky icon key to a Lucide glyph. Unknown keys fall back
 * to the thermometer so the chip still renders a sensible silhouette
 * when the upstream's icon vocabulary diverges.
 */
export const resolveWeatherIcon = (icon: string | null | undefined): LucideIcon => {
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
            return CloudSnow;
        case `hail`:
            return CloudHail;
        case `thunderstorm`:
            return CloudLightning;
        default:
            return Thermometer;
    }
};

/**
 * Map a condition key to its translated label. Unknown / null
 * conditions fall through to the placeholder so the layout is stable.
 */
export const resolveConditionLabel = (
    condition: string | null | undefined,
    strings: WeatherChipStrings
): string => {
    switch (condition) {
        case `dry`:
            return strings.conditionDry;
        case `fog`:
            return strings.conditionFog;
        case `rain`:
            return strings.conditionRain;
        case `sleet`:
            return strings.conditionSleet;
        case `snow`:
            return strings.conditionSnow;
        case `hail`:
            return strings.conditionHail;
        case `thunderstorm`:
            return strings.conditionThunderstorm;
        default:
            return condition ?? strings.temperaturePlaceholder;
    }
};
