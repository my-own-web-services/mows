/** Month grid. Empty space in a day cell is a full-cell "add here" button
 *  sitting *behind* the event chips (the content layer is pointer-events-none
 *  so clicks fall through to it, while each chip re-enables pointer events) —
 *  that keeps every interactive surface a real library Button. */

import { startOfDay } from "date-fns";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
    byStartThenLength,
    dayKey,
    eventOnDay,
    isSameDay,
    isSameMonth,
    monthMatrix,
    timeLabel,
    weekdayHeadings
} from "./calendarMath";
import { eventAccent, eventTint } from "./eventStyle";
import type { SchedulerStrings } from "./strings";
import type { ScheduleItem, SlotInfo, WeekStart } from "./types";

export interface MonthViewProps {
    date: Date;
    events: ScheduleItem[];
    locale: string;
    strings: SchedulerStrings;
    weekStartsOn: WeekStart;
    /** Max chips before "+N more". */
    maxPerCell?: number;
    onSelectItem?: (event: ScheduleItem) => void;
    onSelectSlot?: (slot: SlotInfo) => void;
    onShowMore?: (day: Date) => void;
}

const MonthView = ({
    date,
    events,
    locale,
    strings,
    weekStartsOn,
    maxPerCell = 3,
    onSelectItem,
    onSelectSlot,
    onShowMore
}: MonthViewProps) => {
    const weeks = monthMatrix(date, weekStartsOn);
    const headings = weekdayHeadings(locale, weekStartsOn);
    const today = new Date();

    const slotFor = (day: Date): SlotInfo => {
        const start = startOfDay(day);
        return { start, end: new Date(start.getTime() + 86_400_000), allDay: true, view: `month` };
    };

    return (
        <div className={`flex min-h-0 flex-1 flex-col`}>
            <div className={`grid grid-cols-7 border-b border-border`}>
                {headings.map((h, i) => (
                    <div
                        key={i}
                        className={`px-2 py-1.5 text-center text-xs font-medium text-muted-foreground`}
                    >
                        {h}
                    </div>
                ))}
            </div>
            <div
                className={`grid flex-1 grid-cols-7`}
                style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            >
                {weeks.flat().map((day) => {
                    const inMonth = isSameMonth(day, date);
                    const isToday = isSameDay(day, today);
                    const dayEvents = events
                        .filter((e) => eventOnDay(e, day))
                        .sort(byStartThenLength);
                    const shown = dayEvents.slice(0, maxPerCell);
                    const overflow = dayEvents.length - shown.length;

                    return (
                        <div
                            key={dayKey(day)}
                            className={cn(
                                `relative min-h-24 border-r border-b border-border`,
                                !inMonth && `bg-muted/30`
                            )}
                        >
                            <Button
                                variant={`ghost`}
                                onClick={() => onSelectSlot?.(slotFor(day))}
                                aria-label={`${strings.addEvent} – ${day.toDateString()}`}
                                className={cn(
                                    `absolute inset-0 h-full w-full rounded-none p-0`,
                                    `hover:bg-accent/40`
                                )}
                            />
                            <div className={`pointer-events-none relative flex h-full flex-col gap-0.5 p-1`}>
                                <div className={`flex justify-end`}>
                                    <span
                                        className={cn(
                                            `flex size-6 items-center justify-center rounded-full text-xs tabular-nums`,
                                            isToday && `bg-primary font-semibold text-primary-foreground`,
                                            !isToday && inMonth && `text-foreground`,
                                            !isToday && !inMonth && `text-muted-foreground`
                                        )}
                                    >
                                        {day.getDate()}
                                    </span>
                                </div>
                                <div className={`flex min-h-0 flex-col gap-0.5 overflow-hidden`}>
                                    {shown.map((event) => (
                                        <Button
                                            key={event.id}
                                            variant={`ghost`}
                                            disabled={event.disabled}
                                            onClick={() => onSelectItem?.(event)}
                                            style={{ backgroundColor: eventTint(event.color) }}
                                            className={cn(
                                                `pointer-events-auto flex h-5 w-full min-w-0 items-center gap-1`,
                                                `justify-start rounded-sm px-1 text-left text-xs font-medium`,
                                                `text-foreground hover:brightness-95`
                                            )}
                                        >
                                            <span
                                                className={`h-2.5 w-1 shrink-0 rounded-full`}
                                                style={{ backgroundColor: eventAccent(event.color) }}
                                            />
                                            {!event.allDay && (
                                                <span className={`shrink-0 tabular-nums opacity-70`}>
                                                    {timeLabel(event.start, locale)}
                                                </span>
                                            )}
                                            <span className={`truncate`}>{event.title}</span>
                                        </Button>
                                    ))}
                                    {overflow > 0 && (
                                        <Button
                                            variant={`ghost`}
                                            onClick={() => onShowMore?.(day)}
                                            className={cn(
                                                `pointer-events-auto h-5 w-full justify-start rounded-sm px-1`,
                                                `text-xs font-medium text-muted-foreground hover:text-foreground`
                                            )}
                                        >
                                            {strings.moreEvents.replace(`{count}`, `${overflow}`)}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MonthView;
