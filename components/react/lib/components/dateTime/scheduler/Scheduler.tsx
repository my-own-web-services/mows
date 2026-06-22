/**
 * Scheduler — a real event calendar (month / week / day / agenda), not a
 * date picker. Supply already-expanded `events`; the calendar lays them out
 * and surfaces interaction through callbacks:
 *   - `onSelectItem` when an event is clicked,
 *   - `onSelectSlot` when an empty part of the grid is clicked ("add here").
 *
 * Controlled or uncontrolled on both `view` and `date`. Responsive: it
 * measures its own width and collapses the view switcher into a Select and
 * tightens the toolbar below ~640px, so the same instance works on a phone
 * and on a wide desktop. Localisation (weekday/month names, week start, time
 * format) follows the `MowsProvider` language unless overridden.
 */

import { useContext, useEffect, useRef, useState } from "react";

import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";

import AgendaView from "./AgendaView";
import CalendarToolbar from "./CalendarToolbar";
import MonthView from "./MonthView";
import TimeGridView from "./TimeGridView";
import { DEFAULT_SCHEDULER_STRINGS } from "./strings";
import type { MoveChange, ScheduleItem, SchedulerView, SlotInfo, WeekStart } from "./types";
import { useScheduler } from "./useScheduler";

const ALL_VIEWS: SchedulerView[] = [`month`, `week`, `day`, `agenda`];
const COMPACT_BELOW_PX = 640;

export interface SchedulerProps {
    /** Already-expanded occurrences. The calendar never mutates them. */
    events?: ScheduleItem[];
    /** Controlled view. Omit for uncontrolled. */
    view?: SchedulerView;
    /** Initial view when uncontrolled. Defaults to the first enabled view. */
    defaultView?: SchedulerView;
    onViewChange?: (view: SchedulerView) => void;
    /** Which views are offered (and their order). Defaults to all four. */
    views?: SchedulerView[];
    /** Controlled focused date. Omit for uncontrolled. */
    date?: Date;
    /** Initial focused date when uncontrolled. Defaults to today. */
    defaultDate?: Date;
    onNavigate?: (date: Date, view: SchedulerView) => void;
    /** An event was clicked. */
    onSelectItem?: (event: ScheduleItem) => void;
    /** An empty slot was clicked — the hook for "create an event here". */
    onSelectSlot?: (slot: SlotInfo) => void;
    /**
     * An item with `editable: true` was dragged to a new time/day in the
     * week/day view. The calendar is controlled — apply the change to your
     * own state. Without this handler, nothing is draggable.
     */
    onItemMove?: (item: ScheduleItem, change: MoveChange) => void;
    /** Shows a "+ Add event" button in the toolbar when provided. */
    onCreate?: () => void;
    /** First day of week (0 = Sun … 6 = Sat). Defaults to the locale's. */
    weekStartsOn?: WeekStart;
    /** BCP-47 locale override. Defaults to the provider language. */
    locale?: string;
    /** First / last hour shown in the time grid. Defaults to 0 / 24. */
    minHour?: number;
    maxHour?: number;
    /** Slot granularity (minutes) for click-to-add + snapping. Default 30. */
    slotMinutes?: number;
    /** Show the live "now" line in week/day. Default true. */
    nowIndicator?: boolean;
    className?: string;
    /** Accessible label for the calendar group. Defaults to a translated label. */
    ariaLabel?: string;
}

const Scheduler = ({
    events = [],
    view,
    defaultView,
    onViewChange,
    views = ALL_VIEWS,
    date,
    defaultDate,
    onNavigate,
    onSelectItem,
    onSelectSlot,
    onItemMove,
    onCreate,
    weekStartsOn,
    locale: localeProp,
    minHour = 0,
    maxHour = 24,
    slotMinutes = 30,
    nowIndicator = true,
    className,
    ariaLabel
}: SchedulerProps) => {
    const ctx = useContext(MowsContext);
    const strings = ctx?.t.scheduler ?? DEFAULT_SCHEDULER_STRINGS;
    const locale =
        localeProp ??
        ctx?.currentLanguage?.code ??
        (typeof navigator !== `undefined` ? navigator.language : `en-US`);

    const cal = useScheduler({
        view,
        defaultView: defaultView ?? views[0],
        onViewChange,
        date,
        defaultDate,
        onNavigate,
        locale,
        weekStartsOn
    });

    const rootRef = useRef<HTMLDivElement>(null);
    const [compact, setCompact] = useState(false);
    useEffect(() => {
        const el = rootRef.current;
        if (!el || typeof ResizeObserver === `undefined`) {
            return;
        }
        const ro = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect.width ?? el.clientWidth;
            setCompact(width < COMPACT_BELOW_PX);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const drillToDay = (day: Date) => {
        cal.setDate(day);
        cal.setView(`day`);
    };

    return (
        <div
            ref={rootRef}
            role={`group`}
            aria-label={ariaLabel ?? strings.ariaLabel}
            className={cn(
                `flex h-full min-h-[30rem] w-full flex-col overflow-hidden rounded-lg border border-border`,
                `bg-card text-card-foreground`,
                className
            )}
        >
            <CalendarToolbar
                title={cal.title}
                view={cal.view}
                views={views}
                compact={compact}
                strings={strings}
                onView={cal.setView}
                onToday={cal.goToday}
                onPrev={cal.goPrev}
                onNext={cal.goNext}
                onCreate={onCreate}
            />
            <div className={`flex min-h-0 flex-1 flex-col`}>
                {cal.view === `month` && (
                    <MonthView
                        date={cal.date}
                        events={events}
                        locale={locale}
                        strings={strings}
                        weekStartsOn={cal.weekStartsOn}
                        maxPerCell={compact ? 2 : 3}
                        onSelectItem={onSelectItem}
                        onSelectSlot={onSelectSlot}
                        onShowMore={drillToDay}
                    />
                )}
                {(cal.view === `week` || cal.view === `day`) && (
                    <TimeGridView
                        view={cal.view}
                        date={cal.date}
                        events={events}
                        locale={locale}
                        strings={strings}
                        weekStartsOn={cal.weekStartsOn}
                        minHour={minHour}
                        maxHour={maxHour}
                        slotMinutes={slotMinutes}
                        nowIndicator={nowIndicator}
                        onSelectItem={onSelectItem}
                        onSelectSlot={onSelectSlot}
                        onSelectDay={drillToDay}
                        onItemMove={onItemMove}
                    />
                )}
                {cal.view === `agenda` && (
                    <AgendaView
                        date={cal.date}
                        events={events}
                        locale={locale}
                        strings={strings}
                        onSelectItem={onSelectItem}
                    />
                )}
            </div>
        </div>
    );
};

export default Scheduler;
