import {
    formatDateTime,
    parseDateTimeString,
    type DateTimeFormatOptions
} from "@/lib/dateTimeUtils";
import { TZDate } from "@date-fns/tz";
import * as React from "react";
import type { DateRange } from "react-day-picker";

/** A date range with optional start and end. */
export interface DateTimeRange {
    from: Date | undefined;
    to: Date | undefined;
}

/** Options for the `useDateTimeRangePicker` hook. */
export interface UseDateTimeRangePickerOptions {
    value?: DateTimeRange;
    defaultValue?: DateTimeRange;
    onChange?: (range: DateTimeRange) => void;
    timeFormat?: `12h` | `24h`;
    showSeconds?: boolean;
    timeZone?: string;
}

/** Return value of `useDateTimeRangePicker`. */
export interface UseDateTimeRangePickerReturn {
    range: DateTimeRange;
    startInputValue: string;
    endInputValue: string;
    isStartDirty: boolean;
    isEndDirty: boolean;
    month: Date;
    isOpen: boolean;
    setRange: (range: DateTimeRange) => void;
    setStartInputValue: (value: string) => void;
    setEndInputValue: (value: string) => void;
    confirmStartInput: () => void;
    confirmEndInput: () => void;
    setMonth: (month: Date) => void;
    setIsOpen: (open: boolean) => void;
    handleDayClick: (day: Date) => void;
    handleCalendarSelect: (range: DateRange | undefined) => void;
    handleStartTimeChange: (date: Date) => void;
    handleEndTimeChange: (date: Date) => void;
    handleDragEnd: (newRange: DateTimeRange) => void;
}

const preserveTime = (target: Date, source: Date): void => {
    target.setHours(source.getHours(), source.getMinutes(), source.getSeconds());
};

