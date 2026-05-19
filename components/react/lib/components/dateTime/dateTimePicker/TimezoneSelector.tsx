import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTimezoneOptions } from "@/lib/timezoneUtils";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

/** Props for the `TimezoneSelector` component. */
export interface TimezoneSelectorProps {
    /** Currently selected IANA timezone string. */
    value: string | undefined;
    /** Called when the user selects a timezone. */
    onChange: (timezone: string) => void;
    /** Disables the selector. */
    disabled?: boolean;
    /** Custom placeholder text. */
    placeholder?: string;
    /** Additional CSS class. */
    className?: string;
}

const TimezoneSelector = ({
    value,
    onChange,
    disabled,
    placeholder,
    className
}: TimezoneSelectorProps) => {
    const [open, setOpen] = React.useState(false);
    const options = React.useMemo(() => getTimezoneOptions(), []);

    const selectedOption = React.useMemo(
        () => options.find((o) => o.value === value),
        [options, value]
    );

    const handleSelect = (tz: string) => {
        onChange(tz);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild={true}>
                <Button
                    type={`button`}
                    variant={`outline`}
                    role={`combobox`}
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        `w-full justify-between font-normal`,
                        className
                    )}
                >
                    <span className={`truncate`}>
                        {selectedOption
                            ? selectedOption.label
                            : (placeholder ?? `Select timezone...`)}
                    </span>
                    <ChevronsUpDownIcon className={`ml-2 h-4 w-4 shrink-0 opacity-50`} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className={`w-[320px] p-0`} align={`start`}>
                <Command>
                    <CommandInput placeholder={`Search timezone...`} />
                    <CommandList>
                        <CommandEmpty>No timezone found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => (
                                <CommandItem
                                    key={opt.value}
                                    value={opt.label}
                                    onSelect={() => handleSelect(opt.value)}
                                >
                                    <CheckIcon
                                        className={cn(
                                            `mr-2 h-4 w-4`,
                                            value === opt.value
                                                ? `opacity-100`
                                                : `opacity-0`
                                        )}
                                    />
                                    <span className={`truncate`}>{opt.value}</span>
                                    <span
                                        className={`text-muted-foreground ml-auto text-xs`}
                                    >
                                        {opt.offset}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default TimezoneSelector;
export { TimezoneSelector };
