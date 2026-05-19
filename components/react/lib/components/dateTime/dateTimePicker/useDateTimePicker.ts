import {
    formatDateTime,
    parseDateTimeString,
    type DateTimeFormatOptions
} from "@/lib/dateTimeUtils";
import { TZDate } from "@date-fns/tz";
import * as React from "react";

/** Options for the `useDateTimePicker` hook. */
export interface UseDateTimePickerOptions {
    /** Controlled date value. Pass `undefined` for uncontrolled mode. */
    value?: Date;
    /** Initial date when uncontrolled. Ignored when `value` is provided. */
    defaultValue?: Date;
    /** Called when the date changes (controlled or uncontrolled). */
    onChange?: (date: Date | undefined) => void;
    /** Time display format. Defaults to `"24h"`. */
    timeFormat?: `12h` | `24h`;
    /** Whether to include seconds. Defaults to `false`. */
    showSeconds?: boolean;
    /** IANA timezone string. When set, dates are wrapped in `TZDate`. */
    timeZone?: string;
}

/** Return value of `useDateTimePicker`. */
export interface UseDateTimePickerReturn {
    date: Date | undefined;
    inputValue: string;
    isDirty: boolean;
    month: Date;
    isOpen: boolean;
    setDate: (date: Date | undefined) => void;
    setInputValue: (value: string) => void;
    confirmInput: () => void;
    setMonth: (month: Date) => void;
    setIsOpen: (open: boolean) => void;
    handleCalendarSelect: (date: Date | undefined) => void;
    handleTimeChange: (date: Date) => void;
}

export const useDateTimePicker = (
    options: UseDateTimePickerOptions
): UseDateTimePickerReturn => {
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

    const [internalDate, setInternalDate] = React.useState<Date | undefined>(
        defaultValue
    );
    const date = isControlled ? controlledValue : internalDate;

    const [inputValue, setInputValue] = React.useState(
        date ? formatDateTime(date, formatOptions) : ``
    );
    const [isDirty, setIsDirty] = React.useState(false);
    const [month, setMonth] = React.useState(date ?? new Date());
    const [isOpen, setIsOpen] = React.useState(false);

    const wrapTZ = React.useCallback(
        (d: Date): Date => (timeZone ? new TZDate(d, timeZone) : d),
        [timeZone]
    );

    const updateDate = React.useCallback(
        (newDate: Date | undefined) => {
            if (!isControlled) {
                setInternalDate(newDate);
            }
            onChange?.(newDate);
        },
        [isControlled, onChange]
    );

    const syncInputFromDate = React.useCallback(
        (d: Date | undefined) => {
            setInputValue(d ? formatDateTime(d, formatOptions) : ``);
            setIsDirty(false);
        },
        [formatOptions]
    );

    // Sync input when controlled value changes externally
    const prevControlledRef = React.useRef(controlledValue);
    React.useEffect(() => {
        if (isControlled && controlledValue !== prevControlledRef.current) {
            syncInputFromDate(controlledValue);
            if (controlledValue) {
                setMonth(controlledValue);
            }
        }
        prevControlledRef.current = controlledValue;
    }, [controlledValue, isControlled, syncInputFromDate]);

    const handleSetInputValue = (val: string) => {
        setInputValue(val);
        setIsDirty(true);
    };

    const confirmInput = () => {
        if (!isDirty) return;
        const referenceDate = timeZone
            ? new TZDate(new Date(), timeZone)
            : new Date();
        const parsed = parseDateTimeString(inputValue, formatOptions, referenceDate);
        if (parsed) {
            const finalDate = wrapTZ(parsed);
            updateDate(finalDate);
            setMonth(finalDate);
            syncInputFromDate(finalDate);
        } else {
            syncInputFromDate(date);
        }
    };

    const handleCalendarSelect = (selectedDate: Date | undefined) => {
        if (!selectedDate) return;

        const newDate = new Date(selectedDate);
        if (date) {
            newDate.setHours(date.getHours());
            newDate.setMinutes(date.getMinutes());
            newDate.setSeconds(date.getSeconds());
        }

        const finalDate = wrapTZ(newDate);
        updateDate(finalDate);
        syncInputFromDate(finalDate);
    };

    const handleTimeChange = (newDate: Date) => {
        const finalDate = wrapTZ(newDate);
        updateDate(finalDate);
        syncInputFromDate(finalDate);
    };

    const setDateExposed = (d: Date | undefined) => {
        updateDate(d);
        syncInputFromDate(d);
        if (d) setMonth(d);
    };

    return {
        date,
        inputValue,
        isDirty,
        month,
        isOpen,
        setDate: setDateExposed,
        setInputValue: handleSetInputValue,
        confirmInput,
        setMonth,
        setIsOpen,
        handleCalendarSelect,
        handleTimeChange
    };
};
