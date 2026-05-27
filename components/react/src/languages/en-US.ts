import baseEn from "../../lib/lib/languages/en-US/default";
import { stepsEn } from "../examples/steps/translations";
import type { Translation } from "../languages";
import { ExampleActionIds } from "../exampleActions";
import { actionDisplayEn } from "../examples/actionDisplay/translations";
import { audioPlayerEn } from "../examples/audioPlayer/translations";
import { avatarEn } from "../examples/avatar/translations";
import { badgeEn } from "../examples/badge/translations";
import { buttonEn } from "../examples/button/translations";
import { buttonSelectEn } from "../examples/buttonSelect/translations";
import { calendarEn } from "../examples/calendar/translations";
import { cardEn } from "../examples/card/translations";
import { chartEn } from "../examples/chart/translations";
import { chatEn } from "../examples/chat/translations";
import { checkboxEn } from "../examples/checkbox/translations";
import { codeSnippetEn } from "../examples/codeSnippet/translations";
import { codeThemePickerEn } from "../examples/codeThemePicker/translations";
import { codeViewerEn } from "../examples/codeViewer/translations";
import { collapsibleEn } from "../examples/collapsible/translations";
import { colorCurvesEn } from "../examples/colorCurves/translations";
import { commandPaletteEn } from "../examples/commandPalette/translations";
import { compassEn } from "../examples/compass/translations";
import { consoleManagerEn } from "../examples/consoleManager/translations";
import { contextMenuEn } from "../examples/contextMenu/translations";
import { copyValueButtonEn } from "../examples/copyValueButton/translations";
import { dateTimeDisplayEn } from "../examples/dateTimeDisplay/translations";
import { dateTimePickerEn } from "../examples/dateTimePicker/translations";
import { dateTimeRangePickerEn } from "../examples/dateTimeRangePicker/translations";
import { dialogEn } from "../examples/dialog/translations";
import { dropdownMenuEn } from "../examples/dropdownMenu/translations";
import { emojiPickerEn } from "../examples/emojiPicker/translations";
import { expandableCodeEn } from "../examples/expandableCode/translations";
import { fileIconEn } from "../examples/fileIcon/translations";
import { fileViewerEn } from "../examples/fileViewer/translations";
import { globalContextMenuEn } from "../examples/globalContextMenu/translations";
import { hoverCardEn } from "../examples/hoverCard/translations";
import { image360ViewerEn } from "../examples/image360Viewer/translations";
import { inlineEditEn } from "../examples/inlineEdit/translations";
import { inputEn } from "../examples/input/translations";
import { inputGroupEn } from "../examples/inputGroup/translations";
import { keyComboDisplayEn } from "../examples/keyComboDisplay/translations";
import { keyComboRecorderEn } from "../examples/keyComboRecorder/translations";
import { keyboardShortcutEditorEn } from "../examples/keyboardShortcutEditor/translations";
import { labelEn } from "../examples/label/translations";
import { languagePickerEn } from "../examples/languagePicker/translations";
import { locationPickerEn } from "../examples/locationPicker/translations";
import { logViewEn } from "../examples/logView/translations";
import { loggingConfigEn } from "../examples/loggingConfig/translations";
import { lyricsEn } from "../examples/lyrics/translations";
import { machineMonitorEn } from "../examples/machineMonitor/translations";
import { mapEn } from "../examples/map/translations";
import { mapStylePickerEn } from "../examples/mapStylePicker/translations";
import { modalHandlerEn } from "../examples/modalHandler/translations";
import { nodeEditorEn } from "../examples/nodeEditor/translations";
import { numberInputEn } from "../examples/numberInput/translations";
import { optionPickerEn } from "../examples/optionPicker/translations";
import { pageIndexEn } from "../examples/pageIndex/translations";
import { popoverEn } from "../examples/popover/translations";
import { primaryMenuEn } from "../examples/primaryMenu/translations";
import { progressEn } from "../examples/progress/translations";
import { radioGroupEn } from "../examples/radioGroup/translations";
import { resizableEn } from "../examples/resizable/translations";
import { resourceListEn } from "../examples/resourceList/translations";
import { scrollAreaEn } from "../examples/scrollArea/translations";
import { searchInputEn } from "../examples/searchInput/translations";
import { searchSelectPickerEn } from "../examples/searchSelectPicker/translations";
import { sectionHeadingEn } from "../examples/sectionHeading/translations";
import { selectEn } from "../examples/select/translations";
import { settingsPanelEn } from "../examples/settingsPanel/translations";
import { sidebarEn } from "../examples/sidebar/translations";
import { skeletonEn } from "../examples/skeleton/translations";
import { sliderEn } from "../examples/slider/translations";
import { sonnerEn } from "../examples/sonner/translations";
import { switchEn } from "../examples/switch/translations";
import { tabsEn } from "../examples/tabs/translations";
import { terminalEn } from "../examples/terminal/translations";
import { textareaEn } from "../examples/textarea/translations";
import { themePickerEn } from "../examples/themePicker/translations";
import { timePickerEn } from "../examples/timePicker/translations";
import { timelineEn } from "../examples/timeline/translations";
import { timezoneSelectorEn } from "../examples/timezoneSelector/translations";
import { videoViewerEn } from "../examples/videoViewer/translations";

