import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { forwardRef, type CSSProperties } from "react";

export interface SearchInputProps {
    readonly value: string;
    readonly onValueChange: (value: string) => void;
    readonly placeholder?: string;
    readonly autoFocus?: boolean;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Accessible label for the input itself. */
    readonly [`aria-label`]?: string;
    /** Accessible label for the clear button. Defaults to "Clear search". */
    readonly clearAriaLabel?: string;
    /** Hide the leading search icon. */
    readonly hideIcon?: boolean;
    /** Hide the clear button when the field is non-empty. */
    readonly hideClearButton?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    (
        {
            value,
            onValueChange,
            placeholder,
            autoFocus,
            disabled,
            className,
            style,
            [`aria-label`]: ariaLabel,
            clearAriaLabel = `Clear search`,
            hideIcon,
            hideClearButton
        },
        ref
    ) => {
        return (
            <InputGroup className={cn(`SearchInput group`, className)} style={style}>
                {!hideIcon && (
                    <InputGroupAddon>
                        <Search />
                    </InputGroupAddon>
                )}
                <InputGroupInput
                    ref={ref}
                    type={`search`}
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    disabled={disabled}
                    aria-label={ariaLabel ?? placeholder}
                    autoComplete={`off`}
                    autoCorrect={`off`}
                    autoCapitalize={`off`}
                    spellCheck={false}
                    data-form-type={`other`}
                    data-1p-ignore={``}
                    data-lpignore={`true`}
                    data-bwignore={`true`}
                    // Hide the browser-native clear button (Chromium / Safari
                    // render an extra "x" inside `type=search`) — we render
                    // our own clear button.
                    className={`[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none`}
                />
                {!hideClearButton && value.length > 0 && (
                    <InputGroupAddon
                        align={`inline-end`}
                        className={`pointer-events-none opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100`}
                    >
                        <InputGroupButton
                            size={`icon-xs`}
                            aria-label={clearAriaLabel}
                            disabled={disabled}
                            onClick={() => onValueChange(``)}
                        >
                            <X />
                        </InputGroupButton>
                    </InputGroupAddon>
                )}
            </InputGroup>
        );
    }
);

SearchInput.displayName = `SearchInput`;

export default SearchInput;
export { SearchInput };
