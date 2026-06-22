import opening_hours from "opening_hours";

/**
 * Visual tone of the live "status" line. `open` is the calm, positive
 * state, `closingSoon` is the urgent warning state, `closed` is the
 * neutral / muted state. Callers can map tones to their own design
 * tokens via the component's `toneClassName` prop if they want to opt
 * out of the built-in semantic colours.
 */
export type OpeningHoursTone = `open` | `closingSoon` | `closed`;

/**
 * Live status for an opening-hours value at a given moment, shaped
 * for direct rendering. Produced by `buildOpeningHoursStatus`; the
 * `headline` is the bold label, the optional `detail` is the dimmer
 * trailing fragment, and `tone` is the colour bucket.
 */
export interface OpeningHoursStatus {
    readonly tone: OpeningHoursTone;
    readonly headline: string;
    readonly detail?: string;
}

export interface OpeningHoursInterval {
    /** Inclusive start of the open window, clamped to the day boundary. */
    readonly from: Date;
    /** Exclusive end of the open window, clamped to the day boundary. */
    readonly to: Date;
    /** `HH:mm` rendering of `from` in the active locale. */
    readonly fromLabel: string;
    /** `HH:mm` rendering of `to` in the active locale; midnight reads
     *  as `24:00` when the rule crosses into the next day. */
    readonly toLabel: string;
}

export interface OpeningHoursDay {
    /** Short weekday label, e.g. `Mon`, `Mo`, `Lun`. */
    readonly label: string;
    /** Full weekday label, e.g. `Monday`, `Montag`. Useful for
     *  accessibility hints and tooltips. */
    readonly longLabel: string;
    /** Midnight-aligned start of the day the row represents. */
    readonly date: Date;
    /** True when the row corresponds to the same calendar day as the
     *  reference `now` used to build the week. */
    readonly isToday: boolean;
    /** Open intervals during the day, clamped to its boundaries. */
    readonly intervals: ReadonlyArray<OpeningHoursInterval>;
}

export type OpeningHoursWeek = ReadonlyArray<OpeningHoursDay>;

/**
 * Combined parsed shape. Pass directly via the component's `schedule`
 * prop when you want to keep parsing out of the render path (e.g. for
 * SSR, batched fetches, or testing).
 */
export interface OpeningHoursSchedule {
    readonly status: OpeningHoursStatus | null;
    readonly week: OpeningHoursWeek;
}

/**
 * Translation strings for the visible chrome. Placeholders use
 * `{name}` syntax and are substituted at render time so the strings
 * stay plain data (and translators can reorder them freely).
 *
 *  | Key              | Placeholders          | Notes |
 *  |------------------|-----------------------|-------|
 *  | open             | —                     | Bold headline when open |
 *  | closed           | —                     | Bold headline when closed |
 *  | closingSoon      | —                     | Headline when < 60 min remain |
 *  | alwaysOpen       | —                     | Headline for `24/7` rules |
 *  | closesAt         | {time}                | "closes at 18:00" |
 *  | closesOnDay      | {weekday}, {time}     | "closes Saturday at 18:00" |
 *  | closingInMinutes | {count}, {unit}, {time} | "in 5 minutes (at 18:00)" |
 *  | opensAt          | {time}                | "opens at 09:00" |
 *  | opensTomorrow    | {time}                | "opens tomorrow at 09:00" |
 *  | opensOnDay       | {weekday}, {time}     | "opens Monday at 09:00" |
 *  | minute / minutes | —                     | singular / plural unit |
 *  | closedDay        | —                     | placeholder when a day has no intervals |
 *  | scheduleLabel    | —                     | aria-label / heading for the week table |
 */
export interface OpeningHoursStrings {
    readonly open: string;
    readonly closed: string;
    readonly closingSoon: string;
    readonly alwaysOpen: string;
    readonly closesAt: string;
    readonly closesOnDay: string;
    readonly closingInMinutes: string;
    readonly opensAt: string;
    readonly opensTomorrow: string;
    readonly opensOnDay: string;
    readonly minute: string;
    readonly minutes: string;
    readonly closedDay: string;
    readonly scheduleLabel: string;
}

export const DEFAULT_OPENING_HOURS_STRINGS: OpeningHoursStrings = {
    open: `Open`,
    closed: `Closed`,
    closingSoon: `Closing soon`,
    alwaysOpen: `Open 24/7`,
    closesAt: `closes at {time}`,
    closesOnDay: `closes {weekday} at {time}`,
    closingInMinutes: `in {count} {unit} (at {time})`,
    opensAt: `opens at {time}`,
    opensTomorrow: `opens tomorrow at {time}`,
    opensOnDay: `opens {weekday} at {time}`,
    minute: `minute`,
    minutes: `minutes`,
    closedDay: `closed`,
    scheduleLabel: `Opening hours`
};

