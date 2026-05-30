/**
 * Bright Sky / WMO icon vocabulary. The omniviv original maps each key
 * to a single emoji; we keep that mapping here so the component
 * renders identically. Unknown values fall back to the thermometer
 * glyph.
 */
export type WeatherExpandableIconName =
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
 * Canonical condition keys. Matches the omniviv reference vocabulary.
 * `dry` means "nothing falling from the sky" — i.e. fine weather.
 */
export type WeatherExpandableConditionKey =
    | `dry`
    | `fog`
    | `rain`
    | `sleet`
    | `snow`
    | `hail`
    | `thunderstorm`;

/**
 * Current-conditions sample shape. Field names are snake_case to mirror
 * the omniviv reference (which forwards Bright Sky's payload verbatim);
 * every field is optional and missing values are simply omitted.
 */
export interface WeatherExpandableData {
    /** Air temperature in degrees Celsius. */
    readonly temperature?: number | null;
    /** Condition key — translated via `strings.condition*`. */
    readonly condition?: WeatherExpandableConditionKey | string | null;
    /** Icon hint — mapped to an emoji. */
    readonly icon?: WeatherExpandableIconName | string | null;
    /** Precipitation amount over the last 60 minutes (mm). Preferred. */
    readonly precipitation_60?: number | null;
    /** Precipitation amount over the last 10 minutes (mm). */
    readonly precipitation_10?: number | null;
    /** Precipitation amount, generic / fallback (mm). */
    readonly precipitation?: number | null;
    /** Wind speed over the last 60 minutes (km/h). Preferred. */
    readonly wind_speed_60?: number | null;
    /** Wind speed over the last 10 minutes (km/h). */
    readonly wind_speed_10?: number | null;
    /** Wind speed, generic / fallback (km/h). */
    readonly wind_speed?: number | null;
    /** Cloud cover 0-100. */
    readonly cloud_cover?: number | null;
    /** Relative humidity 0-100. */
    readonly relative_humidity?: number | null;
    /** Visibility in metres (rendered as kilometres in the body). */
    readonly visibility?: number | null;
    /** Mean-sea-level pressure in hPa. */
    readonly pressure_msl?: number | null;
}

/**
 * Single day in the forecast strip. `date` is an ISO yyyy-mm-dd string
 * (omniviv stores them this way); other fields mirror Bright Sky's
 * daily aggregate.
 */
export interface WeatherExpandableForecastDay {
    /** ISO date `yyyy-mm-dd`. */
    readonly date: string;
    /** Daily low (°C). */
    readonly temp_min?: number | null;
    /** Daily high (°C). */
    readonly temp_max?: number | null;
    /** Condition key for the day. */
    readonly condition?: WeatherExpandableConditionKey | string | null;
    /** Icon hint for the day. */
    readonly icon?: WeatherExpandableIconName | string | null;
    /** Probability of precipitation 0-100. */
    readonly precipitation_probability?: number | null;
}

export interface WeatherExpandableStrings {
    /** `aria-label` for the outer card region. */
    readonly title: string;
    /** Condition labels (kept short). */
    readonly conditionDry: string;
    readonly conditionFog: string;
    readonly conditionRain: string;
    readonly conditionSleet: string;
    readonly conditionSnow: string;
    readonly conditionHail: string;
    readonly conditionThunderstorm: string;
    /** Shown in place of a missing temperature value. */
    readonly temperaturePlaceholder: string;
    /** Temperature unit suffix (default `°C`). */
    readonly temperatureUnit: string;
    /** Precipitation unit suffix shown in the header chip (default `mm`). */
    readonly precipitationUnit: string;
    /** Wind unit suffix shown in the header chip (default `km/h`). */
    readonly windUnit: string;
    /** Cloud-cover unit suffix shown in the body (default `%`). */
    readonly cloudCoverUnit: string;
    /** Humidity unit suffix shown in the body (default `%`). */
    readonly humidityUnit: string;
    /** Visibility unit suffix shown in the body (default `km`). */
    readonly visibilityUnit: string;
    /** Pressure unit suffix shown in the body (default `hPa`). */
    readonly pressureUnit: string;
    /** Precipitation-probability unit suffix in the forecast strip (default `%`). */
    readonly precipitationProbabilityUnit: string;
    /** Tooltip on the cloud-cover chip. */
    readonly cloudCoverLabel: string;
    /** Tooltip on the humidity chip. */
    readonly humidityLabel: string;
    /** Tooltip on the visibility chip. */
    readonly visibilityLabel: string;
    /** Tooltip on the pressure chip. */
    readonly pressureLabel: string;
    /** `aria-label` for the disclosure when collapsed. */
    readonly expandLabel: string;
    /** `aria-label` for the disclosure when expanded. */
    readonly collapseLabel: string;
}

/**
 * German defaults match the omniviv `translateCondition` mapping and
 * the PlacesPanel tooltip text. Apps that ship multiple locales override
 * individual fields via the `strings` prop.
 */
export const DEFAULT_WEATHER_EXPANDABLE_STRINGS: WeatherExpandableStrings = {
    title: `Wetter`,
    conditionDry: `Trocken`,
    conditionFog: `Nebel`,
    conditionRain: `Regen`,
    conditionSleet: `Schneeregen`,
    conditionSnow: `Schnee`,
    conditionHail: `Hagel`,
    conditionThunderstorm: `Gewitter`,
    temperaturePlaceholder: `—`,
    temperatureUnit: `°C`,
    precipitationUnit: `mm`,
    windUnit: `km/h`,
    cloudCoverUnit: `%`,
    humidityUnit: `%`,
    visibilityUnit: `km`,
    pressureUnit: `hPa`,
    precipitationProbabilityUnit: `%`,
    cloudCoverLabel: `Bewölkung`,
    humidityLabel: `Luftfeuchtigkeit`,
    visibilityLabel: `Sichtweite`,
    pressureLabel: `Luftdruck`,
    expandLabel: `Wetter-Details anzeigen`,
    collapseLabel: `Wetter-Details ausblenden`
};

/**
 * Resolve an icon key to its emoji glyph. Mirrors the omniviv
 * `iconToEmoji` mapping 1:1; unknown values fall back to the
 * thermometer glyph so the layout stays stable.
 */
export const resolveWeatherEmoji = (icon: string | null | undefined): string => {
    switch (icon) {
        case `clear-day`:
            return `☀️`;
        case `clear-night`:
            return `🌙`;
        case `partly-cloudy-day`:
            return `⛅`;
        case `partly-cloudy-night`:
            return `☁️`;
        case `cloudy`:
            return `☁️`;
        case `fog`:
            return `🌫️`;
        case `wind`:
            return `💨`;
        case `rain`:
            return `🌧️`;
        case `sleet`:
            return `🌨️`;
        case `snow`:
            return `❄️`;
        case `hail`:
            return `🌨️`;
        case `thunderstorm`:
            return `⛈️`;
        default:
            return `🌡️`;
    }
};

/**
 * Resolve a condition key to its translated label. Unknown / null
 * conditions fall through to the placeholder so the layout is stable.
 */
export const resolveConditionLabel = (
    condition: string | null | undefined,
    strings: WeatherExpandableStrings
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
