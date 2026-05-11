import SearchSelectPicker from "@/components/atoms/searchSelectPicker/SearchSelectPicker";
import { type Language } from "@/lib/languages";
import { useMows } from "@/lib/mowsContext/MowsContext";
import * as React from "react";
import { forwardRef } from "react";

interface LanguagePickerProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
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
            autofocus = false
        },
        ref
    ) => {
        const { setLanguage, t, currentLanguage, languages } = useMows();

        const browserLanguage = navigator.language ?? navigator.languages?.[0] ?? `en-US`;

        const renderRow = (language: Language, showEnglishName: boolean) => (
            <>
                <span className={`text-lg leading-none`}>{language.emoji}</span>
                <div className={`flex flex-col`}>
                    <div className={`flex items-center gap-2`}>
                        <span className={`font-medium`}>{language.originalName}</span>
                        {language.code === browserLanguage && (
                            <span className={`text-xs text-muted-foreground opacity-60`}>
                                (system)
                            </span>
                        )}
                    </div>
                    {showEnglishName && (
                        <span className={`text-xs text-muted-foreground`}>
                            {language.englishName}
                        </span>
                    )}
                </div>
            </>
        );

        return (
            <SearchSelectPicker<Language>
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
                renderItemContent={(lang) => renderRow(lang, true)}
                renderTriggerContent={(lang) => renderRow(lang, false)}
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