const OPENING_HOURS_STRINGS_DE: OpeningHoursStrings = {
    open: `Geöffnet`,
    closed: `Geschlossen`,
    closingSoon: `Schließt bald`,
    alwaysOpen: `Durchgehend geöffnet`,
    closesAt: `schließt um {time}`,
    closesOnDay: `schließt {weekday} um {time}`,
    closingInMinutes: `in {count} {unit} (um {time})`,
    opensAt: `öffnet um {time}`,
    opensTomorrow: `öffnet morgen um {time}`,
    opensOnDay: `öffnet {weekday} um {time}`,
    minute: `Minute`,
    minutes: `Minuten`,
    closedDay: `geschlossen`,
    scheduleLabel: `Öffnungszeiten`
};

/**
 * Built-in translations, keyed by BCP 47 locale. Lookups walk the
 * locale tag from most specific to least — `de-DE` falls through to
 * `de`, and anything unrecognised lands on the English defaults — so
 * an exact match isn't required.
 *
 * Extend this map (or override via the `strings` prop) when a
 * consumer needs a locale we don't ship.
 */
export const OPENING_HOURS_STRINGS_BY_LOCALE: Readonly<
    Record<string, OpeningHoursStrings>
> = {
    "en": DEFAULT_OPENING_HOURS_STRINGS,
    "en-US": DEFAULT_OPENING_HOURS_STRINGS,
    "en-GB": DEFAULT_OPENING_HOURS_STRINGS,
    de: OPENING_HOURS_STRINGS_DE,
    "de-DE": OPENING_HOURS_STRINGS_DE,
    "de-AT": OPENING_HOURS_STRINGS_DE,
    "de-CH": OPENING_HOURS_STRINGS_DE
};

/**
 * Resolve the built-in strings for a locale, walking the BCP 47 tag
 * (`de-DE` → `de`) before falling back to English. Exposed for
 * consumers that pre-render or need the same lookup outside the
 * component.
 */
export const resolveOpeningHoursStrings = (
    locale: string | undefined
): OpeningHoursStrings => {
    if (!locale) return DEFAULT_OPENING_HOURS_STRINGS;
    if (OPENING_HOURS_STRINGS_BY_LOCALE[locale]) {
        return OPENING_HOURS_STRINGS_BY_LOCALE[locale];
    }
    const base = locale.split(`-`)[0];
    if (base !== locale && OPENING_HOURS_STRINGS_BY_LOCALE[base]) {
        return OPENING_HOURS_STRINGS_BY_LOCALE[base];
    }
    return DEFAULT_OPENING_HOURS_STRINGS;
};

/**
 * Visual variants. `full` shows the status pill and the 7-day table,
 * `status` only the live status line, `week` only the table. Use
 * `inline` for a single-row layout that omits the table entirely and
 * pads the status to flow with surrounding prose.
 */
export type OpeningHoursVariant = `full` | `status` | `week` | `inline`;

const formatHHMM = (date: Date, locale: string | undefined): string => {
    return new Intl.DateTimeFormat(locale, {
        hour: `2-digit`,
        minute: `2-digit`,
        hour12: false
    }).format(date);
};

const substitute = (
    template: string,
    values: Readonly<Record<string, string | number>>
): string => {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
        const value = values[key];
        return value === undefined ? `` : String(value);
    });
};

/**
 * Build the live status block. Returns `null` when `oh` is null so
 * callers can fan in pre-parsed and rules-driven flows without a
 * conditional. The status is fully derived from `now`; pass a fixed
 * timestamp for tests / SSR snapshots.
 *
 * The three-tone result lets the caller distinguish "comfortably open"
 * (`open`) from "closes within an hour" (`closingSoon`) so callers can
 * surface urgency without changing the headline every minute. Rules
 * with no future change (`24/7`, permanently closed) collapse to a
 * single-headline result with no `detail`.
 */
export const buildOpeningHoursStatus = (
    oh: opening_hours | null,
    now: Date,
    options: {
        readonly locale: string | undefined;
        readonly strings: OpeningHoursStrings;
    }
): OpeningHoursStatus | null => {
    if (!oh) return null;
    const { locale, strings } = options;
    const isOpen = oh.getState(now);
    const next = oh.getNextChange(now);

    if (!next) {
        return {
            tone: isOpen ? `open` : `closed`,
            headline: isOpen ? strings.alwaysOpen : strings.closed
        };
    }

    const diffMin = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 60000));
    const sameDay = next.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = next.toDateString() === tomorrow.toDateString();
    const time = formatHHMM(next, locale);
    const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: `long` }).format(next);

    if (isOpen) {
        if (diffMin < 60) {
            const unit = diffMin === 1 ? strings.minute : strings.minutes;
            return {
                tone: `closingSoon`,
                headline: strings.closingSoon,
                detail: substitute(strings.closingInMinutes, { count: diffMin, unit, time })
            };
        }
        return {
            tone: `open`,
            headline: strings.open,
            detail: sameDay
                ? substitute(strings.closesAt, { time })
                : substitute(strings.closesOnDay, { weekday: weekdayLong, time })
        };
    }

    if (sameDay) {
        return {
            tone: `closed`,
            headline: strings.closed,
            detail: substitute(strings.opensAt, { time })
        };
    }
    if (isTomorrow) {
        return {
            tone: `closed`,
            headline: strings.closed,
            detail: substitute(strings.opensTomorrow, { time })
        };
    }
    return {
        tone: `closed`,
        headline: strings.closed,
        detail: substitute(strings.opensOnDay, { weekday: weekdayLong, time })
    };
};

