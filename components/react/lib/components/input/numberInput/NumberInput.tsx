import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";
import { forwardRef, useCallback, type CSSProperties, type FocusEvent } from "react";

export interface NumberInputProps {
    readonly value: number | null;
    readonly onChange: (value: number | null) => void;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    /** `true` (default) restricts input to integer values. */
    readonly integerOnly?: boolean;
    /** Hide the inline `−` / `+` stepper buttons. */
    readonly hideStepper?: boolean;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly id?: string;
    readonly name?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly inputClassName?: string;
    /** Aria-label, used when there is no visible <label htmlFor>. */
    readonly ariaLabel?: string;
}

const clamp = (
    value: number,
    min: number | undefined,
    max: number | undefined
): number => {
    const minBounded = typeof min === `number` ? Math.max(value, min) : value;
    return typeof max === `number` ? Math.min(minBounded, max) : minBounded;
};

/**
 * NumberInput — typed numeric input with min/max/step clamping and inline
 * `−` / `+` stepper buttons. Empty input value is communicated upstream as
 * `null` so callers can fall back to a server-side default.
 *
 * The placeholder is the right place to show "what gets used if you leave
 * this empty" — e.g. the supervisor's VM defaults.
 */
const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
    (
        {
            value,
            onChange,
            min,
            max,
            step = 1,
            integerOnly = true,
            hideStepper = false,
            placeholder,
            disabled,
            id,
            name,
            className,
            style,
            inputClassName,
            ariaLabel
        },
        ref
    ) => {
        const stringValue = value === null ? `` : String(value);

        const parse = useCallback(
            (raw: string): number | null => {
                if (raw.trim() === ``) return null;
                const parsed = integerOnly ? parseInt(raw, 10) : parseFloat(raw);
                if (!Number.isFinite(parsed)) return null;
                return clamp(parsed, min, max);
            },
            [integerOnly, min, max]
        );

        const bump = (direction: 1 | -1) => {
            const base = value ?? (typeof min === `number` ? min : 0);
            const next = clamp(base + direction * step, min, max);
            onChange(next);
        };

        const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
            const next = parse(event.currentTarget.value);
            if (next !== value) onChange(next);
        };

        return (
            <div
                className={cn(`relative inline-flex w-full items-center`, className)}
                style={style}
            >
                <Input
                    ref={ref}
                    id={id}
                    name={name}
                    type={`text`}
                    inputMode={integerOnly ? `numeric` : `decimal`}
                    pattern={integerOnly ? `-?[0-9]*` : undefined}
                    aria-label={ariaLabel}
                    placeholder={placeholder}
                    value={stringValue}
                    disabled={disabled}
                    onChange={(event) => {
                        const raw = event.currentTarget.value;
                        if (raw === ``) {
                            onChange(null);
                            return;
                        }
                        // While the user is typing accept any partially-valid
                        // input ("-", "1.") and only clamp/coerce on blur.
                        const parsed = integerOnly
                            ? parseInt(raw, 10)
                            : parseFloat(raw);
                        if (Number.isFinite(parsed)) onChange(parsed);
                    }}
                    onBlur={handleBlur}
                    className={cn(
                        hideStepper ? `` : `pr-16`,
                        `tabular-nums`,
                        inputClassName
                    )}
                />
                {!hideStepper && (
                    <div
                        className="absolute inset-y-0 right-0 flex items-stretch"
                        aria-hidden
                    >
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            tabIndex={-1}
                            disabled={
                                disabled ||
                                (typeof min === `number` &&
                                    value !== null &&
                                    value <= min)
                            }
                            onClick={() => bump(-1)}
                            className="text-muted-foreground hover:text-foreground inline-flex h-auto w-7 rounded-none p-0"
                        >
                            <Minus className="size-3.5" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            tabIndex={-1}
                            disabled={
                                disabled ||
                                (typeof max === `number` &&
                                    value !== null &&
                                    value >= max)
                            }
                            onClick={() => bump(1)}
                            className="text-muted-foreground hover:text-foreground inline-flex h-auto w-7 rounded-none p-0"
                        >
                            <Plus className="size-3.5" />
                        </Button>
                    </div>
                )}
            </div>
        );
    }
);
NumberInput.displayName = `NumberInput`;

export default NumberInput;
