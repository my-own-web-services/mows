import * as React from "react";
import { type ReactNode } from "react";
import CodeSnippetDocPage from "./examples/codeSnippet/CodeSnippetDocPage";
import InlineEditDocPage from "./examples/inlineEdit/InlineEditDocPage";
import FileIconDocPage from "./examples/fileIcon/FileIconDocPage";
import VideoViewerDocPage from "./examples/videoViewer/VideoViewerDocPage";
import AudioPlayerDocPage from "./examples/audioPlayer/AudioPlayerDocPage";
import LyricsDocPage from "./examples/lyrics/LyricsDocPage";
import PageIndexDocPage from "./examples/pageIndex/PageIndexDocPage";
import CodeThemePickerDocPage from "./examples/codeThemePicker/CodeThemePickerDocPage";
import CodeViewerDocPage from "./examples/codeViewer/CodeViewerDocPage";
import SectionHeadingDocPage from "./examples/sectionHeading/SectionHeadingDocPage";
import PrimaryMenuDocPage from "./examples/primaryMenu/PrimaryMenuDocPage";
import GlobalContextMenuDocPage from "./examples/globalContextMenu/GlobalContextMenuDocPage";
import CopyValueButtonDocPage from "./examples/copyValueButton/CopyValueButtonDocPage";
import ButtonSelectDocPage from "./examples/buttonSelect/ButtonSelectDocPage";
import ColorCurvesDocPage from "./examples/colorCurves/ColorCurvesDocPage";
import SettingsPanelDocPage from "./examples/settingsPanel/SettingsPanelDocPage";
import TerminalDocPage from "./examples/terminal/TerminalDocPage";
import LogViewDocPage from "./examples/logView/LogViewDocPage";
import MachineMonitorDocPage from "./examples/machineMonitor/MachineMonitorDocPage";
import SidebarDocPage from "./examples/sidebar/SidebarDocPage";
import TabsDocPage from "./examples/tabs/TabsDocPage";
import CompassDocPage from "./examples/compass/CompassDocPage";
import AvatarDocPage from "./examples/avatar/AvatarDocPage";
import IconBadgeDocPage from "./examples/iconBadge/IconBadgeDocPage";
import ActionDisplayDocPage from "./examples/actionDisplay/ActionDisplayDocPage";
import KeyComboDisplayDocPage from "./examples/keyComboDisplay/KeyComboDisplayDocPage";
import KeyboardShortcutEditorDocPage from "./examples/keyboardShortcutEditor/KeyboardShortcutEditorDocPage";
import ExpandableCodeDocPage from "./examples/expandableCode/ExpandableCodeDocPage";
import ExpandableSectionDocPage from "./examples/expandableSection/ExpandableSectionDocPage";
import ShareDialogDocPage from "./examples/shareDialog/ShareDialogDocPage";
import SearchInputDocPage from "./examples/searchInput/SearchInputDocPage";
import NumberInputDocPage from "./examples/numberInput/NumberInputDocPage";
import OptionPickerDocPage from "./examples/optionPicker/OptionPickerDocPage";
import StaggeredCheckboxesDocPage from "./examples/staggeredCheckboxes/StaggeredCheckboxesDocPage";
import SearchSelectPickerDocPage from "./examples/searchSelectPicker/SearchSelectPickerDocPage";
import LanguagePickerDocPage from "./examples/languagePicker/LanguagePickerDocPage";
import CoordinateLinksDocPage from "./examples/coordinateLinks/CoordinateLinksDocPage";
import LocationPickerDocPage from "./examples/locationPicker/LocationPickerDocPage";
import MapDocPage from "./examples/map/MapDocPage";
import WeatherChipDocPage from "./examples/weatherChip/WeatherChipDocPage";
import WeatherExpandableDocPage from "./examples/weatherExpandable/WeatherExpandableDocPage";
import MapStylePickerDocPage from "./examples/mapStylePicker/MapStylePickerDocPage";
import ThemePickerDocPage from "./examples/themePicker/ThemePickerDocPage";
import DateTimePickerDocPage from "./examples/dateTimePicker/DateTimePickerDocPage";
import TimePickerDocPage from "./examples/timePicker/TimePickerDocPage";
import TimezoneSelectorDocPage from "./examples/timezoneSelector/TimezoneSelectorDocPage";
import DateTimeRangePickerDocPage from "./examples/dateTimeRangePicker/DateTimeRangePickerDocPage";
import OpeningHoursDocPage from "./examples/openingHours/OpeningHoursDocPage";
import TimelineDocPage from "./examples/timeline/TimelineDocPage";
import LoggingConfigDocPage from "./examples/loggingConfig/LoggingConfigDocPage";
import CommandPaletteDocPage from "./examples/commandPalette/CommandPaletteDocPage";
import HistoryPanelDocPage from "./examples/historyPanel/HistoryPanelDocPage";
import ModalHandlerDocPage from "./examples/modalHandler/ModalHandlerDocPage";
import FileViewerDocPage from "./examples/fileViewer/FileViewerDocPage";
import Image360ViewerDocPage from "./examples/image360Viewer/Image360ViewerDocPage";
import ResourceListDocPage from "./examples/resourceList/ResourceListDocPage";
import ChatDocPage from "./examples/chat/ChatDocPage";
import EmojiPickerDocPage from "./examples/emojiPicker/EmojiPickerDocPage";
import ConsoleManagerDocPage from "./examples/consoleManager/ConsoleManagerDocPage";
import DateTimeDisplayDocPage from "./examples/dateTimeDisplay/DateTimeDisplayDocPage";
import DurationDocPage from "./examples/duration/DurationDocPage";
import SchedulerDocPage from "./examples/scheduler/SchedulerDocPage";
import KeyComboRecorderDocPage from "./examples/keyComboRecorder/KeyComboRecorderDocPage";
import NodeEditorDocPage from "./examples/nodeEditor/NodeEditorDocPage";
import type { Translation } from "./languages";
import { uiDemos } from "./uiDemos";
import { registerDemoLinks } from "./componentLinkRegistry";