/**
 * Build a 7-row Mo–So (or Su–Sa, depending on `weekStart`) schedule
 * rooted at the start-of-week of `now`. Each day's open intervals are
 * clamped to the day boundary so a `22:00–02:00` rule renders as
 * `22:00–24:00` on day N and `00:00–02:00` on day N+1, matching how
 * users mentally segment overnight hours.
 *
 * The current day is flagged via `isToday` so renderers can highlight
 * it without re-deriving the comparison.
 */
export const buildOpeningHoursWeek = (
    oh: opening_hours | null,
    now: Date,
    options: {
        readonly locale: string | undefined;
        readonly weekStart?: `monday` | `sunday`;
    }
): OpeningHoursWeek => {
    if (!oh) return [];
    const { locale, weekStart = `monday` } = options;
    const startOffset = weekStart === `monday` ? 1 : 0;
    const todayIdx = (now.getDay() - startOffset + 7) % 7;

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - todayIdx);

    const shortFmt = new Intl.DateTimeFormat(locale, { weekday: `short` });
    const longFmt = new Intl.DateTimeFormat(locale, { weekday: `long` });

    return Array.from({ length: 7 }, (_, i): OpeningHoursDay => {
        const dayStart = new Date(start);
        dayStart.setDate(start.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        let raw: ReturnType<opening_hours[`getOpenIntervals`]> = [];
        try {
            raw = oh.getOpenIntervals(dayStart, dayEnd);
        } catch {
            // opening_hours.js throws on certain rule shapes mid-week;
            // swallow so one bad day doesn't blank the whole table.
            raw = [];
        }
        const intervals: OpeningHoursInterval[] = raw.map(([from, to]) => {
            const clampedFrom = from < dayStart ? new Date(dayStart) : from;
            const clampedTo = to > dayEnd ? new Date(dayEnd) : to;
            const fromLabel = formatHHMM(clampedFrom, locale);
            // A rule that runs to midnight reports the next day's 00:00 — render
            // as 24:00 so the row reads "open until end of day" rather than
            // implying a midnight close that wraps backwards.
            const toLabel = clampedTo.getTime() >= dayEnd.getTime() ? `24:00` : formatHHMM(clampedTo, locale);
            return { from: clampedFrom, to: clampedTo, fromLabel, toLabel };
        });

        return {
            label: shortFmt.format(dayStart),
            longLabel: longFmt.format(dayStart),
            date: dayStart,
            isToday: i === todayIdx,
            intervals
        };
    });
};

/**
 * Parse a raw OSM `opening_hours` tag. Returns `null` when `raw` is
 * empty or the value is so malformed that `opening_hours.js` rejects
 * it outright — both cases are common in real OSM data, so callers
 * should treat `null` as "no schedule available" rather than an
 * error. Wraps construction in a try/catch so a single garbage tag
 * doesn't blank the surrounding UI.
 */
export const parseOsmOpeningHours = (raw: string | null | undefined): opening_hours | null => {
    if (!raw || !raw.trim()) return null;
    try {
        return new opening_hours(raw, null);
    } catch {
        return null;
    }
};

/**
 * One-shot helper: parse, build status, build week. The component
 * uses this internally; callers can use it when they want to do the
 * work outside React (SSR, lists with hundreds of rows, etc.) and
 * pass the result via the `schedule` + `status` props.
 */
export const parseOsmOpeningHoursSchedule = (
    raw: string | null | undefined,
    now: Date,
    options: {
        readonly locale: string | undefined;
        readonly strings?: Partial<OpeningHoursStrings>;
        readonly weekStart?: `monday` | `sunday`;
    }
): OpeningHoursSchedule => {
    const oh = parseOsmOpeningHours(raw);
    const strings = { ...DEFAULT_OPENING_HOURS_STRINGS, ...options.strings };
    return {
        status: buildOpeningHoursStatus(oh, now, { locale: options.locale, strings }),
        week: buildOpeningHoursWeek(oh, now, { locale: options.locale, weekStart: options.weekStart })
    };
};
