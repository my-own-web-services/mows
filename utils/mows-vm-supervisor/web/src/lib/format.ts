// Tiny formatting helpers for the VM detail panel.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact human-readable duration: "12s", "4m 13s", "2h 14m", "3d 4h".
 */
export const formatDuration = (ms: number): string => {
    if (ms < 0) return "0s";
    if (ms < MINUTE) return `${Math.floor(ms / SECOND)}s`;
    if (ms < HOUR) {
        const m = Math.floor(ms / MINUTE);
        const s = Math.floor((ms % MINUTE) / SECOND);
        return s === 0 ? `${m}m` : `${m}m ${s}s`;
    }
    if (ms < DAY) {
        const h = Math.floor(ms / HOUR);
        const m = Math.floor((ms % HOUR) / MINUTE);
        return m === 0 ? `${h}h` : `${h}h ${m}m`;
    }
    const d = Math.floor(ms / DAY);
    const h = Math.floor((ms % DAY) / HOUR);
    return h === 0 ? `${d}d` : `${d}d ${h}h`;
};

const relativeFormatterCache = new Map<string, Intl.RelativeTimeFormat>();
const getRelativeFormatter = (locale?: string): Intl.RelativeTimeFormat => {
    const key = locale ?? "default";
    let fmt = relativeFormatterCache.get(key);
    if (!fmt) {
        fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        relativeFormatterCache.set(key, fmt);
    }
    return fmt;
};

/**
 * "5 minutes ago" / "in 2 hours" — best granularity for the magnitude.
 *
 * Pass `locale` (e.g. `"de-DE"`) to match the user's active language and
 * avoid mixing English with localised relative-time strings.
 */
export const formatRelative = (
    date: Date,
    now: Date = new Date(),
    locale?: string
): string => {
    const fmt = getRelativeFormatter(locale);
    const diffMs = date.getTime() - now.getTime();
    const abs = Math.abs(diffMs);
    if (abs < MINUTE) return fmt.format(Math.round(diffMs / SECOND), "second");
    if (abs < HOUR) return fmt.format(Math.round(diffMs / MINUTE), "minute");
    if (abs < DAY) return fmt.format(Math.round(diffMs / HOUR), "hour");
    return fmt.format(Math.round(diffMs / DAY), "day");
};

/** "2 GB" / "512 MB" / "768 KB". */
export const formatBytes = (mb: number): string => {
    if (mb >= 1024) {
        const gb = mb / 1024;
        return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`;
    }
    return `${mb} MB`;
};
