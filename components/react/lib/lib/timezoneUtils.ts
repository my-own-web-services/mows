import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** A timezone option for display in the timezone selector. */
export interface TimezoneOption {
    value: string;
    label: string;
    offset: string;
    offsetMinutes: number;
}

/**
 * Cache keyed by date string (YYYY-MM-DD) so DST-dependent offsets are
 * recalculated when the reference date changes across DST boundaries.
 */
let cachedOptions: TimezoneOption[] | null = null;
let cachedDateKey: string | null = null;

/** Returns the UTC offset string (e.g. "+02:00") for a timezone at a given date. */
export const getTimezoneOffset = (timeZone: string, referenceDate: Date): string => {
    const tzDate = new TZDate(referenceDate, timeZone);
    return format(tzDate, `xxx`);
};

/** Returns the UTC offset in minutes for a timezone at a given date. */
const getTimezoneOffsetMinutes = (timeZone: string, referenceDate: Date): number => {
    const tzDate = new TZDate(referenceDate, timeZone);
    return -tzDate.getTimezoneOffset();
};

/**
 * Returns a sorted list of all IANA timezone options with their offsets.
 *
 * Results are cached per reference date (day granularity).
 */
export const getTimezoneOptions = (referenceDate?: Date): TimezoneOption[] => {
    const now = referenceDate ?? new Date();
    const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

    if (cachedOptions && cachedDateKey === dateKey) return cachedOptions;

    const zones = Intl.supportedValuesOf(`timeZone`);

    if (!zones.includes(`UTC`)) {
        zones.push(`UTC`);
    }

    const options: TimezoneOption[] = zones.map((zone) => {
        const offset = getTimezoneOffset(zone, now);
        const offsetMinutes = getTimezoneOffsetMinutes(zone, now);
        return {
            value: zone,
            label: `${zone} (UTC${offset})`,
            offset: `UTC${offset}`,
            offsetMinutes
        };
    });

    options.sort((a, b) => a.offsetMinutes - b.offsetMinutes);
    cachedOptions = options;
    cachedDateKey = dateKey;
    return options;
};

/** Clears the timezone options cache, forcing recalculation on next call. */
export const clearTimezoneCache = (): void => {
    cachedOptions = null;
    cachedDateKey = null;
};
