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
                actions: `Actions & shortcuts`,
                appShell: `App shell`,
                code: `Code`,
                console: `Console`,
                dateTime: `Date & time`,
                files: `Files`,
                identity: `Identity`,
                input: `Input`,
                list: `Lists`,
                navigation: `Navigation`,
                settings: `Settings`,
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
        examples: {
            _harness: {
                codeTab: `Code`,
                noStateReported: `This example does not report state.`
            },
            steps: {
                horizontal: {
                    title: `Horizontal stepper`,
                    description: `Default horizontal layout. Status is derived from the controlled "current" index.`
                },
                vertical: {
                    title: `Vertical stepper`,
                    description: `Stack the steps vertically, with the connector running between indicators.`
                },
                statusOverride: {
                    title: `Per-step status override`,
                    description: `Pass "status" on an individual <Step> to force its rendering, ignoring the derived state.`
                },
                wizard: {
                    title: `Wizard (preview + content)`,
                    description: `Pair <Steps> with content panels and Back/Next buttons for a real-world flow.`
                },
                selection: {
                    title: `Selection mode`,
                    description: `mode="selection" turns the stepper into a step picker: every circle shows its number, the active step is filled with the primary color, and there is no notion of completion.`
                },
                disabled: {
                    title: `Disabled`,
                    description: `The whole stepper rendered in a disabled state — muted and non-interactive — using a wrapping container with aria-disabled and pointer-events-none.`
                },
                icons: {
                    title: `Icons`,
                    description: `Step titles accept any ReactNode, so you can prefix each label with an icon without modifying the <Steps> primitive itself.`
                },
                rtl: {
                    title: `RTL`,
                    description: `Wrapping <Steps> in dir="rtl" flips the layout for right-to-left scripts. Both horizontal and vertical orientations follow.`
                },
                doc: {
                    installation: {
                        title: `Installation`,
                        commandTab: `Command`,
                        manualTab: `Manual`,
                        manualStep1: `Install the following dependencies:`,
                        manualStep2: `Copy and paste the following code into your project.`,
                        manualStep3: `Update the import paths to match your project setup.`
                    },
                    usage: {
                        title: `Usage`,
                        body: `Import <Steps> and <Step> from the package and render them with a controlled "current" prop. <Step> reads orientation and current from the surrounding <Steps> via context, so its children must be direct <Step> elements.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<Steps> is a thin layout that wires context to its children. Each <Step> renders an indicator circle and a label. The status of each step (completed / current / upcoming) is derived from its index relative to "current", but can be overridden per-step via the "status" prop for error or skipped states.`
                    },
                    examples: {
                        title: `Examples`,
                        line: {
                            title: `Line`,
                            description: `The default horizontal layout: a numbered indicator per step, joined by a connector line.`
                        },
                        vertical: {
                            title: `Vertical`,
                            description: `Stack the steps vertically with the connector running between indicators.`
                        },
                        disabled: {
                            title: `Disabled`,
                            description: `The stepper rendered as fully disabled — muted and non-interactive.`
                        },
                        icons: {
                            title: `Icons`,
                            description: `Use a ReactNode title to put an icon next to each step's label.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Steps> is expected to behave, each linked to the test that verifies it. The path/line points at lib/components/ui/steps.test.tsx in this package.`,
                        verifiedBy: `verified by`,
                        statements: {
                            derivesStatuses: `Index < current renders as completed, == current renders as current, > current renders as upcoming.`,
                            ariaCurrent: `The step at "current" carries aria-current="step".`,
                            rendersTitleDescription: `<Step> renders its title and optional description as written.`,
                            orientationAttr: `The <ol> reflects orientation via the aria-orientation attribute.`,
                            statusOverride: `Passing "status" on a <Step> overrides the index-derived status.`,
                            selectionNoCompleted: `In mode="selection", indices before "current" are never marked completed.`,
                            selectionShowsNumbers: `In mode="selection", every indicator shows its step number; no check icons.`,
                            throwsOutsideSteps: `Rendering <Step> outside a <Steps> throws a descriptive error.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The stepper inherits direction from its DOM ancestor: wrap it in dir="rtl" and the indicator order, label alignment, and connector all reverse without any prop changes.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Steps> and <Step>.`
                    }
                }
            },
            pageIndex: {
                default: {
                    title: `Default`,
                    description: `An on-this-page rail next to a stack of anchored sections. Click an entry to smoothly scroll the matching section into view and update the URL hash.`
                },
                nested: {
                    title: `Nested`,
                    description: `Pass <PageIndexItem>.children to render a tree of anchored sections. The active-line indicator stays at the leftmost edge regardless of depth.`
                },
                doc: {
                    installation: {
                        title: `Installation`,
                        commandTab: `Command`,
                        manualTab: `Manual`,
                        manualStep1: `Install the following dependencies:`,
                        manualStep2: `Copy and paste the following code into your project.`,
                        manualStep3: `Update the import paths to match your project setup.`
                    },
                    usage: {
                        title: `Usage`,
                        body: `Import <PageIndex> from the package and feed it an array of { id, label } items. Each id must match a DOM element's id on the same page.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<PageIndex> is a navigation primitive — it expects the consumer to render the matching anchored elements. Items may carry children to render a nested sub-list; nesting is presentation only, the scrollspy treats every id the same.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Flat list of anchored sections with the rail on the right.`
                        },
                        nested: {
                            title: `Nested`,
                            description: `Items with children render as an indented sub-list under their parent.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <PageIndex> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            pushesHashOnClick: `Clicking an entry writes #<id> to the URL via history.replaceState.`,
                            smoothOnClick: `Click-triggered scroll uses behavior: "smooth".`,
                            instantOnLoad: `Initial hash-driven scroll uses behavior: "auto" — the page lands at the target without animation.`,
                            immediateActiveOnClick: `The clicked entry becomes active immediately, even if the page is already at that section.`,
                            holdsActiveDuringScroll: `The clicked entry stays active during the smooth-scroll animation — intermediate scroll events do not flip the highlight.`,
                            nestedRenders: `Items with children render a link for every leaf AND parent.`,
                            nestedScrollsToChild: `Clicking a nested child scrolls and writes its hash, not the parent's.`,
                            emptyRendersNothing: `Renders nothing when items is empty.`,
                            missingIdSkipsHash: `If the target id is missing from the DOM the hash is NOT updated.`,
                            translationFallback: `Heading and aria-label fall back to English when no <MowsProvider> is mounted.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The rail layout is direction-agnostic — wrap it in dir="rtl" and the indentation reverses for the nested sub-lists.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <PageIndex>.`
                    }
                }
            },
            fileIcon: {
                default: {
                    title: `Common file types`,
                    description: `Resolves a filename to a Material file icon. Lookup tries exact file-name matches first (e.g. Dockerfile, .gitignore), then file extensions, then falls back to a generic file icon.`
                },
                sizes: {
                    title: `Sizes`,
                    description: `The same icon at several pixel sizes. The size prop sets both width and height; the underlying SVG scales without quality loss.`
                },
                fallback: {
                    title: `Unknown extensions`,
                    description: `When upstream finds no specific match, it returns the generic file icon. Only if the SVG itself fails to load does FileIcon fall back further to a lucide File glyph.`
                }
            },
            codeSnippet: {
                block: {
                    title: `Multi-line block`,
                    description: `Tokenized via Monaco's colorize API and styled with the current code theme — no editor is mounted. Use for short illustrative snippets that need their own visual block.`
                },
                inline: {
                    title: `Inline in prose`,
                    description: `Inline mode renders a styled <code>-style chip that sits in a sentence. Newlines are collapsed so the snippet always stays on one line.`
                },
                languages: {
                    title: `Languages`,
                    description: `Same component, different Monaco language ids. plaintext falls back to monospaced text with no token coloring.`
                },
                doc: {
                    installation: {
                        title: `Installation`,
                        commandTab: `Command`,
                        manualTab: `Manual`,
                        manualStep1: `Install the following dependencies:`,
                        manualStep2: `Copy and paste the following code into your project.`,
                        manualStep3: `Update the import paths to match your project setup.`
                    },
                    usage: {
                        title: `Usage`,
                        body: `Import <CodeSnippet> from the package and pass it the code string plus an optional language id. Choose mode="block" for stand-alone snippets, mode="inline" for chips that sit in a sentence.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<CodeSnippet> is a self-contained primitive. Monaco's colorize API runs in a deferred React.lazy chunk, so consumers that never render a snippet don't pay the Monaco bundle cost.`
                    },
                    examples: {
                        title: `Examples`,
                        block: {
                            title: `Multi-line block`,
                            description: `Tokenized via Monaco with the current code theme.`
                        },
                        inline: {
                            title: `Inline in prose`,
                            description: `Chip that lives inside a sentence — newlines are collapsed.`
                        },
                        languages: {
                            title: `Languages`,
                            description: `The same component with different Monaco language ids.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <CodeSnippet> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            blockFallback: `Block mode renders a <pre> fallback containing the raw code while Monaco loads.`,
                            inlineFallback: `Inline mode renders a <code> fallback containing the raw code while Monaco loads.`,
                            defaultMode: `Omitting the mode prop yields block mode.`,
                            forwardsClassName: `className and style props are forwarded to the rendered wrapper.`,
                            preservesMultiline: `Block-mode fallback preserves multi-line code verbatim.`,
                            rendersWithoutProvider: `Snippets render without a <MowsProvider> — the default code theme applies.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Code is direction-agnostic. Wrapping in dir="rtl" leaves source order intact; only surrounding prose flow flips.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <CodeSnippet>.`
                    }
                }
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
                timeLabel: `Copy current time`,
                toastLabel: `Copy with toast`,
                toastMessage: `Token copied to clipboard`
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
            globalContextMenu: {
                description: `Right-click an area with a matching data-actionscope to open the global context menu. Right-clicking a menu item executes it.`,
                rightClickHere: `right-click here`
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
            logView: {
                description: `Plain log view: feed it lines, it renders them. Auto-scrolls; scroll up to pause autoscroll. Optional search filter and clear button.`,
                hint: `Click "Push line" repeatedly to append sample server-style output. Clear empties the view via the onClear callback.`,
                searchPlaceholder: `Filter…`,
                empty: `No log lines yet.`,
                pushLine: `Push line`
            },
            terminal: {
                description: `Interactive terminal backed by xterm.js. The xterm code is in a lazy-loaded chunk so it's only fetched when a Terminal first mounts. Use the imperative ref (write / writeln / clear / focus / fit) to feed server output, and onData to forward keystrokes upstream. The onReady callback fires once the lazy chunk resolves — use it to print an initial banner.`,
                hint: `The demo wires a tiny "shell" — type a line and press Enter to see it echoed back. The greeting is printed on mount via onReady.`,
                clear: `Clear`
            },
            machineMonitor: {
                description: `VNC stream viewer backed by react-vnc / noVNC. The noVNC client is in a lazy-loaded chunk so it's only fetched when a MachineMonitor first mounts. Feed it a WebSocket URL pointing at a VNC-over-WebSocket bridge and it connects automatically.`,
                hint: `Enter a ws:// or wss:// URL to a VNC bridge and click Connect. Without a server the screen stays in its disconnected state — the lazy chunk is still loaded only on first mount.`,
                urlPlaceholder: `ws://localhost:5900`,
                connect: `Connect`,
                disconnect: `Disconnect`,
                sendCtrlAltDel: `Send Ctrl+Alt+Del`,
                readOnly: `Read-only (passive embed)`,
                status: {
                    connected: `Connected`,
                    disconnected: `Disconnected`
                },
                loadingLabel: `Loading VNC client…`
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
