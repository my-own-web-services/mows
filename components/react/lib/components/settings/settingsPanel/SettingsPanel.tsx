import CodeThemePicker from "@/components/code/codeThemePicker/CodeThemePicker";
import CodeViewer from "@/components/code/codeViewer/CodeViewer";
import LanguagePicker from "@/components/settings/languagePicker/LanguagePicker";
import MapStylePicker from "@/components/settings/mapStylePicker/MapStylePicker";
import ThemePicker from "@/components/settings/themePicker/ThemePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { Translation } from "@/lib/languages";
import {
    type AnyAppSettings,
    type AppSettingField,
    type AppSettingsContextValue,
    matchesFieldType,
    resolveLocalisedText
} from "@/lib/mowsContext/appSettings";
import {
    type ToastPosition,
    TOAST_POSITIONS,
    useMows
} from "@/lib/mowsContext/MowsContext";
import {
    type SettingsBlob,
    SettingsBlobValidationError
} from "@/lib/mowsContext/SettingsManager";
import { cn } from "@/lib/utils";
import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore
} from "react";

export interface SettingsPanelProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

const fieldClass = `flex h-9 w-full items-center justify-between rounded-md border border-input bg-background py-1`;

type CoreSectionId =
    | `appearance`
    | `code-editor`
    | `language`
    | `notifications`
    | `map`;

type SectionId = CoreSectionId | `app-${string}`;

const TOAST_POSITION_LABEL_KEYS: Record<
    ToastPosition,
    keyof Translation[`settings`][`toastPositions`]
> = {
    "top-left": `topLeft`,
    "top-center": `topCenter`,
    "top-right": `topRight`,
    "bottom-left": `bottomLeft`,
    "bottom-center": `bottomCenter`,
    "bottom-right": `bottomRight`
};