export const useDateTimeRangePicker = (
    options: UseDateTimeRangePickerOptions
): UseDateTimeRangePickerReturn => {
    const {
        value: controlledValue,
        defaultValue,
        onChange,
        timeFormat = `24h`,
        showSeconds = false,
        timeZone
    } = options;

    const isControlled = controlledValue !== undefined;
    const formatOptions = React.useMemo<DateTimeFormatOptions>(
        () => ({ timeFormat, showSeconds }),
        [timeFormat, showSeconds]
    );

    const [internalRange, setInternalRange] = React.useState<DateTimeRange>(
        defaultValue ?? { from: undefined, to: undefined }
    );
    const range = isControlled ? controlledValue : internalRange;

    const [startInputValue, setStartInputValue] = React.useState(
        range.from ? formatDateTime(range.from, formatOptions) : ``
    );
    const [endInputValue, setEndInputValue] = React.useState(
        range.to ? formatDateTime(range.to, formatOptions) : ``
    );
    const [isStartDirty, setIsStartDirty] = React.useState(false);
    const [isEndDirty, setIsEndDirty] = React.useState(false);
    const [month, setMonth] = React.useState(range.from ?? new Date());
    const [isOpen, setIsOpen] = React.useState(false);

    const updateRange = React.useCallback(
        (newRange: DateTimeRange) => {
            if (!isControlled) {
                setInternalRange(newRange);
            }
            onChange?.(newRange);
        },
        [isControlled, onChange]
    );

    const formatDate = React.useCallback(
        (d: Date | undefined): string => (d ? formatDateTime(d, formatOptions) : ``),
        [formatOptions]
    );

    const prevControlledRef = React.useRef(controlledValue);
    React.useEffect(() => {
        if (isControlled && controlledValue !== prevControlledRef.current) {
            setStartInputValue(formatDate(controlledValue.from));
            setEndInputValue(formatDate(controlledValue.to));
            setIsStartDirty(false);
            setIsEndDirty(false);
            if (controlledValue.from) setMonth(controlledValue.from);
        }
        prevControlledRef.current = controlledValue;
    }, [controlledValue, isControlled, formatDate]);

    const wrapTZ = React.useCallback(
        (d: Date): Date => (timeZone ? new TZDate(d, timeZone) : d),
        [timeZone]
    );

    const handleSetStartInput = (val: string) => {
        setStartInputValue(val);
        setIsStartDirty(true);
    };

    const handleSetEndInput = (val: string) => {
        setEndInputValue(val);
        setIsEndDirty(true);
    };

    const confirmStartInput = () => {
        if (!isStartDirty) return;
        const referenceDate = timeZone
            ? new TZDate(new Date(), timeZone)
            : new Date();
        const parsed = parseDateTimeString(
            startInputValue,
            formatOptions,
            referenceDate
        );
        if (parsed) {
            const finalDate = wrapTZ(parsed);
            const newRange = { ...range, from: finalDate };
            updateRange(newRange);
            setMonth(finalDate);
            setStartInputValue(formatDate(finalDate));
            setIsStartDirty(false);
        } else {
            setStartInputValue(formatDate(range.from));
            setIsStartDirty(false);
        }
    };

    const confirmEndInput = () => {
        if (!isEndDirty) return;
        const referenceDate = timeZone
            ? new TZDate(new Date(), timeZone)
            : new Date();
        const parsed = parseDateTimeString(
            endInputValue,
            formatOptions,
            referenceDate
        );
        if (parsed) {
            const finalDate = wrapTZ(parsed);
            // Validate end >= start
            if (range.from && finalDate < range.from) {
                setEndInputValue(formatDate(range.to));
                setIsEndDirty(false);
                return;
            }
            const newRange = { ...range, to: finalDate };
            updateRange(newRange);
            setEndInputValue(formatDate(finalDate));
            setIsEndDirty(false);
        } else {
            setEndInputValue(formatDate(range.to));
            setIsEndDirty(false);
        }
    };

    // Tracks the exact day the user clicked, set by `handleDayClick` which
    // fires (via rdp's `onDayClick`) before `handleCalendarSelect`.
    const lastClickedDayRef = React.useRef<Date | undefined>(undefined);

    const handleDayClick = (day: Date) => {
        lastClickedDayRef.current = day;
    };

    const handleCalendarSelect = (dateRange: DateRange | undefined) => {
        const clickedDay = lastClickedDayRef.current;
        lastClickedDayRef.current = undefined;

        if (!dateRange) {
            updateRange({ from: undefined, to: undefined });
            setStartInputValue(``);
            setEndInputValue(``);
            setIsStartDirty(false);
            setIsEndDirty(false);
            return;
        }

        // 3-click cycle: only accept rdp's "to" value when we are explicitly
        // in the "selecting end" phase — i.e. "from" is set but "to" is not.
        const isSelectingTo = range.from !== undefined && range.to === undefined;

        let newFrom: Date | undefined;
        let newTo: Date | undefined;

        if (isSelectingTo) {
            newFrom = dateRange.from ? new Date(dateRange.from) : undefined;
            newTo = dateRange.to ? new Date(dateRange.to) : undefined;
        } else {
            newFrom = clickedDay
                ? new Date(clickedDay)
                : dateRange.from
                  ? new Date(dateRange.from)
                  : undefined;
            newTo = undefined;
        }

        if (newFrom && range.from) preserveTime(newFrom, range.from);
        if (newTo && range.to) preserveTime(newTo, range.to);

        const finalFrom = newFrom ? wrapTZ(newFrom) : undefined;
        const finalTo = newTo ? wrapTZ(newTo) : undefined;
        const newRange = { from: finalFrom, to: finalTo };

        updateRange(newRange);
        setStartInputValue(formatDate(finalFrom));
        setEndInputValue(formatDate(finalTo));
        setIsStartDirty(false);
        setIsEndDirty(false);
    };

    const handleStartTimeChange = (newDate: Date) => {
        const finalDate = wrapTZ(newDate);
        const newRange = { ...range, from: finalDate };
        updateRange(newRange);
        setStartInputValue(formatDate(finalDate));
        setIsStartDirty(false);
    };

    const handleEndTimeChange = (newDate: Date) => {
        const finalDate = wrapTZ(newDate);
        const newRange = { ...range, to: finalDate };
        updateRange(newRange);
        setEndInputValue(formatDate(finalDate));
        setIsEndDirty(false);
    };

    const handleDragEnd = (newRange: DateTimeRange) => {
        const newFrom = newRange.from ? new Date(newRange.from) : undefined;
        const newTo = newRange.to ? new Date(newRange.to) : undefined;

        if (newFrom && range.from) preserveTime(newFrom, range.from);
        if (newTo && range.to) preserveTime(newTo, range.to);

        const finalFrom = newFrom ? wrapTZ(newFrom) : undefined;
        const finalTo = newTo ? wrapTZ(newTo) : undefined;
        const finalRange = { from: finalFrom, to: finalTo };

        updateRange(finalRange);
        setStartInputValue(formatDate(finalFrom));
        setEndInputValue(formatDate(finalTo));
        setIsStartDirty(false);
        setIsEndDirty(false);
    };

    const setRangeExposed = (newRange: DateTimeRange) => {
        updateRange(newRange);
        setStartInputValue(formatDate(newRange.from));
        setEndInputValue(formatDate(newRange.to));
        setIsStartDirty(false);
        setIsEndDirty(false);
        if (newRange.from) setMonth(newRange.from);
    };

    return {
        range,
        startInputValue,
        endInputValue,
        isStartDirty,
        isEndDirty,
        month,
        isOpen,
        setRange: setRangeExposed,
        setStartInputValue: handleSetStartInput,
        setEndInputValue: handleSetEndInput,
        confirmStartInput,
        confirmEndInput,
        setMonth,
        setIsOpen,
        handleDayClick,
        handleCalendarSelect,
        handleStartTimeChange,
        handleEndTimeChange,
        handleDragEnd
    };
};
