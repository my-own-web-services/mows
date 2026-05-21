import SearchSelectPicker from "@/components/input/searchSelectPicker/SearchSelectPicker";
import { type Language } from "@/lib/languages";
import { useMows } from "@/lib/mowsContext/MowsContext";
import * as React from "react";
import { forwardRef } from "react";

interface LanguagePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, `onSelect`> {
    readonly value?: string;
    readonly onValueChange?: (value?: Language) => void;
    readonly defaultOpen?: boolean;
    readonly standalone?: boolean;
    readonly autofocus?: boolean;
}

const LanguagePicker = forwardRef<HTMLDivElement, LanguagePickerProps>(
    (
        {
            className,
            style,
            onValueChange,
            defaultOpen = false,
            standalone = false,
            autofocus = false,
            // Unrecognized props are forwarded onto the popover trigger div
            // so a parent `<DropdownMenuItem asChild>` can merge `role`,
            // `onSelect`, focus / keyboard handlers, etc. all the way down.
            value: _value,
            ...rest
        },
        ref
    ) => {
        const { setLanguage, t, currentLanguage, languages } = useMows();

        const browserLanguage = navigator.language ?? navigator.languages?.[0] ?? `en-US`;

        const renderRow = (language: Language, options: { inPopover: boolean }) => (
            <>
                <span className={`text-lg leading-none`}>{language.emoji}</span>
                <div className={`flex flex-col`}>
                    <div className={`flex items-center gap-2`}>
                        <span className={`font-medium`}>{language.originalName}</span>
                        {options.inPopover && language.code === browserLanguage && (
                            // "(system)" tag only inside the popover list, not on
                            // the trigger row — outside the popover it would
                            // collide with the ThemePicker's "System" theme name
                            // when both pickers share a parent (e.g. the PrimaryMenu
                            // dropdown), confusing accessibility tooling.
                            <span className={`text-xs text-muted-foreground opacity-60`}>
                                (system)
                            </span>
                        )}
                    </div>
                    {options.inPopover && (
                        <span className={`text-xs text-muted-foreground`}>
                            {language.englishName}
                        </span>
                    )}
                </div>
            </>
        );

        return (
            <SearchSelectPicker<Language>
                {...rest}
                ref={ref}
                items={languages}
                selected={currentLanguage ?? undefined}
                getId={(lang) => lang.code}
                matchesSearch={(lang, search) => {
                    const s = search.toLowerCase();
                    return (
                        lang.englishName.toLowerCase().includes(s) ||
                        lang.originalName.toLowerCase().includes(s)
                    );
                }}
                renderItemContent={(lang) => renderRow(lang, { inPopover: true })}
                renderTriggerContent={(lang) => renderRow(lang, { inPopover: false })}
                onSelect={(lang) => {
                    setLanguage(lang);
                    onValueChange?.(lang);
                }}
                onOpenChange={(open) => {
                    if (!open) onValueChange?.();
                }}
                placeholder={t.languagePicker.selectLanguage}
                emptyText={t.languagePicker.noLanguageFound}
                triggerTitle={t.languagePicker.selectLanguage}
                emptyTrigger={<span>{t.languagePicker.selectLanguage}</span>}
                standalone={standalone}
                defaultOpen={defaultOpen}
                autoFocus={standalone ? autofocus : false}
                className={className}
                style={style}
                popoverContentClassName={`w-[240px]`}
            />
        );
    }
);

LanguagePicker.displayName = `LanguagePicker`;

export default LanguagePicker;
