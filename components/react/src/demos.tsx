import * as React from "react";
import { type ReactNode } from "react";
import CodeSnippetDocPage from "./examples/codeSnippet/CodeSnippetDocPage";
import InlineEditDocPage from "./examples/inlineEdit/InlineEditDocPage";
import FileIconDocPage from "./examples/fileIcon/FileIconDocPage";
import VideoViewerDocPage from "./examples/videoViewer/VideoViewerDocPage";
import PageIndexDocPage from "./examples/pageIndex/PageIndexDocPage";
import CodeThemePickerDocPage from "./examples/codeThemePicker/CodeThemePickerDocPage";
import CodeViewerDocPage from "./examples/codeViewer/CodeViewerDocPage";
import SectionHeadingDocPage from "./examples/sectionHeading/SectionHeadingDocPage";
import PrimaryMenuDocPage from "./examples/primaryMenu/PrimaryMenuDocPage";
import GlobalContextMenuDocPage from "./examples/globalContextMenu/GlobalContextMenuDocPage";
import CopyValueButtonDocPage from "./examples/copyValueButton/CopyValueButtonDocPage";
import ButtonSelectDocPage from "./examples/buttonSelect/ButtonSelectDocPage";
import SettingsPanelDocPage from "./examples/settingsPanel/SettingsPanelDocPage";
import TerminalDocPage from "./examples/terminal/TerminalDocPage";
import LogViewDocPage from "./examples/logView/LogViewDocPage";
import MachineMonitorDocPage from "./examples/machineMonitor/MachineMonitorDocPage";
import SidebarDocPage from "./examples/sidebar/SidebarDocPage";
import TabsDocPage from "./examples/tabs/TabsDocPage";
import CompassDocPage from "./examples/compass/CompassDocPage";
import AvatarDocPage from "./examples/avatar/AvatarDocPage";
import ActionDisplayDocPage from "./examples/actionDisplay/ActionDisplayDocPage";
import KeyComboDisplayDocPage from "./examples/keyComboDisplay/KeyComboDisplayDocPage";
import KeyboardShortcutEditorDocPage from "./examples/keyboardShortcutEditor/KeyboardShortcutEditorDocPage";
import ExpandableCodeDocPage from "./examples/expandableCode/ExpandableCodeDocPage";
import SearchInputDocPage from "./examples/searchInput/SearchInputDocPage";
import NumberInputDocPage from "./examples/numberInput/NumberInputDocPage";
import OptionPickerDocPage from "./examples/optionPicker/OptionPickerDocPage";
import SearchSelectPickerDocPage from "./examples/searchSelectPicker/SearchSelectPickerDocPage";
import LanguagePickerDocPage from "./examples/languagePicker/LanguagePickerDocPage";
import MapDocPage from "./examples/map/MapDocPage";
import MapStylePickerDocPage from "./examples/mapStylePicker/MapStylePickerDocPage";
import ThemePickerDocPage from "./examples/themePicker/ThemePickerDocPage";
import DateTimePickerDocPage from "./examples/dateTimePicker/DateTimePickerDocPage";
import TimePickerDocPage from "./examples/timePicker/TimePickerDocPage";
import TimezoneSelectorDocPage from "./examples/timezoneSelector/TimezoneSelectorDocPage";
import DateTimeRangePickerDocPage from "./examples/dateTimeRangePicker/DateTimeRangePickerDocPage";
import LoggingConfigDocPage from "./examples/loggingConfig/LoggingConfigDocPage";
import CommandPaletteDocPage from "./examples/commandPalette/CommandPaletteDocPage";
import ModalHandlerDocPage from "./examples/modalHandler/ModalHandlerDocPage";
import FileViewerDocPage from "./examples/fileViewer/FileViewerDocPage";
import Image360ViewerDocPage from "./examples/image360Viewer/Image360ViewerDocPage";
import ResourceListDocPage from "./examples/resourceList/ResourceListDocPage";
import ConsoleManagerDocPage from "./examples/consoleManager/ConsoleManagerDocPage";
import DateTimeDisplayDocPage from "./examples/dateTimeDisplay/DateTimeDisplayDocPage";
import KeyComboRecorderDocPage from "./examples/keyComboRecorder/KeyComboRecorderDocPage";
import type { Translation } from "./languages";
import { uiDemos } from "./uiDemos";

