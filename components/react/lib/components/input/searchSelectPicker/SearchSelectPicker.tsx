import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import {
    forwardRef,
    useEffect,
    useState,
    type CSSProperties,
    type ForwardedRef,
    type ReactNode
} from "react";

export interface SearchSelectPickerProps<T> {
    readonly items: readonly T[];
    readonly selected?: T;
    readonly onSelect: (item: T) => void;
    readonly getId: (item: T) => string;
    readonly matchesSearch: (item: T, search: string) => boolean;
    readonly renderItemContent: (item: T) => ReactNode;
    /** Override what's shown in the popover trigger row. Defaults to renderItemContent. */
    readonly renderTriggerContent?: (item: T) => ReactNode;
    readonly placeholder: string;
    readonly emptyText: string;
    readonly triggerTitle: string;
    /** Shown in the trigger when nothing is selected (popover mode only). */
    readonly emptyTrigger?: ReactNode;
    readonly standalone?: boolean;
    readonly defaultOpen?: boolean;
    readonly autoFocus?: boolean;
    readonly onOpenChange?: (open: boolean) => void;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly popoverContentClassName?: string;
}

// Hints that tell credential / autofill / TOTP detectors (KeePassXC, 1Password,
// LastPass, Bitwarden, browser autofill) that this search field is unrelated to
// any account input and should never be filled, saved, or treated as a TOTP.
//
// `type="search"` + a neutral name keeps KeePassXC's TOTP heuristic (which
// triggers on placeholder/label words like "code" — e.g. "Select code theme")
// from latching onto these inputs. The other data-* attributes opt out of the
// individual managers' autofill paths.
const ignoreCredentialManagersProps = {
    type: `search`,
    name: `mows-search`,
    autoComplete: `off`,
    autoCorrect: `off`,
    autoCapitalize: `off`,
    spellCheck: false,
    [`data-form-type`]: `other`,
    [`data-1p-ignore`]: ``,
    [`data-lpignore`]: `true`,
    [`data-bwignore`]: `true`,
    [`data-kpxc-skip`]: `true`
} as const;

const SearchSelectPickerInner = <T,>(
    {
        items,
        selected,
        onSelect,
        getId,
        matchesSearch,
        renderItemContent,
        renderTriggerContent,
        placeholder,
        emptyText,
        triggerTitle,
        emptyTrigger,
        standalone = false,
        defaultOpen = false,
        autoFocus = false,
        onOpenChange,
        className,
        style,
        popoverContentClassName
    }: SearchSelectPickerProps<T>,
    ref: ForwardedRef<HTMLDivElement>
) => {
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
        setOpen(defaultOpen);
    }, [defaultOpen]);

    const filter = (value: string, search: string) => {
        const item = items.find((i) => getId(i) === value);
        if (!item) return 0;
        return matchesSearch(item, search) ? 1 : 0;
    };

    const handleSelect = (item: T) => {
        setOpen(false);
        onSelect(item);
        onOpenChange?.(false);
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        onOpenChange?.(newOpen);
    };

    const command = (
        <Command filter={filter}>
            <CommandInput
                placeholder={placeholder}
                autoFocus={autoFocus}
                {...ignoreCredentialManagersProps}
                className={`[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none`}
            />
            <CommandList>
                <CommandEmpty className={`select-none py-6 text-center text-sm`}>
                    {emptyText}
                </CommandEmpty>
                <CommandGroup>
                    {items.map((item) => {
                        const id = getId(item);
                        const isSelected = selected ? getId(selected) === id : false;
                        return (
                            <CommandItem
                                key={id}
                                value={id}
                                className={`cursor-pointer gap-2`}
                                onSelect={() => handleSelect(item)}
                            >
                                {renderItemContent(item)}
                                <Check
                                    className={cn(
                                        `ml-auto h-4 w-4`,
                                        isSelected ? `opacity-100` : `opacity-0`
                                    )}
                                />
                            </CommandItem>
                        );
                    })}
                </CommandGroup>
            </CommandList>
        </Command>
    );

    if (standalone) {
        return (
            <div ref={ref} className={cn(`w-full`, className)} style={style}>
                {command}
            </div>
        );
    }

    const triggerContent = selected
        ? (renderTriggerContent ?? renderItemContent)(selected)
        : emptyTrigger;

    return (
        <Popover modal open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <div
                    ref={ref}
                    className={cn(
                        // Padding matches the surrounding DropdownMenuItem
                        // (px-2 py-1.5) so the hover background lines up
                        // exactly with the highlight of sibling items in a
                        // dropdown menu.
                        `flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground`,
                        className
                    )}
                    style={style}
                    title={triggerTitle}
                >
                    {triggerContent}
                    <ChevronsUpDown className={`ml-auto h-4 w-4 opacity-50`} />
                </div>
            </PopoverTrigger>
            <PopoverContent
                className={cn(`w-[260px] p-0`, popoverContentClassName)}
            >
                {command}
            </PopoverContent>
        </Popover>
    );
};

const SearchSelectPicker = forwardRef(SearchSelectPickerInner) as <T>(
    props: SearchSelectPickerProps<T> & { ref?: ForwardedRef<HTMLDivElement> }
) => ReturnType<typeof SearchSelectPickerInner>;

export default SearchSelectPicker;
export { SearchSelectPicker };
