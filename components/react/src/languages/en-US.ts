import baseEn from "../../lib/lib/languages/en-US/default";
import type { Translation } from "../languages";
import { ExampleActionIds } from "../exampleActions";

const translation: Translation = {
    ...baseEn,
    actions: {
        ...baseEn.actions,
        [ExampleActionIds.GREET]: `Greet`,
        [ExampleActionIds.COPY_TIMESTAMP]: `Copy current timestamp`
    },
    example: {
        pageTitle: `MOWS Components — Example`,
        pageSubtitle: `Open the menu in the top-right to switch theme, language or sign in.`,
        menuHint: `Top-right menu`,
        themeAndLanguageCard: {
            title: `Theme & Language`,
            description: `The PrimaryMenu in the top-right is wired to MowsProvider. State persists in localStorage under the storagePrefix.`,
            themeBadge: `theme`,
            langBadge: `lang`,
            rightClickHint: `Right-click this card to open the global context menu (actions scoped to "exampleCard").`
        },
        actionManagerCard: {
            title: `Action Manager`,
            description: `Trigger core actions programmatically or via their hotkeys.`,
            openCommandPalette: `Open command palette`,
            editKeyboardShortcuts: `Edit keyboard shortcuts`,
            themeModal: `Theme modal`,
            languageModal: `Language modal`
        },
        greetAlert: `Hello from the example card!`,
        sidebar: {
            groups: {
                atoms: `Atoms`,
                dateAndTime: `Date & time`,
                actionsAndShortcuts: `Actions & shortcuts`,
                settings: `Settings`,
                lists: `Lists`,
                uiPrimitives: `UI primitives`
            },
            searchPlaceholder: `Search components...`,
            searchAriaLabel: `Search components`,
            searchClearAriaLabel: `Clear search`,
            noMatches: `No components match this search.`
        },
        ui: {
            button: {
                description: `Variants and sizes for the base button.`,
                iconButtonAriaLabel: `Settings`,
                disabledLabel: `disabled`
            },
            badge: {
                description: `Inline status badges.`
            },
            card: {
                description: `Container with header, content and footer slots.`,
                title: `Card title`,
                descriptionText: `Short supporting copy.`,
                body: `Cards group related content and actions.`,
                confirm: `Confirm`,
                cancel: `Cancel`
            },
            input: {
                description: `Plain text inputs in their common modes.`,
                text: `Text`,
                password: `Password`,
                disabled: `Disabled`,
                placeholder: `Type something...`,
                disabledValue: `read-only value`
            },
            textarea: {
                description: `Multi-line text input.`,
                placeholder: `Write a longer message...`,
                disabledValue: `disabled textarea`
            },
            label: {
                description: `Form-control label, clickable to focus its input.`,
                text: `Accept terms`
            },
            checkbox: {
                description: `Tri-state-capable checkbox primitive.`,
                checked: `Checked`,
                unchecked: `Unchecked`,
                disabled: `Disabled`
            },
            switch: {
                description: `On/off toggle.`,
                on: `On`,
                off: `Off`,
                disabled: `Disabled`
            },
            select: {
                description: `Single-select dropdown.`,
                placeholder: `Pick a fruit`,
                apple: `Apple`,
                banana: `Banana`,
                cherry: `Cherry`
            },
            radioGroup: {
                description: `Single-select group of radio buttons.`,
                apple: `Apple`,
                banana: `Banana`,
                cherry: `Cherry`
            },
            slider: {
                description: `Single-thumb and range sliders.`
            },
            progress: {
                description: `Linear progress indicator.`
            },
            tabs: {
                description: `Switch between sibling panels.`,
                account: `Account`,
                password: `Password`,
                notifications: `Notifications`,
                accountBody: `Update your account details.`,
                passwordBody: `Change your password.`,
                notificationsBody: `Manage notification preferences.`
            },
            dialog: {
                description: `Modal dialog with focus trap and overlay.`,
                open: `Open dialog`,
                title: `Are you sure?`,
                descriptionText: `This action cannot be undone.`,
                confirm: `Confirm`,
                cancel: `Cancel`
            },
            popover: {
                description: `Floating panel anchored to a trigger.`,
                open: `Open popover`,
                body: `Popovers are non-modal — clicks outside dismiss them.`
            },
            hoverCard: {
                description: `Rich hover preview, ideal for user mentions.`,
                handle: `mows`,
                name: `MOWS Demo`,
                bio: `A simple example user shown when you hover the link.`
            },
            dropdownMenu: {
                description: `Action menu attached to a trigger button.`,
                open: `Open menu`,
                label: `Account`,
                profile: `Profile`,
                settings: `Settings`,
                bookmarks: `Bookmarks`
            },
            contextMenu: {
                description: `Right-click menu attached to its trigger area.`,
                rightClick: `right-click here`,
                action1: `Mark as read`,
                action2: `Reply`,
                action3: `Delete`
            },
            skeleton: {
                description: `Animated placeholder while content loads.`
            },
            scrollArea: {
                description: `Container with custom-styled scrollbars.`,
                itemPrefix: `Item`
            },
            resizable: {
                description: `User-draggable split panels.`,
                panel: `Panel`
            },
            sonner: {
                description: `Toast notifications via sonner.`,
                show: `Show toast`,
                showSuccess: `Show success`,
                showError: `Show error`,
                defaultMsg: `Just a notification.`,
                successMsg: `Saved successfully.`,
                errorMsg: `Something went wrong.`
            },
            inputGroup: {
                description: `Input with leading icon or addon.`,
                searchPlaceholder: `Search...`,
                usernamePlaceholder: `username`,
                emailPlaceholder: `you@example.com`
            },
            calendar: {
                description: `Single-date calendar primitive.`,
                empty: `–`
            }
        },
        common: {
            selected: `selected`,
            value: `value`,
            tz: `tz`,
            empty: `–`,
            popoverTrigger: `Popover trigger`,
            standalone: `Standalone`
        },
        demos: {
            actionDisplay: {
                description: `Renders an action's icon, label and key combo.`,
                notRegistered: `action not registered`
            },
            avatar: {
                description: `Circular initial-letter avatar.`
            },
            buttonSelect: {
                description: `Single-select button group.`,
                grid: `Grid`,
                list: `List`,
                table: `Table`
            },
            codeThemePicker: {
                description: `Picks the syntax-highlighting theme used by CodeViewer.`
            },
            codeViewer: {
                description: `Read-only Monaco-based code viewer with syntax highlighting.`
            },
            commandPalette: {
                description: `Globally mounted. Open with the action below or the keyboard shortcut.`,
                openButton: `Open command palette`
            },
            copyValueButton: {
                description: `Click to copy a value to the clipboard.`,
                tokenLabel: `Copy token`,
                timeLabel: `Copy current time`
            },
            dateTime: {
                description: `Locale-aware timestamp display.`,
                nowLabel: `Now`,
                naiveLabel: `Naive`,
                utcLabel: `UTC`
            },
            dateTimePicker: {
                description: `Date + time picker.`
            },
            timePicker: {
                description: `Hours / minutes / seconds picker.`
            },
            timezoneSelector: {
                description: `Searchable IANA timezone selector.`
            },
            dateTimeRangePicker: {
                description: `Start / end date+time range picker.`
            },
            globalContextMenu: {
                description: `Right-click an area with a matching data-actionscope to open the global context menu. Right-clicking a menu item executes it.`,
                rightClickHere: `right-click here`
            },
            keyboardShortcutEditor: {
                description: `Lists every registered action and lets you rebind its hotkeys.`
            },
            keyComboDisplay: {
                description: `Renders a key combo as styled keycaps.`
            },
            languagePicker: {
                description: `Trigger (left) and standalone (right) variants.`
            },
            modalHandler: {
                description: `Mounted globally — opens whichever modal the active action requests.`,
                themeButton: `Open theme modal`,
                languageButton: `Open language modal`,
                shortcutsButton: `Open keyboard shortcuts modal`
            },
            optionPicker: {
                description: `Popover containing a list of toggleable options.`,
                compact: `Compact rows`,
                wrap: `Wrap text`,
                lineNumbers: `Line numbers`
            },
            settingsPanel: {
                description: `Bundled panel with theme, language, code-theme and editor settings.`
            },
            primaryMenu: {
                description: `Mounted globally in the top-right corner — click the avatar to open it.`,
                topRightHint: `see top-right corner`
            },
            themePicker: {
                description: `Trigger (left) and standalone (right) variants.`
            },
            loggingConfig: {
                description: `Per-file log-level overrides, persisted to localStorage.`
            },
            resourceList: {
                description: `ResourceList requires a paginated data source — see the filez frontend for a full example.`,
                note: `No standalone demo: this component renders large infinite-scrolling lists driven by a server-side getResourcesList function.`
            },
            searchInput: {
                description: `Generic search field with a leading icon and clear button. Used in the sidebar to filter components.`,
                placeholder: `Search...`,
                valueLabel: `value`
            }
        }
    }
};

export default translation;
