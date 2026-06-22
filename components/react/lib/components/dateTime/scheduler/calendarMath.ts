/**
 * Pure date helpers for {@link Scheduler}. Math goes through `date-fns`
 * (locale-agnostic, with an explicit `weekStartsOn`); all *display* strings
 * go through `Intl.DateTimeFormat` so we get correct localisation for every
 * language without bundling per-locale data.
 */

import {
    addDays,
    addMonths,
    addWeeks,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek
} from "date-fns";

import type { ScheduleItem, SchedulerView, WeekStart } from "./types";

/** Number of days an agenda window spans forward from the focused date. */
export const AGENDA_DAYS = 42;

/**
 * First day of the week for a locale. Prefers the modern
 * `Intl.Locale().weekInfo` (1 = Mon … 7 = Sun); falls back to Sunday for
 * `en`/`he`/`ar`-style locales and Monday (ISO) otherwise.
 */
export const resolveWeekStart = (locale: string): WeekStart => {
    try {
        const info = (new Intl.Locale(locale) as { weekInfo?: { firstDay?: number } }).weekInfo;
        if (info?.firstDay) {
            return (info.firstDay === 7 ? 0 : info.firstDay) as WeekStart;
        }
    } catch {
        /* older engines: fall through */
    }
    const lc = locale.toLowerCase();
    return lc.startsWith(`en`) || lc.startsWith(`he`) || lc.startsWith(`ar`) ? 0 : 1;
};

/** Days that make up a month grid: full weeks covering the focused month. */
export const monthMatrix = (date: Date, weekStartsOn: WeekStart): Date[][] => {
    const start = startOfWeek(startOfMonth(date), { weekStartsOn });
    const end = endOfWeek(endOfMonth(date), { weekStartsOn });
    const days = eachDayOfInterval({ start, end });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7));
    }
    return weeks;
};

/** The day columns a time-grid view shows (week = 7, day = 1). */
export const gridDays = (view: SchedulerView, date: Date, weekStartsOn: WeekStart): Date[] => {
    if (view === `day`) {
        return [startOfDay(date)];
    }
    const start = startOfWeek(date, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Move the focused date by one unit in the current view's direction. */
export const step = (view: SchedulerView, date: Date, dir: -1 | 1): Date => {
    switch (view) {
        case `month`:
            return addMonths(date, dir);
        case `week`:
            return addWeeks(date, dir);
        case `agenda`:
            return addDays(date, dir * AGENDA_DAYS);
        case `day`:
        default:
            return addDays(date, dir);
    }
};

/** Localised ordered weekday short names starting at `weekStartsOn`. */
export const weekdayHeadings = (
    locale: string,
    weekStartsOn: WeekStart,
    width: `short` | `narrow` = `short`
): string[] => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: width });
    // 2021-08-01 is a Sunday — a stable anchor independent of "today".
    const sunday = new Date(2021, 7, 1);
    return Array.from({ length: 7 }, (_, i) =>
        fmt.format(addDays(sunday, (weekStartsOn + i) % 7))
    );
};

/** The toolbar title for the current view + focused date. */
export const formatTitle = (
    view: SchedulerView,
    date: Date,
    locale: string,
    weekStartsOn: WeekStart
): string => {
    if (view === `month`) {
        return new Intl.DateTimeFormat(locale, { month: `long`, year: `numeric` }).format(date);
    }
    if (view === `day`) {
        return new Intl.DateTimeFormat(locale, {
            weekday: `long`,
            day: `numeric`,
            month: `long`,
            year: `numeric`
        }).format(date);
    }
    if (view === `agenda`) {
        // A month-level range reads far cleaner than the arbitrary
        // "16 Jun – 27 Jul" day span the window would otherwise produce;
        // the per-day calendar-week (KW) labels carry the finer detail.
        const end = addDays(date, AGENDA_DAYS - 1);
        if (isSameMonth(date, end)) {
            return new Intl.DateTimeFormat(locale, { month: `long`, year: `numeric` }).format(date);
        }
        const sameYear = date.getFullYear() === end.getFullYear();
        const startMonth = new Intl.DateTimeFormat(locale, {
            month: `long`,
            ...(sameYear ? {} : { year: `numeric` })
        }).format(date);
        const endMonth = new Intl.DateTimeFormat(locale, {
            month: `long`,
            year: `numeric`
        }).format(end);
        return `${startMonth} – ${endMonth}`;
    }
    // week
    const start = startOfWeek(date, { weekStartsOn });
    const end = addDays(start, 6);
    return formatRange(start, end, locale);
};

/** "10.–16. Juni 2026" / "Jun 10 – 16, 2026" style range, collapsing shared parts. */
export const formatRange = (start: Date, end: Date, locale: string): string => {
    const sameMonth = isSameMonth(start, end);
    const sameYear = start.getFullYear() === end.getFullYear();
    const dayFmt = new Intl.DateTimeFormat(locale, { day: `numeric` });
    const dayMonthFmt = new Intl.DateTimeFormat(locale, { day: `numeric`, month: `short` });
    const fullFmt = new Intl.DateTimeFormat(locale, {
        day: `numeric`,
        month: `short`,
        year: `numeric`
    });
    if (sameMonth && sameYear) {
        const year = new Intl.DateTimeFormat(locale, { year: `numeric` }).format(start);
        return `${dayFmt.format(start)} – ${dayMonthFmt.format(end)} ${year}`;
    }
    return `${fullFmt.format(start)} – ${fullFmt.format(end)}`;
};

/** "16:00", locale-aware (24h vs 12h follows the locale). */
export const timeLabel = (date: Date, locale: string): string =>
    new Intl.DateTimeFormat(locale, { hour: `numeric`, minute: `2-digit` }).format(date);

/** "Mo., 16. Juni" style label for agenda day headers. */
export const dayHeadingLabel = (date: Date, locale: string): string =>
    new Intl.DateTimeFormat(locale, {
        weekday: `short`,
        day: `numeric`,
        month: `long`
    }).format(date);

/** Stable per-day key (`2026-06-16`) for grouping/memoisation. */
export const dayKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, `0`);
    const d = `${date.getDate()}`.padStart(2, `0`);
    return `${y}-${m}-${d}`;
};

/** Does an event overlap the given calendar day at all? */
export const eventOnDay = (event: ScheduleItem, day: Date): boolean => {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    return event.start < dayEnd && event.end > dayStart;
};

/** Sort by start, then longer-first so multi-day/wide events anchor left. */
export const byStartThenLength = (a: ScheduleItem, b: ScheduleItem): number =>
    a.start.getTime() - b.start.getTime() ||
    b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime());

export { isSameDay, isSameMonth, startOfDay, startOfWeek, addDays };
