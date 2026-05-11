import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import * as React from "react";

/** Props for the `TimePicker` component. */
export interface TimePickerProps {
    /** The currently selected date (time is read from this). */
    date: Date | undefined;
    /** Called when the user changes the time. */
    onChange: (date: Date) => void;
    /** Whether to use 12-hour or 24-hour display. */
    timeFormat: `12h` | `24h`;
    /** Whether to show a seconds column. */
    showSeconds: boolean;
    /** Disables all time selection. */
    disabled?: boolean;
    /** Additional CSS class. */
    className?: string;
}

interface TimeColumnProps {
    values: number[];
    selectedValue: number;
    onSelect: (value: number) => void;
    formatValue?: (value: number) => string;
    label: string;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i);
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const SECONDS = Array.from({ length: 60 }, (_, i) => i);

const TimeColumn = ({
    values,
    selectedValue,
    onSelect,
    formatValue,
    label
}: TimeColumnProps) => {
    const selectedRef = React.useRef<HTMLButtonElement>(null);
    // Suppress scroll animation shortly after mount: the controlled value can
    // arrive on a second render within the same frame and we don't want a
    // visible animated jump on first paint.
    const mountTime = React.useRef(Date.now());

    React.useEffect(() => {
        const id = requestAnimationFrame(() => {
            const el = selectedRef.current;
            if (!el) return;
            const isInitial = Date.now() - mountTime.current < 100;
            const viewport = el.closest(`[data-radix-scroll-area-viewport]`);
            if (isInitial && viewport) {
                const viewportRect = viewport.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                viewport.scrollTop +=
                    elRect.top -
                    viewportRect.top -
                    viewportRect.height / 2 +
                    elRect.height / 2;
            } else {
                el.scrollIntoView({ block: `nearest`, behavior: `smooth` });
            }
        });
        return () => cancelAnimationFrame(id);
    }, [selectedValue]);

    const display = formatValue ?? ((v: number) => v.toString().padStart(2, `0`));

    return (
        <div className={`flex flex-col`}>
            <div
                className={`text-muted-foreground pb-1 pt-0.5 text-center text-xs font-medium`}
            >
                {label}
            </div>
            <ScrollArea className={`h-[200px] w-16`}>
                <div
                    className={`flex flex-col items-center gap-0.5 px-1 py-1 pr-3`}
                    role={`listbox`}
                    aria-label={label}
                >
                    {values.map((v) => (
                        <Button
                            key={v}
                            ref={v === selectedValue ? selectedRef : undefined}
                            type={`button`}
                            variant={v === selectedValue ? `default` : `ghost`}
                            size={`sm`}
                            role={`option`}
                            aria-selected={v === selectedValue}
                            className={`h-8 w-full shrink-0 text-xs`}
                            onClick={() => onSelect(v)}
                        >
                            {display(v)}
                        </Button>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};

const TimePicker = ({
    date,
    onChange,
    timeFormat,
    showSeconds,
    disabled,
    className
}: TimePickerProps) => {
    const hours = timeFormat === `24h` ? HOURS_24 : HOURS_12;

    const currentHour = date ? date.getHours() : 0;
    const currentMinute = date ? date.getMinutes() : 0;
    const currentSecond = date ? date.getSeconds() : 0;
    const isPM = currentHour >= 12;

    const displayHour =
        timeFormat === `12h`
            ? currentHour % 12 === 0
                ? 12
                : currentHour % 12
            : currentHour;

    const handleHourSelect = (hour: number) => {
        const base = date ? new Date(date) : new Date();
        if (timeFormat === `12h`) {
            const h24 = hour === 12 ? 0 : hour;
            base.setHours(isPM ? h24 + 12 : h24);
        } else {
            base.setHours(hour);
        }
        onChange(base);
    };

    const handleMinuteSelect = (minute: number) => {
        const base = date ? new Date(date) : new Date();
        base.setMinutes(minute);
        onChange(base);
    };

    const handleSecondSelect = (second: number) => {
        const base = date ? new Date(date) : new Date();
        base.setSeconds(second);
        onChange(base);
    };

    const handleAmPmToggle = (ampm: `AM` | `PM`) => {
        const base = date ? new Date(date) : new Date();
        const h = base.getHours();
        if (ampm === `AM` && h >= 12) {
            base.setHours(h - 12);
        } else if (ampm === `PM` && h < 12) {
            base.setHours(h + 12);
        }
        onChange(base);
    };

    return (
        <div
            className={cn(
                `flex items-start`,
                disabled && `pointer-events-none opacity-50`,
                className
            )}
        >
            <TimeColumn
                values={hours}
                selectedValue={displayHour}
                onSelect={handleHourSelect}
                label={`Hours`}
            />
            <TimeColumn
                values={MINUTES}
                selectedValue={currentMinute}
                onSelect={handleMinuteSelect}
                label={`Minutes`}
            />
            {showSeconds && (
                <TimeColumn
                    values={SECONDS}
                    selectedValue={currentSecond}
                    onSelect={handleSecondSelect}
                    label={`Seconds`}
                />
            )}
            {timeFormat === `12h` && (
                <div className={`flex flex-col`}>
                    <div
                        className={`text-muted-foreground pb-1 pt-0.5 text-center text-xs font-medium`}
                    >
                        &nbsp;
                    </div>
                    <div className={`flex flex-col gap-0.5 p-1`}>
                        <Button
                            type={`button`}
                            variant={!isPM ? `default` : `ghost`}
                            size={`sm`}
                            className={`h-8 w-14 text-xs`}
                            onClick={() => handleAmPmToggle(`AM`)}
                        >
                            AM
                        </Button>
                        <Button
                            type={`button`}
                            variant={isPM ? `default` : `ghost`}
                            size={`sm`}
                            className={`h-8 w-14 text-xs`}
                            onClick={() => handleAmPmToggle(`PM`)}
                        >
                            PM
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TimePicker;
export { TimePicker };