// ARCH-20: previous `DemoFrame`, `useTranslations`, `ExampleT|DemosT|CommonT`
// scaffolding was retired with the DocPage migration. Every entry in the
// `demos` array now renders a `<XDocPage />` directly; the harness owns
// the frame chrome inside `<ExampleCard>`.

export type DemoGroupKey = keyof Translation[`example`][`sidebar`][`groups`];

/**
 * Canonical render order for sidebar groups. Every key declared on the
 * Translation `sidebar.groups` object MUST appear here — otherwise demos
 * in that group are silently dropped from the sidebar AND from the
 * search filter (App.tsx maps over this list). The integrity test in
 * `src/examples/harness/groupOrderIntegrity.test.ts` enforces that.
 */
export const GROUP_ORDER: ReadonlyArray<DemoGroupKey> = [
    `actions`,
    `appShell`,
    `chat`,
    `code`,
    `console`,
    `dateTime`,
    `display`,
    `editor`,
    `files`,
    `identity`,
    `input`,
    `list`,
    `map`,
    `navigation`,
    `settings`,
    `uiPrimitives`
];

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
    { id: `historyPanel`, name: `HistoryPanel`, groupKey: `appShell`, render: () => <HistoryPanelDocPage />, searchTags: [`undo`, `redo`, `history`, `audit`, `log`, `ctrl-z`] },
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
    { id: `openingHours`, name: `OpeningHours`, groupKey: `dateTime`, render: () => <OpeningHoursDocPage />, searchTags: [`opening`, `hours`, `osm`, `openstreetmap`, `schedule`, `place`, `business`, `open`, `closed`] },
    { id: `duration`, name: `Duration`, groupKey: `dateTime`, render: () => <DurationDocPage />, searchTags: [`duration`, `elapsed`, `length`, `time`, `responsive`, `1h`, `10min`, `eta`, `runtime`, `interval`, `humanize`] },
    { id: `scheduler`, name: `Scheduler`, groupKey: `dateTime`, render: () => <SchedulerDocPage />, searchTags: [`calendar`, `event`, `schedule`, `agenda`, `month`, `week`, `day`, `booking`, `planner`, `appointments`] },
    { id: `timeline`, name: `Timeline`, groupKey: `input`, render: () => <TimelineDocPage />, searchTags: [`scrubber`, `playhead`, `video`, `axis`, `zoom`, `time`] },
    { id: `nodeEditor`, name: `NodeEditor`, groupKey: `editor`, render: () => <NodeEditorDocPage />, searchTags: [`graph`, `flow`, `dag`, `node`, `pipeline`, `react-flow`, `xyflow`, `dataflow`, `visual`] },
    {
        id: `audioPlayer`,
        name: `AudioPlayer`,
        groupKey: `files`,
        render: () => <AudioPlayerDocPage />,
        searchTags: [`audio`, `player`, `waveform`, `media`, `podcast`, `mp3`]
    },
    {
        id: `lyrics`,
        name: `Lyrics`,
        groupKey: `files`,
        render: () => <LyricsDocPage />,
        searchTags: [`lyrics`, `lrc`, `karaoke`, `transcript`, `timecode`, `subtitle`, `audio`]
    },
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
    { id: `iconBadge`, name: `IconBadge`, groupKey: `display`, render: () => <IconBadgeDocPage />, searchTags: [`icon`, `badge`, `overlay`, `sub-icon`, `corner`, `edge`, `indicator`, `status`, `mask`, `cutout`, `transparent`] },
    { id: `searchInput`, name: `SearchInput`, groupKey: `input`, render: () => <SearchInputDocPage /> },
    { id: `buttonSelect`, name: `ButtonSelect`, groupKey: `input`, render: () => <ButtonSelectDocPage /> },
    { id: `colorCurves`, name: `ColorCurves`, groupKey: `input`, render: () => <ColorCurvesDocPage />, searchTags: [`curves`, `tonal`, `lightroom`, `photoshop`, `color`, `colour`, `histogram`, `photo`, `grading`] },
    { id: `optionPicker`, name: `OptionPicker`, groupKey: `input`, render: () => <OptionPickerDocPage /> },
    { id: `staggeredCheckboxes`, name: `StaggeredCheckboxes`, groupKey: `input`, render: () => <StaggeredCheckboxesDocPage />, searchTags: [`tree`, `hierarchy`, `tri-state`, `indeterminate`, `checkbox`, `nested`] },
    { id: `copyValueButton`, name: `CopyValueButton`, groupKey: `input`, render: () => <CopyValueButtonDocPage /> },
    { id: `inlineEdit`, name: `InlineEdit`, groupKey: `input`, render: () => <InlineEditDocPage />, searchTags: [`edit`, `rename`, `contenteditable`, `inplace`] },
    { id: `numberInput`, name: `NumberInput`, groupKey: `input`, render: () => <NumberInputDocPage />, searchTags: [`number`, `numeric`, `stepper`] },
    { id: `searchSelectPicker`, name: `SearchSelectPicker`, groupKey: `input`, render: () => <SearchSelectPickerDocPage />, searchTags: [`combobox`, `command`, `autocomplete`] },
    { id: `emojiPicker`, name: `EmojiPicker`, groupKey: `input`, render: () => <EmojiPickerDocPage />, searchTags: [`emoji`, `picker`, `smiley`, `emoticon`, `unicode`, `reactions`, `keyboard`] },
    { id: `locationPicker`, name: `LocationPicker`, groupKey: `input`, render: () => <LocationPickerDocPage />, searchTags: [`map`, `coordinates`, `lat`, `lng`, `geo`, `place`] },
    { id: `settingsPanel`, name: `SettingsPanel`, groupKey: `settings`, render: () => <SettingsPanelDocPage /> },
    { id: `languagePicker`, name: `LanguagePicker`, groupKey: `settings`, render: () => <LanguagePickerDocPage /> },
    { id: `themePicker`, name: `ThemePicker`, groupKey: `settings`, render: () => <ThemePickerDocPage /> },
    { id: `mapStylePicker`, name: `MapStylePicker`, groupKey: `settings`, render: () => <MapStylePickerDocPage />, searchTags: [`map`, `mapbox`, `tiles`] },
    { id: `loggingConfig`, name: `LoggingConfig`, groupKey: `settings`, render: () => <LoggingConfigDocPage /> },
    { id: `map`, name: `Map`, groupKey: `map`, render: () => <MapDocPage />, searchTags: [`map`, `mapbox`, `mapbox-gl`, `maplibre`, `tiles`, `geo`] },
    { id: `coordinateLinks`, name: `CoordinateLinks`, groupKey: `map`, render: () => <CoordinateLinksDocPage />, searchTags: [`map`, `coordinate`, `coordinates`, `lat`, `lng`, `latitude`, `longitude`, `geo`, `links`, `provider`, `google`, `osm`, `apple`, `bing`, `waze`, `here`, `yandex`, `geohack`] },
    { id: `weatherChip`, name: `WeatherChip`, groupKey: `map`, render: () => <WeatherChipDocPage />, searchTags: [`weather`, `wetter`, `forecast`, `historical`, `temperature`, `meteo`, `chip`, `card`] },
    { id: `weatherExpandable`, name: `WeatherExpandable`, groupKey: `map`, render: () => <WeatherExpandableDocPage />, searchTags: [`weather`, `wetter`, `forecast`, `expandable`, `collapsible`, `temperature`, `hourly`, `daily`] },
    { id: `resourceList`, name: `ResourceList`, groupKey: `list`, render: () => <ResourceListDocPage /> },
    { id: `chat`, name: `Chat`, groupKey: `chat`, render: () => <ChatDocPage />, searchTags: [`messages`, `messaging`, `conversation`, `reactions`, `threads`, `reply`, `inbox`, `dm`] },
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
    {
        id: `expandableSection`,
        name: `ExpandableSection`,
        groupKey: `navigation`,
        render: () => <ExpandableSectionDocPage />,
        searchTags: [`disclosure`, `collapsible`, `accordion`, `panel`, `card`, `expand`]
    },
    {
        id: `shareDialog`,
        name: `ShareDialog`,
        groupKey: `identity`,
        render: () => <ShareDialogDocPage />,
        searchTags: [`share`, `policy`, `subject`, `access`, `authorize`, `permission`]
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

// Feed the cross-doc link registry. `renderInlineMarkup` consults the
// registry whenever it encounters a `<PascalCaseName>` chip in prose and
// wraps the chip in a doc-page anchor when the name resolves — that's
// what turns plain mentions like `<PrimaryMenu>` in a `<Steps>`
// description into clickable navigation.
registerDemoLinks(demos);
