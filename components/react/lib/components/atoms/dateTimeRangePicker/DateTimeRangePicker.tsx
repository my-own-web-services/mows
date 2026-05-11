import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { getDetectedTimeFormat, getPlaceholder } from "@/lib/dateTimeUtils";
import { cn } from "@/lib/utils";
import * as React from "react";
import type { DayButton } from "react-day-picker";
import DateTimeInput from "../dateTimePicker/DateTimeInput";
import TimePicker from "../dateTimePicker/TimePicker";
import TimezoneSelector from "../dateTimePicker/TimezoneSelector";
import {
    useDateTimeRangePicker,
    type DateTimeRange
} from "./useDateTimeRangePicker";

// ---------------------------------------------------------------------------
// Drag range types & context
// ---------------------------------------------------------------------------

interface DragState {
    isDragging: boolean;
    draggingEndpoint: `start` | `end` | null;
    previewRange: DateTimeRange | null;
    originalRange: DateTimeRange | null;
    startDay: Date | null;
    hasMoved: boolean;
}

const initialDragState: DragState = {
    isDragging: false,
    draggingEndpoint: null,
    previewRange: null,
    originalRange: null,
    startDay: null,
    hasMoved: false
};

interface DragContextValue {
    dragState: DragState;
    startDrag: (
        endpoint: `start` | `end`,
        originalRange: DateTimeRange,
        day: Date
    ) => void;
    updatePreview: (day: Date) => void;
    finishDrag: () => void;
    justFinishedDrag: React.RefObject<boolean>;
    onDayClick: (day: Date) => void;
    disableFuture?: boolean;
    isDisabled?: boolean;
    currentRange: DateTimeRange;
}

const DragRangeContext = React.createContext<DragContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isSameDay = (a: Date, b: Date): boolean =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

const stripTime = (d: Date): Date => {
    const stripped = new Date(d);
    stripped.setHours(0, 0, 0, 0);
    return stripped;
};

const MS_PER_DAY = 86_400_000;

const touchActionStyle = { touchAction: `none` } as const;
const touchActionNoSelectStyle = {
    touchAction: `none`,
    userSelect: `none`
} as const;

// ---------------------------------------------------------------------------
// DraggableDayButton
// ---------------------------------------------------------------------------

