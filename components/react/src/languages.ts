import {
    type Language as MowsLanguage,
    type Translation as MowsTranslation
} from "../lib/lib/languages";

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
                langBadge: string;
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
                    code: string;
                    console: string;
                    dateTime: string;
                    files: string;
                    identity: string;
                    input: string;
                    list: string;
                    navigation: string;
                    settings: string;
                    uiPrimitives: string;
                };
                searchPlaceholder: string;
                searchAriaLabel: string;
                searchClearAriaLabel: string;
                noMatches: string;
            };
            ui: {
                button: {
                    description: string;
                    iconButtonAriaLabel: string;
                    disabledLabel: string;
                };
                badge: { description: string };
                card: {
                    description: string;
                    title: string;
                    descriptionText: string;
                    body: string;
                    confirm: string;
                    cancel: string;
                };
                input: {
                    description: string;
                    text: string;
                    password: string;
                    disabled: string;
                    placeholder: string;
                    disabledValue: string;
                };
                textarea: {
                    description: string;
                    placeholder: string;
                    disabledValue: string;
                };
                label: { description: string; text: string };
                checkbox: {
                    description: string;
                    checked: string;
                    unchecked: string;
                    disabled: string;
                };
                switch: {
                    description: string;
                    on: string;
                    off: string;
                    disabled: string;
                };
                select: {
                    description: string;
                    placeholder: string;
                    apple: string;
                    banana: string;
                    cherry: string;
                };
                radioGroup: {
                    description: string;
                    apple: string;
                    banana: string;
                    cherry: string;
                };
                slider: { description: string };
                progress: { description: string };
                tabs: {
                    description: string;
                    account: string;
                    password: string;
                    notifications: string;
                    accountBody: string;
                    passwordBody: string;
                    notificationsBody: string;
                };
                dialog: {
                    description: string;
                    open: string;
                    title: string;
                    descriptionText: string;
                    confirm: string;
                    cancel: string;
                };
                popover: {
                    description: string;
                    open: string;
                    body: string;
                };
                hoverCard: {
                    description: string;
                    handle: string;
                    name: string;
                    bio: string;
                };
                dropdownMenu: {
                    description: string;
                    open: string;
                    label: string;
                    profile: string;
                    settings: string;
                    bookmarks: string;
                };
                contextMenu: {
                    description: string;
                    rightClick: string;
                    action1: string;
                    action2: string;
                    action3: string;
                };
                skeleton: { description: string };
                scrollArea: { description: string; itemPrefix: string };
                resizable: { description: string; panel: string };
                sonner: {
                    description: string;
                    show: string;
                    showSuccess: string;
                    showError: string;
                    defaultMsg: string;
                    successMsg: string;
                    errorMsg: string;
                };
                inputGroup: {
                    description: string;
                    searchPlaceholder: string;
                    usernamePlaceholder: string;
                    emailPlaceholder: string;
                };
                calendar: { description: string; empty: string };
            };
            examples: {
                _harness: {
                    codeTab: string;
                    noStateReported: string;
                };
                steps: {
                    horizontal: { title: string; description: string };
                    vertical: { title: string; description: string };
                    statusOverride: { title: string; description: string };
                    wizard: { title: string; description: string };
                    disabled: { title: string; description: string };
                    icons: { title: string; description: string };
                    rtl: { title: string; description: string };
                    selection: { title: string; description: string };
                    doc: {
                        installation: {
                            title: string;
                            commandTab: string;
                            manualTab: string;
                            manualStep1: string;
                            manualStep2: string;
                            manualStep3: string;
                        };
                        usage: { title: string; body: string };
                        composition: { title: string; body: string };
                        examples: {
                            title: string;
                            line: { title: string; description: string };
                            vertical: { title: string; description: string };
                            disabled: { title: string; description: string };
                            icons: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                derivesStatuses: string;
                                ariaCurrent: string;
                                rendersTitleDescription: string;
                                orientationAttr: string;
                                statusOverride: string;
                                selectionNoCompleted: string;
                                selectionShowsNumbers: string;
                                throwsOutsideSteps: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                sectionHeading: {
                    default: { title: string; description: string };
                    levels: { title: string; description: string };
                    doc: {
                        installation: {
                            title: string;
                            commandTab: string;
                            manualTab: string;
                            manualStep1: string;
                            manualStep2: string;
                            manualStep3: string;
                        };
                        usage: { title: string; body: string };
                        composition: { title: string; body: string };
                        examples: {
                            title: string;
                            default: { title: string; description: string };
                            levels: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersLevel: string;
                                defaultsToH2: string;
                                anchorHref: string;
                                pushesHash: string;
                                noDuplicateHistory: string;
                                preventsDefaultScroll: string;
                                hoverUnderlineText: string;
                                dimMarker: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                pageIndex: {
                    default: { title: string; description: string };
                    nested: { title: string; description: string };
                    doc: {
                        installation: {
                            title: string;
                            commandTab: string;
                            manualTab: string;
                            manualStep1: string;
                            manualStep2: string;
                            manualStep3: string;
                        };
                        usage: { title: string; body: string };
                        composition: { title: string; body: string };
                        examples: {
                            title: string;
                            default: { title: string; description: string };
                            nested: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                pushesHashOnClick: string;
                                smoothOnClick: string;
                                instantOnLoad: string;
                                immediateActiveOnClick: string;
                                holdsActiveDuringScroll: string;
                                nestedRenders: string;
                                nestedScrollsToChild: string;
                                emptyRendersNothing: string;
                                missingIdSkipsHash: string;
                                translationFallback: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                fileIcon: {
                    default: { title: string; description: string };
                    sizes: { title: string; description: string };
                    fallback: { title: string; description: string };
                    doc: {
                        installation: {
                            title: string;
                            commandTab: string;
                            manualTab: string;
                            manualStep1: string;
                            manualStep2: string;
                            manualStep3: string;
                        };
                        usage: { title: string; body: string };
                        composition: { title: string; body: string };
                        examples: {
                            title: string;
                            default: { title: string; description: string };
                            sizes: { title: string; description: string };
                            fallback: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                resolvesAll: string;
                                extension: string;
                                exactName: string;
                                defaultFallback: string;
                                sizeForwarded: string;
                                rerendersOnFileName: string;
                                lucideFallback: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                codeThemePicker: {
                    popover: { title: string; description: string };
                    standalone: { title: string; description: string };
                    doc: {
                        installation: {
                            title: string;
                            commandTab: string;
                            manualTab: string;
                            manualStep1: string;
                            manualStep2: string;
                            manualStep3: string;
                        };
                        usage: { title: string; body: string };
                        composition: { title: string; body: string };
                        examples: {
                            title: string;
                            popover: { title: string; description: string };
                            standalone: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                showsCurrent: string;
                                listsAll: string;
                                callsSetCodeTheme: string;
                                filtersBySearch: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                codeViewer: {
                    default: { title: string; description: string };
                    editable: { title: string; description: string };
                    fitContent: { title: string; description: string };
                    doc: {
                        installation: {
                            title: string;
                            commandTab: string;
                            manualTab: string;
                            manualStep1: string;
                            manualStep2: string;
                            manualStep3: string;
                        };
                        usage: { title: string; body: string };
                        composition: { title: string; body: string };
                        examples: {
                            title: string;
                            default: { title: string; description: string };
                            editable: { title: string; description: string };
                            fitContent: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersLazyEditor: string;
                                forwardsClassName: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                codeSnippet: {
                    block: { title: string; description: string };
                    inline: { title: string; description: string };
                    languages: { title: string; description: string };
                    doc: {
                        installation: {
                            title: string;
                            commandTab: string;
                            manualTab: string;
                            manualStep1: string;
                            manualStep2: string;
                            manualStep3: string;
                        };
                        usage: { title: string; body: string };
                        composition: { title: string; body: string };
                        examples: {
                            title: string;
                            block: { title: string; description: string };
                            inline: { title: string; description: string };
                            languages: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                blockFallback: string;
                                inlineFallback: string;
                                defaultMode: string;
                                forwardsClassName: string;
                                preservesMultiline: string;
                                rendersWithoutProvider: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
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
                buttonSelect: {
                    description: string;
                    grid: string;
                    list: string;
                    table: string;
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
                copyValueButton: {
                    description: string;
                    tokenLabel: string;
                    timeLabel: string;
                    toastLabel: string;
                    toastMessage: string;
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
                globalContextMenu: {
                    description: string;
                    rightClickHere: string;
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
                settingsPanel: {
                    description: string;
                };
                primaryMenu: {
                    description: string;
                    topRightHint: string;
                };
                themePicker: {
                    description: string;
                };
                loggingConfig: {
                    description: string;
                };
                logView: {
                    description: string;
                    hint: string;
                    searchPlaceholder: string;
                    empty: string;
                    pushLine: string;
                };
                terminal: {
                    description: string;
                    hint: string;
                    clear: string;
                };
                machineMonitor: {
                    description: string;
                    hint: string;
                    urlPlaceholder: string;
                    connect: string;
                    disconnect: string;
                    sendCtrlAltDel: string;
                    readOnly: string;
                    status: {
                        connected: string;
                        disconnected: string;
                    };
                    loadingLabel: string;
                };
                resourceList: {
                    description: string;
                    note: string;
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