// ARCH-20: previous `DemoFrame`, `useTranslations`, `ExampleT|DemosT|CommonT`
// scaffolding was retired with the DocPage migration. Every entry in the
// `demos` array now renders a `<XDocPage />` directly; the harness owns
// the frame chrome inside `<ExampleCard>`.

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
    { id: `actionDisplay`, name: `ActionDisplay`, groupKey: `actions`, render: () => <ActionDisplayDocPage /> },
    { id: `keyComboDisplay`, name: `KeyComboDisplay`, groupKey: `actions`, render: () => <KeyComboDisplayDocPage /> },
    { id: `keyComboRecorder`, name: `KeyComboRecorder`, groupKey: `actions`, render: () => <KeyComboRecorderDocPage /> },
    { id: `keyboardShortcutEditor`, name: `KeyboardShortcutEditor`, groupKey: `actions`, render: () => <KeyboardShortcutEditorDocPage /> },
    { id: `primaryMenu`, name: `PrimaryMenu`, groupKey: `appShell`, render: () => <PrimaryMenuDocPage /> },
    { id: `commandPalette`, name: `CommandPalette`, groupKey: `appShell`, render: () => <CommandPaletteDocPage /> },
    { id: `globalContextMenu`, name: `GlobalContextMenu`, groupKey: `appShell`, render: () => <GlobalContextMenuDocPage /> },
    { id: `modalHandler`, name: `ModalHandler`, groupKey: `appShell`, render: () => <ModalHandlerDocPage /> },
    { id: `codeViewer`, name: `CodeViewer`, groupKey: `code`, render: () => <CodeViewerDocPage /> },
    {
        id: `codeSnippet`,
        name: `CodeSnippet`,
        groupKey: `code`,
        render: () => <CodeSnippetDocPage />
    },
    { id: `codeThemePicker`, name: `CodeThemePicker`, groupKey: `code`, render: () => <CodeThemePickerDocPage /> },
    { id: `expandableCode`, name: `ExpandableCode`, groupKey: `code`, render: () => <ExpandableCodeDocPage /> },
    {
        id: `consoleManager`,
        name: `ConsoleManager`,
        groupKey: `console`,
        render: () => <ConsoleManagerDocPage />,
        searchTags: [`tabs`, `split`, `panel`, `multiplex`]
    },
    { id: `logView`, name: `LogView`, groupKey: `console`, render: () => <LogViewDocPage /> },
    { id: `terminal`, name: `Terminal`, groupKey: `console`, render: () => <TerminalDocPage /> },
    { id: `machineMonitor`, name: `MachineMonitor`, groupKey: `console`, render: () => <MachineMonitorDocPage /> },
    { id: `dateTimeDisplay`, name: `DateTimeDisplay`, groupKey: `dateTime`, render: () => <DateTimeDisplayDocPage /> },
    { id: `dateTimePicker`, name: `DateTimePicker`, groupKey: `dateTime`, render: () => <DateTimePickerDocPage /> },
    { id: `timePicker`, name: `TimePicker`, groupKey: `dateTime`, render: () => <TimePickerDocPage /> },
    { id: `timezoneSelector`, name: `TimezoneSelector`, groupKey: `dateTime`, render: () => <TimezoneSelectorDocPage /> },
    { id: `dateTimeRangePicker`, name: `DateTimeRangePicker`, groupKey: `dateTime`, render: () => <DateTimeRangePickerDocPage /> },
    {
        id: `fileIcon`,
        name: `FileIcon`,
        groupKey: `files`,
        render: () => <FileIconDocPage />
    },
    { id: `fileViewer`, name: `FileViewer`, groupKey: `files`, render: () => <FileViewerDocPage /> },
    { id: `image360Viewer`, name: `Image360Viewer`, groupKey: `files`, render: () => <Image360ViewerDocPage /> },
    {
        id: `videoViewer`,
        name: `VideoViewer`,
        groupKey: `files`,
        render: () => <VideoViewerDocPage />,
        searchTags: [`video`, `shaka`, `dash`, `hls`, `player`, `streaming`, `mp4`, `webm`]
    },
    { id: `avatar`, name: `Avatar`, groupKey: `identity`, render: () => <AvatarDocPage /> },
    { id: `searchInput`, name: `SearchInput`, groupKey: `input`, render: () => <SearchInputDocPage /> },
    { id: `buttonSelect`, name: `ButtonSelect`, groupKey: `input`, render: () => <ButtonSelectDocPage /> },
    { id: `optionPicker`, name: `OptionPicker`, groupKey: `input`, render: () => <OptionPickerDocPage /> },
    { id: `copyValueButton`, name: `CopyValueButton`, groupKey: `input`, render: () => <CopyValueButtonDocPage /> },
    { id: `inlineEdit`, name: `InlineEdit`, groupKey: `input`, render: () => <InlineEditDocPage />, searchTags: [`edit`, `rename`, `contenteditable`, `inplace`] },
    { id: `numberInput`, name: `NumberInput`, groupKey: `input`, render: () => <NumberInputDocPage />, searchTags: [`number`, `numeric`, `stepper`] },
    { id: `searchSelectPicker`, name: `SearchSelectPicker`, groupKey: `input`, render: () => <SearchSelectPickerDocPage />, searchTags: [`combobox`, `command`, `autocomplete`] },
    { id: `settingsPanel`, name: `SettingsPanel`, groupKey: `settings`, render: () => <SettingsPanelDocPage /> },
    { id: `languagePicker`, name: `LanguagePicker`, groupKey: `settings`, render: () => <LanguagePickerDocPage /> },
    { id: `themePicker`, name: `ThemePicker`, groupKey: `settings`, render: () => <ThemePickerDocPage /> },
    { id: `mapStylePicker`, name: `MapStylePicker`, groupKey: `settings`, render: () => <MapStylePickerDocPage />, searchTags: [`map`, `mapbox`, `tiles`] },
    { id: `loggingConfig`, name: `LoggingConfig`, groupKey: `settings`, render: () => <LoggingConfigDocPage /> },
    { id: `map`, name: `Map`, groupKey: `map`, render: () => <MapDocPage />, searchTags: [`map`, `mapbox`, `mapbox-gl`, `maplibre`, `tiles`, `geo`] },
    { id: `resourceList`, name: `ResourceList`, groupKey: `list`, render: () => <ResourceListDocPage /> },
    { id: `compass`, name: `Compass`, groupKey: `navigation`, render: () => <CompassDocPage />, searchTags: [`heading`, `bearing`, `yaw`, `direction`] },
    {
        id: `pageIndex`,
        name: `PageIndex`,
        groupKey: `navigation`,
        render: () => <PageIndexDocPage />
    },
    {
        id: `sectionHeading`,
        name: `SectionHeading`,
        groupKey: `navigation`,
        render: () => <SectionHeadingDocPage />
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
