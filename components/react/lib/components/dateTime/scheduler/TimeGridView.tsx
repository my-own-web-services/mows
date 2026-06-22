/** Time-grid view shared by `week` (7 day columns) and `day` (1 column):
 *  an hour ruler, an all-day band, overlap-packed event blocks, a live
 *  now-indicator, and click-to-add on empty space. */

import {
    useEffect,
    useRef,
    useState,
    type MouseEvent,
    type PointerEvent as ReactPointerEvent
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
    byStartThenLength,
    dayKey,
    eventOnDay,
    gridDays,
    isSameDay,
    startOfDay
} from "./calendarMath";
import { computeMove } from "./dragMath";
import { eventAccent, eventTint, eventTintStrong } from "./eventStyle";
import { layoutDayEvents, offsetToMinutes } from "./eventLayout";
import type { SchedulerStrings } from "./strings";
import type { MoveChange, ScheduleItem, SchedulerView, SlotInfo, WeekStart } from "./types";

/** Minutes from midnight for a Date. */
const minutesOfDay = (d: Date): number =>
    (d.getTime() - startOfDay(d).getTime()) / 60_000;

const HOUR_PX = 48;

export interface TimeGridViewProps {
    view: Extract<SchedulerView, `week` | `day`>;
    date: Date;
    events: ScheduleItem[];
    locale: string;
    strings: SchedulerStrings;
    weekStartsOn: WeekStart;
    minHour: number;
    maxHour: number;
    slotMinutes: number;
    nowIndicator: boolean;
    onSelectItem?: (event: ScheduleItem) => void;
    onSelectSlot?: (slot: SlotInfo) => void;
    onSelectDay?: (day: Date) => void;
    onItemMove?: (event: ScheduleItem, change: MoveChange) => void;
}

