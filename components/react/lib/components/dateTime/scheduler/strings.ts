/** Translatable strings for {@link Scheduler}. The shape is owned by the
 *  core `Translation` interface (`lib/lib/languages.ts`); we derive the type
 *  from there so the component and the translations can never drift, and ship
 *  an English fallback for rendering outside a `MowsProvider` (tests). */

import type { Translation } from "@/lib/languages";

export type SchedulerStrings = Translation[`scheduler`];

/** English fallback used when the component renders without a provider. */
export const DEFAULT_SCHEDULER_STRINGS: SchedulerStrings = {
    ariaLabel: `Event calendar`,
    today: `Today`,
    previous: `Previous`,
    next: `Next`,
    addEvent: `Add event`,
    allDay: `All day`,
    noEvents: `No events`,
    moreEvents: `+{count} more`,
    weekAbbrev: `Wk`,
    views: { month: `Month`, week: `Week`, day: `Day`, agenda: `Agenda` }
};