const translation: Translation = {
    ...baseEn,
    actions: {
        ...baseEn.actions,
        [ExampleActionIds.GREET]: `Greet`,
        [ExampleActionIds.COPY_TIMESTAMP]: `Copy current timestamp`,
        [ExampleActionIds.SHARE]: `Share`,
        [ExampleActionIds.SHARE_COPY_LINK]: `Copy link`,
        [ExampleActionIds.SHARE_EMAIL]: `Email`,
        [ExampleActionIds.SHARE_SLACK]: `Slack`,
        [ExampleActionIds.TRASH]: `Move to bin`,
        [ExampleActionIds.DUPLICATE]: `Duplicate`,
        [ExampleActionIds.REPO_DELETE]: `Delete`
    },
    example: {
        pageTitle: `MOWS Components — Example`,
        menuHint: `Top-right menu`,
        themeAndLanguageCard: {
            title: `Theme & Language`,
            description: `The PrimaryMenu in the top-right is wired to MowsProvider. State persists in localStorage under the storagePrefix.`,
            themeBadge: `theme`,
            languageBadge: `lang`,
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
                actions: `Actions & shortcuts`,
                appShell: `App shell`,
                chat: `Chat`,
                code: `Code`,
                console: `Console`,
                dateTime: `Date & time`,
                editor: `Editors`,
                files: `Files`,
                identity: `Identity`,
                input: `Input`,
                list: `Lists`,
                map: `Map`,
                navigation: `Navigation`,
                settings: `Settings`,
                uiPrimitives: `UI primitives`
            },
            searchPlaceholder: `Search components...`,
            searchAriaLabel: `Search components`,
            searchClearAriaLabel: `Clear search`,
            noMatches: `No components match this search.`,
            favorites: `Favorites`,
            addToFavoritesAriaLabel: `Add to favorites`,
            removeFromFavoritesAriaLabel: `Remove from favorites`,
            guidesLabel: `Guides`,
            creatingAppsLabel: `Creating Apps`,
            translationsLabel: `Translations`
        },
        guides: {
            creatingApps: {
                title: `Creating Apps`,
                placeholder: `Content coming soon — patterns to use, antipatterns to avoid, and an in-page index will live here.`,
                setup: {
                    title: `Setup`,
                    intro: `Every MOWS app starts from the same minimal scaffolding. Wire it up once at the root and every component in the tree can summon shared state via \`useMows()\`.`,
                    provider: {
                        title: `MowsProvider`,
                        body: `Wrap your root in \`<MowsProvider>\` with a \`storagePrefix\` unique to your app. The prefix scopes everything we persist to \`localStorage\` (theme, language, favorites, hotkey overrides, recent actions, …) so multiple MOWS apps loaded on the same origin never trample each other's state. Pass \`oidc\` only if your app authenticates directly — omit it when an upstream proxy / bearer-token-only API does the auth.`
                    },
                    appShell: {
                        title: `App shell mounts`,
                        body: `Drop \`<CommandPalette>\`, \`<ModalHandler>\`, \`<GlobalContextMenu>\`, and \`<Toaster>\` once anywhere inside the provider — typically right next to your top-level \`<App />\`. They render nothing until summoned, but \`useMows()\`, action handlers, and toast emitters silently no-op when their mount is missing. Skipping one is the single most common reason an action / shortcut / toast call quietly does nothing — always mount all four.`
                    }
                },
                patterns: {
                    title: `Patterns to use`,
                    intro: `Recurring layouts and wiring that we want every MOWS app to share. Copy the snippets verbatim as a starting point and adjust from there.`,
                    sidebar: {
                        title: `Sidebar layout`,
                        body: `Reach for the \`<Sidebar>\` primitive whenever the app surfaces more than one or two top-level views. Pin a header at the top with your own app's logo + name — do NOT ship the MOWS logo, that belongs to the platform and not to your app. Route between surfaces via \`<SidebarContent>\`, and drop \`<PrimaryMenu variant="inline" />\` into the footer so theme / language / auth controls live in one consistent place across every MOWS app. This is the same shell the docs sidebar on the left uses.`
                    }
                },
                actions: {
                    title: `Actions`,
                    intro: `Every user-invokable verb in your app — "create document", "delete row", "open settings" — should be an \`Action\`. One definition flows into four invocation surfaces at once: the command palette (Ctrl/Cmd-K), the hotkey manager, the global context menu (right-click), and direct dispatch from your own UI. The same id ends up in localStorage (recents, custom shortcuts) and in the keyboard-shortcut editor, so users can rebind and rediscover anything you ship.`,
                    define: {
                        title: `Define an action`,
                        body: `An \`Action\` is a stable id + category + map of handlers keyed by \`scope\`. The handler's \`getState()\` returns an \`ActionVisibility\` and optional \`icon\` / \`label\` so the same row in the command palette or context menu picks up live state (e.g. hidden when the user lacks permission, disabled when not yet applicable). Keep ids namespaced (\`myapp.document.create\`) — they survive renames in storage and persist across sessions. Prefer \`ActionVisibility.Disabled\` over \`Hidden\` when the action is contextually unavailable so users can still discover it.`
                    },
                    register: {
                        title: `Register with the provider`,
                        body: `Pass your actions to \`<MowsProvider extraActions={…}>\`. Built-in core actions (open command palette, open settings, login/logout, …) merge automatically. From here, hotkeys defined for any id automatically resolve to your handler, and \`actionManager.dispatchAction(id)\` works from anywhere via \`useMows()\`. The \`<CommandPalette />\` mount picks them up too — that's why all four app-shell mounts are non-negotiable (see Setup above).`
                    },
                    contextMenu: {
                        title: `Right-click context menus`,
                        body: `MOWS apps should expose row-level verbs through the \`<GlobalContextMenu />\` instead of building bespoke popovers. Mark each interactive DOM region with \`data-actionscope="<scope-name>"\` plus any \`data-*\` payload the handler needs (id, name, current status). When the user right-clicks inside a marked region, the menu opens with every action whose handler is registered for that scope. The handler's \`executeAction\` receives the original click event and the marked element as arguments — read identifiers off that element instead of re-traversing the DOM. Outside marked regions the browser's native menu still fires, so copy / paste / inspect keep working untouched.`
                    },
                    variants: {
                        title: `Modifier-key variants`,
                        body: `An action can morph its label, icon, and handler under a modifier-key combination via \`variants\`. The classic case is a "Move to bin" row that becomes "Delete permanently" while Shift is held — the menu re-renders live as the user holds and releases the modifier. Variants resolve in order against the live modifier mask; the first matching predicate wins, so put the most specific variants first. The handler resolution and dispatch path is shared with the right-click menu and the command palette, so the behaviour stays consistent across surfaces.`
                    }
                }
            },
            translations: {
                title: `Translations`,
                overview: {
                    title: `Overview`,
                    intro: `Every translatable string in the library and in your own app flows through one typed object: \`t\`. The library owns its slice (\`BaseTranslation\`), your app extends the shape via TypeScript declaration merging, and \`<MowsProvider>\` carries the active locale's resolved tree on \`useMows().t\`.`,
                    baseTranslation: {
                        title: `BaseTranslation`,
                        body: `Defined in \`lib/lib/languages.ts\`. Lists every string the library itself renders — \`<PrimaryMenu>\`, \`<CommandPalette>\`, \`<SettingsPanel>\`, \`<VideoViewer>\`, key labels, and so on. Apps never edit this interface; it's the contract every locale shipped from the library must satisfy.`
                    },
                    translationInterface: {
                        title: `Translation`,
                        body: `Also in \`lib/lib/languages.ts\`. Starts out as a bare extension of \`BaseTranslation\` and is the type every consumer references. Your app augments it via \`declare module ".../languages" { interface Translation { … } }\` to add its own keys, so the very same \`t\` object exposes both library strings and app strings.`
                    },
                    language: {
                        title: `Language`,
                        body: `A small record holding the language \`code\` (\`en-US\`, \`de\`), display name, emoji, and an \`import()\` thunk that returns the resolved \`Translation\` for that locale. Each locale's full data lives in its own module, so the language switcher dynamically loads only the locale the user picks.`
                    },
                    provider: {
                        title: `MowsProvider wiring`,
                        body: `\`<MowsProvider>\` takes \`languages\` (the available \`Language[]\`) and \`initialTranslation\` (the eagerly-bundled tree for first paint). It picks up the user's stored choice via \`storagePrefix\` + browser language, runs the matching \`Language.import()\` on mount, and re-renders consumers with the new tree when \`setLanguage()\` is called. The active tree is always reachable on context as \`t\`.`
                    }
                },
                setup: {
                    title: `Setup`,
                    intro: `Wire translations once at the root. Everything else — language switching, persistence, automatic browser-language detection — is handled by the provider.`,
                    mountProvider: {
                        title: `Mount with languages + initial tree`,
                        body: `Pass \`languages\` and \`initialTranslation\` to \`<MowsProvider>\`. The initial tree is bundled with the entry chunk so the first paint never flashes English while a locale chunk loads. Pick it via \`localStorage\` first, then \`navigator.language\`, then a hardcoded English fallback — the example app's \`main.tsx\` shows the exact pattern.`
                    },
                    defaultLanguages: {
                        title: `Skip the languages prop for English + German`,
                        body: `When you omit \`languages\`, \`<MowsProvider>\` falls back to \`baseLanguages\` (English + German shipped by the library). That's enough for apps that don't add their own translation keys. Once your app augments \`Translation\`, ship your own \`Language[]\` so each entry's \`import()\` returns the extended tree, not the base.`
                    }
                },
                reading: {
                    title: `Reading translations`,
                    intro: `Pull \`t\` off context and dereference the typed path. No string keys, no lookup misses — if the dot path doesn't typecheck, the value isn't there.`,
                    hooks: {
                        title: `Function components — useMows()`,
                        body: `Call \`useMows()\` to get the full context, then read \`t.<path>\`. The same hook gives you everything else (theme, action manager, modal state, …) so most components only need one context call.`
                    },
                    classComponents: {
                        title: `Class components — contextType`,
                        body: `Most components in this library are class components. Attach \`static contextType = MowsContext\` and declare \`context: ContextType<typeof MowsContext>\`, then read \`this.context!.t.<path>\` inside \`render()\`. \`this.context\` is typed against \`MowsContextType\` so the same dot-path completion works.`
                    },
                    actions: {
                        title: `Action labels — the one dynamic key`,
                        body: `Action labels live under \`t.actions[ActionId]\`. This is the only place where the key is dynamic instead of statically typed — action ids are namespaced strings (\`myapp.document.create\`) chosen by callers, so the type is \`Record<string, string>\`. Look up via \`t.actions[CoreActionIds.OpenCommandPalette]\` (or your own enum) and the action manager renders the resolved label in the command palette, the keyboard-shortcut editor, and the context menu.`
                    }
                },
                extending: {
                    title: `Adding your own translation keys`,
                    intro: `When your app needs strings beyond what the library ships, augment the \`Translation\` interface via TypeScript declaration merging and provide one file per locale. The augmentation is purely a type-level concern — at runtime the strings just become extra fields on the same \`t\` object.`,
                    declareMerge: {
                        title: `Augment the Translation interface`,
                        body: `In your app, write a \`declare module ".../languages" { interface Translation { … } }\` block that adds your namespace. Use one top-level key per feature area (\`dashboard\`, \`settings\`, \`onboarding\`) so multiple teams can grow their slices without colliding. The library's keys stay untouched; your additions appear alongside them on \`t\`.`
                    },
                    perLocaleFile: {
                        title: `One file per locale, spreading the base`,
                        body: `For each locale build a module that imports the library's base locale (\`baseEn\`, \`baseDe\`), spreads it, and fills in your own keys. \`const translation: Translation = { ...baseEn, … }\` typechecks against the augmented interface, so every library key keeps its baseline value while every app key you added is required at compile time.`
                    },
                    consumeOwnKeys: {
                        title: `Consumers read their own keys the same way`,
                        body: `Inside the app, \`useMows().t.dashboard.greeting\` is just as typed as \`useMows().t.primaryMenu.login\` — there's no second \`useAppT()\` hook to remember, and no risk of a library translation drifting out of sync with an app translation because there's only one tree.`
                    }
                },
                slicing: {
                    title: `Splitting locale files into per-feature slices`,
                    intro: `Once your \`Translation\` covers more than a handful of features, the per-locale file stops fitting in a reviewer's head. A slice file pulls every string for one component — type and both locale values — into a single module that lives next to the component. The top-level locale files become a short list of \`...\`-spread references, and adding a key still fails the compile in every locale because the slice type is what the top-level interface refers to.`,
                    sliceFile: {
                        title: `One file per component, type + both locale values`,
                        body: `Co-locate \`translations.ts\` with the component (e.g. \`src/examples/steps/translations.ts\`) and export three things: \`StepsTranslation\` (the shape), \`stepsEn\` typed as \`StepsTranslation\`, and \`stepsDe\` typed as \`StepsTranslation\`. Anyone touching that component edits one file instead of three.`
                    },
                    wiring: {
                        title: `Wiring a slice into the tree`,
                        body: `In the top-level type, replace the inline literal for that feature with the slice type: \`steps: StepsTranslation\`. In each locale file, replace the inline literal with the slice constant: \`steps: stepsEn\` / \`steps: stepsDe\`. The \`const translation: Translation = { … }\` annotation still forces every required key to be filled — the slice just moves the strings to a different file.`
                    },
                    bundle: {
                        title: `What slicing does (and does not) change in the bundle`,
                        body: `Slice extraction is a maintainability change, not a code-splitting change — the strings end up in the same chunk regardless of where the source lives. Bundle layout is decided by your entrypoint: import both locales statically and the bundler folds them into the main chunk; load the initial locale through a dynamic \`import()\` and the bundler emits one chunk per locale. Pick eager for instant first paint, dynamic for a slimmer main chunk.`
                    }
                },
                switching: {
                    title: `Switching languages at runtime`,
                    intro: `\`setLanguage(language)\` swaps the active locale. The provider invokes \`language.import()\`, awaits the chunk, persists the selection under \`storagePrefix_language\`, and re-renders with the new \`t\`.`,
                    runtime: {
                        title: `Triggering a switch`,
                        body: `Call \`setLanguage\` from \`useMows()\` with the target \`Language\` record. The bundled \`<LanguagePicker>\` already does this — the same call works from your own UI when you need a bespoke entry point. Persisted choice survives reloads; deleting the storage entry falls back to browser-language detection.`
                    },
                    chunks: {
                        title: `Per-locale code chunks`,
                        body: `Each \`Language.import\` is a dynamic \`import()\`. Vite emits a separate chunk per locale, so users only download the locales they actually switch to. The initial paint uses \`initialTranslation\` (eagerly bundled), and subsequent switches stream from the network or the HTTP cache.`
                    }
                },
                safety: {
                    title: `Compile-time guarantees`,
                    intro: `The point of typing the translation tree is that the compiler refuses to let a locale drift out of sync. Add a key without filling it everywhere and \`tsc\` lights up; the test suite locks the property in.`,
                    compileCheck: {
                        title: `Every locale file is a Translation`,
                        body: `Each per-locale module declares \`const translation: Translation = { … }\`. Add a new key to \`Translation\` (in the library or via app-side augmentation) and every locale file fails to compile until the key is filled. No silent fallbacks, no untranslated string slipping through.`
                    },
                    complianceTest: {
                        title: `localesAreCompliant.test.ts`,
                        body: `\`lib/lib/languages/localesAreCompliant.test.ts\` imports every shipped locale and re-asserts its type against \`BaseTranslation\`. Running \`pnpm test\` (or \`pnpm build\`) surfaces a missing locale slot the same way a CI run does — there's no path where a translation gap reaches production undetected.`
                    }
                },
                conventions: {
                    title: `Conventions & gotchas`,
                    intro: `Patterns that keep the tree maintainable as it grows.`,
                    namespacing: {
                        title: `Namespace by feature, not by component`,
                        body: `Group strings by user-facing concept (\`onboarding.welcome\`, \`settings.appearance\`) rather than by component name. The library does the opposite — it namespaces by component (\`primaryMenu\`, \`commandPalette\`) — because its surfaces ARE its components. App keys outlive component renames, so a feature namespace is steadier ground.`
                    },
                    flatKeys: {
                        title: `Don't flatten the tree`,
                        body: `Resist the urge to write \`t["settings.theme.title"]\`. Nested objects are typed end-to-end and refactorable; bracket-indexed flat keys defeat completion, drop refactor support, and make missing-key bugs runtime-only. The one place this is unavoidable is action labels (see "Reading translations" above) — and even there the keys come from an enum.`
                    },
                    actionIds: {
                        title: `Action labels are the lone dynamic slot`,
                        body: `\`t.actions[id]\` is a \`Record<string, string>\` because action ids are open-ended. Always source the id from an enum or const so a typo at the call site stays a typo at the lookup site. The translation file is where the label is rendered — keep both halves close together when you add a new action.`
                    },
                    spreadBase: {
                        title: `Always spread the base locale`,
                        body: `Per-locale app files start with \`...baseEn\` (or \`...baseDe\`) so the library's strings keep their values without being duplicated. Forgetting the spread leaves your app-side keys typechecking individually but the merged \`Translation\` missing every library key — and the compile error surfaces only at the assignment site, far from the missing field.`
                    }
                }
            }
        },
        examples: {
            _harness: {
                codeTab: `Code`,
                stateTab: `State`,
                noStateReported: `This example does not report state.`
            },
            steps: stepsEn,
            sectionHeading: sectionHeadingEn,
            pageIndex: pageIndexEn,
            audioPlayer: audioPlayerEn,
            lyrics: lyricsEn,
            fileIcon: fileIconEn,
            videoViewer: videoViewerEn,
            codeThemePicker: codeThemePickerEn,
            codeViewer: codeViewerEn,
            codeSnippet: codeSnippetEn,
            primaryMenu: primaryMenuEn,
            globalContextMenu: globalContextMenuEn,
            copyValueButton: copyValueButtonEn,
            buttonSelect: buttonSelectEn,
            settingsPanel: settingsPanelEn,
            terminal: terminalEn,
            logView: logViewEn,
            machineMonitor: machineMonitorEn,
            sidebar: sidebarEn,
            tabs: tabsEn,
            badge: badgeEn,
            button: buttonEn,
            card: cardEn,
            checkbox: checkboxEn,
            switch: switchEn,
            collapsible: collapsibleEn,
            input: inputEn,
            label: labelEn,
            textarea: textareaEn,
            skeleton: skeletonEn,
            progress: progressEn,
            dialog: dialogEn,
            popover: popoverEn,
            scrollArea: scrollAreaEn,
            radioGroup: radioGroupEn,
            slider: sliderEn,
            contextMenu: contextMenuEn,
            dropdownMenu: dropdownMenuEn,
            hoverCard: hoverCardEn,
            select: selectEn,
            sonner: sonnerEn,
            inputGroup: inputGroupEn,
            resizable: resizableEn,
            calendar: calendarEn,
            compass: compassEn,
            avatar: avatarEn,
            actionDisplay: actionDisplayEn,
            keyComboDisplay: keyComboDisplayEn,
            keyboardShortcutEditor: keyboardShortcutEditorEn,
            expandableCode: expandableCodeEn,
            searchInput: searchInputEn,
            numberInput: numberInputEn,
            colorCurves: colorCurvesEn,
            optionPicker: optionPickerEn,
            searchSelectPicker: searchSelectPickerEn,
            languagePicker: languagePickerEn,
            themePicker: themePickerEn,
            mapStylePicker: mapStylePickerEn,
            map: mapEn,
            locationPicker: locationPickerEn,
            dateTimePicker: dateTimePickerEn,
            timePicker: timePickerEn,
            timezoneSelector: timezoneSelectorEn,
            dateTimeRangePicker: dateTimeRangePickerEn,
            loggingConfig: loggingConfigEn,
            inlineEdit: inlineEditEn,
            commandPalette: commandPaletteEn,
            modalHandler: modalHandlerEn,
            fileViewer: fileViewerEn,
            image360Viewer: image360ViewerEn,
            consoleManager: consoleManagerEn,
            timeline: timelineEn,
            nodeEditor: nodeEditorEn,
            dateTimeDisplay: dateTimeDisplayEn,
            resourceList: resourceListEn,
            emojiPicker: emojiPickerEn,
            chat: chatEn,
            keyComboRecorder: keyComboRecorderEn,
            chart: chartEn,
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
            fileViewer: {
                description: `Generic file preview. Dispatches by MIME type; image/* renders an ImageViewer (or Image360Viewer when is360 is set). Other types fall back to the file name.`,
                hint: `A bundled sample image loads on mount. Paste any URL to swap it.`,
                urlPlaceholder: `https://example.com/photo.jpg`,
                namePlaceholder: `photo.jpg`,
                mimeTypePlaceholder: `image/jpeg`,
                empty: `Enter a URL to preview.`,
                loadSample: `Load sample`,
                clear: `Clear`,
                sampleName: `landscape.webp`,
                photoBy: `Photo`,
                sourceLink: `source`
            },
            image360Viewer: {
                description: `Equirectangular 360° panorama viewer powered by Photo Sphere Viewer (three.js). Loaded lazily — only fetched when first rendered.`,
                hint: `A bundled sample panorama loads on mount. Drag to look around; scroll to zoom. Paste any equirectangular (2:1) URL to load your own.`,
                urlPlaceholder: `https://example.com/panorama.jpg`,
                empty: `Enter an equirectangular image URL to preview.`,
                loadSample: `Load sample`,
                load: `Load`,
                clear: `Clear`,
                photoBy: `Photo`,
                sourceLink: `source`
            },
            keyboardShortcutEditor: {
                description: `Lists every registered action and lets you rebind its hotkeys.`
            },
            keyComboDisplay: {
                description: `Renders a key combo as styled keycaps. Always shows the Win / Linux variant; macOS-specific glyphs (⌘, ⌃, ⌥) are documented separately in the legend below so docs can show one row per shortcut and a single legend section.`,
                combosHeading: `Common combos`,
                iconsHeading: `All keys with icons`,
                textHeading: `Keys with text (Windows / Linux)`,
                textHint: `These render as the active translation. Switch language in the top-right menu — they update.`,
                macDifferencesHeading: `macOS equivalents`,
                macDifferencesHint: `On a Mac keyboard the text-rendered tokens above appear as icons. Each row groups every alias that resolves to the same icon.`
            },
            keyComboRecorder: {
                description: `Capture real keystrokes from the keyboard and convert them to combo strings using the same formatter the rest of the app uses.`,
                heading: `Record key combos`,
                hint: `Click "Start recording" then press any combos on your keyboard — each press is appended to the list below. A modifier key released alone (e.g. just Shift) is also captured. Click "Stop recording" when you're done.`,
                start: `Start recording`,
                stop: `Stop recording`,
                clear: `Clear`,
                listening: `Listening — press any key combo…`
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
            themePicker: {
                description: `Trigger (left) and standalone (right) variants.`
            },
            loggingConfig: {
                description: `Per-file log-level overrides, persisted to localStorage.`
            },
            resourceList: {
                description: `ResourceList renders large infinite-scrolling lists of any resource type — supply a paginated getResourcesList function and one or more row handlers.`,
                note: `See the ResourceList component page for runnable Column, Grid, multi-layout, and selection examples.`,
                crossListDrag: {
                    intro: `Three lists. {ab} accept each other's drops; {c} rejects everything. Start a drag in any list — the others light up to show whether they'll accept it (primary outline = accept, dimmed overlay = reject). All three still allow internal reordering.`,
                    introBold: `A ↔ B`,
                    listLabel: `List`,
                    acceptsPrefix: `accepts`,
                    acceptsSelfOnly: `self only`
                }
            },
            consoleManager: {
                description: `VSCode-style console host. Open new tabs with +, double-click a tab to rename, hover to close (×), and use the split buttons on the right to split the pane horizontally or vertically.`,
                terminalLabel: `Terminal`,
                logsLabel: `Logs`
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
