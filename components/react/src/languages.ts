import {
    type Language as MowsLanguage,
    type Translation as MowsTranslation
} from "../lib/lib/languages";
import type { StepsTranslation } from "./examples/steps/translations";
import type { ActionDisplayTranslation } from "./examples/actionDisplay/translations";
import type { AudioPlayerTranslation } from "./examples/audioPlayer/translations";
import type { AvatarTranslation } from "./examples/avatar/translations";
import type { BadgeTranslation } from "./examples/badge/translations";
import type { ButtonSelectTranslation } from "./examples/buttonSelect/translations";
import type { ButtonTranslation } from "./examples/button/translations";
import type { CalendarTranslation } from "./examples/calendar/translations";
import type { CardTranslation } from "./examples/card/translations";
import type { ChartTranslation } from "./examples/chart/translations";
import type { ChatTranslation } from "./examples/chat/translations";
import type { CheckboxTranslation } from "./examples/checkbox/translations";
import type { CodeSnippetTranslation } from "./examples/codeSnippet/translations";
import type { CodeThemePickerTranslation } from "./examples/codeThemePicker/translations";
import type { CodeViewerTranslation } from "./examples/codeViewer/translations";
import type { CollapsibleTranslation } from "./examples/collapsible/translations";
import type { ColorCurvesTranslation } from "./examples/colorCurves/translations";
import type { CommandPaletteTranslation } from "./examples/commandPalette/translations";
import type { CompassTranslation } from "./examples/compass/translations";
import type { ConsoleManagerTranslation } from "./examples/consoleManager/translations";
import type { ContextMenuTranslation } from "./examples/contextMenu/translations";
import type { CopyValueButtonTranslation } from "./examples/copyValueButton/translations";
import type { DateTimeDisplayTranslation } from "./examples/dateTimeDisplay/translations";
import type { DurationTranslation } from "./examples/duration/translations";
import type { SchedulerTranslation } from "./examples/scheduler/translations";
import type { DateTimePickerTranslation } from "./examples/dateTimePicker/translations";
import type { DateTimeRangePickerTranslation } from "./examples/dateTimeRangePicker/translations";
import type { DialogTranslation } from "./examples/dialog/translations";
import type { DropdownMenuTranslation } from "./examples/dropdownMenu/translations";
import type { EmojiPickerTranslation } from "./examples/emojiPicker/translations";
import type { ExpandableCodeTranslation } from "./examples/expandableCode/translations";
import type { ExpandableSectionTranslation } from "./examples/expandableSection/translations";
import type { ShareDialogTranslation } from "./examples/shareDialog/translations";
import type { FileIconTranslation } from "./examples/fileIcon/translations";
import type { FileViewerTranslation } from "./examples/fileViewer/translations";
import type { GlobalContextMenuTranslation } from "./examples/globalContextMenu/translations";
import type { HoverCardTranslation } from "./examples/hoverCard/translations";
import type { Image360ViewerTranslation } from "./examples/image360Viewer/translations";
import type { InlineEditTranslation } from "./examples/inlineEdit/translations";
import type { InputGroupTranslation } from "./examples/inputGroup/translations";
import type { InputTranslation } from "./examples/input/translations";
import type { KeyComboDisplayTranslation } from "./examples/keyComboDisplay/translations";
import type { KeyComboRecorderTranslation } from "./examples/keyComboRecorder/translations";
import type { KeyboardShortcutEditorTranslation } from "./examples/keyboardShortcutEditor/translations";
import type { LabelTranslation } from "./examples/label/translations";
import type { LanguagePickerTranslation } from "./examples/languagePicker/translations";
import type { CoordinateLinksTranslation } from "./examples/coordinateLinks/translations";
import type { IconBadgeTranslation } from "./examples/iconBadge/translations";
import type { LocationPickerTranslation } from "./examples/locationPicker/translations";
import type { LogViewTranslation } from "./examples/logView/translations";
import type { LoggingConfigTranslation } from "./examples/loggingConfig/translations";
import type { LyricsTranslation } from "./examples/lyrics/translations";
import type { OpeningHoursTranslation } from "./examples/openingHours/translations";
import type { MachineMonitorTranslation } from "./examples/machineMonitor/translations";
import type { MapStylePickerTranslation } from "./examples/mapStylePicker/translations";
import type { MapTranslation } from "./examples/map/translations";
import type { ModalHandlerTranslation } from "./examples/modalHandler/translations";
import type { NodeEditorTranslation } from "./examples/nodeEditor/translations";
import type { NumberInputTranslation } from "./examples/numberInput/translations";
import type { OptionPickerTranslation } from "./examples/optionPicker/translations";
import type { PageIndexTranslation } from "./examples/pageIndex/translations";
import type { PopoverTranslation } from "./examples/popover/translations";
import type { PrimaryMenuTranslation } from "./examples/primaryMenu/translations";
import type { ProgressTranslation } from "./examples/progress/translations";
import type { RadioGroupTranslation } from "./examples/radioGroup/translations";
import type { ResizableTranslation } from "./examples/resizable/translations";
import type { ResourceListTranslation } from "./examples/resourceList/translations";
import type { ScrollAreaTranslation } from "./examples/scrollArea/translations";
import type { SearchInputTranslation } from "./examples/searchInput/translations";
import type { SearchSelectPickerTranslation } from "./examples/searchSelectPicker/translations";
import type { SectionHeadingTranslation } from "./examples/sectionHeading/translations";
import type { SelectTranslation } from "./examples/select/translations";
import type { HistoryPanelTranslation } from "./examples/historyPanel/translations";
import type { SettingsPanelTranslation } from "./examples/settingsPanel/translations";
import type { SidebarTranslation } from "./examples/sidebar/translations";
import type { SkeletonTranslation } from "./examples/skeleton/translations";
import type { SliderTranslation } from "./examples/slider/translations";
import type { SonnerTranslation } from "./examples/sonner/translations";
import type { StaggeredCheckboxesTranslation } from "./examples/staggeredCheckboxes/translations";
import type { SwitchTranslation } from "./examples/switch/translations";
import type { TabsTranslation } from "./examples/tabs/translations";
import type { TerminalTranslation } from "./examples/terminal/translations";
import type { TextareaTranslation } from "./examples/textarea/translations";
import type { ThemePickerTranslation } from "./examples/themePicker/translations";
import type { TimePickerTranslation } from "./examples/timePicker/translations";
import type { TimelineTranslation } from "./examples/timeline/translations";
import type { TimezoneSelectorTranslation } from "./examples/timezoneSelector/translations";
import type { VideoViewerTranslation } from "./examples/videoViewer/translations";
import type { WeatherChipTranslation } from "./examples/weatherChip/translations";
import type { WeatherExpandableTranslation } from "./examples/weatherExpandable/translations";

