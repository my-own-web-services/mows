import { useContext, useState, type ReactNode } from "react";
import ActionDisplay from "../lib/components/atoms/actionDisplay/ActionDisplay";
import Avatar from "../lib/components/atoms/avatar/Avatar";
import ButtonSelect from "../lib/components/atoms/buttonSelect/ButtonSelect";
import CodeThemePicker from "../lib/components/atoms/codeThemePicker/CodeThemePicker";
import CodeViewer from "../lib/components/atoms/codeViewer/CodeViewer";
import CopyValueButton from "../lib/components/atoms/copyValueButton/CopyValueButton";
import DateTime from "../lib/components/atoms/dateTime/DateTime";
import DateTimePicker from "../lib/components/atoms/dateTimePicker/DateTimePicker";
import TimePicker from "../lib/components/atoms/dateTimePicker/TimePicker";
import TimezoneSelector from "../lib/components/atoms/dateTimePicker/TimezoneSelector";
import DateTimeRangePicker from "../lib/components/atoms/dateTimeRangePicker/DateTimeRangePicker";
import KeyboardShortcutEditor from "../lib/components/atoms/keyboardShortcutEditor/KeyboardShortcutEditor";
import KeyComboDisplay from "../lib/components/atoms/keyComboDisplay/KeyComboDisplay";
import LanguagePicker from "../lib/components/atoms/languagePicker/LanguagePicker";
import OptionPicker from "../lib/components/atoms/optionPicker/OptionPicker";
import SearchInput from "../lib/components/atoms/searchInput/SearchInput";
import SettingsPanel from "../lib/components/atoms/settingsPanel/SettingsPanel";
import ThemePicker from "../lib/components/atoms/themePicker/ThemePicker";
import LoggingConfig from "../lib/components/loggingConfig/LoggingConfig";
import { Badge } from "../lib/components/ui/badge";
import { Button } from "../lib/components/ui/button";
import { CoreActionIds } from "../lib/lib/mowsContext/coreActions";
import { MowsContext } from "../lib/lib/mowsContext/MowsContext";
import { ExampleActionIds, EXAMPLE_ACTION_SCOPE } from "./exampleActions";
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

const CodeThemePickerDemo = () => {
    const { demos, common } = useTranslations();
    return (
        <DemoFrame description={demos.codeThemePicker.description}>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2`}>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.popoverTrigger}</p>
                    <div className={`max-w-xs rounded-md border py-2`}>
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
            </div>
        </DemoFrame>
    );
};

const DateTimeDemo = () => {
    const { demos } = useTranslations();
    return (
        <DemoFrame description={demos.dateTime.description}>
            <div className={`flex flex-col gap-2`}>
                <div>
                    {demos.dateTime.nowLabel}: <DateTime timestampMilliseconds={Date.now()} />
                </div>
                <div>
                    {demos.dateTime.naiveLabel}: <DateTime dateTimeNaive={`2026-01-15 09:30:00`} />
                </div>
                <div>
                    {demos.dateTime.utcLabel}:{` `}
                    <DateTime timestampMilliseconds={Date.now()} utcTime />
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
    return (
        <DemoFrame description={demos.keyComboDisplay.description}>
            <div className={`flex flex-wrap items-center gap-3`}>
                <KeyComboDisplay keyCombo={`mod+k`} />
                <KeyComboDisplay keyCombo={`mod+shift+p`} />
                <KeyComboDisplay keyCombo={`alt+enter`} />
                <KeyComboDisplay keyCombo={`escape`} />
            </div>
        </DemoFrame>
    );
};

const LanguagePickerDemo = () => {
    const { demos, common } = useTranslations();
    return (
        <DemoFrame description={demos.languagePicker.description}>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2`}>
                <div>
                    <p className={`mb-2 text-xs text-muted-foreground`}>{common.popoverTrigger}</p>
                    <div className={`max-w-xs rounded-md border py-2`}>
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
                    <div className={`max-w-xs rounded-md border py-2`}>
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
}

export const demos: DemoEntry[] = [
    { id: `actionDisplay`, name: `ActionDisplay`, groupKey: `atoms`, render: () => <ActionDisplayDemo /> },
    { id: `avatar`, name: `Avatar`, groupKey: `atoms`, render: () => <AvatarDemo /> },
    { id: `buttonSelect`, name: `ButtonSelect`, groupKey: `atoms`, render: () => <ButtonSelectDemo /> },
    { id: `codeThemePicker`, name: `CodeThemePicker`, groupKey: `atoms`, render: () => <CodeThemePickerDemo /> },
    { id: `codeViewer`, name: `CodeViewer`, groupKey: `atoms`, render: () => <CodeViewerDemo /> },
    { id: `commandPalette`, name: `CommandPalette`, groupKey: `atoms`, render: () => <CommandPaletteDemo /> },
    { id: `copyValueButton`, name: `CopyValueButton`, groupKey: `atoms`, render: () => <CopyValueButtonDemo /> },
    { id: `dateTime`, name: `DateTime`, groupKey: `dateAndTime`, render: () => <DateTimeDemo /> },
    { id: `dateTimePicker`, name: `DateTimePicker`, groupKey: `dateAndTime`, render: () => <DateTimePickerDemo /> },
    { id: `timePicker`, name: `TimePicker`, groupKey: `dateAndTime`, render: () => <TimePickerDemo /> },
    { id: `timezoneSelector`, name: `TimezoneSelector`, groupKey: `dateAndTime`, render: () => <TimezoneSelectorDemo /> },
    { id: `dateTimeRangePicker`, name: `DateTimeRangePicker`, groupKey: `dateAndTime`, render: () => <DateTimeRangePickerDemo /> },
    { id: `globalContextMenu`, name: `GlobalContextMenu`, groupKey: `actionsAndShortcuts`, render: () => <GlobalContextMenuDemo /> },
    { id: `keyboardShortcutEditor`, name: `KeyboardShortcutEditor`, groupKey: `actionsAndShortcuts`, render: () => <KeyboardShortcutEditorDemo /> },
    { id: `keyComboDisplay`, name: `KeyComboDisplay`, groupKey: `actionsAndShortcuts`, render: () => <KeyComboDisplayDemo /> },
    { id: `languagePicker`, name: `LanguagePicker`, groupKey: `settings`, render: () => <LanguagePickerDemo /> },
    { id: `modalHandler`, name: `ModalHandler`, groupKey: `settings`, render: () => <ModalHandlerDemo /> },
    { id: `optionPicker`, name: `OptionPicker`, groupKey: `atoms`, render: () => <OptionPickerDemo /> },
    { id: `searchInput`, name: `SearchInput`, groupKey: `atoms`, render: () => <SearchInputDemo /> },
    { id: `settingsPanel`, name: `SettingsPanel`, groupKey: `settings`, render: () => <SettingsPanelDemo /> },
    { id: `primaryMenu`, name: `PrimaryMenu`, groupKey: `settings`, render: () => <PrimaryMenuDemo /> },
    { id: `themePicker`, name: `ThemePicker`, groupKey: `settings`, render: () => <ThemePickerDemo /> },
    { id: `loggingConfig`, name: `LoggingConfig`, groupKey: `settings`, render: () => <LoggingConfigDemo /> },
    { id: `resourceList`, name: `ResourceList`, groupKey: `lists`, render: () => <ResourceListDemo /> },
    ...uiDemos.map(
        (entry): DemoEntry => ({
            id: `ui-${entry.id}`,
            name: entry.name,
            groupKey: `uiPrimitives`,
            render: entry.render
        })
    )
];
