import SearchSelectPicker from "@/components/input/searchSelectPicker/SearchSelectPicker";
import { type MowsCodeTheme } from "@/lib/codeThemes";
import { useMows } from "@/lib/mowsContext/MowsContext";
import { Code2 } from "lucide-react";
import * as React from "react";
import { forwardRef } from "react";

interface CodeThemePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, `onSelect`> {
    readonly defaultOpen?: boolean;
    readonly onValueChange?: (value?: MowsCodeTheme) => void;
    readonly standalone?: boolean;
}

const ThemeSwatch = ({ theme }: { theme: MowsCodeTheme }) => (
    <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-border`}
        style={{
            background: theme.mode === `dark` ? `#1e1e1e` : `#ffffff`,
            color: theme.mode === `dark` ? `#d4d4d4` : `#1e1e1e`
        }}
    >
        <Code2 className={`h-3 w-3`} />
    </span>
);

const CodeThemePicker = forwardRef<HTMLDivElement, CodeThemePickerProps>(
    (
        { className, style, defaultOpen = false, onValueChange, standalone = false, ...rest },
        ref
    ) => {
        const { t, codeThemes, currentCodeTheme, setCodeTheme } = useMows();

        const renderItemContent = (theme: MowsCodeTheme) => (
            <>
                <ThemeSwatch theme={theme} />
                <span className={`font-medium`}>{theme.name}</span>
            </>
        );

        return (
            <SearchSelectPicker<MowsCodeTheme>
                {...rest}
                ref={ref}
                items={codeThemes}
                selected={currentCodeTheme}
                getId={(theme) => theme.id}
                matchesSearch={(theme, search) =>
                    theme.name.toLowerCase().includes(search.toLowerCase())
                }
                renderItemContent={renderItemContent}
                onSelect={(theme) => {
                    setCodeTheme(theme);
                    onValueChange?.(theme);
                }}
                onOpenChange={(open) => {
                    if (!open) onValueChange?.();
                }}
                placeholder={t.codeThemePicker.selectCodeTheme}
                emptyText={t.codeThemePicker.noCodeThemeFound}
                triggerTitle={t.codeThemePicker.selectCodeTheme}
                standalone={standalone}
                defaultOpen={defaultOpen}
                autoFocus={standalone}
                className={className}
                style={style}
                popoverContentClassName={`w-[260px]`}
            />
        );
    }
);

CodeThemePicker.displayName = `CodeThemePicker`;

export default CodeThemePicker;
