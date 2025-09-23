import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFilez } from "@/FilezContext";
import { getBrowserLanguage, languages, type Language } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { forwardRef, useEffect, useRef, useState } from "react";
import { IoLanguageSharp } from "react-icons/io5";

interface LanguagePickerProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    readonly value?: string;
    readonly onValueChange?: (value?: Language) => void;
    readonly defaultOpen?: boolean;
}

const LanguagePicker = forwardRef<HTMLDivElement, LanguagePickerProps>(
    (
        {
            className,
            style,
            value,
            onValueChange,
            defaultOpen = false,
            ...props
        }: LanguagePickerProps,
        ref
    ) => {
        const [open, setOpen] = useState(defaultOpen);
        const triggerRef = useRef<HTMLButtonElement>(null);

        useEffect(() => {
            setOpen(defaultOpen);
        }, [defaultOpen]);

        const { setLanguage, t, currentLanguage } = useFilez();

        const browserLanguage = getBrowserLanguage().code;

        const handleSelect = (language: Language) => {
            setOpen(false);
            setLanguage(language);
            onValueChange?.();
        };

        const filterLanguages = (value: string, search: string) => {
            const language = languages.find((lang) => lang.code === value);
            if (!language) return 0;

            const searchLower = search.toLowerCase();
            const englishMatch = language.englishName.toLowerCase().includes(searchLower);
            const originalMatch = language.originalName.toLowerCase().includes(searchLower);

            return englishMatch || originalMatch ? 1 : 0;
        };

        const handleOpenChange = (newOpen: boolean) => {
            setOpen(newOpen);
            if (!newOpen) {
                onValueChange?.();
            }
        };

        return (
            <Popover modal open={open} onOpenChange={handleOpenChange}>
                <PopoverTrigger asChild>
                    <div
                        {...props}
                        ref={ref}
                        className={cn(
                            className,
                            "flex w-full cursor-pointer items-center justify-between px-2"
                        )}
                        style={style}
                        title={t.languagePicker.selectLanguage}
                    >
                        <IoLanguageSharp className="h-5 w-5" />{" "}
                        {currentLanguage ? (
                            <span className="flex w-full items-center gap-2">
                                <span>{currentLanguage.originalName}</span>{" "}
                                <span className="text-sm">{currentLanguage.emoji}</span>
                            </span>
                        ) : (
                            <span>
                                <span>{t.languagePicker.selectLanguage}</span>
                            </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                    <Command filter={filterLanguages}>
                        <CommandInput placeholder={t.languagePicker.selectLanguage} />
                        <CommandList>
                            <CommandEmpty className="py-6 text-center text-sm select-none">
                                {t.languagePicker.noLanguageFound}
                            </CommandEmpty>
                            <CommandGroup>
                                {languages.map((language) => (
                                    <CommandItem
                                        key={language.code}
                                        value={language.code}
                                        className="cursor-pointer"
                                        onSelect={() => handleSelect(language)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{language.emoji}</span>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {language.originalName}
                                                    </span>
                                                    {language.code === browserLanguage && (
                                                        <span className="text-muted-foreground text-xs opacity-60">
                                                            (system)
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-muted-foreground text-xs">
                                                    {language.englishName}
                                                </span>
                                            </div>
                                        </div>
                                        <Check
                                            className={cn(
                                                "ml-auto h-4 w-4",
                                                currentLanguage?.code === language.code
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

LanguagePicker.displayName = "LanguagePicker";

export default LanguagePicker;
