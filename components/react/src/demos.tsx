import * as React from "react";
import { useContext, useRef, useState, type ReactNode } from "react";
import ActionDisplay from "../lib/components/actions/actionDisplay/ActionDisplay";
import Avatar from "../lib/components/identity/avatar/Avatar";
import Compass from "../lib/components/navigation/compass/Compass";
import { Slider } from "../lib/components/ui/slider";
import ButtonSelect from "../lib/components/input/buttonSelect/ButtonSelect";
import CodeThemePicker from "../lib/components/code/codeThemePicker/CodeThemePicker";
import CodeViewer from "../lib/components/code/codeViewer/CodeViewer";
import CopyValueButton from "../lib/components/input/copyValueButton/CopyValueButton";
import DateTimeDisplay from "../lib/components/dateTime/dateTimeDisplay/DateTimeDisplay";
import DateTimePicker from "../lib/components/dateTime/dateTimePicker/DateTimePicker";
import TimePicker from "../lib/components/dateTime/dateTimePicker/TimePicker";
import TimezoneSelector from "../lib/components/dateTime/dateTimePicker/TimezoneSelector";
import DateTimeRangePicker from "../lib/components/dateTime/dateTimeRangePicker/DateTimeRangePicker";
import FileViewer from "../lib/components/files/fileViewer/FileViewer";
import Image360Viewer from "../lib/components/files/fileViewer/formats/Image360Viewer";
import KeyboardShortcutEditor from "../lib/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor";
import KeyComboDisplay, {
    MAC_MODIFIER_DIFFERENCES
} from "../lib/components/actions/keyComboDisplay/KeyComboDisplay";
import LanguagePicker from "../lib/components/settings/languagePicker/LanguagePicker";
import OptionPicker from "../lib/components/input/optionPicker/OptionPicker";
import SearchInput from "../lib/components/input/searchInput/SearchInput";
import SettingsPanel from "../lib/components/settings/settingsPanel/SettingsPanel";
import ThemePicker from "../lib/components/settings/themePicker/ThemePicker";
import LoggingConfig from "../lib/components/settings/loggingConfig/LoggingConfig";
import LogView from "../lib/components/console/logView/LogView";
import Terminal, {
    type TerminalHandle
} from "../lib/components/console/terminal/Terminal";
import MachineMonitor, {
    type MachineMonitorHandle
} from "../lib/components/console/machineMonitor/MachineMonitor";
import { Input } from "../lib/components/ui/input";
import { Badge } from "../lib/components/ui/badge";
import { Button } from "../lib/components/ui/button";
import { Checkbox } from "../lib/components/ui/checkbox";
import { Label } from "../lib/components/ui/label";
import { CoreActionIds } from "../lib/lib/mowsContext/coreActions";
import { isMacPlatform } from "../lib/lib/mowsContext/HotkeyManager";
import { MowsContext } from "../lib/lib/mowsContext/MowsContext";
import { ExampleActionIds, EXAMPLE_ACTION_SCOPE } from "./exampleActions";
import { ExamplePage } from "./examples/harness";
import CodeSnippetDocPage from "./examples/codeSnippet/CodeSnippetDocPage";
import { fileIconExamples } from "./examples/fileIcon";
import PageIndexDocPage from "./examples/pageIndex/PageIndexDocPage";
import type { Translation } from "./languages";
import { uiDemos } from "./uiDemos";

type ExampleT = Translation[`example`];
type DemosT = ExampleT[`demos`];
type CommonT = ExampleT[`common`];

interface DemoFrameProps {
    readonly children: ReactNode;
    readonly description: string;
}

const DemoFrame = ({ children, description }: DemoFrameProps) => (
    <div className={`flex flex-col gap-4`}>
        <p className={`text-sm text-muted-foreground`}>{description}</p>
        <div className={`rounded-md border bg-card p-6`}>{children}</div>
    </div>
);

const useTranslations = (): { common: CommonT; demos: DemosT } => {
    const ctx = useContext(MowsContext)!;
    return { common: ctx.t.example.common, demos: ctx.t.example.demos };
};

const ActionDisplayDemo = () => {
    const ctx = useContext(MowsContext)!;
    const { demos } = useTranslations();
    const action = ctx.actionManager.getAction(ExampleActionIds.GREET);
    return (
        <DemoFrame description={demos.actionDisplay.description}>
            {action ? (
                <ActionDisplay action={action} />
            ) : (
                <span className={`text-muted-foreground`}>{demos.actionDisplay.notRegistered}</span>
            )}
        </DemoFrame>
    );
};

const AvatarDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.avatar.description}>
            <div className={`flex items-center gap-3`}>
                <Avatar displayName={`Demo User`} />
                <Avatar displayName={`Alice`} />
                <Avatar displayName={`Bob`} />
                <Avatar />
            </div>
        </DemoFrame>
    );
};

const ButtonSelectDemo = () => {
    const { demos, common } = useTranslations();
    const [selected, setSelected] = useState(`grid`);
    return (
        <DemoFrame description={demos.buttonSelect.description}>
            <ButtonSelect
                selectedId={selected}
                onSelectionChange={setSelected}
                options={[
                    { id: `grid`, icon: `▦`, label: demos.buttonSelect.grid },
                    { id: `list`, icon: `≣`, label: demos.buttonSelect.list },
                    { id: `table`, icon: `▤`, label: demos.buttonSelect.table }
                ]}
            />
            <p className={`mt-3 text-sm text-muted-foreground`}>
                {common.selected}: <code>{selected}</code>
            </p>
        </DemoFrame>
    );
};

