import {
    type Language as MowsLanguage,
    type Translation as MowsTranslation
} from "../lib/lib/languages";

// eslint-disable-next-line quotes
declare module "../lib/lib/languages" {
    interface Translation {
        example: {
            pageTitle: string;
            pageSubtitle: string;
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
                    atoms: string;
                    dateAndTime: string;
                    actionsAndShortcuts: string;
                    settings: string;
                    lists: string;
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
                globalContextMenu: {
                    description: string;
                    rightClickHere: string;
                };
                keyboardShortcutEditor: {
                    description: string;
                };
                keyComboDisplay: {
                    description: string;
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
