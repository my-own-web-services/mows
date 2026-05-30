import { cn } from "@/lib/utils";
import {
    Cloud,
    Droplets,
    Eye,
    Gauge,
    Thermometer,
    Wind
} from "lucide-react";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { ExpandableSection } from "../../navigation/expandableSection/ExpandableSection";
import {
    DEFAULT_WEATHER_EXPANDABLE_STRINGS,
    resolveConditionLabel,
    resolveWeatherEmoji,
    type WeatherExpandableData,
    type WeatherExpandableForecastDay,
    type WeatherExpandableStrings
} from "./types";

export interface WeatherExpandableProps {
    /**
     * Current-conditions sample. `null` / omit renders the silhouette
     * placeholder (`—`) — useful while a fetch is in flight.
     */
    readonly data?: WeatherExpandableData | null;
    /**
     * Optional daily forecast strip shown in the expanded body.
     * Each entry becomes a small column with weekday + emoji + high/low
     * + rain probability.
     */
    readonly forecast?: readonly WeatherExpandableForecastDay[];
    /**
     * Attribution line shown at the bottom-right of the forecast strip
     * (e.g. "© DWD", "Demo data"). Pass `null` / omit to hide. The
     * library does not imply any specific source — the consumer owns
     * this string.
     */
    readonly attribution?: ReactNode;
    /** Controlled open state. */
    readonly open?: boolean;
    /** Initial open state when uncontrolled. Defaults to `false`. */
    readonly defaultOpen?: boolean;
    /** Fires whenever the disclosure toggles. */
    readonly onOpenChange?: (open: boolean) => void;
    /**
     * Replace individual translated strings. Anything not overridden
     * falls back to `DEFAULT_WEATHER_EXPANDABLE_STRINGS` (German,
     * matching the omniviv reference).
     */
    readonly strings?: Partial<WeatherExpandableStrings>;
    /**
     * BCP-47 locale tag used to format the forecast weekday labels.
     * Defaults to `"de-DE"` to match the omniviv original.
     */
    readonly locale?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

/**
 * Pick the most precise sample available — omniviv prefers the
 * 60-minute aggregate over the generic field, falling back to whatever
 * is present.
 */
const preferred = (
    a: number | null | undefined,
    b: number | null | undefined
): number | null | undefined => (typeof a === `number` ? a : b);

const formatDayShort = (dateStr: string, locale: string): string => {
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat(locale, { weekday: `short` }).format(d);
};

/**
 * WeatherExpandable — collapsible weather card ported 1:1 from the
 * omniviv PlacesPanel weather-section. The header row stays visible
 * and renders emoji + temperature + condition on the leading edge and
 * precipitation / wind chips on the trailing edge; the disclosure
 * chevron toggles the body, which contains an extras row (cloud
 * cover, humidity, visibility, pressure) and a horizontally-scrollable
 * multi-day forecast strip with attribution.
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │ ☀ 🌡 16°C  Trocken          💧 1.4mm  💨 12km/h ▽ │
 *   ├────────────────────────────────────────────────────┤
 *   │ ☁ 30%  💧 60%  👁 5.0km  🎚 1013hPa               │
 *   ├────────────────────────────────────────────────────┤
 *   │ Mo  ☀  10°/22°       Di  ⛅  9°/19° 💧30%   ...   │
 *   │                                       Demo data   │
 *   └────────────────────────────────────────────────────┘
 *
 * Composes the generic `<ExpandableSection>` primitive. Purely
 * presentational: the consumer owns the fetch (no internal effects, no
 * API calls). When the consumer passes neither extras data nor a
 * forecast, the disclosure becomes inert and the chevron disappears —
 * clicking an empty section is the worst possible UX.
 */
export const WeatherExpandable = ({
    data,
    forecast,
    attribution,
    open,
    defaultOpen = false,
    onOpenChange,
    strings,
    locale = `de-DE`,
    className,
    style
}: WeatherExpandableProps) => {
    const t = useMemo(
        () => ({ ...DEFAULT_WEATHER_EXPANDABLE_STRINGS, ...strings }),
        [strings]
    );

    const emoji = resolveWeatherEmoji(data?.icon);
    const conditionText = resolveConditionLabel(data?.condition, t);
    const temperatureText =
        typeof data?.temperature === `number`
            ? `${Math.round(data.temperature)}${t.temperatureUnit}`
            : t.temperaturePlaceholder;

    const precipitation = preferred(data?.precipitation_60, data?.precipitation);
    const windSpeed = preferred(data?.wind_speed_60, data?.wind_speed);

    const hasExtras =
        typeof data?.cloud_cover === `number` ||
        typeof data?.relative_humidity === `number` ||
        typeof data?.visibility === `number` ||
        typeof data?.pressure_msl === `number`;

    const hasForecast = forecast !== undefined && forecast.length > 0;
    const hasBody = hasExtras || hasForecast || attribution != null;

    const header = (
        <div
            className={`flex items-center justify-between gap-2`}
            role={`region`}
            aria-label={t.title}
        >
            <div className={`flex items-center gap-2`}>
                <span
                    className={`text-lg leading-none`}
                    aria-hidden
                    data-testid={`weather-expandable-emoji`}
                >
                    {emoji}
                </span>
                <div className={`flex items-center gap-1.5 text-sm`}>
                    <Thermometer
                        className={`text-muted-foreground h-3.5 w-3.5`}
                        aria-hidden
                    />
                    <span
                        className={`font-semibold`}
                        data-testid={`weather-expandable-temperature`}
                    >
                        {temperatureText}
                    </span>
                    <span className={`text-muted-foreground text-xs`}>
                        {conditionText}
                    </span>
                </div>
            </div>
            <div
                className={`text-muted-foreground flex items-center gap-2 text-[10px]`}
                data-testid={`weather-expandable-header-metrics`}
            >
                {typeof precipitation === `number` && precipitation > 0 ? (
                    <span
                        className={`inline-flex items-center gap-0.5`}
                        data-testid={`weather-expandable-precipitation`}
                    >
                        <Droplets className={`h-3 w-3`} aria-hidden />
                        {`${precipitation.toFixed(1)}${t.precipitationUnit}`}
                    </span>
                ) : null}
                {typeof windSpeed === `number` ? (
                    <span
                        className={`inline-flex items-center gap-0.5`}
                        data-testid={`weather-expandable-wind`}
                    >
                        <Wind className={`h-3 w-3`} aria-hidden />
                        {`${windSpeed.toFixed(0)}${t.windUnit}`}
                    </span>
                ) : null}
            </div>
        </div>
    );

    const body = hasBody ? (
        <>
            {hasExtras ? (
                <div
                    className={`text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-[10px]`}
                    data-testid={`weather-expandable-extras`}
                >
                    {typeof data?.cloud_cover === `number` ? (
                        <span
                            className={`inline-flex items-center gap-1`}
                            title={t.cloudCoverLabel}
                            data-testid={`weather-expandable-cloud-cover`}
                        >
                            <Cloud className={`h-3 w-3`} aria-hidden />
                            {`${Math.round(data.cloud_cover)}${t.cloudCoverUnit}`}
                        </span>
                    ) : null}
                    {typeof data?.relative_humidity === `number` ? (
                        <span
                            className={`inline-flex items-center gap-1`}
                            title={t.humidityLabel}
                            data-testid={`weather-expandable-humidity`}
                        >
                            <Droplets className={`h-3 w-3`} aria-hidden />
                            {`${Math.round(data.relative_humidity)}${t.humidityUnit}`}
                        </span>
                    ) : null}
                    {typeof data?.visibility === `number` ? (
                        <span
                            className={`inline-flex items-center gap-1`}
                            title={t.visibilityLabel}
                            data-testid={`weather-expandable-visibility`}
                        >
                            <Eye className={`h-3 w-3`} aria-hidden />
                            {`${(data.visibility / 1000).toFixed(1)}${t.visibilityUnit}`}
                        </span>
                    ) : null}
                    {typeof data?.pressure_msl === `number` ? (
                        <span
                            className={`inline-flex items-center gap-1`}
                            title={t.pressureLabel}
                            data-testid={`weather-expandable-pressure`}
                        >
                            <Gauge className={`h-3 w-3`} aria-hidden />
                            {`${Math.round(data.pressure_msl)}${t.pressureUnit}`}
                        </span>
                    ) : null}
                </div>
            ) : null}

            {hasForecast ? (
                <div
                    className={cn(
                        `px-2 py-2`,
                        hasExtras && `border-border/50 border-t`
                    )}
                    data-testid={`weather-expandable-forecast`}
                >
                    <div className={`flex gap-1 overflow-x-auto pb-0.5`}>
                        {forecast!.map((day) => {
                            const dayEmoji = resolveWeatherEmoji(day.icon);
                            const minText =
                                typeof day.temp_min === `number`
                                    ? `${Math.round(day.temp_min)}°`
                                    : t.temperaturePlaceholder;
                            const maxText =
                                typeof day.temp_max === `number`
                                    ? `${Math.round(day.temp_max)}°`
                                    : t.temperaturePlaceholder;
                            return (
                                <div
                                    key={day.date}
                                    data-testid={`weather-expandable-forecast-day`}
                                    className={`bg-background/50 flex min-w-14 shrink-0 flex-col items-center gap-0.5 rounded px-1.5 py-1`}
                                >
                                    <span
                                        className={`text-muted-foreground text-[9px]`}
                                        data-testid={`weather-expandable-forecast-day-label`}
                                    >
                                        {formatDayShort(day.date, locale)}
                                    </span>
                                    <span
                                        className={`text-base leading-none`}
                                        aria-hidden
                                    >
                                        {dayEmoji}
                                    </span>
                                    <span
                                        className={`font-mono text-[10px] tabular-nums`}
                                        data-testid={`weather-expandable-forecast-day-temps`}
                                    >
                                        {`${minText}/${maxText}`}
                                    </span>
                                    {typeof day.precipitation_probability === `number` &&
                                    day.precipitation_probability > 0 ? (
                                        <span
                                            className={`text-muted-foreground inline-flex items-center gap-0.5 text-[8px]`}
                                            data-testid={`weather-expandable-forecast-day-rain`}
                                        >
                                            <Droplets
                                                className={`h-2 w-2`}
                                                aria-hidden
                                            />
                                            {`${Math.round(day.precipitation_probability)}${t.precipitationProbabilityUnit}`}
                                        </span>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                    {attribution != null ? (
                        <div
                            className={`text-muted-foreground/60 pt-0.5 text-right text-[8px]`}
                            data-testid={`weather-expandable-attribution`}
                        >
                            {attribution}
                        </div>
                    ) : null}
                </div>
            ) : attribution != null ? (
                <div
                    className={`text-muted-foreground/60 px-3 py-1.5 text-right text-[8px]`}
                    data-testid={`weather-expandable-attribution`}
                >
                    {attribution}
                </div>
            ) : null}
        </>
    ) : undefined;

    return (
        <ExpandableSection
            className={cn(`WeatherExpandable`, className)}
            style={style}
            testId={`weather-expandable`}
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
            disabled={!hasBody}
            expandLabel={t.expandLabel}
            collapseLabel={t.collapseLabel}
            header={header}
        >
            {body}
        </ExpandableSection>
    );
};

export default WeatherExpandable;