const SettingsPanel = ({ className, style }: SettingsPanelProps) => {
    const mows = useMows();
    const {
        t,
        codeEditorSettings,
        setCodeEditorSettings,
        toastSettings,
        setToastSettings,
        settingsManager,
        appSettings
    } = mows;

    // Subscribe to the whole blob so the JSON tab stays in sync if any
    // other code (or a programmatic `replaceBlob`) modifies it under us.
    const blob = useSyncExternalStore(
        useCallback((listener) => settingsManager.subscribe(`*`, listener), [settingsManager]),
        useCallback(() => settingsManager.getBlob(), [settingsManager])
    );

    // Group registered app fields so we render one sub-section per
    // group. Field order inside a group is preserved from the schema
    // declaration order (Object.entries on a same-shape object is
    // insertion-ordered in modern JS).
    const appGroups = useMemo(() => buildAppGroups(appSettings.registered, t), [
        appSettings.registered,
        t
    ]);

    const sections = useMemo(() => {
        const core: { id: CoreSectionId; label: string }[] = [
            { id: `appearance`, label: t.settings.sections.appearance },
            { id: `code-editor`, label: t.settings.sections.codeEditor },
            { id: `map`, label: t.settings.sections.map },
            { id: `notifications`, label: t.settings.sections.notifications },
            { id: `language`, label: t.settings.sections.language }
        ];
        const app: { id: SectionId; label: string }[] = appGroups.map((g) => ({
            id: `app-${g.id}` as const,
            label: g.label
        }));
        return [...core, ...app];
    }, [appGroups, t.settings.sections]);

    // JSON tab edits the full unified blob — that's the "single key,
    // single JSON file for export" guarantee the system gives users.
    const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(blob, null, 2));
    const [jsonError, setJsonError] = useState<string | null>(null);
    // Ref for the JSON-tab textarea so we can skip the blob-driven
    // reset while the user is actively typing (otherwise a programmatic
    // blob change — e.g. cross-tab sync, or any `setCore` from a
    // sibling component — would overwrite mid-edit and lose work).
    const jsonTextareaRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (
            typeof document !== `undefined` &&
            jsonTextareaRef.current &&
            jsonTextareaRef.current.contains(document.activeElement)
        ) {
            // User is mid-edit — preserve their draft. They'll see the
            // staleness on next blur or when they explicitly Reset.
            return;
        }
        setJsonDraft(JSON.stringify(blob, null, 2));
        setJsonError(null);
    }, [blob]);

    const onSaveJson = () => {
        let parsed: SettingsBlob;
        try {
            parsed = JSON.parse(jsonDraft) as SettingsBlob;
        } catch (err) {
            setJsonError(t.settings.invalidJson + ` (` + (err as Error).message + `)`);
            return;
        }
        try {
            // SettingsManager.replaceBlob owns the version + shape
            // contract; the panel only forwards the parsed value and
            // surfaces the validation error to the user.
            settingsManager.replaceBlob(parsed);
            setJsonError(null);
        } catch (err) {
            if (err instanceof SettingsBlobValidationError) {
                setJsonError(`${t.settings.invalidJson} (${err.message})`);
                return;
            }
            throw err;
        }
    };

    const onResetJson = () => {
        setJsonDraft(JSON.stringify(blob, null, 2));
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
                const candidates = entries
                    .filter((e) => e.isIntersecting)
                    .sort(
                        (a, b) =>
                            a.boundingClientRect.top - b.boundingClientRect.top
                    );
                if (candidates.length === 0) return;
                const target = candidates[0].target;
                // The observer is only ever attached to our own
                // `[data-section-id]` divs (HTMLElements with a
                // dataset). The narrow guard makes the access
                // type-safe even if a future refactor ever observes a
                // non-HTML element (SVG, MathML).
                if (!(target instanceof HTMLElement)) return;
                const id = target.dataset.sectionId as SectionId | undefined;
                if (id) setActiveSection(id);
            },
            {
                root,
                rootMargin: `0px 0px -60% 0px`,
                threshold: [0, 0.1, 0.5]
            }
        );
        sections.forEach((s) => {
            const el = root.querySelector<HTMLElement>(`[data-section-id="${s.id}"]`);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [sections]);

    const [mode, setMode] = useState<`form` | `json`>(`form`);
    const toggleMode = () => setMode((m) => (m === `form` ? `json` : `form`));
    const toggleLabel = mode === `form` ? t.settings.jsonTab : t.settings.formTab;

    return (
        <div
            style={style}
            className={cn(`SettingsPanel relative flex h-full flex-col`, className)}
        >
            <Button
                type={`button`}
                variant={`outline`}
                size={`sm`}
                onClick={toggleMode}
                aria-pressed={mode === `json`}
                className={`absolute right-0 top-0 z-10`}
            >
                {toggleLabel}
            </Button>

            {mode === `form` ? (
                <div className={`flex min-h-0 flex-1 gap-6 pt-2`}>
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
                            <SettingRow label={t.settings.labels.theme}>
                                <ThemePicker className={fieldClass} />
                            </SettingRow>
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
                            <SettingRow label={t.settings.labels.codeTheme}>
                                <CodeThemePicker className={fieldClass} />
                            </SettingRow>
                            <CodeViewer
                                language={`tsx`}
                                code={`const greet = (name: string): string => \`Hello, \${name}!\`;\nconst nums = [1, 2, 3].map((n) => n * 2);`}
                                className={`h-[140px]`}
                            />
                            <SettingRow
                                label={t.settings.labels.showLineNumbers}
                                htmlFor={`settings-show-line-numbers`}
                            >
                                <Switch
                                    id={`settings-show-line-numbers`}
                                    checked={codeEditorSettings.showLineNumbers}
                                    onCheckedChange={(showLineNumbers) =>
                                        setCodeEditorSettings({ showLineNumbers })
                                    }
                                />
                            </SettingRow>
                            <SettingRow
                                label={t.settings.labels.wrap}
                                htmlFor={`settings-wrap`}
                            >
                                <Switch
                                    id={`settings-wrap`}
                                    checked={codeEditorSettings.wrap}
                                    onCheckedChange={(wrap) =>
                                        setCodeEditorSettings({ wrap })
                                    }
                                />
                            </SettingRow>
                            <SettingRow
                                label={t.settings.labels.showWhitespace}
                                htmlFor={`settings-show-whitespace`}
                            >
                                <Switch
                                    id={`settings-show-whitespace`}
                                    checked={codeEditorSettings.showWhitespace}
                                    onCheckedChange={(showWhitespace) =>
                                        setCodeEditorSettings({ showWhitespace })
                                    }
                                />
                            </SettingRow>
                            <SettingRow
                                label={t.settings.labels.bracketPairColorization}
                                htmlFor={`settings-bracket-pair-colorization`}
                            >
                                <Switch
                                    id={`settings-bracket-pair-colorization`}
                                    checked={
                                        codeEditorSettings.bracketPairColorization
                                    }
                                    onCheckedChange={(bracketPairColorization) =>
                                        setCodeEditorSettings({
                                            bracketPairColorization
                                        })
                                    }
                                />
                            </SettingRow>
                        </section>

                        <section
                            data-section-id={`map`}
                            className={`flex flex-col gap-4 scroll-mt-2`}
                        >
                            <h2
                                className={`text-2xl font-semibold tracking-tight`}
                            >
                                {t.settings.sections.map}
                            </h2>
                            <SettingRow label={t.settings.labels.mapStyle}>
                                <MapStylePicker className={fieldClass} />
                            </SettingRow>
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
                            <SettingRow
                                label={t.settings.labels.toastPosition}
                                htmlFor={`settings-toast-position`}
                            >
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
                            </SettingRow>
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
                            <SettingRow label={t.settings.labels.language}>
                                <LanguagePicker className={fieldClass} />
                            </SettingRow>
                        </section>

                        {appGroups.map((group) => (
                            <section
                                key={group.id}
                                data-section-id={`app-${group.id}`}
                                className={`flex flex-col gap-4 scroll-mt-2`}
                            >
                                <h2
                                    className={`text-2xl font-semibold tracking-tight`}
                                >
                                    {group.label}
                                </h2>
                                {group.fields.map((entry) => (
                                    <AppFieldRow
                                        key={entry.settingId}
                                        settingId={entry.settingId}
                                        field={entry.field}
                                        appSettingsContext={appSettings}
                                        t={t}
                                    />
                                ))}
                            </section>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={`flex min-h-0 flex-1 flex-col gap-2 pt-2`}>
                    <div ref={(el) => { jsonTextareaRef.current = el; }}>
                        <CodeViewer
                            editable
                            wrap
                            showLineNumbers
                            language={`json`}
                            code={jsonDraft}
                            onCodeChange={setJsonDraft}
                            className={`h-[400px]`}
                        />
                    </div>
                    {jsonError && (
                        <span className={`text-sm text-destructive`}>{jsonError}</span>
                    )}
                    <div className={`flex justify-end gap-2`}>
                        <Button variant={`secondary`} onClick={onResetJson}>
                            {t.settings.reset}
                        </Button>
                        <Button onClick={onSaveJson}>{t.settings.save}</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

SettingsPanel.displayName = `SettingsPanel`;

export default SettingsPanel;

// ---- Helpers ---------------------------------------------------------------

interface SettingRowProps {
    readonly label: ReactNode;
    readonly description?: ReactNode;
    readonly htmlFor?: string;
    readonly children: ReactNode;
}

const SettingRow = ({ label, description, htmlFor, children }: SettingRowProps) => (
    <div className={`grid grid-cols-[200px_1fr] items-start gap-3`}>
        <div className={`flex flex-col gap-1 pt-2`}>
            <Label htmlFor={htmlFor}>{label}</Label>
            {description && (
                <span className={`text-xs text-muted-foreground`}>{description}</span>
            )}
        </div>
        <div className={`pt-1`}>{children}</div>
    </div>
);

interface AppGroup {
    readonly id: string;
    readonly label: string;
    readonly fields: ReadonlyArray<{ readonly settingId: string; readonly field: AppSettingField }>;
}

const APP_GROUP_ID_OTHER = `__other__`;

const buildAppGroups = (
    registered: AnyAppSettings | null,
    t: Translation
): AppGroup[] => {
    if (!registered) return [];
    const groups = new Map<string, AppGroup & { id: string }>();
    const fallbackLabel = t.settings.appSectionDefaultGroup ?? `Other`;

    for (const [settingId, field] of Object.entries(registered.schema)) {
        const label = field.group
            ? resolveLocalisedText(field.group, t)
            : fallbackLabel;
        // Use the resolved label as the grouping key but keep a stable
        // slug for the section id (so the same group across languages
        // doesn't fragment the nav when the locale changes mid-life).
        const groupId =
            field.group === undefined ? APP_GROUP_ID_OTHER : slugForGroup(label);
        let bucket = groups.get(groupId);
        if (!bucket) {
            bucket = { id: groupId, label, fields: [] };
            groups.set(groupId, bucket);
        }
        (bucket.fields as Array<{ settingId: string; field: AppSettingField }>).push({
            settingId,
            field
        });
    }
    return Array.from(groups.values());
};

const slugForGroup = (label: string): string =>
    label.toLowerCase().replace(/[^a-z0-9]+/g, `-`).replace(/^-+|-+$/g, ``) || `group`;

interface AppFieldRowProps {
    readonly settingId: string;
    readonly field: AppSettingField;
    readonly appSettingsContext: AppSettingsContextValue;
    readonly t: Translation;
}

const AppFieldRow = ({ settingId, field, appSettingsContext, t }: AppFieldRowProps) => {
    const value = useSyncExternalStore(
        useCallback(
            (listener) => appSettingsContext.subscribe(settingId, listener),
            [appSettingsContext, settingId]
        ),
        useCallback(() => {
            const stored = appSettingsContext.getValue(settingId);
            return matchesFieldType(stored, field) ? stored : field.default;
        }, [appSettingsContext, field, settingId])
    );

    const setValue = useCallback(
        (next: unknown) => appSettingsContext.setValue(settingId, next),
        [appSettingsContext, settingId]
    );

    const label = resolveLocalisedText(field.label, t);
    const description = field.description
        ? resolveLocalisedText(field.description, t)
        : undefined;
    const inputId = `settings-app-${settingId}`;

    // Custom renderer escape hatch — schema author owns the row body.
    if (field.render) {
        // Cast to a value-type-erased shape. Every concrete schema's
        // `render` signature is `({ value: T, setValue: (T) => void, t }) => ReactNode`
        // for SOME `T`, but TS narrows the union to `never` here:
        // `value: T` is covariant and `setValue: (T) => void` is
        // contravariant in `T`, so the intersection of all union
        // members has no common position for `T` at all. We erase to
        // `unknown` to bypass — safety is guaranteed by the schema
        // author's responsibility to return a renderer that matches
        // the field's declared `type` (which the value at this point
        // already does, since `matchesFieldType` ran one closure ago).
        const renderFn = field.render as (props: {
            value: unknown;
            setValue: (v: unknown) => void;
            t: Translation;
        }) => ReactNode;
        return (
            <SettingRow label={label} description={description} htmlFor={inputId}>
                {renderFn({ value, setValue, t })}
            </SettingRow>
        );
    }

    return (
        <SettingRow label={label} description={description} htmlFor={inputId}>
            {renderBuiltinField(field, value, setValue, inputId, t)}
        </SettingRow>
    );
};

const renderBuiltinField = (
    field: AppSettingField,
    value: unknown,
    setValue: (v: unknown) => void,
    inputId: string,
    t: Translation
): ReactNode => {
    switch (field.type) {
        case `boolean`:
            return (
                <Switch
                    id={inputId}
                    checked={value as boolean}
                    onCheckedChange={(v) => setValue(v)}
                />
            );
        case `select`:
            return (
                <Select
                    value={value as string}
                    onValueChange={(v) => setValue(v)}
                >
                    <SelectTrigger id={inputId} className={fieldClass}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {field.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {resolveLocalisedText(opt.label, t)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        case `number`:
            return (
                <Input
                    id={inputId}
                    type={`number`}
                    value={value as number}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isFinite(n)) setValue(n);
                    }}
                />
            );
        case `slider`:
            return (
                <Slider
                    id={inputId}
                    value={[value as number]}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    onValueChange={(v) => setValue(v[0])}
                />
            );
        case `string`:
            return (
                <Input
                    id={inputId}
                    type={`text`}
                    value={value as string}
                    placeholder={
                        field.placeholder
                            ? resolveLocalisedText(field.placeholder, t)
                            : undefined
                    }
                    onChange={(e) => setValue(e.target.value)}
                />
            );
        case `color`:
            return (
                <Input
                    id={inputId}
                    type={`color`}
                    value={value as string}
                    onChange={(e) => setValue(e.target.value)}
                />
            );
    }
};