// eslint-disable-next-line quotes
declare module "../lib/lib/languages" {
    interface Translation {
        example: {
            pageTitle: string;
            menuHint: string;
            themeAndLanguageCard: {
                title: string;
                description: string;
                themeBadge: string;
                languageBadge: string;
                rightClickHint: string;
            };
            actionManagerCard: {
                title: string;
                description: string;
                openCommandPalette: string;
                editKeyboardShortcuts: string;
                themeModal: string;
                languageModal: string;
            };
            greetAlert: string;
            sidebar: {
                groups: {
                    actions: string;
                    appShell: string;
                    chat: string;
                    code: string;
                    console: string;
                    dateTime: string;
                    display: string;
                    editor: string;
                    files: string;
                    identity: string;
                    input: string;
                    list: string;
                    map: string;
                    navigation: string;
                    settings: string;
                    uiPrimitives: string;
                };
                searchPlaceholder: string;
                searchAriaLabel: string;
                searchClearAriaLabel: string;
                noMatches: string;
                favorites: string;
                addToFavoritesAriaLabel: string;
                removeFromFavoritesAriaLabel: string;
                guidesLabel: string;
                creatingAppsLabel: string;
                translationsLabel: string;
                settingsSystemLabel: string;
            };
            guides: {
                creatingApps: {
                    title: string;
                    placeholder: string;
                    setup: {
                        title: string;
                        intro: string;
                        provider: {
                            title: string;
                            body: string;
                        };
                        appShell: {
                            title: string;
                            body: string;
                        };
                    };
                    patterns: {
                        title: string;
                        intro: string;
                        sidebar: {
                            title: string;
                            body: string;
                        };
                    };
                    actions: {
                        title: string;
                        intro: string;
                        define: { title: string; body: string };
                        register: { title: string; body: string };
                        contextMenu: { title: string; body: string };
                        variants: { title: string; body: string };
                    };
                };
                translations: {
                    title: string;
                    overview: {
                        title: string;
                        intro: string;
                        baseTranslation: { title: string; body: string };
                        translationInterface: { title: string; body: string };
                        language: { title: string; body: string };
                        provider: { title: string; body: string };
                    };
                    setup: {
                        title: string;
                        intro: string;
                        mountProvider: { title: string; body: string };
                        defaultLanguages: { title: string; body: string };
                    };
                    reading: {
                        title: string;
                        intro: string;
                        hooks: { title: string; body: string };
                        classComponents: { title: string; body: string };
                        actions: { title: string; body: string };
                    };
                    extending: {
                        title: string;
                        intro: string;
                        declareMerge: { title: string; body: string };
                        perLocaleFile: { title: string; body: string };
                        consumeOwnKeys: { title: string; body: string };
                    };
                    slicing: {
                        title: string;
                        intro: string;
                        sliceFile: { title: string; body: string };
                        wiring: { title: string; body: string };
                        bundle: { title: string; body: string };
                    };
                    switching: {
                        title: string;
                        intro: string;
                        runtime: { title: string; body: string };
                        chunks: { title: string; body: string };
                    };
                    safety: {
                        title: string;
                        intro: string;
                        compileCheck: { title: string; body: string };
                        complianceTest: { title: string; body: string };
                    };
                    conventions: {
                        title: string;
                        intro: string;
                        namespacing: { title: string; body: string };
                        flatKeys: { title: string; body: string };
                        actionIds: { title: string; body: string };
                        spreadBase: { title: string; body: string };
                    };
                };
                settingsSystem: {
                    title: string;
                    overview: {
                        title: string;
                        intro: string;
                        oneBlob: { title: string; body: string };
                        coreVsApp: { title: string; body: string };
                        futureSync: { title: string; body: string };
                    };
                    quickStart: {
                        title: string;
                        intro: string;
                        defineSchema: { title: string; body: string };
                        registerSchema: { title: string; body: string };
                        readWrite: { title: string; body: string };
                    };
                    fields: {
                        title: string;
                        intro: string;
                        builtin: { title: string; body: string };
                        custom: { title: string; body: string };
                    };
                    panel: {
                        title: string;
                        intro: string;
                        grouping: { title: string; body: string };
                        jsonExport: { title: string; body: string };
                    };
                    storage: {
                        title: string;
                        intro: string;
                        shape: { title: string; body: string };
                        migration: { title: string; body: string };
                    };
                };
            };
            examples: {
                _harness: {
                    codeTab: string;
                    stateTab: string;
                    noStateReported: string;
                };
                steps: StepsTranslation;
                sectionHeading: SectionHeadingTranslation;
                pageIndex: PageIndexTranslation;
                audioPlayer: AudioPlayerTranslation;
                lyrics: LyricsTranslation;
                fileIcon: FileIconTranslation;
                videoViewer: VideoViewerTranslation;
                codeThemePicker: CodeThemePickerTranslation;
                codeViewer: CodeViewerTranslation;
                codeSnippet: CodeSnippetTranslation;
                primaryMenu: PrimaryMenuTranslation;
                globalContextMenu: GlobalContextMenuTranslation;
                copyValueButton: CopyValueButtonTranslation;
                buttonSelect: ButtonSelectTranslation;
                settingsPanel: SettingsPanelTranslation;
                historyPanel: HistoryPanelTranslation;
                terminal: TerminalTranslation;
                logView: LogViewTranslation;
                machineMonitor: MachineMonitorTranslation;
                sidebar: SidebarTranslation;
                tabs: TabsTranslation;
                badge: BadgeTranslation;
                button: ButtonTranslation;
                card: CardTranslation;
                checkbox: CheckboxTranslation;
                switch: SwitchTranslation;
                collapsible: CollapsibleTranslation;
                input: InputTranslation;
                label: LabelTranslation;
                textarea: TextareaTranslation;
                skeleton: SkeletonTranslation;
                progress: ProgressTranslation;
                dialog: DialogTranslation;
                popover: PopoverTranslation;
                scrollArea: ScrollAreaTranslation;
                radioGroup: RadioGroupTranslation;
                slider: SliderTranslation;
                contextMenu: ContextMenuTranslation;
                dropdownMenu: DropdownMenuTranslation;
                hoverCard: HoverCardTranslation;
                select: SelectTranslation;
                sonner: SonnerTranslation;
                inputGroup: InputGroupTranslation;
                resizable: ResizableTranslation;
                calendar: CalendarTranslation;
                compass: CompassTranslation;
                avatar: AvatarTranslation;
                actionDisplay: ActionDisplayTranslation;
                keyComboDisplay: KeyComboDisplayTranslation;
                keyboardShortcutEditor: KeyboardShortcutEditorTranslation;
                expandableCode: ExpandableCodeTranslation;
                expandableSection: ExpandableSectionTranslation;
                shareDialog: ShareDialogTranslation;
                searchInput: SearchInputTranslation;
                numberInput: NumberInputTranslation;
                colorCurves: ColorCurvesTranslation;
                optionPicker: OptionPickerTranslation;
                searchSelectPicker: SearchSelectPickerTranslation;
                languagePicker: LanguagePickerTranslation;
                themePicker: ThemePickerTranslation;
                mapStylePicker: MapStylePickerTranslation;
                map: MapTranslation;
                locationPicker: LocationPickerTranslation;
                coordinateLinks: CoordinateLinksTranslation;
                iconBadge: IconBadgeTranslation;
                dateTimePicker: DateTimePickerTranslation;
                timePicker: TimePickerTranslation;
                timezoneSelector: TimezoneSelectorTranslation;
                dateTimeRangePicker: DateTimeRangePickerTranslation;
                openingHours: OpeningHoursTranslation;
                duration: DurationTranslation;
                scheduler: SchedulerTranslation;
                timeline: TimelineTranslation;
                nodeEditor: NodeEditorTranslation;
                loggingConfig: LoggingConfigTranslation;
                inlineEdit: InlineEditTranslation;
                commandPalette: CommandPaletteTranslation;
                modalHandler: ModalHandlerTranslation;
                fileViewer: FileViewerTranslation;
                image360Viewer: Image360ViewerTranslation;
                resourceList: ResourceListTranslation;
                emojiPicker: EmojiPickerTranslation;
                chat: ChatTranslation;
                consoleManager: ConsoleManagerTranslation;
                dateTimeDisplay: DateTimeDisplayTranslation;
                keyComboRecorder: KeyComboRecorderTranslation;
                chart: ChartTranslation;
                weatherChip: WeatherChipTranslation;
                weatherExpandable: WeatherExpandableTranslation;
                staggeredCheckboxes: StaggeredCheckboxesTranslation;
            };
            common: {
                selected: string;
                value: string;
                tz: string;
                empty: string;
                popoverTrigger: string;
                standalone: string;
            };
            demos: {
                actionDisplay: {
                    description: string;
                    notRegistered: string;
                };
                avatar: {
                    description: string;
                };
                codeThemePicker: {
                    description: string;
                };
                codeViewer: {
                    description: string;
                };
                commandPalette: {
                    description: string;
                    openButton: string;
                };
                dateTime: {
                    description: string;
                    nowLabel: string;
                    naiveLabel: string;
                    utcLabel: string;
                };
                dateTimePicker: {
                    description: string;
                };
                timePicker: {
                    description: string;
                };
                timezoneSelector: {
                    description: string;
                };
                dateTimeRangePicker: {
                    description: string;
                };
                fileViewer: {
                    description: string;
                    hint: string;
                    urlPlaceholder: string;
                    namePlaceholder: string;
                    mimeTypePlaceholder: string;
                    empty: string;
                    loadSample: string;
                    clear: string;
                    sampleName: string;
                    photoBy: string;
                    sourceLink: string;
                };
                image360Viewer: {
                    description: string;
                    hint: string;
                    urlPlaceholder: string;
                    empty: string;
                    loadSample: string;
                    load: string;
                    clear: string;
                    photoBy: string;
                    sourceLink: string;
                };
                keyboardShortcutEditor: {
                    description: string;
                };
                keyComboDisplay: {
                    description: string;
                    combosHeading: string;
                    iconsHeading: string;
                    textHeading: string;
                    textHint: string;
                    macDifferencesHeading: string;
                    macDifferencesHint: string;
                };
                keyComboRecorder: {
                    description: string;
                    heading: string;
                    hint: string;
                    start: string;
                    stop: string;
                    clear: string;
                    listening: string;
                };
                languagePicker: {
                    description: string;
                };
                modalHandler: {
                    description: string;
                    themeButton: string;
                    languageButton: string;
                    shortcutsButton: string;
                };
                optionPicker: {
                    description: string;
                    compact: string;
                    wrap: string;
                    lineNumbers: string;
                };
                themePicker: {
                    description: string;
                };
                loggingConfig: {
                    description: string;
                };
                resourceList: {
                    description: string;
                    note: string;
                    crossListDrag: {
                        intro: string;
                        introBold: string;
                        listLabel: string;
                        acceptsPrefix: string;
                        acceptsSelfOnly: string;
                    };
                };
                consoleManager: {
                    description: string;
                    terminalLabel: string;
                    logsLabel: string;
                };
                searchInput: {
                    description: string;
                    placeholder: string;
                    valueLabel: string;
                };
            };
        };
    }
}

export type Translation = MowsTranslation;
export type Language = MowsLanguage;

export const languages: Language[] = [
    {
        code: `en-US`,
        originalName: `English (US)`,
        englishName: `English (US)`,
        emoji: `🇺🇸`,
        import: () => import(`./languages/en-US`)
    },
    {
        code: `de`,
        originalName: `Deutsch`,
        englishName: `German`,
        emoji: `🇩🇪`,
        import: () => import(`./languages/de`)
    }
];
