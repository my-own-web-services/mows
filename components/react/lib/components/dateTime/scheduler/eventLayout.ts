/**
 * Pure geometry for the time-grid (week / day) views: pack overlapping
 * events into side-by-side columns and turn start/end times into
 * percentage offsets within the visible day window. Kept separate from
 * React so the packing is unit-testable in isolation.
 */

import { addDays, startOfDay } from "date-fns";

import type { ScheduleItem } from "./types";
import { byStartThenLength } from "./calendarMath";

/** An event placed in the time grid, sized in percentages of the column. */
export interface PositionedEvent {
    event: ScheduleItem;
    /** Distance from the top of the day window, 0–100. */
    topPct: number;
    /** Height as a share of the day window, 0–100 (clamped to a floor in the view). */
    heightPct: number;
    /** Horizontal offset within the day column, 0–100. */
    leftPct: number;
    /** Width within the day column, 0–100. */
    widthPct: number;
    /** True when the event is clipped because it starts before / ends after the window. */
    clippedStart: boolean;
    clippedEnd: boolean;
}

/** Greedily pack a set of overlapping events into the fewest columns. */
export const assignColumns = (
    events: ScheduleItem[]
): Array<{ event: ScheduleItem; col: number; cols: number }> => {
    const sorted = [...events].sort(byStartThenLength);
    const out: Array<{ event: ScheduleItem; col: number; cols: number }> = [];

    let cluster: ScheduleItem[] = [];
    let clusterEnd = Number.NEGATIVE_INFINITY;

    const flush = () => {
        if (cluster.length === 0) {
            return;
        }
        const colEnds: number[] = [];
        const placed: Array<{ event: ScheduleItem; col: number }> = [];
        for (const e of cluster) {
            let col = colEnds.findIndex((end) => end <= e.start.getTime());
            if (col === -1) {
                col = colEnds.length;
                colEnds.push(0);
            }
            colEnds[col] = e.end.getTime();
            placed.push({ event: e, col });
        }
        const cols = colEnds.length;
        for (const p of placed) {
            out.push({ event: p.event, col: p.col, cols });
        }
    };

    for (const e of sorted) {
        if (cluster.length > 0 && e.start.getTime() >= clusterEnd) {
            flush();
            cluster = [];
            clusterEnd = Number.NEGATIVE_INFINITY;
        }
        cluster.push(e);
        clusterEnd = Math.max(clusterEnd, e.end.getTime());
    }
    flush();
    return out;
};

/**
 * Lay out the timed events of a single day inside the `[minHour, maxHour)`
 * window. All-day events are handled separately by the view (the all-day
 * row), so callers pass only timed events here.
 */
export const layoutDayEvents = (
    events: ScheduleItem[],
    day: Date,
    minHour: number,
    maxHour: number
): PositionedEvent[] => {
    const base = startOfDay(day);
    const windowStart = base.getTime() + minHour * 3_600_000;
    const windowEnd = base.getTime() + maxHour * 3_600_000;
    const windowMs = windowEnd - windowStart;
    if (windowMs <= 0) {
        return [];
    }

    const dayEnd = addDays(base, 1).getTime();
    const visible = events.filter(
        (e) => !e.allDay && e.start.getTime() < Math.min(windowEnd, dayEnd) && e.end.getTime() > windowStart
    );

    const cols = new Map<string, { col: number; cols: number }>();
    for (const placed of assignColumns(visible)) {
        cols.set(placed.event.id, { col: placed.col, cols: placed.cols });
    }

    const GAP = 1; // % gutter between concurrent columns
    return visible.map((event) => {
        const rawStart = event.start.getTime();
        const rawEnd = event.end.getTime();
        const clampedStart = Math.max(rawStart, windowStart);
        const clampedEnd = Math.min(rawEnd, windowEnd);
        const topPct = ((clampedStart - windowStart) / windowMs) * 100;
        const heightPct = ((clampedEnd - clampedStart) / windowMs) * 100;
        const { col, cols: colCount } = cols.get(event.id) ?? { col: 0, cols: 1 };
        const colWidth = 100 / colCount;
        return {
            event,
            topPct,
            heightPct,
            leftPct: col * colWidth + (col === 0 ? 0 : GAP / 2),
            widthPct: colWidth - GAP,
            clippedStart: rawStart < windowStart,
            clippedEnd: rawEnd > windowEnd
        };
    });
};

/** Minutes from `minHour` for a y-position, used to map a click to a slot time. */
export const offsetToMinutes = (
    ratio: number,
    minHour: number,
    maxHour: number,
    snapMinutes: number
): number => {
    const total = (maxHour - minHour) * 60;
    const raw = Math.max(0, Math.min(total, ratio * total));
    return Math.round(raw / snapMinutes) * snapMinutes;
};
