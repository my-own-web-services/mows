/** Agenda / list view: upcoming events grouped by day. The most "mobile
 *  first" of the views and the one that answers "just show me the events". */

import { addDays, getISOWeek } from "date-fns";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import {
    AGENDA_DAYS,
    byStartThenLength,
    dayHeadingLabel,
    dayKey,
    eventOnDay,
    isSameDay,
    startOfDay,
    timeLabel
} from "./calendarMath";
import { eventAccent } from "./eventStyle";
import type { SchedulerStrings } from "./strings";
import type { ScheduleItem } from "./types";

export interface AgendaViewProps {
    date: Date;
    events: ScheduleItem[];
    locale: string;
    strings: SchedulerStrings;
    onSelectItem?: (event: ScheduleItem) => void;
}

const AgendaView = ({ date, events, locale, strings, onSelectItem }: AgendaViewProps) => {
    const start = startOfDay(date);
    const today = new Date();

    const groups = Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(start, i))
        .map((day) => ({
            day,
            items: events.filter((e) => eventOnDay(e, day)).sort(byStartThenLength)
        }))
        .filter((g) => g.items.length > 0);

    if (groups.length === 0) {
        return (
            <div
                className={cn(
                    `flex flex-1 flex-col items-center justify-center gap-2 py-16`,
                    `text-muted-foreground`
                )}
            >
                <CalendarRange className={`size-8 opacity-40`} />
                <p className={`text-sm`}>{strings.noEvents}</p>
            </div>
        );
    }

    return (
        <ScrollArea className={`min-h-0 flex-1`}>
            <div className={`flex flex-col gap-4 px-3 py-3`}>
                {groups.map(({ day, items }) => (
                    <section key={dayKey(day)} className={`flex flex-col gap-1`}>
                        <header
                            className={cn(
                                `sticky top-0 z-10 flex items-baseline justify-between gap-2`,
                                `bg-card/95 px-2 py-1 backdrop-blur`,
                                `text-xs font-medium uppercase tracking-wide`,
                                isSameDay(day, today) ? `text-primary` : `text-muted-foreground`
                            )}
                        >
                            <span>{dayHeadingLabel(day, locale)}</span>
                            <span className={`tabular-nums opacity-70`}>
                                {strings.weekAbbrev} {getISOWeek(day)}
                            </span>
                        </header>
                        <ul className={`flex flex-col gap-0.5`}>
                            {items.map((event) => (
                                <li key={`${dayKey(day)}:${event.id}`}>
                                    <Button
                                        variant={`ghost`}
                                        disabled={event.disabled}
                                        onClick={() => onSelectItem?.(event)}
                                        className={cn(
                                            `h-auto w-full justify-start gap-3 rounded-md px-2 py-2 text-left`
                                        )}
                                    >
                                        <span
                                            className={`mt-1 h-2 w-2 shrink-0 rounded-full`}
                                            style={{ backgroundColor: eventAccent(event.color) }}
                                        />
                                        <span className={`flex min-w-0 flex-1 flex-col`}>
                                            <span className={`truncate text-sm font-medium text-foreground`}>
                                                {event.title}
                                            </span>
                                            {event.location && (
                                                <span className={`truncate text-xs text-muted-foreground`}>
                                                    {event.location}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={`shrink-0 text-xs tabular-nums text-muted-foreground`}
                                        >
                                            {event.allDay
                                                ? strings.allDay
                                                : timeLabel(event.start, locale)}
                                        </span>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </ScrollArea>
    );
};

export default AgendaView;
