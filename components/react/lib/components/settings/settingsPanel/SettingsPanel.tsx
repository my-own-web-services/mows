import CodeThemePicker from "@/components/code/codeThemePicker/CodeThemePicker";
import CodeViewer from "@/components/code/codeViewer/CodeViewer";
import LanguagePicker from "@/components/settings/languagePicker/LanguagePicker";
import ThemePicker from "@/components/settings/themePicker/ThemePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Translation } from "@/lib/languages";
import {
    type MowsCodeEditorSettings,
    type MowsToastSettings,
    type ToastPosition,
    TOAST_POSITIONS,
    useMows
} from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import {
    type CSSProperties,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

export interface MowsSettings {
    readonly theme: string;
    readonly codeTheme: string;
    readonly language?: string;
    readonly codeEditor?: Partial<MowsCodeEditorSettings>;
    readonly toast?: Partial<MowsToastSettings>;
}

export interface SettingsPanelProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

const fieldClass = `flex h-9 w-full items-center justify-between rounded-md border border-input bg-background py-1`;

type SectionId = `appearance` | `code-editor` | `language` | `notifications`;

const TOAST_POSITION_LABEL_KEYS: Record<ToastPosition, keyof Translation[`settings`][`toastPositions`]> = {
    "top-left": `topLeft`,
    "top-center": `topCenter`,
    "top-right": `topRight`,
    "bottom-left": `bottomLeft`,
    "bottom-center": `bottomCenter`,
    "bottom-right": `bottomRight`
};

const SettingsPanel = ({ className, style }: SettingsPanelProps) => {
    const {
        t,
        themes,
        currentTheme,
        setTheme,
        codeThemes,
        currentCodeTheme,
        setCodeTheme,
        languages,
        currentLanguage,
        setLanguage,
        codeEditorSettings,
        setCodeEditorSettings,
        toastSettings,
        setToastSettings
    } = useMows();

    const sections = useMemo(
        () =>
            [
                { id: `appearance`, label: t.settings.sections.appearance },
                { id: `code-editor`, label: t.settings.sections.codeEditor },
                { id: `notifications`, label: t.settings.sections.notifications },
                { id: `language`, label: t.settings.sections.language }
            ] as { id: SectionId; label: string }[],
        [t.settings.sections]
    );

    const currentSettings: MowsSettings = useMemo(
        () => ({
            theme: currentTheme.id,
            codeTheme: currentCodeTheme.id,
            language: currentLanguage?.code,
            codeEditor: codeEditorSettings,
            toast: toastSettings
        }),
        [
            currentTheme.id,
            currentCodeTheme.id,
            currentLanguage?.code,
            codeEditorSettings,
            toastSettings
        ]
    );

    const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(currentSettings, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);

    useEffect(() => {
        setJsonDraft(JSON.stringify(currentSettings, null, 2));
        setJsonError(null);
    }, [currentSettings]);

    const applySettings = (next: MowsSettings) => {
        if (next.theme && next.theme !== currentTheme.id) {
            const theme = themes.find((th) => th.id === next.theme);
            if (theme) setTheme(theme);
        }
        if (next.codeTheme && next.codeTheme !== currentCodeTheme.id) {
            const codeTheme = codeThemes.find((c) => c.id === next.codeTheme);
            if (codeTheme) setCodeTheme(codeTheme);
        }
        if (next.language && next.language !== currentLanguage?.code) {
            const lang = languages.find((l) => l.code === next.language);
            if (lang) setLanguage(lang);
        }
        if (next.codeEditor) {
            setCodeEditorSettings(next.codeEditor);
        }
        if (next.toast) {
            setToastSettings(next.toast);
        }
    };

    const onSaveJson = () => {
        try {
            const parsed = JSON.parse(jsonDraft) as MowsSettings;
            applySettings(parsed);
            setJsonError(null);
        } catch (err) {
            setJsonError(t.settings.invalidJson + ` (` + (err as Error).message + `)`);
        }
    };

    const onResetJson = () => {
        setJsonDraft(JSON.stringify(currentSettings, null, 2));
        setJsonError(null);
    };

    // ---- Sidebar navigation -------------------------------------------------

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [activeSection, setActiveSection] = useState<SectionId>(sections[0].id);
    // Programmatic scrolls fire intersection events that we should ignore so
    // the active item doesn't briefly track the *passing* sections.
    const programmaticScrollUntil = useRef(0);

    const scrollToSection = useCallback((id: SectionId) => {
        const root = scrollContainerRef.current;
        if (!root) return;
        const target = root.querySelector<HTMLElement>(`[data-section-id="${id}"]`);
        if (!target) return;
        programmaticScrollUntil.current = Date.now() + 600;
        setActiveSection(id);
        target.scrollIntoView({ behavior: `smooth`, block: `start` });
    }, []);

    useEffect(() => {
        const root = scrollContainerRef.current;
        if (!root) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (Date.now() < programmaticScrollUntil.current) return;
                // Pick the entry whose top is closest to (but not below) the
                // root's top — that's the section currently anchored to the
                // top of the viewport.
                const candidates = entries
                    .filter((e) => e.isIntersecting)
                    .sort(
                        (a, b) =>
                            a.boundingClientRect.top - b.boundingClientRect.top
                    );
                if (candidates.length === 0) return;
                const id = (candidates[0].target as HTMLElement).dataset
                    .sectionId as SectionId | undefined;
                if (id) setActiveSection(id);
            },
            {
                root,
                // Triggers ~halfway up the viewport so the highlight follows
                // the section title rather than waiting for the entire
                // section to scroll out.
                rootMargin: `0px 0px -60% 0px`,
                threshold: [0, 0.1, 0.5]
            }
        );
        sections.forEach((s) => {
            const el = root.querySelector<HTMLElement>(
                `[data-section-id="${s.id}"]`
            );
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [sections]);

    return (
        <div
            style={style}
            className={cn(`SettingsPanel flex h-full flex-col gap-4`, className)}
        >
            <Tabs
                defaultValue={`form`}
                className={`flex h-full min-h-0 w-full flex-col`}
            >
                <TabsList>
                    <TabsTrigger value={`form`}>{t.settings.formTab}</TabsTrigger>
                    <TabsTrigger value={`json`}>{t.settings.jsonTab}</TabsTrigger>
                </TabsList>

                <TabsContent
                    value={`form`}
                    className={`flex min-h-0 flex-1 gap-6 pt-4`}
                >
                    <nav
                        className={`flex w-48 shrink-0 flex-col gap-1 border-r pr-3`}
                        aria-label={t.settings.title}
                    >
                        {sections.map((s) => (
                            <Button
                                type="button"
                                variant="ghost"
                                key={s.id}
                                onClick={() => scrollToSection(s.id)}
                                className={cn(
                                    `relative h-auto justify-start rounded-md px-3 py-2 text-left text-sm font-normal transition-colors`,
                                    activeSection === s.id
                                        ? `bg-accent text-accent-foreground font-medium`
                                        : `text-muted-foreground hover:bg-accent/50 hover:text-foreground`
                                )}
                            >
                                {activeSection === s.id && (
                                    <span
                                        aria-hidden
                                        className="bg-primary absolute inset-y-2 left-0 w-[3px] rounded-r"
                                    />
                                )}
                                {s.label}
                            </Button>
                        ))}
                    </nav>

                    <div
                        ref={scrollContainerRef}
                        className={`flex min-w-0 flex-1 flex-col gap-10 overflow-y-auto pr-2`}
                    >
                        <section
                            data-section-id={`appearance`}
                            className={`flex flex-col gap-4 scroll-mt-2`}
                        >
                            <h2
                                className={`text-2xl font-semibold tracking-tight`}
                            >
                                {t.settings.sections.appearance}
                            </h2>
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label>{t.settings.labels.theme}</Label>
                                <ThemePicker className={fieldClass} />
                            </div>
                        </section>

                        <section
                            data-section-id={`code-editor`}
                            className={`flex flex-col gap-4 scroll-mt-2`}
                        >
                            <h2
                                className={`text-2xl font-semibold tracking-tight`}
                            >
                                {t.settings.sections.codeEditor}
                            </h2>
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label>{t.settings.labels.codeTheme}</Label>
                                <CodeThemePicker className={fieldClass} />
                            </div>
                            <CodeViewer
                                language={`tsx`}
                                code={`const greet = (name: string): string => \`Hello, \${name}!\`;\nconst nums = [1, 2, 3].map((n) => n * 2);`}
                                className={`h-[140px]`}
                            />
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label htmlFor={`settings-show-line-numbers`}>
                                    {t.settings.labels.showLineNumbers}
                                </Label>
                                <Switch
                                    id={`settings-show-line-numbers`}
                                    checked={codeEditorSettings.showLineNumbers}
                                    onCheckedChange={(showLineNumbers) =>
                                        setCodeEditorSettings({ showLineNumbers })
                                    }
                                />
                            </div>
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label htmlFor={`settings-wrap`}>
                                    {t.settings.labels.wrap}
                                </Label>
                                <Switch
                                    id={`settings-wrap`}
                                    checked={codeEditorSettings.wrap}
                                    onCheckedChange={(wrap) =>
                                        setCodeEditorSettings({ wrap })
                                    }
                                />
                            </div>
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label htmlFor={`settings-show-whitespace`}>
                                    {t.settings.labels.showWhitespace}
                                </Label>
                                <Switch
                                    id={`settings-show-whitespace`}
                                    checked={codeEditorSettings.showWhitespace}
                                    onCheckedChange={(showWhitespace) =>
                                        setCodeEditorSettings({ showWhitespace })
                                    }
                                />
                            </div>
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label htmlFor={`settings-bracket-pair-colorization`}>
                                    {t.settings.labels.bracketPairColorization}
                                </Label>
                                <Switch
                                    id={`settings-bracket-pair-colorization`}
                                    checked={codeEditorSettings.bracketPairColorization}
                                    onCheckedChange={(bracketPairColorization) =>
                                        setCodeEditorSettings({ bracketPairColorization })
                                    }
                                />
                            </div>
                        </section>

                        <section
                            data-section-id={`notifications`}
                            className={`flex flex-col gap-4 scroll-mt-2`}
                        >
                            <h2
                                className={`text-2xl font-semibold tracking-tight`}
                            >
                                {t.settings.sections.notifications}
                            </h2>
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label htmlFor={`settings-toast-position`}>
                                    {t.settings.labels.toastPosition}
                                </Label>
                                <Select
                                    value={toastSettings.position}
                                    onValueChange={(value) =>
                                        setToastSettings({
                                            position: value as ToastPosition
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        id={`settings-toast-position`}
                                        className={fieldClass}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TOAST_POSITIONS.map((p) => (
                                            <SelectItem key={p} value={p}>
                                                {
                                                    t.settings.toastPositions[
                                                        TOAST_POSITION_LABEL_KEYS[p]
                                                    ]
                                                }
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </section>

                        <section
                            data-section-id={`language`}
                            className={`flex flex-col gap-4 scroll-mt-2`}
                        >
                            <h2
                                className={`text-2xl font-semibold tracking-tight`}
                            >
                                {t.settings.sections.language}
                            </h2>
                            <div
                                className={`grid grid-cols-[200px_1fr] items-center gap-3`}
                            >
                                <Label>{t.settings.labels.language}</Label>
                                <LanguagePicker className={fieldClass} />
                            </div>
                        </section>
                    </div>
                </TabsContent>

                <TabsContent
                    value={`json`}
                    className={`flex min-h-0 flex-1 flex-col gap-2 pt-4`}
                >
                    <CodeViewer
                        editable
                        wrap
                        showLineNumbers
                        language={`json`}
                        code={jsonDraft}
                        onCodeChange={setJsonDraft}
                        className={`h-[400px]`}
                    />
                    {jsonError && (
                        <span className={`text-sm text-destructive`}>{jsonError}</span>
                    )}
                    <div className={`flex justify-end gap-2`}>
                        <Button variant={`secondary`} onClick={onResetJson}>
                            {t.settings.reset}
                        </Button>
                        <Button onClick={onSaveJson}>{t.settings.save}</Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

SettingsPanel.displayName = `SettingsPanel`;

export default SettingsPanel;
