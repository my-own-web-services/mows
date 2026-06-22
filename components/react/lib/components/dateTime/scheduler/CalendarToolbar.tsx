/** Header bar for {@link Scheduler}: Today / prev / next, the focused-
 *  range title, the view switcher (Tabs on desktop, Select when compact),
 *  and an optional "Add event" affordance. */

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { SchedulerStrings } from "./strings";
import type { SchedulerView } from "./types";

export interface CalendarToolbarProps {
    title: string;
    view: SchedulerView;
    views: SchedulerView[];
    compact: boolean;
    strings: SchedulerStrings;
    onView: (view: SchedulerView) => void;
    onToday: () => void;
    onPrev: () => void;
    onNext: () => void;
    onCreate?: () => void;
}

const CalendarToolbar = ({
    title,
    view,
    views,
    compact,
    strings,
    onView,
    onToday,
    onPrev,
    onNext,
    onCreate
}: CalendarToolbarProps) => {
    return (
        <div
            className={cn(
                `flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5`
            )}
        >
            <div className={`flex items-center gap-1.5`}>
                <Button variant={`outline`} size={`sm`} onClick={onToday}>
                    {strings.today}
                </Button>
                <Button
                    variant={`ghost`}
                    size={`icon-sm`}
                    onClick={onPrev}
                    aria-label={strings.previous}
                >
                    <ChevronLeft className={`size-4`} />
                </Button>
                <Button
                    variant={`ghost`}
                    size={`icon-sm`}
                    onClick={onNext}
                    aria-label={strings.next}
                >
                    <ChevronRight className={`size-4`} />
                </Button>
                <h2
                    className={cn(
                        `ml-1 truncate font-semibold tabular-nums text-foreground`,
                        compact ? `text-sm` : `text-base`
                    )}
                >
                    {title}
                </h2>
            </div>

            <div className={`flex items-center gap-2`}>
                {views.length > 1 &&
                    (compact ? (
                        <Select value={view} onValueChange={(v) => onView(v as SchedulerView)}>
                            <SelectTrigger className={`h-8 w-28 text-xs`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {views.map((v) => (
                                    <SelectItem key={v} value={v}>
                                        {strings.views[v]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Tabs value={view} onValueChange={(v) => onView(v as SchedulerView)}>
                            <TabsList>
                                {views.map((v) => (
                                    <TabsTrigger key={v} value={v}>
                                        {strings.views[v]}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    ))}
                {onCreate && (
                    <Button
                        size={compact ? `icon-sm` : `sm`}
                        onClick={onCreate}
                        aria-label={strings.addEvent}
                    >
                        <Plus className={`size-4`} />
                        {!compact && <span className={`ml-1`}>{strings.addEvent}</span>}
                    </Button>
                )}
            </div>
        </div>
    );
};

export default CalendarToolbar;
