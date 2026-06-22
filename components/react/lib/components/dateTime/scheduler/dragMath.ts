/** Pure geometry for drag-to-reschedule in the time grid, kept out of React
 *  so the "where does it land" maths is unit-testable. */

import { startOfDay } from "date-fns";

import type { MoveChange } from "./types";

/** Round minutes-of-day to the nearest slot. */
export const snapMinutes = (mins: number, slot: number): number =>
    Math.round(mins / slot) * slot;

/**
 * New placement for an item dragged onto `targetDay` at `pointerMinutesOfDay`.
 * The grab offset (minutes between the item's start and where the user grabbed
 * it) is preserved so the block doesn't jump under the cursor, the start snaps
 * to `slotMinutes`, the duration is kept, and the result is clamped inside the
 * `[minHour, maxHour)` window.
 */
export const computeMove = (
    item: { start: Date; end: Date },
    targetDay: Date,
    pointerMinutesOfDay: number,
    grabOffsetMin: number,
    slotMinutes: number,
    minHour: number,
    maxHour: number
): MoveChange => {
    const durationMs = item.end.getTime() - item.start.getTime();
    const durationMin = durationMs / 60_000;
    const snapped = snapMinutes(pointerMinutesOfDay - grabOffsetMin, slotMinutes);
    const newStartMin = Math.max(
        minHour * 60,
        Math.min(snapped, maxHour * 60 - durationMin)
    );
    const start = new Date(startOfDay(targetDay).getTime() + newStartMin * 60_000);
    return { start, end: new Date(start.getTime() + durationMs), allDay: false };
};
