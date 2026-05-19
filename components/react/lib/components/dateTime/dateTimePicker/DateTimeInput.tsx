import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput
} from "@/components/ui/input-group";
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
    /** Called when the input itself is clicked (used to open the calendar). */
    onInputClick?: () => void;
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
            onInputClick,
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
            <div ref={ref} className={cn(`DateTimeInput`, className)}>
            <InputGroup>
                {!hideCalendarButton && (
                    <InputGroupAddon>
                        <InputGroupButton
                            size={`icon-xs`}
                            variant={`ghost`}
                            onPointerDown={(e) => {
                                if (e.button !== 0) return;
                                e.preventDefault();
                                onCalendarClick();
                            }}
                            disabled={disabled}
                            aria-label={`Open calendar`}
                        >
                            <CalendarIcon />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
                <InputGroupInput
                    type={`text`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onClick={onInputClick}
                    placeholder={placeholder}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    className={`font-mono text-sm`}
                />
                {isDirty && (
                    <InputGroupAddon align={`inline-end`}>
                        <InputGroupButton
                            size={`icon-xs`}
                            variant={`ghost`}
                            onClick={onConfirm}
                            disabled={disabled}
                            aria-label={`Confirm date input`}
                        >
                            <CheckIcon />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
            </div>
        );
    }
);

DateTimeInput.displayName = `DateTimeInput`;

export default DateTimeInput;
export { DateTimeInput };
