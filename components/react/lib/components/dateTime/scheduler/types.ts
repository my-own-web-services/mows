/**
 * Public types for {@link Scheduler} — a real calendar of time-based items
 * (events, bookings, shifts, appointments …), not a date picker. Items are
 * supplied as a flat, already-expanded list (the consumer expands
 * recurrences); the calendar lays them out, never mutates them. "Adding" an
 * item is surfaced as the {@link SlotInfo} callback `onSelectSlot`, and
 * moving one as {@link MoveChange} via `onItemMove` — the consumer owns
 * persistence so it stays a controlled display.
 */

/** The four rendering shapes the calendar can take. */
export type SchedulerView = `month` | `week` | `day` | `agenda`;

/** One item occurrence. `start`/`end` are concrete `Date`s in local time. */
export interface ScheduleItem {
    /** Stable id — used as the React key and for selection. */
    id: string;
    title: string;
    start: Date;
    /** Exclusive end. For an all-day item use the next midnight, or set `allDay`. */
    end: Date;
    /** Renders in the all-day row / as a full-day band in month view. */
    allDay?: boolean;
    /**
     * Accent colour — any CSS colour (`#hex`, `oklch(...)`, `var(--chart-1)`).
     * Applied as a dynamic inline accent so it never fights the theme tokens.
     * Omit to fall back to the calendar's default accent.
     */
    color?: string;
    /** Optional secondary line (venue, organiser …). */
    location?: string;
    /** Renders muted and is not clickable. */
    disabled?: boolean;
    /**
     * Allow drag-to-reschedule for THIS item. Off by default so read-only
     * items (e.g. pulled from a feed) can't be moved; set it on items the
     * user owns. Requires an `onItemMove` handler on the `Scheduler`.
     */
    editable?: boolean;
    /** Arbitrary passenger data handed back in `onSelectItem`. */
    data?: unknown;
}

/** The new placement produced by dragging an item, handed to `onItemMove`. */
export interface MoveChange {
    start: Date;
    /** Exclusive end. The item's duration is preserved across a move. */
    end: Date;
    allDay: boolean;
}

/** A time range the user picked in an empty part of the grid ("add here"). */
export interface SlotInfo {
    start: Date;
    /** Exclusive end. */
    end: Date;
    allDay: boolean;
    /** Which view produced the selection. */
    view: SchedulerView;
}

/** First day of the week, Sunday = 0 … Saturday = 6 (date-fns convention). */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;
