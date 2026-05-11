import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CalendarIcon, CheckIcon } from "lucide-react";
import * as React from "react";

/** Props for the `DateTimeInput` component. */
export interface DateTimeInputProps {
    /** The current text input value. */
    value: string;
    /** Called when the text input changes. */
    onChange: (value: string) => void;
    /** Called when the user confirms the input (Enter key or checkmark click). */
    onConfirm: () => void;
    /** Called when the calendar icon button is clicked. */
    onCalendarClick: () => void;
    /** Whether the input value has been modified since last sync. */
    isDirty: boolean;
    /** Placeholder text for the input. */
    placeholder?: string;
    /** Disables the input and buttons. */
    disabled?: boolean;
    /** Additional CSS class. */
    className?: string;
    /** Accessible label for the input. */
    [`aria-label`]?: string;
    /** Hide the calendar icon button (used when a sibling input already exposes one). */
    hideCalendarButton?: boolean;
}

const DateTimeInput = React.forwardRef<HTMLDivElement, DateTimeInputProps>(
    (
        {
            value,
            onChange,
            onConfirm,
            onCalendarClick,
            isDirty,
            placeholder,
            disabled,
            className,
            [`aria-label`]: ariaLabel,
            hideCalendarButton
        },
        ref
    ) => {
        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === `Enter` && isDirty) {
                e.preventDefault();
                onConfirm();
            }
        };

        return (
            <div ref={ref} className={cn(`flex items-center gap-1`, className)}>
                <Input
                    type={`text`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    className={`flex-1 font-mono text-sm`}
                />
                {isDirty && (
                    <Button
                        type={`button`}
                        variant={`ghost`}
                        size={`icon`}
                        onClick={onConfirm}
                        disabled={disabled}
                        aria-label={`Confirm date input`}
                        className={`h-9 w-9 shrink-0`}
                    >
                        <CheckIcon className={`h-4 w-4`} />
                    </Button>
                )}
                {!hideCalendarButton && (
                    <Button
                        type={`button`}
                        variant={`ghost`}
                        size={`icon`}
                        onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            onCalendarClick();
                        }}
                        disabled={disabled}
                        aria-label={`Open calendar`}
                        className={`h-9 w-9 shrink-0`}
                    >
                        <CalendarIcon className={`h-4 w-4`} />
                    </Button>
                )}
            </div>
        );
    }
);

DateTimeInput.displayName = `DateTimeInput`;

export default DateTimeInput;
export { DateTimeInput };
