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
import { languages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IoLanguageSharp } from "react-icons/io5";

interface LanguagePickerProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    readonly value?: string;
    readonly onValueChange?: (value: string) => void;
    readonly defaultOpen?: boolean;
}

export default function LanguagePicker({
    className,
    style,
    value,
    onValueChange,
    defaultOpen = false
}: LanguagePickerProps) {
    const [open, setOpen] = useState(defaultOpen);

    const { t, i18n } = useTranslation();
    const [selectedValue, setSelectedValue] = useState(value || i18n.language);

    // Get browser's preferred language
    const browserLanguage = navigator.language || navigator.languages?.[0] || "en-US";

    const selectedLanguage = languages.find((lang) => lang.code === selectedValue);

    const handleSelect = (languageCode: string) => {
        setSelectedValue(languageCode);
        setOpen(false);
        onValueChange?.(languageCode);
        i18n.changeLanguage(languageCode);
    };

    const filterLanguages = (value: string, search: string) => {
        const language = languages.find((lang) => lang.code === value);
        if (!language) return 0;

        const searchLower = search.toLowerCase();
        const englishMatch = language.englishName.toLowerCase().includes(searchLower);
        const originalMatch = language.originalName.toLowerCase().includes(searchLower);

        return englishMatch || originalMatch ? 1 : 0;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    aria-expanded={open}
                    className={cn("cursor-pointer justify-between px-2", className)}
                    style={style}
                    title={t("languagePicker.selectLanguage")}
                >
                    <IoLanguageSharp className="h-5 w-5" />{" "}
                    {selectedLanguage ? (
                        <span className="flex w-full items-center gap-2">
                            <span>{selectedLanguage.originalName}</span>{" "}
                            <span className="text-sm">{selectedLanguage.emoji}</span>
                        </span>
                    ) : (
                        <span>
                            <span>{t("languagePicker.selectLanguage")}</span>
                        </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command filter={filterLanguages}>
                    <CommandInput placeholder={t("languagePicker.selectLanguage")} />
                    <CommandList>
                        <CommandEmpty className="py-6 text-center text-sm select-none">
                            {t("languagePicker.noLanguageFound")}
                        </CommandEmpty>
                        <CommandGroup>
                            {languages.map((language) => (
                                <CommandItem
                                    key={language.code}
                                    value={language.code}
                                    className="cursor-pointer"
                                    onSelect={() => handleSelect(language.code)}
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
                                            selectedValue === language.code
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