const TimeGridView = ({
    view,
    date,
    events,
    locale,
    strings,
    weekStartsOn,
    minHour,
    maxHour,
    slotMinutes,
    nowIndicator,
    onSelectItem,
    onSelectSlot,
    onSelectDay,
    onItemMove
}: TimeGridViewProps) => {
    const days = gridDays(view, date, weekStartsOn);
    const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
    const totalMins = (maxHour - minHour) * 60;
    const bodyHeight = (maxHour - minHour) * HOUR_PX;
    const today = new Date();

    const bodyRef = useRef<HTMLDivElement>(null);

    // The day-header + all-day rows live OUTSIDE the vertical scroll, so when
    // the body shows a scrollbar its day columns are narrower than theirs.
    // Measure the scrollbar width and reserve it on those rows so every column
    // lines up across the whole grid.
    const [scrollbarWidth, setScrollbarWidth] = useState(0);
    useEffect(() => {
        const el = bodyRef.current;
        if (!el) {
            return;
        }
        const measure = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
        measure();
        if (typeof ResizeObserver === `undefined`) {
            return;
        }
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [days.length, hours.length]);

    // Open near the working day rather than midnight, but never past an
    // event the user is looking at.
    useEffect(() => {
        const el = bodyRef.current;
        if (!el) {
            return;
        }
        const firstStart = events
            .filter((e) => !e.allDay && days.some((d) => isSameDay(d, e.start)))
            .map((e) => e.start.getHours())
            .sort((a, b) => a - b)[0];
        const targetHour = Math.max(minHour, Math.min(firstStart ?? 8, 8));
        el.scrollTop = (targetHour - minHour) * HOUR_PX;
        // Only re-run when the focused range changes, not on every event tick.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayKey(days[0]), view]);

    const hourLabel = (h: number): string =>
        new Intl.DateTimeFormat(locale, { hour: `numeric` }).format(new Date(2021, 0, 1, h));

    const selectSlot = (day: Date, e: MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / rect.height;
        const mins = offsetToMinutes(ratio, minHour, maxHour, slotMinutes);
        const start = new Date(startOfDay(day).getTime() + (minHour * 60 + mins) * 60_000);
        onSelectSlot?.({
            start,
            end: new Date(start.getTime() + slotMinutes * 60_000),
            allDay: false,
            view
        });
    };

    // --- drag-to-reschedule (only items with `editable` + an onItemMove) ---
    const gridRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<{
        event: ScheduleItem;
        grabOffsetMin: number;
        colIndex: number;
        preview: MoveChange;
    } | null>(null);
    // True once a drag actually moves, so the click that fires on pointerup is
    // swallowed instead of selecting the item.
    const movedRef = useRef(false);

    const pointerToGrid = (clientX: number, clientY: number) => {
        const el = gridRef.current;
        if (!el) {
            return null;
        }
        const rect = el.getBoundingClientRect();
        const colWidth = rect.width / days.length;
        const colIndex = Math.max(
            0,
            Math.min(days.length - 1, Math.floor((clientX - rect.left) / colWidth))
        );
        const mins = ((clientY - rect.top) / rect.height) * totalMins + minHour * 60;
        return { colIndex, mins };
    };

    const startDrag = (event: ScheduleItem, e: ReactPointerEvent<HTMLElement>) => {
        if (!onItemMove || !event.editable || event.disabled) {
            return;
        }
        const at = pointerToGrid(e.clientX, e.clientY);
        if (!at) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        movedRef.current = false;
        setDrag({
            event,
            grabOffsetMin: at.mins - minutesOfDay(event.start),
            colIndex: at.colIndex,
            preview: { start: event.start, end: event.end, allDay: false }
        });
    };

    useEffect(() => {
        if (!drag) {
            return;
        }
        const onMove = (e: PointerEvent) => {
            const at = pointerToGrid(e.clientX, e.clientY);
            if (!at) {
                return;
            }
            const preview = computeMove(
                drag.event,
                days[at.colIndex],
                at.mins,
                drag.grabOffsetMin,
                slotMinutes,
                minHour,
                maxHour
            );
            if (
                at.colIndex !== drag.colIndex ||
                preview.start.getTime() !== drag.preview.start.getTime()
            ) {
                movedRef.current = true;
            }
            setDrag((d) => (d ? { ...d, colIndex: at.colIndex, preview } : d));
        };
        const onUp = () => {
            if (movedRef.current) {
                onItemMove?.(drag.event, drag.preview);
            }
            setDrag(null);
            // Safety net: clear the swallow flag if no click follows (the moved
            // item may have re-rendered away before the click could fire).
            window.setTimeout(() => {
                movedRef.current = false;
            }, 0);
        };
        window.addEventListener(`pointermove`, onMove);
        window.addEventListener(`pointerup`, onUp);
        return () => {
            window.removeEventListener(`pointermove`, onMove);
            window.removeEventListener(`pointerup`, onUp);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drag, slotMinutes, minHour, maxHour, onItemMove]);

    const gridCols = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` };

    return (
        <div className={`flex min-h-0 flex-1 flex-col`}>
            {/* Day headers */}
            <div
                className={`flex border-b border-border`}
                style={{ paddingRight: scrollbarWidth }}
            >
                <div className={`w-14 shrink-0`} />
                <div className={`grid flex-1`} style={gridCols}>
                    {days.map((day) => {
                        const isToday = isSameDay(day, today);
                        return (
                            <Button
                                key={dayKey(day)}
                                variant={`ghost`}
                                onClick={() => onSelectDay?.(day)}
                                className={cn(
                                    `flex h-auto flex-col gap-0 rounded-none border-l border-border py-1.5`
                                )}
                            >
                                <span className={`text-xs uppercase text-muted-foreground`}>
                                    {new Intl.DateTimeFormat(locale, { weekday: `short` }).format(day)}
                                </span>
                                <span
                                    className={cn(
                                        `flex size-7 items-center justify-center rounded-full text-sm tabular-nums`,
                                        isToday
                                            ? `bg-primary font-semibold text-primary-foreground`
                                            : `text-foreground`
                                    )}
                                >
                                    {day.getDate()}
                                </span>
                            </Button>
                        );
                    })}
                </div>
            </div>

            {/* All-day band */}
            <div
                className={`flex border-b border-border`}
                style={{ paddingRight: scrollbarWidth }}
            >
                <div className={`flex w-14 shrink-0 items-start justify-end px-1 py-1`}>
                    <span className={`text-[10px] leading-tight text-muted-foreground`}>
                        {strings.allDay}
                    </span>
                </div>
                <div className={`grid min-h-7 flex-1`} style={gridCols}>
                    {days.map((day) => {
                        const allDay = events
                            .filter((e) => e.allDay && eventOnDay(e, day))
                            .sort(byStartThenLength);
                        return (
                            <div
                                key={dayKey(day)}
                                className={`flex flex-col gap-0.5 border-l border-border p-0.5`}
                            >
                                {allDay.map((event) => (
                                    <Button
                                        key={event.id}
                                        variant={`ghost`}
                                        disabled={event.disabled}
                                        onClick={() => onSelectItem?.(event)}
                                        style={{ backgroundColor: eventTint(event.color) }}
                                        className={cn(
                                            `h-5 w-full justify-start truncate rounded-sm px-1`,
                                            `text-left text-xs font-medium text-foreground hover:brightness-95`
                                        )}
                                    >
                                        <span className={`truncate`}>{event.title}</span>
                                    </Button>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Scrollable time grid */}
            <div ref={bodyRef} className={`relative min-h-0 flex-1 overflow-y-auto`}>
                <div className={`flex`} style={{ height: bodyHeight }}>
                    {/* Hour ruler */}
                    <div className={`w-14 shrink-0`}>
                        {hours.map((h) => (
                            <div key={h} className={`relative`} style={{ height: HOUR_PX }}>
                                <span
                                    className={`absolute right-1 -top-2 text-[10px] tabular-nums text-muted-foreground`}
                                >
                                    {h === minHour ? `` : hourLabel(h)}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Day columns */}
                    <div ref={gridRef} className={`relative grid flex-1`} style={gridCols}>
                        {days.map((day) => {
                            const positioned = layoutDayEvents(
                                events.filter((e) => eventOnDay(e, day)),
                                day,
                                minHour,
                                maxHour
                            );
                            const isToday = isSameDay(day, today);
                            const nowMins =
                                (today.getHours() * 60 + today.getMinutes()) - minHour * 60;
                            const showNow =
                                nowIndicator && isToday && nowMins >= 0 && nowMins <= totalMins;

                            return (
                                <div key={dayKey(day)} className={`relative border-l border-border`}>
                                    {hours.map((h) => (
                                        <div
                                            key={h}
                                            className={`absolute inset-x-0 border-t border-border/60`}
                                            style={{ top: (h - minHour) * HOUR_PX }}
                                        />
                                    ))}
                                    <Button
                                        variant={`ghost`}
                                        onClick={(e) => selectSlot(day, e)}
                                        aria-label={`${strings.addEvent} – ${day.toDateString()}`}
                                        className={`absolute inset-0 h-full w-full rounded-none p-0 hover:bg-accent/20`}
                                    />
                                    {positioned.map(({ event, topPct, heightPct, leftPct, widthPct }) => {
                                        const durationMin =
                                            (event.end.getTime() - event.start.getTime()) / 60_000;
                                        // A ~40-minute block (≈32px at 48px/h) is too short for
                                        // a stacked title + time, so render one compact line.
                                        const compactBlock = durationMin < 45;
                                        const time = new Intl.DateTimeFormat(locale, {
                                            hour: `numeric`,
                                            minute: `2-digit`
                                        }).format(event.start);
                                        const draggable = Boolean(event.editable && onItemMove);
                                        return (
                                            <Button
                                                key={event.id}
                                                variant={`ghost`}
                                                disabled={event.disabled}
                                                onPointerDown={
                                                    draggable ? (e) => startDrag(event, e) : undefined
                                                }
                                                onClick={() => {
                                                    if (movedRef.current) {
                                                        movedRef.current = false;
                                                        return;
                                                    }
                                                    onSelectItem?.(event);
                                                }}
                                                title={event.title}
                                                style={{
                                                    top: `${topPct}%`,
                                                    height: `${heightPct}%`,
                                                    left: `${leftPct}%`,
                                                    width: `calc(${widthPct}% - 2px)`,
                                                    minHeight: 18,
                                                    touchAction: draggable ? `none` : undefined,
                                                    backgroundColor: eventTintStrong(event.color),
                                                    boxShadow: `inset 3px 0 0 0 ${eventAccent(event.color)}`
                                                }}
                                                className={cn(
                                                    `absolute flex w-full flex-col items-start gap-0 overflow-hidden`,
                                                    `rounded-[5px] py-0.5 pr-1 pl-2 text-left leading-tight`,
                                                    `hover:brightness-[0.97]`,
                                                    draggable && `cursor-grab active:cursor-grabbing`,
                                                    drag?.event.id === event.id && `opacity-40`
                                                )}
                                            >
                                                {compactBlock ? (
                                                    <span className={`w-full truncate text-[11px] font-medium text-foreground`}>
                                                        <span className={`tabular-nums opacity-70`}>{time}</span>{` `}
                                                        {event.title}
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span className={`w-full truncate text-xs font-medium text-foreground`}>
                                                            {event.title}
                                                        </span>
                                                        <span className={`w-full truncate text-[10px] tabular-nums text-foreground/70`}>
                                                            {time}
                                                        </span>
                                                        {event.location && (
                                                            <span className={`w-full truncate text-[10px] text-foreground/60`}>
                                                                {event.location}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
                                            </Button>
                                        );
                                    })}
                                    {showNow && (
                                        <div
                                            className={`pointer-events-none absolute inset-x-0 z-10 flex items-center`}
                                            style={{ top: `${(nowMins / totalMins) * 100}%` }}
                                        >
                                            <span className={`size-2 -ml-1 rounded-full bg-destructive`} />
                                            <span className={`h-px flex-1 bg-destructive`} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {drag && (
                            <div
                                className={cn(
                                    `pointer-events-none absolute z-30 overflow-hidden rounded-[5px]`,
                                    `ring-2 ring-primary`
                                )}
                                style={{
                                    left: `${(drag.colIndex / days.length) * 100}%`,
                                    width: `${100 / days.length}%`,
                                    top: `${((minutesOfDay(drag.preview.start) - minHour * 60) / totalMins) * 100}%`,
                                    height: `${(((drag.preview.end.getTime() - drag.preview.start.getTime()) / 60_000) / totalMins) * 100}%`,
                                    minHeight: 18,
                                    backgroundColor: eventTintStrong(drag.event.color),
                                    boxShadow: `inset 3px 0 0 0 ${eventAccent(drag.event.color)}`
                                }}
                            >
                                <span className={`block truncate py-0.5 pl-2 text-[11px] font-medium text-foreground`}>
                                    <span className={`tabular-nums opacity-70`}>
                                        {new Intl.DateTimeFormat(locale, {
                                            hour: `numeric`,
                                            minute: `2-digit`
                                        }).format(drag.preview.start)}
                                    </span>{` `}
                                    {drag.event.title}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeGridView;
