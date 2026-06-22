import { addDays, startOfWeek } from "date-fns";

import type { ScheduleItem } from "../../../lib/components/dateTime/scheduler/types";

/** A small, realistic week of events anchored to the current week so every
 *  view (month / week / day / agenda) has something to show, including an
 *  overlapping pair and an all-day band. Shared across the examples. */
export const buildSampleEvents = (): ScheduleItem[] => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const at = (dayOffset: number, hour: number, minute = 0): Date => {
        const d = addDays(monday, dayOffset);
        d.setHours(hour, minute, 0, 0);
        return d;
    };
    return [
        { id: `1`, title: `Daily standup`, start: at(0, 9), end: at(0, 9, 30), color: `var(--chart-1)` },
        { id: `2`, title: `Design review`, start: at(0, 11), end: at(0, 12, 30), color: `var(--chart-2)`, location: `Studio` },
        { id: `3`, title: `1:1 with Sam`, start: at(1, 14), end: at(1, 15), color: `var(--chart-3)` },
        { id: `4`, title: `Vendor call`, start: at(1, 14, 30), end: at(1, 15, 30), color: `var(--chart-4)` },
        { id: `5`, title: `Conference`, start: addDays(monday, 2), end: addDays(monday, 3), allDay: true, color: `var(--chart-5)`, location: `Berlin` },
        { id: `6`, title: `Sprint planning`, start: at(3, 10), end: at(3, 11), color: `var(--chart-1)` },
        { id: `7`, title: `Lunch & learn`, start: at(3, 13), end: at(3, 14), color: `var(--chart-2)`, location: `Kitchen` },
        { id: `8`, title: `Release`, start: at(4, 16), end: at(4, 18), color: `var(--chart-3)` }
    ];
};