const CompassDemo = () => {
    const { demos } = useTranslations();
    const [heading, setHeading] = useState(0);
    return (
        <DemoFrame description={demos.compass?.description ?? `HUD-style compass bar`}>
            <div className={`flex max-w-xl flex-col gap-4`}>
                <Compass heading={heading} />
                <div className={`flex items-center gap-3`}>
                    <span className={`text-muted-foreground w-12 text-xs`}>0°</span>
                    <Slider
                        value={[heading]}
                        onValueChange={(v) => setHeading(v[0] ?? 0)}
                        min={0}
                        max={360}
                        step={1}
                        className={`flex-1`}
                    />
                    <span className={`text-muted-foreground w-12 text-right text-xs`}>360°</span>
                </div>
                <Compass
                    heading={heading}
                    fieldOfView={60}
                    tickInterval={5}
                    markers={[
                        { bearing: 33, label: `Goal` },
                        { bearing: 200, label: `Camp` }
                    ]}
                />
            </div>
        </DemoFrame>
    );
};

const CodeThemePickerDemo = () => {
    const { demos, common } = useTranslations();
    return (
        <DemoFrame description={demos.codeThemePicker.description}>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2`}>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.popoverTrigger}</p>
                    <div className={`max-w-xs rounded-md border`}>
                        <CodeThemePicker />
                    </div>
                </div>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.standalone}</p>
                    <div className={`max-w-xs rounded-md border`}>
                        <CodeThemePicker standalone />
                    </div>
                </div>
            </div>
        </DemoFrame>
    );
};

const CodeViewerDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.codeViewer.description}>
            <CodeViewer
                language={`typescript`}
                code={`const greet = (name: string) => {\n    console.log(\`Hello, \${name}!\`);\n};\n\ngreet(\"world\");\n`}
            />
        </DemoFrame>
    );
};

const CommandPaletteDemo = () => {
    const ctx = useContext(MowsContext)!;
    const { demos } = useTranslations();
    const combos = ctx.hotkeyManager.getHotkeysByActionId(CoreActionIds.OPEN_COMMAND_PALETTE);
    return (
        <DemoFrame description={demos.commandPalette.description}>
            <div className={`flex items-center gap-3`}>
                <Button
                    onClick={() =>
                        ctx.actionManager.dispatchAction(CoreActionIds.OPEN_COMMAND_PALETTE)
                    }
                >
                    {demos.commandPalette.openButton}
                </Button>
                {combos[0] && <KeyComboDisplay keyCombo={combos[0]} />}
            </div>
        </DemoFrame>
    );
};

const CopyValueButtonDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.copyValueButton.description}>
            <div className={`flex flex-col gap-3`}>
                <CopyValueButton
                    value={`mows-example-token-abc123`}
                    label={demos.copyValueButton.tokenLabel}
                />
                <CopyValueButton
                    value={new Date().toISOString()}
                    label={demos.copyValueButton.timeLabel}
                />
                <CopyValueButton
                    value={`mows-example-token-with-toast`}
                    label={demos.copyValueButton.toastLabel}
                    toastOnCopy={demos.copyValueButton.toastMessage}
                />
            </div>
        </DemoFrame>
    );
};

const DateTimeDisplayDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.dateTime.description}>
            <div className={`flex flex-col gap-2`}>
                <div>
                    {demos.dateTime.nowLabel}: <DateTimeDisplay timestampMilliseconds={Date.now()} />
                </div>
                <div>
                    {demos.dateTime.naiveLabel}: <DateTimeDisplay dateTimeNaive={`2026-01-15 09:30:00`} />
                </div>
                <div>
                    {demos.dateTime.utcLabel}:{` `}
                    <DateTimeDisplay timestampMilliseconds={Date.now()} utcTime />
                </div>
            </div>
        </DemoFrame>
    );
};

const DateTimePickerDemo = () => {
    const { demos, common } = useTranslations();
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
        <DemoFrame description={demos.dateTimePicker.description}>
            <DateTimePicker value={date} onChange={setDate} />
            <p className={`mt-3 text-sm text-muted-foreground`}>
                {common.value}: <code>{date?.toISOString() ?? common.empty}</code>
            </p>
        </DemoFrame>
    );
};

const TimePickerDemo = () => {
    const { demos } = useTranslations();
    const [date, setDate] = useState(new Date());
    return (
        <DemoFrame description={demos.timePicker.description}>
            <TimePicker date={date} onChange={setDate} timeFormat={`24h`} showSeconds />
        </DemoFrame>
    );
};

const TimezoneSelectorDemo = () => {
    const { demos, common } = useTranslations();
    const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    return (
        <DemoFrame description={demos.timezoneSelector.description}>
            <div className={`max-w-sm`}>
                <TimezoneSelector value={tz} onChange={setTz} />
            </div>
            <p className={`mt-3 text-sm text-muted-foreground`}>
                {common.tz}: <code>{tz}</code>
            </p>
        </DemoFrame>
    );
};

const DateTimeRangePickerDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.dateTimeRangePicker.description}>
            <DateTimeRangePicker />
        </DemoFrame>
    );
};

// Bundled sample images live under src/assets/samples/. Vite turns these
// imports into hashed asset URLs so the demos work fully offline.
//
// Attribution: both photos © Paul Colin Hennig, released under CC BY 4.0
// (https://creativecommons.org/licenses/by/4.0/).
import sampleLandscapeUrl from "./assets/samples/landscape-2000.webp";
import samplePanoramaUrl from "./assets/samples/panorama-4000.jpg";

interface SampleAttribution {
    readonly author: string;
    readonly license: string;
    readonly sourceUrl: string;
}

const SAMPLE_LANDSCAPE_ATTRIBUTION: SampleAttribution = {
    author: `Paul Colin Hennig`,
    license: `CC BY 4.0`,
    sourceUrl: `https://vindelicum.eu/static/i/hexlerz/231/2000.webp`
};

const SAMPLE_PANORAMA_ATTRIBUTION: SampleAttribution = {
    author: `Paul Colin Hennig`,
    license: `CC BY 4.0`,
    sourceUrl: `https://vindelicum.eu/static/i/hexlerz/7/pano.jpg`
};

interface AttributionLineProps {
    readonly photoBy: string;
    readonly sourceLabel: string;
    readonly attribution: SampleAttribution;
}

const AttributionLine = ({ photoBy, sourceLabel, attribution }: AttributionLineProps) => (
    <p className={`text-xs italic text-muted-foreground`}>
        {photoBy}: {attribution.author} — {attribution.license} —{` `}
        <a
            href={attribution.sourceUrl}
            target={`_blank`}
            rel={`noopener noreferrer`}
            className={`underline`}
        >
            {sourceLabel}
        </a>
    </p>
);

const FileViewerDemo = () => {
    const { demos } = useTranslations();
    const t = demos.fileViewer;
    const [url, setUrl] = useState(sampleLandscapeUrl);
    const [name, setName] = useState(t.sampleName);
    const [mimeType, setMimeType] = useState(`image/webp`);
    const isSample = url === sampleLandscapeUrl;
    const loadSample = () => {
        setUrl(sampleLandscapeUrl);
        setName(t.sampleName);
        setMimeType(`image/webp`);
    };
    return (
        <DemoFrame description={t.description}>
            <div className={`flex flex-col gap-3`}>
                <div className={`flex flex-wrap items-center gap-2`}>
                    <Input
                        type={`url`}
                        value={isSample ? `` : url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={t.urlPlaceholder}
                        className={`max-w-sm`}
                    />
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t.namePlaceholder}
                        className={`max-w-xs`}
                    />
                    <Input
                        value={mimeType}
                        onChange={(e) => setMimeType(e.target.value)}
                        placeholder={t.mimeTypePlaceholder}
                        className={`max-w-xs`}
                    />
                    <Button size={`sm`} variant={`outline`} onClick={loadSample}>
                        {t.loadSample}
                    </Button>
                    {url && (
                        <Button size={`sm`} variant={`ghost`} onClick={() => setUrl(``)}>
                            {t.clear}
                        </Button>
                    )}
                </div>
                <p className={`text-xs text-muted-foreground`}>{t.hint}</p>
                <div className={`aspect-video w-full max-w-2xl rounded-md border bg-background`}>
                    {url ? (
                        <FileViewer
                            src={url}
                            name={name || `file`}
                            mimeType={mimeType || `application/octet-stream`}
                        />
                    ) : (
                        <div
                            className={`flex h-full w-full items-center justify-center text-sm text-muted-foreground`}
                        >
                            {t.empty}
                        </div>
                    )}
                </div>
                {isSample && (
                    <AttributionLine
                        photoBy={t.photoBy}
                        sourceLabel={t.sourceLink}
                        attribution={SAMPLE_LANDSCAPE_ATTRIBUTION}
                    />
                )}
            </div>
        </DemoFrame>
    );
};

const Image360ViewerDemo = () => {
    const { demos } = useTranslations();
    const t = demos.image360Viewer;
    const [urlDraft, setUrlDraft] = useState(``);
    const [activeUrl, setActiveUrl] = useState<string | undefined>(samplePanoramaUrl);
    const [heading, setHeading] = useState(0);
    const isSample = activeUrl === samplePanoramaUrl;
    return (
        <DemoFrame description={t.description}>
            <div className={`flex flex-col gap-3`}>
                <div className={`flex flex-wrap items-center gap-2`}>
                    <Input
                        type={`url`}
                        value={urlDraft}
                        onChange={(e) => setUrlDraft(e.target.value)}
                        placeholder={t.urlPlaceholder}
                        className={`max-w-sm`}
                    />
                    <Button size={`sm`} disabled={!urlDraft} onClick={() => setActiveUrl(urlDraft)}>
                        {t.load}
                    </Button>
                    <Button
                        size={`sm`}
                        variant={`outline`}
                        onClick={() => setActiveUrl(samplePanoramaUrl)}
                    >
                        {t.loadSample}
                    </Button>
                    {activeUrl && (
                        <Button
                            size={`sm`}
                            variant={`ghost`}
                            onClick={() => setActiveUrl(undefined)}
                        >
                            {t.clear}
                        </Button>
                    )}
                </div>
                <p className={`text-xs text-muted-foreground`}>{t.hint}</p>
                <div className={`aspect-video w-full max-w-2xl rounded-md border bg-background`}>
                    {activeUrl ? (
                        <Image360Viewer src={activeUrl} onHeadingChange={setHeading} />
                    ) : (
                        <div
                            className={`flex h-full w-full items-center justify-center text-sm text-muted-foreground`}
                        >
                            {t.empty}
                        </div>
                    )}
                </div>
                {activeUrl && (
                    <div className={`w-full max-w-2xl`}>
                        <Compass heading={heading} />
                    </div>
                )}
                {isSample && (
                    <AttributionLine
                        photoBy={t.photoBy}
                        sourceLabel={t.sourceLink}
                        attribution={SAMPLE_PANORAMA_ATTRIBUTION}
                    />
                )}
            </div>
        </DemoFrame>
    );
};

const GlobalContextMenuDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.globalContextMenu.description}>
            <div
                data-actionscope={EXAMPLE_ACTION_SCOPE}
                className={`flex h-40 items-center justify-center rounded-md border-2 border-dashed text-sm text-muted-foreground`}
            >
                {demos.globalContextMenu.rightClickHere}
            </div>
        </DemoFrame>
    );
};

const KeyboardShortcutEditorDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.keyboardShortcutEditor.description}>
            <KeyboardShortcutEditor />
        </DemoFrame>
    );
};

const KeyComboDisplayDemo = () => {
    const { demos } = useTranslations();
    const t = demos.keyComboDisplay;

    // Every key for which the component renders an icon. Listed in pairs
    // so the kbd glyph + name are visually paired in the demo.
    const iconKeys: ReadonlyArray<readonly [string, string]> = [
        [`shift`, `shift`],
        [`enter`, `enter`],
        [`tab`, `tab`],
        [`backspace`, `backspace`],
        [`capslock`, `capslock`],
        [`arrowup`, `arrowup`],
        [`arrowdown`, `arrowdown`],
        [`arrowleft`, `arrowleft`],
        [`arrowright`, `arrowright`],
        [`menu`, `menu`]
    ];

    // Keys that render as text on Windows / Linux (translated word).
    // Paired with their token name, mirroring the icons section. Switch
    // language in the top-right menu to see translation behavior.
    const textKeys: ReadonlyArray<readonly [string, string]> = [
        [`ctrl`, `ctrl`],
        [`alt`, `alt`],
        [`altgr`, `altgr`],
        [`fn`, `fn`],
        [`meta`, `meta`],
        [`space`, `space`],
        [`esc`, `esc`],
        [`home`, `home`],
        [`end`, `end`],
        [`delete`, `delete`],
        [`insert`, `insert`],
        [`pageup`, `pageup`],
        [`pagedown`, `pagedown`],
        [`pause`, `pause`],
        [`scrolllock`, `scrolllock`],
        [`numlock`, `numlock`],
        [`printscreen`, `printscreen`]
    ];

    return (
        <DemoFrame description={t.description}>
            <div className={`flex flex-col gap-6`}>
                <div className={`flex flex-col gap-2`}>
                    <div className={`text-sm font-semibold`}>{t.combosHeading}</div>
                    <div className={`flex flex-wrap items-center gap-3`}>
                        <KeyComboDisplay keyCombo={`mod+k`} />
                        <KeyComboDisplay keyCombo={`mod+shift+p`} />
                        <KeyComboDisplay keyCombo={`alt+enter`} />
                        <KeyComboDisplay keyCombo={`shift+arrowup`} />
                        <KeyComboDisplay keyCombo={`ctrl+space`} />
                        <KeyComboDisplay keyCombo={`escape`} />
                    </div>
                </div>

                <div className={`flex flex-col gap-2`}>
                    <div className={`text-sm font-semibold`}>{t.iconsHeading}</div>
                    <div
                        className={`grid grid-cols-2 items-center gap-x-6 gap-y-2 sm:grid-cols-3`}
                    >
                        {iconKeys.map(([key, label]) => (
                            <div key={key} className={`flex items-center gap-2`}>
                                <KeyComboDisplay keyCombo={key} />
                                <span className={`text-sm text-muted-foreground`}>
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`flex flex-col gap-2`}>
                    <div className={`text-sm font-semibold`}>{t.textHeading}</div>
                    <p className={`text-xs text-muted-foreground`}>{t.textHint}</p>
                    <div
                        className={`grid grid-cols-2 items-center gap-x-6 gap-y-2 sm:grid-cols-3`}
                    >
                        {textKeys.map(([key, label]) => (
                            <div key={key} className={`flex items-center gap-2`}>
                                <KeyComboDisplay keyCombo={key} />
                                <span className={`text-sm text-muted-foreground`}>
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={`flex flex-col gap-2`}>
                    <div className={`text-sm font-semibold`}>{t.macDifferencesHeading}</div>
                    <p className={`text-xs text-muted-foreground`}>
                        {t.macDifferencesHint}
                    </p>
                    <div
                        className={`grid grid-cols-2 items-center gap-x-6 gap-y-2 sm:grid-cols-3`}
                    >
                        {MAC_MODIFIER_DIFFERENCES.map(({ token, icon: Icon }) => (
                            <div key={token} className={`flex items-center gap-2`}>
                                <kbd
                                    className={`bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 leading-none font-medium`}
                                >
                                    <Icon className={`h-3 w-3`} aria-hidden />
                                </kbd>
                                <span className={`text-sm text-muted-foreground`}>
                                    {token}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DemoFrame>
    );
};

const KeyComboRecorderDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.keyComboRecorder.description}>
            <KeyComboRecorder />
        </DemoFrame>
    );
};

const KeyComboRecorder = () => {
    const ctx = useContext(MowsContext)!;
    const { demos } = useTranslations();
    const t = demos.keyComboRecorder;
    const [recording, setRecording] = useState(false);
    const [combos, setCombos] = useState<ReadonlyArray<string>>([]);
    const nextIdRef = useRef(1);

    React.useEffect(() => {
        if (!recording) return;

        const MODIFIER_KEYS = [`Shift`, `Control`, `Alt`, `Meta`];
        // For each currently-held modifier, the timestamp of its keydown.
        // A modifier is recorded as a standalone combo iff it gets released
        // and no non-modifier keypress happened since it went down.
        const modifierDownAt = new Map<string, number>();
        let lastNonModifierAt = 0;

        const modifierToken = (eventKey: string): string | null => {
            const mac = isMacPlatform();
            switch (eventKey) {
                case `Control`:
                    return mac ? `ctrl` : `mod`;
                case `Meta`:
                    return mac ? `mod` : `meta`;
                case `Alt`:
                    return `alt`;
                case `Shift`:
                    return `shift`;
                default:
                    return null;
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (MODIFIER_KEYS.includes(event.key)) {
                if (!modifierDownAt.has(event.key)) {
                    modifierDownAt.set(event.key, performance.now());
                }
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            lastNonModifierAt = performance.now();
            const combo = ctx.hotkeyManager.formatKeyCombo(event);
            setCombos((prev) => [...prev, combo]);
        };

        const onKeyUp = (event: KeyboardEvent) => {
            if (!MODIFIER_KEYS.includes(event.key)) return;
            const downAt = modifierDownAt.get(event.key);
            modifierDownAt.delete(event.key);
            if (downAt === undefined) return;
            // If a non-modifier was pressed while this modifier was held,
            // it was part of a real combo — don't record it standalone.
            if (lastNonModifierAt > downAt) return;
            const token = modifierToken(event.key);
            if (!token) return;
            setCombos((prev) => [...prev, token]);
        };

        const opts = { capture: true } as const;
        window.addEventListener(`keydown`, onKeyDown, opts);
        window.addEventListener(`keyup`, onKeyUp, opts);
        return () => {
            window.removeEventListener(
                `keydown`,
                onKeyDown,
                opts as EventListenerOptions
            );
            window.removeEventListener(
                `keyup`,
                onKeyUp,
                opts as EventListenerOptions
            );
        };
    }, [recording, ctx.hotkeyManager]);

    return (
        <div className={`flex flex-col gap-2`}>
            <div className={`text-sm font-semibold`}>{t.heading}</div>
            <p className={`text-xs text-muted-foreground`}>{t.hint}</p>
            <div className={`flex items-center gap-3`}>
                <Button
                    size={`sm`}
                    variant={recording ? `destructive` : `default`}
                    onClick={() => setRecording((r) => !r)}
                >
                    {recording ? t.stop : t.start}
                </Button>
                {combos.length > 0 && (
                    <Button
                        size={`sm`}
                        variant={`ghost`}
                        onClick={() => {
                            setCombos([]);
                            nextIdRef.current = 1;
                        }}
                    >
                        {t.clear}
                    </Button>
                )}
                {recording && (
                    <span className={`text-muted-foreground text-xs`}>
                        {t.listening}
                    </span>
                )}
            </div>
            {combos.length > 0 && (
                <ul
                    className={`mt-1 flex max-h-48 flex-col gap-1 overflow-auto rounded-md border bg-card p-2`}
                >
                    {/* Newest first: iterate from the end of the press
                         history. The displayed press number still reflects
                         the actual chronological order (1 = first press). */}
                    {combos
                        .map((combo, i) => ({ combo, pressNumber: i + 1 }))
                        .reverse()
                        .map(({ combo, pressNumber }) => (
                            <li
                                key={`${pressNumber}-${combo}`}
                                className={`flex items-center gap-3`}
                            >
                                <span
                                    className={`text-muted-foreground w-6 shrink-0 text-right text-[10px] tabular-nums`}
                                >
                                    {pressNumber}
                                </span>
                                <KeyComboDisplay keyCombo={combo} />
                                <code className={`text-muted-foreground text-xs`}>
                                    {combo}
                                </code>
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
};

const LanguagePickerDemo = () => {
    const { demos, common } = useTranslations();
    return (
        <DemoFrame description={demos.languagePicker.description}>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2`}>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.popoverTrigger}</p>
                    <div className={`max-w-xs rounded-md border`}>
                        <LanguagePicker />
                    </div>
                </div>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.standalone}</p>
                    <div className={`max-w-xs rounded-md border`}>
                        <LanguagePicker standalone />
                    </div>
                </div>
            </div>
        </DemoFrame>
    );
};

const ModalHandlerDemo = () => {
    const ctx = useContext(MowsContext)!;
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.modalHandler.description}>
            <div className={`flex flex-wrap gap-2`}>
                <Button
                    onClick={() =>
                        ctx.actionManager.dispatchAction(CoreActionIds.OPEN_THEME_SELECTOR)
                    }
                >
                    {demos.modalHandler.themeButton}
                </Button>
                <Button
                    onClick={() =>
                        ctx.actionManager.dispatchAction(CoreActionIds.OPEN_LANGUAGE_SETTINGS)
                    }
                >
                    {demos.modalHandler.languageButton}
                </Button>
                <Button
                    onClick={() =>
                        ctx.actionManager.dispatchAction(CoreActionIds.OPEN_KEYBOARD_SHORTCUTS)
                    }
                >
                    {demos.modalHandler.shortcutsButton}
                </Button>
            </div>
        </DemoFrame>
    );
};

const OptionPickerDemo = () => {
    const { demos } = useTranslations();
    const [opts, setOpts] = useState([
        { id: `compact`, label: demos.optionPicker.compact, enabled: true },
        { id: `wrap`, label: demos.optionPicker.wrap, enabled: false },
        { id: `lineNumbers`, label: demos.optionPicker.lineNumbers, enabled: true }
    ]);
    return (
        <DemoFrame description={demos.optionPicker.description}>
            <OptionPicker
                options={opts}
                onOptionChange={(id, enabled) =>
                    setOpts((prev) => prev.map((o) => (o.id === id ? { ...o, enabled } : o)))
                }
                showCount
            />
        </DemoFrame>
    );
};

const SettingsPanelDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.settingsPanel.description}>
            <div className={`h-[640px]`}>
                <SettingsPanel />
            </div>
        </DemoFrame>
    );
};

const PrimaryMenuDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.primaryMenu.description}>
            <div className={`flex items-center gap-3 text-sm text-muted-foreground`}>
                <Badge variant={`outline`}>{demos.primaryMenu.topRightHint}</Badge>
            </div>
        </DemoFrame>
    );
};

const ThemePickerDemo = () => {
    const { demos, common } = useTranslations();
    return (
        <DemoFrame description={demos.themePicker.description}>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2`}>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.popoverTrigger}</p>
                    <div className={`max-w-xs rounded-md border`}>
                        <ThemePicker />
                    </div>
                </div>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.standalone}</p>
                    <div className={`max-w-xs rounded-md border`}>
                        <ThemePicker standalone />
                    </div>
                </div>
            </div>
        </DemoFrame>
    );
};

const LoggingConfigDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.loggingConfig.description}>
            <LoggingConfig />
        </DemoFrame>
    );
};

const TerminalDemo = () => {
    const { demos } = useTranslations();
    const t = demos.terminal;
    const ref = useRef<TerminalHandle>(null);

    // Tiny "shell" that accumulates the current line, echoes printable
    // characters, handles backspace, and prints a fake prompt on Enter.
    const bufferRef = useRef(``);
    const handleData = (data: string) => {
        const term = ref.current;
        if (!term) return;
        for (const ch of data) {
            const code = ch.charCodeAt(0);
            if (ch === `\r`) {
                term.write(`\r\n`);
                if (bufferRef.current.length > 0) {
                    term.write(`echoed: ${bufferRef.current}\r\n`);
                }
                bufferRef.current = ``;
                term.write(`$ `);
            } else if (code === 0x7f) {
                if (bufferRef.current.length > 0) {
                    bufferRef.current = bufferRef.current.slice(0, -1);
                    term.write(`\b \b`);
                }
            } else if (code >= 32) {
                bufferRef.current += ch;
                term.write(ch);
            }
        }
    };

    return (
        <DemoFrame description={t.description}>
            <div className={`flex flex-col gap-3`}>
                <div className={`flex flex-wrap gap-2`}>
                    <Button size={`sm`} variant={`outline`} onClick={() => ref.current?.clear()}>
                        {t.clear}
                    </Button>
                </div>
                <p className={`text-xs text-muted-foreground`}>{t.hint}</p>
                <div className={`h-[360px]`}>
                    <Terminal
                        ref={ref}
                        onData={handleData}
                        onReady={(handle) => {
                            handle.write(
                                `Welcome to mows-components Terminal demo\r\n$ `
                            );
                            handle.focus();
                        }}
                    />
                </div>
            </div>
        </DemoFrame>
    );
};

const LogViewDemo = () => {
    const { demos } = useTranslations();
    const t = demos.logView;
    const [lines, setLines] = useState<ReadonlyArray<string>>([]);

    // Sample lines that look like typical unstructured server output —
    // the kind of stuff that comes off `kubectl logs --follow`,
    // `journalctl --follow`, container stdout, `tail -f`, etc.
    const SAMPLE: ReadonlyArray<string> = [
        `[2026-05-12 10:14:21] starting nginx worker pool (4 workers)`,
        `worker 0 listening on :8080`,
        `worker 1 listening on :8080`,
        `127.0.0.1 - - "GET /healthz HTTP/1.1" 200 2`,
        `127.0.0.1 - - "GET /api/users HTTP/1.1" 200 1842`,
        `[warn] upstream took 1.4s to respond`,
        `[error] connection refused: db.mows.local:5432`,
        `[2026-05-12 10:14:23] retrying upstream connection (attempt 2/5)`
    ];
    const idxRef = useRef(0);
    const pushLine = () => {
        const line = SAMPLE[idxRef.current % SAMPLE.length];
        idxRef.current++;
        setLines((prev) => [...prev, line]);
    };

    return (
        <DemoFrame description={t.description}>
            <div className={`flex flex-col gap-3`}>
                <div className={`flex flex-wrap gap-2`}>
                    <Button size={`sm`} onClick={pushLine}>
                        {t.pushLine}
                    </Button>
                </div>
                <p className={`text-xs text-muted-foreground`}>{t.hint}</p>
                <div className={`h-[360px]`}>
                    <LogView
                        lines={lines}
                        onClear={() => setLines([])}
                        placeholders={{
                            search: t.searchPlaceholder,
                            empty: t.empty
                        }}
                    />
                </div>
            </div>
        </DemoFrame>
    );
};

const MachineMonitorDemo = () => {
    const { demos } = useTranslations();
    const t = demos.machineMonitor;
    const [urlDraft, setUrlDraft] = useState(``);
    const [activeUrl, setActiveUrl] = useState<string | undefined>(undefined);
    const [connected, setConnected] = useState(false);
    const [readOnly, setReadOnly] = useState(false);
    const ref = useRef<MachineMonitorHandle>(null);

    return (
        <DemoFrame description={t.description}>
            <div className={`flex flex-col gap-3`}>
                <div className={`flex flex-wrap items-center gap-2`}>
                    <Input
                        type={`url`}
                        value={urlDraft}
                        onChange={(e) => setUrlDraft(e.target.value)}
                        placeholder={t.urlPlaceholder}
                        className={`max-w-sm`}
                    />
                    {activeUrl ? (
                        <Button
                            size={`sm`}
                            variant={`outline`}
                            onClick={() => {
                                setActiveUrl(undefined);
                                setConnected(false);
                            }}
                        >
                            {t.disconnect}
                        </Button>
                    ) : (
                        <Button
                            size={`sm`}
                            disabled={!urlDraft}
                            onClick={() => setActiveUrl(urlDraft)}
                        >
                            {t.connect}
                        </Button>
                    )}
                    <Button
                        size={`sm`}
                        variant={`outline`}
                        disabled={!connected}
                        onClick={() => ref.current?.sendCtrlAltDel()}
                    >
                        {t.sendCtrlAltDel}
                    </Button>
                    <Badge variant={connected ? `default` : `secondary`}>
                        {connected ? t.status.connected : t.status.disconnected}
                    </Badge>
                    <Label
                        htmlFor={`machine-monitor-readonly`}
                        className={`ml-2 flex items-center gap-2 text-xs`}
                    >
                        <Checkbox
                            id={`machine-monitor-readonly`}
                            checked={readOnly}
                            onCheckedChange={(v) => setReadOnly(v === true)}
                        />
                        {t.readOnly}
                    </Label>
                </div>
                <p className={`text-xs text-muted-foreground`}>{t.hint}</p>
                <div className={`aspect-[4/3] w-full max-w-2xl`}>
                    <MachineMonitor
                        ref={ref}
                        url={activeUrl}
                        autoConnect={Boolean(activeUrl)}
                        readOnly={readOnly}
                        loadingLabel={t.loadingLabel}
                        onConnect={() => setConnected(true)}
                        onDisconnect={() => setConnected(false)}
                    />
                </div>
            </div>
        </DemoFrame>
    );
};

const SearchInputDemo = () => {
    const { demos, common } = useTranslations();
    const [value, setValue] = useState(``);
    return (
        <DemoFrame description={demos.searchInput.description}>
            <div className={`max-w-md`}>
                <SearchInput
                    value={value}
                    onValueChange={setValue}
                    placeholder={demos.searchInput.placeholder}
                />
            </div>
            <p className={`mt-3 text-sm text-muted-foreground`}>
                {demos.searchInput.valueLabel}: <code>{value || common.empty}</code>
            </p>
        </DemoFrame>
    );
};

const ResourceListDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.resourceList.description}>
            <p className={`text-sm text-muted-foreground`}>{demos.resourceList.note}</p>
        </DemoFrame>
    );
};

export type DemoGroupKey = keyof Translation[`example`][`sidebar`][`groups`];

export interface DemoEntry {
    readonly id: string;
    readonly name: string;
    readonly groupKey: DemoGroupKey;
    readonly render: () => ReactNode;
    /**
     * Extra search keywords besides `name` and the group label. Use for
     * common synonyms, abbreviations, or feature words a user might type
     * (e.g. "range" for the slider, "menubar" for PrimaryMenu).
     */
    readonly searchTags?: readonly string[];
}

export const demos: DemoEntry[] = [
    { id: `actionDisplay`, name: `ActionDisplay`, groupKey: `actions`, render: () => <ActionDisplayDemo /> },
    { id: `keyComboDisplay`, name: `KeyComboDisplay`, groupKey: `actions`, render: () => <KeyComboDisplayDemo /> },
    { id: `keyComboRecorder`, name: `KeyComboRecorder`, groupKey: `actions`, render: () => <KeyComboRecorderDemo /> },
    { id: `keyboardShortcutEditor`, name: `KeyboardShortcutEditor`, groupKey: `actions`, render: () => <KeyboardShortcutEditorDemo /> },
    { id: `primaryMenu`, name: `PrimaryMenu`, groupKey: `appShell`, render: () => <PrimaryMenuDemo /> },
    { id: `commandPalette`, name: `CommandPalette`, groupKey: `appShell`, render: () => <CommandPaletteDemo /> },
    { id: `globalContextMenu`, name: `GlobalContextMenu`, groupKey: `appShell`, render: () => <GlobalContextMenuDemo /> },
    { id: `modalHandler`, name: `ModalHandler`, groupKey: `appShell`, render: () => <ModalHandlerDemo /> },
    { id: `codeViewer`, name: `CodeViewer`, groupKey: `code`, render: () => <CodeViewerDemo /> },
    {
        id: `codeSnippet`,
        name: `CodeSnippet`,
        groupKey: `code`,
        render: () => <CodeSnippetDocPage />
    },
    { id: `codeThemePicker`, name: `CodeThemePicker`, groupKey: `code`, render: () => <CodeThemePickerDemo /> },
    { id: `logView`, name: `LogView`, groupKey: `console`, render: () => <LogViewDemo /> },
    { id: `terminal`, name: `Terminal`, groupKey: `console`, render: () => <TerminalDemo /> },
    { id: `machineMonitor`, name: `MachineMonitor`, groupKey: `console`, render: () => <MachineMonitorDemo /> },
    { id: `dateTimeDisplay`, name: `DateTimeDisplay`, groupKey: `dateTime`, render: () => <DateTimeDisplayDemo /> },
    { id: `dateTimePicker`, name: `DateTimePicker`, groupKey: `dateTime`, render: () => <DateTimePickerDemo /> },
    { id: `timePicker`, name: `TimePicker`, groupKey: `dateTime`, render: () => <TimePickerDemo /> },
    { id: `timezoneSelector`, name: `TimezoneSelector`, groupKey: `dateTime`, render: () => <TimezoneSelectorDemo /> },
    { id: `dateTimeRangePicker`, name: `DateTimeRangePicker`, groupKey: `dateTime`, render: () => <DateTimeRangePickerDemo /> },
    {
        id: `fileIcon`,
        name: `FileIcon`,
        groupKey: `files`,
        render: () => <ExamplePage examples={fileIconExamples} idPrefix={`fileIcon`} />
    },
    { id: `fileViewer`, name: `FileViewer`, groupKey: `files`, render: () => <FileViewerDemo /> },
    { id: `image360Viewer`, name: `Image360Viewer`, groupKey: `files`, render: () => <Image360ViewerDemo /> },
    { id: `avatar`, name: `Avatar`, groupKey: `identity`, render: () => <AvatarDemo /> },
    { id: `searchInput`, name: `SearchInput`, groupKey: `input`, render: () => <SearchInputDemo /> },
    { id: `buttonSelect`, name: `ButtonSelect`, groupKey: `input`, render: () => <ButtonSelectDemo /> },
    { id: `optionPicker`, name: `OptionPicker`, groupKey: `input`, render: () => <OptionPickerDemo /> },
    { id: `copyValueButton`, name: `CopyValueButton`, groupKey: `input`, render: () => <CopyValueButtonDemo /> },
    { id: `settingsPanel`, name: `SettingsPanel`, groupKey: `settings`, render: () => <SettingsPanelDemo /> },
    { id: `languagePicker`, name: `LanguagePicker`, groupKey: `settings`, render: () => <LanguagePickerDemo /> },
    { id: `themePicker`, name: `ThemePicker`, groupKey: `settings`, render: () => <ThemePickerDemo /> },
    { id: `loggingConfig`, name: `LoggingConfig`, groupKey: `settings`, render: () => <LoggingConfigDemo /> },
    { id: `resourceList`, name: `ResourceList`, groupKey: `list`, render: () => <ResourceListDemo /> },
    { id: `compass`, name: `Compass`, groupKey: `navigation`, render: () => <CompassDemo />, searchTags: [`heading`, `bearing`, `yaw`, `direction`] },
    {
        id: `pageIndex`,
        name: `PageIndex`,
        groupKey: `navigation`,
        render: () => <PageIndexDocPage />
    },
    ...uiDemos.map(
        (entry): DemoEntry => ({
            id: `ui-${entry.id}`,
            name: entry.name,
            // The Calendar primitive is the date-picker surface of the
            // library, so list it under the dateTime category instead of
            // uiPrimitives — that's where users go looking for it.
            groupKey: entry.id === `calendar` ? `dateTime` : `uiPrimitives`,
            render: entry.render,
            searchTags:
                entry.id === `calendar`
                    ? [...(entry.searchTags ?? []), `date`, `picker`, `datepicker`]
                    : entry.searchTags
        })
    )
];
