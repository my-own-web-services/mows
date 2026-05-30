import { cn } from "@/lib/utils";
import { Droplet, Droplets, Wind } from "lucide-react";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
    DEFAULT_WEATHER_CHIP_STRINGS,
    resolveConditionLabel,
    resolveWeatherIcon,
    type WeatherChipStrings,
    type WeatherMode,
    type WeatherRecord
} from "./types";

export interface WeatherChipProps {
    /**
     * Weather sample to render. Pass `null` (or omit) to render the
     * "no data yet" silhouette — useful while a fetch is in flight or
     * when the surrounding feature is disabled.
     */
    readonly data?: WeatherRecord | null;
    /**
     * Which time the sample describes. Drives the footer label. Defaults
     * to `"current"`.
     */
    readonly mode?: WeatherMode;
    /**
     * Timestamp the sample describes. Required when `mode` is
     * `"historical"` or `"forecast"` so the footer can render the
     * formatted time; ignored in `"current"` mode (which renders the
     * `modeCurrent` string verbatim).
     */
    readonly at?: Date | number | string | null;
    /**
     * Render a small spinner glyph next to the time label. Useful while
     * the consumer is fetching fresh data; the existing data stays
     * visible so the chip doesn't flicker.
     */
    readonly loading?: boolean;
    /**
     * Error message to show below the readout. Pass `null`/omit when
     * there's no error.
     */
    readonly error?: string | null;
    /**
     * Attribution line shown beneath the chip ("© DWD", "Bright Sky",
     * etc.). Pass `null` / omit to hide.
     */
    readonly attribution?: ReactNode;
    /**
     * Replace individual translated strings (condition labels, mode
     * labels, units). Anything not overridden falls back to
     * `DEFAULT_WEATHER_CHIP_STRINGS` (English).
     */
    readonly strings?: Partial<WeatherChipStrings>;
    /**
     * BCP-47 locale tag used to format the timestamp in `historical` /
     * `forecast` modes. Defaults to the user's browser locale.
     */
    readonly locale?: string;
    /**
     * Override the time label entirely. Receives the resolved
     * timestamp, mode, and active strings; should return a `ReactNode`.
     * Use this when the default `<mode> · <date>` shape doesn't fit
     * your surrounding chrome.
     */
    readonly formatTimeLabel?: (args: {
        readonly date: Date | null;
        readonly mode: WeatherMode;
        readonly strings: WeatherChipStrings;
        readonly locale: string | undefined;
    }) => ReactNode;
    /**
     * Override the temperature formatter. Receives the raw temperature
     * (or `null`/`undefined`) and the strings; should return the text
     * (units included). Default rounds to integer and appends the
     * `temperatureUnit` string.
     */
    readonly formatTemperature?: (
        temperature: number | null | undefined,
        strings: WeatherChipStrings
    ) => string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

const toDate = (value: Date | number | string | null | undefined): Date | null => {
    if (value === null || value === undefined) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
};

const defaultTemperatureFormat = (
    temperature: number | null | undefined,
    strings: WeatherChipStrings
): string => {
    if (typeof temperature !== `number` || !Number.isFinite(temperature)) {
        return strings.temperaturePlaceholder;
    }
    return `${Math.round(temperature)}${strings.temperatureUnit}`;
};

/**
 * WeatherChip — glass-card readout showing temperature, condition, and
 * supporting metrics for a point in time.
 *
 *   ┌──────────────────────────┐
 *   │  ☀  16°C                 │
 *   │     Dry                  │
 *   │  Now                     │
 *   │  💧 0.0 mm  💨 12 km/h    │
 *   │  © DWD                   │
 *   └──────────────────────────┘
 *
 * Data-source agnostic: the consumer fetches the record (BrightSky,
 * OpenWeather, a server enrichment endpoint, …) and forwards it via
 * the `data` prop. The chip handles layout, icon resolution,
 * formatting, and i18n.
 *
 * Positioning is the consumer's responsibility — the chip renders as
 * an inline-block. Place it absolutely over a `<Map>`, drop it into a
 * sidebar, or stack several to compose a small forecast strip.
 */
export const WeatherChip = ({
    data,
    mode = `current`,
    at,
    loading = false,
    error,
    attribution,
    strings,
    locale,
    formatTimeLabel,
    formatTemperature,
    className,
    style
}: WeatherChipProps) => {
    const t = useMemo(
        () => ({ ...DEFAULT_WEATHER_CHIP_STRINGS, ...strings }),
        [strings]
    );

    const IconComponent = useMemo(() => resolveWeatherIcon(data?.icon), [data?.icon]);
    const temperatureText = (formatTemperature ?? defaultTemperatureFormat)(
        data?.temperature,
        t
    );
    const conditionText = resolveConditionLabel(data?.condition, t);

    const date = useMemo(() => toDate(at), [at]);

    const timeLabel = useMemo<ReactNode>(() => {
        if (formatTimeLabel) {
            return formatTimeLabel({ date, mode, strings: t, locale });
        }
        if (mode === `current` || date === null) {
            return t.modeCurrent;
        }
        const formatter = new Intl.DateTimeFormat(locale, {
            weekday: `short`,
            day: `numeric`,
            month: `short`,
            hour: `2-digit`,
            minute: `2-digit`
        });
        const prefix = mode === `forecast` ? t.modeForecast : t.modeHistorical;
        return `${prefix}${t.modeTimeSeparator}${formatter.format(date)}`;
    }, [formatTimeLabel, date, mode, t, locale]);

    const precipitation = data?.precipitation;
    const wind = data?.windSpeed;
    const humidity = data?.relativeHumidity;
    const hasMetricsRow =
        typeof precipitation === `number` ||
        typeof wind === `number` ||
        typeof humidity === `number`;

    return (
        <div
            role={`region`}
            aria-label={t.title}
            data-testid={`weather-chip`}
            data-mode={mode}
            data-state={loading ? `loading` : error ? `error` : `ready`}
            className={cn(
                `WeatherChip bg-card/90 border-border text-foreground flex min-w-[180px] flex-col rounded-lg border px-4 py-3 shadow-lg backdrop-blur`,
                className
            )}
            style={style}
        >
            <div className={`flex items-center gap-3`}>
                <IconComponent
                    aria-hidden
                    className={`text-foreground size-8 shrink-0`}
                    strokeWidth={1.75}
                />
                <div className={`flex min-w-0 flex-col`}>
                    <span
                        className={`text-2xl leading-tight font-semibold tabular-nums`}
                        data-testid={`weather-chip-temperature`}
                    >
                        {temperatureText}
                    </span>
                    <span className={`text-muted-foreground truncate text-xs`}>
                        {conditionText}
                    </span>
                </div>
            </div>

            <div
                className={`text-muted-foreground mt-2 flex items-center justify-between gap-3 text-[10px]`}
            >
                <span data-testid={`weather-chip-time`}>{timeLabel}</span>
                {loading ? (
                    <span
                        role={`status`}
                        aria-label={t.loadingLabel}
                        className={`bg-muted-foreground/60 size-1.5 animate-pulse rounded-full`}
                    />
                ) : null}
            </div>

            {hasMetricsRow ? (
                <div
                    className={`text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums`}
                    data-testid={`weather-chip-metrics`}
                >
                    {typeof precipitation === `number` ? (
                        <span className={`inline-flex items-center gap-1`}>
                            <Droplet aria-hidden className={`size-3`} strokeWidth={2} />
                            {`${precipitation.toFixed(1)}${t.precipitationUnit}`}
                        </span>
                    ) : null}
                    {typeof wind === `number` ? (
                        <span className={`inline-flex items-center gap-1`}>
                            <Wind aria-hidden className={`size-3`} strokeWidth={2} />
                            {`${Math.round(wind)}${t.windUnit}`}
                        </span>
                    ) : null}
                    {typeof humidity === `number` ? (
                        <span className={`inline-flex items-center gap-1`}>
                            <Droplets aria-hidden className={`size-3`} strokeWidth={2} />
                            {`${Math.round(humidity)}${t.humidityUnit}`}
                        </span>
                    ) : null}
                </div>
            ) : null}

            {error ? (
                <div
                    role={`alert`}
                    className={`text-destructive mt-1 text-[10px]`}
                    data-testid={`weather-chip-error`}
                >
                    {error}
                </div>
            ) : null}

            {attribution ? (
                <div className={`text-muted-foreground/60 mt-1 text-[9px]`}>
                    {attribution}
                </div>
            ) : null}
        </div>
    );
};

export default WeatherChip;
