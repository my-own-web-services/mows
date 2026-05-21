import SearchSelectPicker from "@/components/input/searchSelectPicker/SearchSelectPicker";
import { useMows } from "@/lib/mowsContext/MowsContext";
import { type MowsTheme } from "@/lib/themes";
import { Monitor, Moon, Sun } from "lucide-react";
import * as React from "react";
import { forwardRef } from "react";

interface ThemePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, `onSelect`> {
    readonly defaultOpen?: boolean;
    readonly onValueChange?: (value?: MowsTheme) => void;
    readonly standalone?: boolean;
}

const getThemeIcon = (themeId: string) => {
    switch (themeId) {
        case `light`:
            return <Sun className={`h-4 w-4`} />;
        case `dark`:
            return <Moon className={`h-4 w-4`} />;
        case `system`:
        default:
            return <Monitor className={`h-4 w-4`} />;
    }
};

const ThemePicker = forwardRef<HTMLDivElement, ThemePickerProps>(
    (
        { className, style, defaultOpen = false, onValueChange, standalone = false, ...rest },
        ref
    ) => {
        const { t, currentTheme, setTheme, themes } = useMows();

        const systemTheme = window.matchMedia(`(prefers-color-scheme: dark)`).matches
            ? `dark`
            : `light`;

        const renderItemContent = (theme: MowsTheme) => (
            <>
                {getThemeIcon(theme.id)}
                <span className={`font-medium`}>{theme.name}</span>
                {theme.id === `system` && (
                    <span className={`text-xs text-muted-foreground opacity-60`}>
                        ({systemTheme})
                    </span>
                )}
            </>
        );

        return (
            <SearchSelectPicker<MowsTheme>
                {...rest}
                ref={ref}
                items={themes}
                selected={currentTheme}
                getId={(theme) => theme.id}
                matchesSearch={(theme, search) =>
                    theme.name.toLowerCase().includes(search.toLowerCase())
                }
                renderItemContent={renderItemContent}
                onSelect={(theme) => {
                    setTheme(theme);
                    onValueChange?.(theme);
                }}
                onOpenChange={(open) => {
                    if (!open) onValueChange?.();
                }}
                placeholder={t.themePicker.selectTheme}
                emptyText={t.themePicker.noThemeFound}
                triggerTitle={t.themePicker.selectTheme}
                standalone={standalone}
                defaultOpen={defaultOpen}
                autoFocus={standalone}
                className={className}
                style={style}
                popoverContentClassName={`w-[220px]`}
            />
        );
    }
);

ThemePicker.displayName = `ThemePicker`;

export default ThemePicker;
