/** State + navigation for {@link Scheduler}: controlled or uncontrolled
 *  `view` and focused `date`, plus the derived toolbar title and week start. */

import { useCallback, useMemo, useState } from "react";

import { formatTitle, resolveWeekStart, step } from "./calendarMath";
import type { SchedulerView, WeekStart } from "./types";

export interface UseSchedulerOptions {
    view?: SchedulerView;
    defaultView?: SchedulerView;
    onViewChange?: (view: SchedulerView) => void;
    date?: Date;
    defaultDate?: Date;
    onNavigate?: (date: Date, view: SchedulerView) => void;
    /** BCP-47 locale used for every display string + the default week start. */
    locale: string;
    weekStartsOn?: WeekStart;
}

export interface UseSchedulerReturn {
    view: SchedulerView;
    date: Date;
    weekStartsOn: WeekStart;
    title: string;
    setView: (view: SchedulerView) => void;
    setDate: (date: Date) => void;
    goToday: () => void;
    goPrev: () => void;
    goNext: () => void;
}

export const useScheduler = (opts: UseSchedulerOptions): UseSchedulerReturn => {
    const [uncontrolledView, setUncontrolledView] = useState<SchedulerView>(
        opts.defaultView ?? `month`
    );
    const [uncontrolledDate, setUncontrolledDate] = useState<Date>(
        () => opts.defaultDate ?? new Date()
    );

    const view = opts.view ?? uncontrolledView;
    const date = opts.date ?? uncontrolledDate;
    const weekStartsOn = opts.weekStartsOn ?? resolveWeekStart(opts.locale);

    const setView = useCallback(
        (next: SchedulerView) => {
            if (opts.view === undefined) {
                setUncontrolledView(next);
            }
            opts.onViewChange?.(next);
        },
        [opts]
    );

    const setDate = useCallback(
        (next: Date) => {
            if (opts.date === undefined) {
                setUncontrolledDate(next);
            }
            opts.onNavigate?.(next, view);
        },
        [opts, view]
    );

    const goToday = useCallback(() => setDate(new Date()), [setDate]);
    const goPrev = useCallback(() => setDate(step(view, date, -1)), [setDate, view, date]);
    const goNext = useCallback(() => setDate(step(view, date, 1)), [setDate, view, date]);

    const title = useMemo(
        () => formatTitle(view, date, opts.locale, weekStartsOn),
        [view, date, opts.locale, weekStartsOn]
    );

    return { view, date, weekStartsOn, title, setView, setDate, goToday, goPrev, goNext };
};
