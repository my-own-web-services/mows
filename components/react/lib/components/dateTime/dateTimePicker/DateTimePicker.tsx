import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { getDetectedTimeFormat, getPlaceholder } from "@/lib/dateTimeUtils";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import { useContext } from "react";
import DateTimeInput from "./DateTimeInput";
import TimePicker from "./TimePicker";
import TimezoneSelector from "./TimezoneSelector";
import { useDateTimePicker } from "./useDateTimePicker";

/** Props for the `DateTimePicker` component. */
export interface DateTimePickerProps {
    /** Controlled date value. Omit for uncontrolled mode. */
    value?: Date;
    /** Initial date when uncontrolled. */
    defaultValue?: Date;
    /** Called when the date changes. */
    onChange?: (date: Date | undefined) => void;
    /** Time display format. Defaults to the user's locale preference. */
    timeFormat?: `12h` | `24h`;
    /** Whether to show a seconds column. Defaults to `false`. */
    showSeconds?: boolean;
    /** Whether to show the timezone selector. Defaults to `false`. */
    showTimezone?: boolean;
    /** IANA timezone string (e.g. `"America/New_York"`). */
    timeZone?: string;
    /** Called when the user changes the timezone. */
    onTimezoneChange?: (tz: string) => void;
    /** Position of the time picker relative to the calendar. */
    timeLayout?: `below` | `beside`;
    /** Custom placeholder for the text input. */
    placeholder?: string;
    /** Disables the entire picker. */
    disabled?: boolean;
    /** Prevents selecting dates in the future. */
    disableFuture?: boolean;
    /** Additional CSS class for the root element. */
    className?: string;
}

const DateTimePicker = ({
    value,
    defaultValue,
    onChange,
    timeFormat = getDetectedTimeFormat(),
    showSeconds = false,
    showTimezone = false,
    timeZone,
    onTimezoneChange,
    timeLayout = `below`,
    placeholder,
    disabled,
    disableFuture,
    className
}: DateTimePickerProps) => {
    const mowsContext = useContext(MowsContext);
    const picker = useDateTimePicker({
        value,
        defaultValue,
        onChange,
        timeFormat,
        showSeconds,
        timeZone
    });

    const formatPlaceholder =
        placeholder ?? getPlaceholder({ timeFormat, showSeconds });

    return (
        <Popover open={picker.isOpen} onOpenChange={picker.setIsOpen}>
            <PopoverAnchor asChild={true}>
                <DateTimeInput
                    value={picker.inputValue}
                    onChange={picker.setInputValue}
                    onConfirm={picker.confirmInput}
                    onCalendarClick={() => picker.setIsOpen(!picker.isOpen)}
                    onInputClick={() => picker.setIsOpen(true)}
                    isDirty={picker.isDirty}
                    placeholder={formatPlaceholder}
                    disabled={disabled}
                    className={cn(`w-full`, className)}
                    aria-label={mowsContext?.t.dateTimePicker.ariaLabel ?? `Date and time`}
                />
            </PopoverAnchor>
            <PopoverContent
                className={`w-auto overflow-clip p-0`}
                align={`start`}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <div
                    className={cn(
                        `flex`,
                        timeLayout === `beside` ? `flex-row` : `flex-col`
                    )}
                >
                    <Calendar
                        mode={`single`}
                        selected={picker.date}
                        onSelect={picker.handleCalendarSelect}
                        month={picker.month}
                        onMonthChange={picker.setMonth}
                        disabled={disabled ? () => true : undefined}
                        disableFuture={disableFuture}
                        timeZone={timeZone}
                    />
                    <div
                        className={cn(
                            `flex flex-col`,
                            timeLayout === `beside` ? `border-l` : `border-t`
                        )}
                    >
                        <div className={`px-3 pb-2 pt-1`}>
                            <TimePicker
                                date={picker.date}
                                onChange={picker.handleTimeChange}
                                timeFormat={timeFormat}
                                showSeconds={showSeconds}
                                disabled={disabled}
                            />
                        </div>
                        {showTimezone && onTimezoneChange && (
                            <div className={`border-t px-3 py-2`}>
                                <div
                                    className={`text-muted-foreground mb-1 text-xs font-medium`}
                                >
                                    {mowsContext?.t.dateTimePicker.timezoneLabel ?? `Timezone`}
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
            </PopoverContent>
        </Popover>
    );
};

export default DateTimePicker;
export { DateTimePicker };
