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
import { useFilez } from "@/FilezContext";
import { FilezTheme, themes } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Monitor, Moon, Sun } from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface ThemePickerProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    readonly defaultOpen?: boolean;
}

const getThemeIcon = (themeId: string) => {
    switch (themeId) {
        case "light":
            return <Sun className="h-4 w-4" />;
        case "dark":
            return <Moon className="h-4 w-4" />;
        case "system":
        default:
            return <Monitor className="h-4 w-4" />;
    }
};

export default function ThemePicker({ className, style, defaultOpen = false }: ThemePickerProps) {
    const [open, setOpen] = useState(defaultOpen);
    const { t } = useTranslation();
    const { currentTheme, setTheme } = useFilez();

    // Get system's preferred theme
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    const handleSelect = (theme: FilezTheme) => {
        setOpen(false);
        setTheme(theme);
    };

    const filterThemes = (value: string, search: string) => {
        const theme = themes.find((theme) => theme.id === value);
        if (!theme) return 0;

        const searchLower = search.toLowerCase();
        const nameMatch = theme.name.toLowerCase().includes(searchLower);

        return nameMatch ? 1 : 0;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    aria-expanded={open}
                    className={cn("cursor-pointer justify-between px-2", className)}
                    style={style}
                    title={t("themePicker.selectTheme", "Select theme")}
                >
                    {getThemeIcon(currentTheme.id)}
                    <span className="flex w-full items-center gap-2">
                        <span>{currentTheme.name}</span>
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command filter={filterThemes}>
                    <CommandInput placeholder={t("themePicker.selectTheme", "Select theme")} />
                    <CommandList>
                        <CommandEmpty className="py-6 text-center text-sm select-none">
                            {t("themePicker.noThemeFound", "No theme found")}
                        </CommandEmpty>
                        <CommandGroup>
                            {themes.map((theme) => (
                                <CommandItem
                                    key={theme.id}
                                    value={theme.id}
                                    className="cursor-pointer"
                                    onSelect={() => handleSelect(theme)}
                                >
                                    <div className="flex items-center gap-2">
                                        {getThemeIcon(theme.id)}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{theme.name}</span>
                                                {theme.id === "system" && (
                                                    <span className="text-muted-foreground text-xs opacity-60">
                                                        ({systemTheme})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <Check
                                        className={cn(
                                            "ml-auto h-4 w-4",
                                            currentTheme.id === theme.id
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