const DraggableDayButton = (props: React.ComponentProps<typeof DayButton>) => {
    const dragContext = React.useContext(DragRangeContext);
    const { day, modifiers, ...rest } = props;

    // Run in the capture phase so this fires before CalendarDayButton's own
    // onPointerDown handler — which fires the day-click on press and would
    // collapse the range before our drag could start. When we determine the
    // press is on a range endpoint, stopPropagation prevents that handler from
    // running at all, leaving the original range intact for the drag.
    const handlePointerDownCapture = (e: React.PointerEvent) => {
        if (!dragContext || dragContext.isDisabled) return;
        if (modifiers.disabled) return;
        if (e.button !== 0) return;

        const hasCompleteRange =
            dragContext.currentRange.from !== undefined &&
            dragContext.currentRange.to !== undefined;
        if (!hasCompleteRange) return;

        const isStart = modifiers.range_start;
        const isEnd = modifiers.range_end;
        if (!isStart && !isEnd) return;

        let endpoint: `start` | `end`;
        if (isStart && isEnd) {
            // Single-day range — drag to extend the end
            endpoint = `end`;
        } else if (isStart) {
            endpoint = `start`;
        } else {
            endpoint = `end`;
        }

        e.stopPropagation();
        dragContext.startDrag(
            endpoint,
            { ...dragContext.currentRange },
            day.date
        );
    };

    const handlePointerOver = () => {
        if (!dragContext || !dragContext.dragState.isDragging) return;
        if (modifiers.disabled) return;

        if (dragContext.disableFuture) {
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);
            if (day.date > endOfToday) return;
        }

        dragContext.updatePreview(day.date);
    };

    const handlePointerUp = () => {
        if (!dragContext || !dragContext.dragState.isDragging) return;
        dragContext.finishDrag();
    };

    const handleClickCapture = (e: React.MouseEvent) => {
        dragContext?.onDayClick(day.date);

        if (dragContext?.justFinishedDrag.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const isEndpoint = modifiers.range_start || modifiers.range_end;
    const hasCompleteRange =
        dragContext &&
        dragContext.currentRange.from !== undefined &&
        dragContext.currentRange.to !== undefined;

    return (
        <span
            onPointerDownCapture={handlePointerDownCapture}
            onPointerOver={handlePointerOver}
            onPointerUp={handlePointerUp}
            onClickCapture={handleClickCapture}
            className={cn(
                `inline-flex`,
                !dragContext?.isDisabled &&
                    !modifiers.disabled &&
                    hasCompleteRange &&
                    isEndpoint &&
                    !dragContext?.dragState.isDragging &&
                    `cursor-grab [&_button]:cursor-grab`,
                dragContext?.dragState.isDragging &&
                    `cursor-grabbing [&_button]:cursor-grabbing`
            )}
            style={
                dragContext?.dragState.isDragging
                    ? touchActionNoSelectStyle
                    : touchActionStyle
            }
        >
            <CalendarDayButton day={day} modifiers={modifiers} {...rest} />
        </span>
    );
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DateTimeRangePickerProps {
    value?: DateTimeRange;
    defaultValue?: DateTimeRange;
    onChange?: (range: DateTimeRange) => void;
    timeFormat?: `12h` | `24h`;
    showSeconds?: boolean;
    showTimezone?: boolean;
    timeZone?: string;
    onTimezoneChange?: (tz: string) => void;
    timeLayout?: `below` | `beside`;
    startPlaceholder?: string;
    endPlaceholder?: string;
    disabled?: boolean;
    disableFuture?: boolean;
    showDuration?: boolean;
    className?: string;
}

// ---------------------------------------------------------------------------
// DateTimeRangePicker
// ---------------------------------------------------------------------------

const DateTimeRangePicker = ({
    value,
    defaultValue,
    onChange,
    timeFormat = getDetectedTimeFormat(),
    showSeconds = false,
    showTimezone = false,
    timeZone,
    onTimezoneChange,
    timeLayout = `below`,
    startPlaceholder,
    endPlaceholder,
    disabled,
    disableFuture,
    showDuration,
    className
}: DateTimeRangePickerProps) => {
    const picker = useDateTimeRangePicker({
        value,
        defaultValue,
        onChange,
        timeFormat,
        showSeconds,
        timeZone
    });

    const [dragState, setDragState] = React.useState<DragState>(initialDragState);
    const dragStateRef = React.useRef(dragState);
    dragStateRef.current = dragState;

    const justFinishedDrag = React.useRef(false);

    const handleDragEndRef = React.useRef(picker.handleDragEnd);
    handleDragEndRef.current = picker.handleDragEnd;

    const startDrag = React.useCallback(
        (
            endpoint: `start` | `end`,
            originalRange: DateTimeRange,
            day: Date
        ) => {
            setDragState({
                isDragging: true,
                draggingEndpoint: endpoint,
                previewRange: null,
                originalRange,
                startDay: day,
                hasMoved: false
            });
        },
        []
    );

    const updatePreview = React.useCallback((day: Date) => {
        setDragState((prev) => {
            if (!prev.isDragging || !prev.originalRange) return prev;

            const moved = prev.startDay ? !isSameDay(day, prev.startDay) : true;
            if (!moved && !prev.hasMoved) return prev;

            let from: Date | undefined;
            let to: Date | undefined;

            if (prev.draggingEndpoint === `start`) {
                from = day;
                to = prev.originalRange.to;
            } else {
                from = prev.originalRange.from;
                to = day;
            }

            if (from && to && stripTime(from) > stripTime(to)) {
                [from, to] = [to, from];
            }

            return {
                ...prev,
                hasMoved: true,
                previewRange: { from, to }
            };
        });
    }, []);

    const finishDrag = React.useCallback(() => {
        const prev = dragStateRef.current;

        if (!prev.isDragging) return;

        if (prev.hasMoved && prev.previewRange) {
            handleDragEndRef.current(prev.previewRange);
            justFinishedDrag.current = true;
            requestAnimationFrame(() => {
                justFinishedDrag.current = false;
            });
        }

        setDragState(initialDragState);
    }, []);

    const cancelDrag = React.useCallback(() => {
        setDragState(initialDragState);
    }, []);

    React.useEffect(() => {
        if (!dragState.isDragging) return;

        const onPointerUp = () => finishDrag();
        window.addEventListener(`pointerup`, onPointerUp);
        return () => window.removeEventListener(`pointerup`, onPointerUp);
    }, [dragState.isDragging, finishDrag]);

    React.useEffect(() => {
        if (!picker.isOpen && dragState.isDragging) cancelDrag();
    }, [picker.isOpen, dragState.isDragging, cancelDrag]);

    const { setMonth: pickerSetMonth } = picker;
    const handleMonthChange = React.useCallback(
        (month: Date) => {
            if (dragStateRef.current.isDragging) cancelDrag();
            pickerSetMonth(month);
        },
        [cancelDrag, pickerSetMonth]
    );

    const dragContextValue = React.useMemo<DragContextValue>(
        () => ({
            dragState,
            startDrag,
            updatePreview,
            finishDrag,
            justFinishedDrag,
            onDayClick: picker.handleDayClick,
            disableFuture,
            isDisabled: disabled,
            currentRange: picker.range
        }),
        [
            dragState,
            startDrag,
            updatePreview,
            finishDrag,
            picker.handleDayClick,
            disableFuture,
            disabled,
            picker.range
        ]
    );

    const displayRange =
        dragState.isDragging && dragState.previewRange
            ? dragState.previewRange
            : picker.range;

    const placeholderBase = getPlaceholder({ timeFormat, showSeconds });

    const durationText = React.useMemo(() => {
        if (!picker.range.from || !picker.range.to) return null;
        const nights = Math.floor(
            (stripTime(picker.range.to).getTime() -
                stripTime(picker.range.from).getTime()) /
                MS_PER_DAY
        );
        if (nights < 0) return null;
        const days = nights + 1;
        return `${days} day${days !== 1 ? `s` : ``}, ${nights} night${
            nights !== 1 ? `s` : ``
        }`;
    }, [picker.range.from, picker.range.to]);

    return (
        <Popover open={picker.isOpen} onOpenChange={picker.setIsOpen}>
            <PopoverAnchor asChild={true}>
                <div
                    className={cn(
                        `flex flex-col gap-2 sm:flex-row sm:items-center`,
                        className
                    )}
                >
                    <div className={`flex-1`}>
                        <div
                            className={`text-muted-foreground mb-1 text-xs font-medium`}
                        >
                            Start
                        </div>
                        <DateTimeInput
                            value={picker.startInputValue}
                            onChange={picker.setStartInputValue}
                            onConfirm={picker.confirmStartInput}
                            onCalendarClick={() =>
                                picker.setIsOpen(!picker.isOpen)
                            }
                            isDirty={picker.isStartDirty}
                            placeholder={startPlaceholder ?? placeholderBase}
                            disabled={disabled}
                            aria-label={`Start date and time`}
                        />
                    </div>
                    <span
                        className={`text-muted-foreground hidden pt-5 text-sm sm:inline`}
                    >
                        &ndash;
                    </span>
                    <div className={`flex-1`}>
                        <div
                            className={`text-muted-foreground mb-1 text-xs font-medium`}
                        >
                            End
                        </div>
                        <DateTimeInput
                            value={picker.endInputValue}
                            onChange={picker.setEndInputValue}
                            onConfirm={picker.confirmEndInput}
                            onCalendarClick={() =>
                                picker.setIsOpen(!picker.isOpen)
                            }
                            isDirty={picker.isEndDirty}
                            placeholder={endPlaceholder ?? placeholderBase}
                            disabled={disabled}
                            aria-label={`End date and time`}
                            hideCalendarButton
                        />
                    </div>
                </div>
            </PopoverAnchor>
            {showDuration && durationText && (
                <div className={`text-muted-foreground mt-1 text-xs`}>
                    {durationText}
                </div>
            )}
            <PopoverContent
                className={`w-auto overflow-clip p-0`}
                align={`start`}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DragRangeContext.Provider value={dragContextValue}>
                    <div
                        className={cn(
                            `flex`,
                            timeLayout === `beside` ? `flex-row` : `flex-col`
                        )}
                    >
                        <Calendar
                            mode={`range`}
                            selected={
                                displayRange.from || displayRange.to
                                    ? {
                                          from: displayRange.from,
                                          to: displayRange.to
                                      }
                                    : undefined
                            }
                            onSelect={picker.handleCalendarSelect}
                            month={picker.month}
                            onMonthChange={handleMonthChange}
                            disabled={disabled ? () => true : undefined}
                            disableFuture={disableFuture}
                            numberOfMonths={2}
                            timeZone={timeZone}
                            components={{
                                DayButton: DraggableDayButton
                            }}
                        />
                        <div
                            className={cn(
                                `flex flex-col`,
                                timeLayout === `beside`
                                    ? `border-l`
                                    : `border-t`
                            )}
                        >
                            <div
                                className={cn(
                                    `flex flex-col gap-2 px-3 py-2`,
                                    timeLayout === `below` && `sm:flex-row sm:gap-6`
                                )}
                            >
                                <div>
                                    <div
                                        className={`text-muted-foreground mb-1 text-xs font-medium`}
                                    >
                                        Start time
                                    </div>
                                    <TimePicker
                                        date={picker.range.from}
                                        onChange={picker.handleStartTimeChange}
                                        timeFormat={timeFormat}
                                        showSeconds={showSeconds}
                                        disabled={disabled || !picker.range.from}
                                    />
                                </div>
                                <div>
                                    <div
                                        className={`text-muted-foreground mb-1 text-xs font-medium`}
                                    >
                                        End time
                                    </div>
                                    <TimePicker
                                        date={picker.range.to}
                                        onChange={picker.handleEndTimeChange}
                                        timeFormat={timeFormat}
                                        showSeconds={showSeconds}
                                        disabled={disabled || !picker.range.to}
                                    />
                                </div>
                            </div>
                            {showTimezone && onTimezoneChange && (
                                <div className={`border-t px-3 py-2`}>
                                    <div
                                        className={`text-muted-foreground mb-1 text-xs font-medium`}
                                    >
                                        Timezone
                                    </div>
                                    <TimezoneSelector
                                        value={timeZone}
                                        onChange={onTimezoneChange}
                                        disabled={disabled}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </DragRangeContext.Provider>
            </PopoverContent>
        </Popover>
    );
};

export default DateTimeRangePicker;
export { DateTimeRangePicker };
