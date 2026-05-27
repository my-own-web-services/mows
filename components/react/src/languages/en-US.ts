import baseEn from "../../lib/lib/languages/en-US/default";
import type { Translation } from "../languages";
import { ExampleActionIds } from "../exampleActions";

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
            creatingAppsLabel: `Creating Apps`
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
            }
        },
        examples: {
            _harness: {
                codeTab: `Code`,
                stateTab: `State`,
                noStateReported: `This example does not report state.`
            },
            steps: {
                horizontal: {
                    title: `Horizontal stepper`,
                    description: `Default horizontal layout. Status is derived from the controlled "current" index.`
                },
                endAlignment: {
                    title: `End alignment`,
                    description: `endAlignment toggles how the first and last steps anchor along the row. "side" (default) pushes them to the row edges with left/right label alignment; "center" centers every label under its indicator. In both modes the indicators stay evenly spaced.`
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
                loading: {
                    title: `Loading`,
                    description: `Per-step loading state. Pass loading={true} for an indeterminate spinner around the indicator, or loading={n} (0–100) for a determinate progress ring driven by your own state.`
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
                        endAlignment: {
                            title: `End alignment`,
                            description: `Side-by-side comparison of endAlignment="side" (first/last labels at the row edges) and endAlignment="center" (every label centered). Indicators stay evenly spaced in both.`
                        },
                        vertical: {
                            title: `Vertical`,
                            description: `Stack the steps vertically with the connector running between indicators.`
                        },
                        loading: {
                            title: `Loading`,
                            description: `Side-by-side comparison of loading={true} (indeterminate spinner) and loading={n} (determinate progress ring driven by component state).`
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
                            throwsOutsideSteps: `Rendering <Step> outside a <Steps> throws a descriptive error.`,
                            endAlignmentSide: `With endAlignment="side" the first step's label is left-aligned and the last step's label is right-aligned, while middle labels stay centered.`,
                            endAlignmentCenter: `With endAlignment="center" every step's label is centered under its indicator, including the first and last.`,
                            loadingIndeterminate: `Passing loading on a <Step> wraps the indicator in an indeterminate spinner ring.`,
                            loadingDeterminate: `Passing loading={n} (0–100, clamped) wraps the indicator in a determinate progress ring exposed as role="progressbar" with aria-valuenow.`
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
            sectionHeading: {
                default: {
                    title: `Default`,
                    description: `A single permalink heading. Hover the text to underline it and reveal the muted # marker; clicking pushes #<id> to the URL.`
                },
                levels: {
                    title: `Levels`,
                    description: `One <SectionHeading> per heading level (h1–h6). The component renders the requested level via React.createElement; styling is the consumer's responsibility (via className).`
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
                        body: `Import <SectionHeading> from the package and render it with an id (becomes the URL hash on click) and the heading level. Style the heading via className.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<SectionHeading> is a thin wrapper around the native <hN> element. It owns the anchor link, the hash push on click, and the hover-underline + dim # marker affordance. Visual styling is left to the consumer.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `A single h2 heading with the standard hover affordance.`
                        },
                        levels: {
                            title: `Levels`,
                            description: `All six heading levels rendered side by side.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <SectionHeading> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersLevel: `Renders the requested heading level (h1–h6) with the given id.`,
                            defaultsToH2: `Defaults to h2 when no level is provided.`,
                            anchorHref: `Wraps its text in an anchor whose href matches the id.`,
                            pushesHash: `Clicking the heading pushes #<id> to the URL via history.pushState.`,
                            noDuplicateHistory: `Does not push a duplicate history entry when the hash is already current.`,
                            preventsDefaultScroll: `Prevents the browser's default scroll so scrollToSection can run.`,
                            hoverUnderlineText: `Underlines only the heading text on hover, not the # marker.`,
                            dimMarker: `Renders a dim # marker that appears on hover and is not underlined.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Headings inherit direction from their DOM ancestor — wrap in dir="rtl" and the # marker flips to the start of the heading.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <SectionHeading>.`
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
            audioPlayer: {
                bar: {
                    title: `Bar variant`,
                    description: `A compact single-row pill that fits inside lists, comments, and table cells. The procedural waveform fills the available width.`
                },
                card: {
                    title: `Card variant`,
                    description: `A hero layout with artwork, title, and subtitle stacked above a taller waveform. Use as a dedicated playback surface in articles or detail pages.`
                },
                minimal: {
                    title: `Minimal variant`,
                    description: `A bar-style layout that swaps the waveform for a plain shadcn Slider — useful when the surrounding chrome is already dense or the waveform would feel decorative.`
                },
                peaks: {
                    title: `Provided peaks`,
                    description: `Pass an array of values in [0, 1] to the peaks prop when you already have analysed waveform data from the server.`
                },
                rtl: {
                    title: `Right-to-left`,
                    description: `Wrapped in dir="rtl", labels mirror but the play-head still moves left-to-right with the audio timeline.`
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
                        body: `Pass a resolved \`src\` URL — the player wires up a hidden \`<audio>\` element and renders a custom control surface on top.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `The bar variant is the default. Opt into the card with \`variant="card"\` and pass \`title\`, \`subtitle\`, and \`artwork\`. Supply \`peaks\` to override the procedural waveform with pre-computed analysis.`
                    },
                    examples: {
                        title: `Examples`,
                        bar: {
                            title: `Bar variant`,
                            description: `Compact player sized for inline use. The procedural waveform is derived deterministically from the source URL when no \`peaks\` prop is supplied.`
                        },
                        card: {
                            title: `Card variant`,
                            description: `Hero layout with artwork on the left and a taller waveform on the right.`
                        },
                        minimal: {
                            title: `Minimal variant`,
                            description: `Same pill chrome as the bar variant, but with a regular slider instead of the waveform — opt in when the surrounding context is already busy.`
                        },
                        peaks: {
                            title: `Provided peaks`,
                            description: `Override the procedural waveform with an explicit \`peaks\` array — useful when you've already analysed the source on the server.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements about how \`<AudioPlayer>\` should behave, each referencing the test that enforces it.`,
                        verifiedBy: `Verified by`,
                        statements: {
                            defaultBar: `Renders the \`bar\` variant when no \`variant\` prop is supplied.`,
                            cardVariant: `Renders the hero layout with title and subtitle when \`variant="card"\`.`,
                            playPauseToggle: `The play button shows the inverse label after the audio element fires play/pause.`,
                            muteToggle: `Clicking the mute button toggles the underlying \`audio.muted\` flag.`,
                            durationLoad: `Displays the total duration once \`loadedmetadata\` fires.`,
                            keyboardSpace: `Space on the player root toggles playback.`,
                            keyboardSkip: `ArrowRight skips forward by 5 seconds; ArrowLeft skips backward by the same.`,
                            errorAlert: `Surfaces an inline error row with a Retry button when the media element emits \`error\`.`,
                            peaksOverride: `Renders one bar per entry in the \`peaks\` prop instead of the procedural waveform.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under \`dir="rtl"\` the surrounding flex chrome mirrors. The waveform itself still flows in time order — the play-head moves with the audio timeline, not the page direction.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by \`<AudioPlayer>\`.`
                    }
                }
            },
            lyrics: {
                basic: {
                    title: `Basic LRC`,
                    description: `Time-synced lyrics parsed from a classic LRC string. The active line is highlighted and kept centred; inactive lines fade with distance.`
                },
                compact: {
                    title: `Compact variant`,
                    description: `Same parser, no auto-scroll, no fade — useful inside dense surfaces like a sidebar or card footer where the full lyric list is meant to be scanned at a glance.`
                },
                karaoke: {
                    title: `Word-level (enhanced LRC)`,
                    description: `Enhanced LRC sources sprinkle \`<mm:ss.xx>\` markers between words. The component highlights the active word as the timeline advances.`
                },
                synced: {
                    title: `Synced with audio`,
                    description: `Wired to an HTML \`<audio>\` element — press play to watch the active line follow the playhead. Clicking a line seeks the audio back.`
                },
                rtl: {
                    title: `Right-to-left`,
                    description: `Wrapped in \`dir="rtl"\`. Lines remain centred and time-ordered, but the surrounding text direction flips.`
                },
                syncedDemo: {
                    instructions: `Press play and watch the active line follow the playhead. Click any line to seek the audio back.`,
                    toggleAriaLabel: `Toggle playback`
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
                        body: `Feed the component a raw LRC string (or a pre-parsed \`ParsedLyrics\` value) plus the current playback time in seconds. The component finds the active line, optionally scrolls it into view, and exposes a seek callback so clicks on a line can drive your audio element.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `The \`scrolling\` variant is the default and auto-scrolls the active line to the centre. Switch to \`variant="compact"\` when you want a static list. Pair with any audio source by piping \`audio.currentTime\` into \`currentTime\` and pointing \`onSeek\` back at \`audio.currentTime\` — no special hook required.`
                    },
                    examples: {
                        title: `Examples`,
                        basic: {
                            title: `Basic LRC`,
                            description: `Drive the active line with a slider that stands in for an audio element. The procedural scroll behaviour keeps the active line in view.`
                        },
                        compact: {
                            title: `Compact variant`,
                            description: `Same source rendered without auto-scroll or fade — sized for tight surfaces.`
                        },
                        karaoke: {
                            title: `Word-level highlighting`,
                            description: `Enhanced LRC with per-word \`<mm:ss.xx>\` markers. The active word picks up the primary colour as time advances.`
                        },
                        synced: {
                            title: `Wired to <audio>`,
                            description: `Press play to drive the lyrics from a real HTML audio element. Clicking a line seeks the audio back.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements about how \`<Lyrics>\` should behave, each referencing the test that enforces it.`,
                        verifiedBy: `Verified by`,
                        statements: {
                            parsesMetadata: `Reads \`[ti:]\`, \`[ar:]\`, and \`[al:]\` tags out of the source string into the parsed metadata.`,
                            expandsRepeats: `Expands repeated \`[mm:ss.xx][mm:ss.xx]\` prefixes into separate lines so choruses appear once per timestamp.`,
                            karaokeWords: `Recognises enhanced LRC \`<mm:ss.xx>\` markers and exposes per-word timings on the parsed line.`,
                            appliesOffset: `Applies the \`[offset:ms]\` correction by shifting every timestamp.`,
                            activeIndex: `Selects the line whose start is the greatest value \`<= currentTime\`.`,
                            seekOnClick: `Fires \`onSeek\` with the clicked line's start time when interactive.`,
                            seekOnEnter: `Fires \`onSeek\` when Enter is pressed on a focused line.`,
                            emptySource: `Renders the empty state with \`data-state="empty"\` when the source has no usable lines.`,
                            noClickWithoutSeek: `Skips the interactive role entirely when no \`onSeek\` callback is wired up.`,
                            preparsed: `Accepts a pre-parsed \`ParsedLyrics\` value without re-running the parser.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Wrap the component in \`dir="rtl"\` to flip the surrounding text direction. Lines stay centred and time-ordered — only the inline content and prose around them mirror.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by \`<Lyrics>\`.`
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
                        body: `Import <FileIcon> from the package and pass a fileName. The component resolves the matching Material icon and falls back gracefully when nothing matches.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<FileIcon> bundles the full 1109-icon set as Vite assets so consumers don't need to mirror SVGs in their own public/. The resolved <img> can be swapped for a lucide File glyph if the SVG itself fails to load.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Common file types`,
                            description: `A grid of recognisable extensions and exact-name matches.`
                        },
                        sizes: {
                            title: `Sizes`,
                            description: `Same icon at several pixel sizes.`
                        },
                        fallback: {
                            title: `Unknown extensions`,
                            description: `What happens when no match is found.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <FileIcon> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            resolvesAll: `Resolves extensions, exact names, and the default fallback in priority order.`,
                            extension: `A file extension alone resolves to the matching icon.`,
                            exactName: `An exact file-name match wins over the extension.`,
                            defaultFallback: `Unknown extensions render the default file icon.`,
                            sizeForwarded: `The size prop forwards to width + height on the rendered <img>.`,
                            rerendersOnFileName: `Changing the fileName prop re-resolves to the new icon.`,
                            lucideFallback: `If the SVG itself fails to load, the lucide File fallback is shown.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The icon is a square <img> — its visual orientation is direction-agnostic. Wrapping in dir="rtl" leaves the icon unchanged.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <FileIcon>.`
                    }
                }
            },
            videoViewer: {
                default: {
                    title: `Progressive MP4`,
                    description: `Standard video/mp4 served progressively via MediaSource Extensions. The seek-bar tooltip surfaces a real-time thumbnail of the hovered/dragged frame: a hidden off-screen <video> + <canvas> grabs frames on demand and the main player canvas updates live as you scrub, with the slider thumb pinned to the cursor until the seek lands so it never snaps back while the new range buffers.`
                },
                dash: {
                    title: `DASH manifest`,
                    description: `application/dash+xml with multiple bitrate renditions. The quality button shows whichever variant Shaka's ABR is currently playing; picking a specific rendition disables ABR, picking Auto re-enables it. When the manifest declares a thumbnail AdaptationSet, the seek tooltip swaps the frame-grab tile for the pre-rendered sprite.`
                },
                hls: {
                    title: `HLS playlist`,
                    description: `application/vnd.apple.mpegurl multi-rendition playlist. Same dispatch path as DASH — Shaka parses both through the same Player and the same control behaviours (quality menu, captions menu, drag-scrub preview) apply.`
                },
                chapters: {
                    title: `Chapters`,
                    description: `Hand <VideoViewer> a chapters array and the seek bar grows tick marks at every boundary while the hover/drag tooltip surfaces the matching chapter title above the timestamp.`
                },
                controls: {
                    title: `Controls showcase`,
                    description: `Switch between progressive, DASH, and HLS sources to exercise every control. Move the pointer to keep the bar visible; tab into the player and press space, arrows, m, f, p, or c to use the keyboard shortcuts. The playback-rate popover hosts both a continuous slider (0.25× – 3×) and preset chips.`
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
                        body: `Hand <VideoViewer> a resolved src URL and a mimeType. It plays standard video/* formats progressively (via MediaSource) and DASH/HLS manifests with adaptive bitrate. The backend must support HTTP Range requests and expose Content-Range / Accept-Ranges / Content-Length via CORS.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<VideoViewer> is normally reached via <FileViewer>, which lazy-loads it behind a Suspense boundary so non-video callers don't pay the ~256 kB shaka-player cost. Direct usage works too — wrap it in a sized container.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Progressive MP4`,
                            description: `Standard video/mp4 via MediaSource. Demonstrates the live drag-scrub: the main player canvas updates as the cursor moves, the floating tooltip shows a frame-grabbed thumbnail + timestamp at every position, and the slider stays pinned to the release point until <currentTime> catches up (5 s watchdog if a seek silently fails).`
                        },
                        dash: {
                            title: `DASH manifest`,
                            description: `Multi-bitrate DASH. The Quality button shows what ABR picked; the menu's Auto entry surfaces the same in parens plus a tier badge. Manifests that ship a thumbnail track will swap the frame-grab preview for the pre-rendered sprite automatically.`
                        },
                        hls: {
                            title: `HLS playlist`,
                            description: `Multi-rendition HLS — same dispatch as DASH. Hover/drag the bar to see the frame-grab fallback work for HLS-served files just like for MP4.`
                        },
                        chapters: {
                            title: `Chapters`,
                            description: `Pass a chapters array to render YouTube-style tick marks on the seek bar at every chapter boundary. The hover/drag tooltip surfaces the matching chapter title next to the timestamp, so the user sees both 'where in the clip' and 'which chapter'.`
                        },
                        controls: {
                            title: `Controls showcase`,
                            description: `Cycle between progressive, DASH, and HLS sources to exercise every control + keyboard shortcut. The playback-rate popover hosts a continuous slider (0.25× – 3×) alongside preset chips.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <VideoViewer> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            dispatchByMime: `<FileViewer> dispatches video/* mime types to <VideoViewer>.`,
                            dispatchManifest: `<FileViewer> dispatches DASH and HLS manifest mime types to <VideoViewer>.`,
                            recognisesManifests: `The isVideoOrStream helper matches video/* plus every supported streaming-manifest mime type.`,
                            constructsOnePlayer: `Each mount installs Shaka polyfills once and constructs exactly one Player.`,
                            nativeFallback: `When shaka.Player.isBrowserSupported() returns false, the component falls back to a native <video controls> element.`,
                            reusesOnSrcChange: `Changing the src prop re-loads the existing Player instead of constructing a new one.`,
                            cleansUpOnUnmount: `Unmounting calls Player.destroy() exactly once.`,
                            keyboardTogglePlay: `Space and k toggle play / pause on the focused player.`,
                            keyboardModifierGuard: `Keyboard shortcuts ignore modifier-combined presses so browser shortcuts (Cmd+F, Ctrl+R, …) keep working.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The video surface is direction-agnostic. The control bar lays out its right-aligned action cluster with logical (start/end) flex order, so dir="rtl" inverts the cluster correctly without extra wiring.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <VideoViewer>.`
                    }
                }
            },
            codeThemePicker: {
                popover: {
                    title: `Popover trigger`,
                    description: `Default form: a trigger button that opens a searchable theme list in a popover. Use when the picker needs to live inside a settings menu.`
                },
                standalone: {
                    title: `Standalone`,
                    description: `Renders the search + list inline without the popover trigger. Use when the picker is the whole UI (e.g. a dedicated theme-switcher page).`
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
                        body: `Import <CodeThemePicker> and render it. It reads the available code themes and the currently active one from <MowsProvider>, and calls setCodeTheme on selection.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<CodeThemePicker> wires Radix Popover + Command (with search) to the <MowsProvider> code-theme state. Set standalone to skip the popover and inline the searchable list.`
                    },
                    examples: {
                        title: `Examples`,
                        popover: {
                            title: `Popover trigger`,
                            description: `Trigger button + popover list.`
                        },
                        standalone: {
                            title: `Standalone`,
                            description: `Inline searchable list, no popover.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <CodeThemePicker> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            showsCurrent: `Shows the current code theme name on the trigger.`,
                            listsAll: `Lists every registered theme when opened (standalone).`,
                            callsSetCodeTheme: `Calls setCodeTheme on the surrounding MowsContext when a theme is picked.`,
                            filtersBySearch: `Filters the theme list by the typed search query.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The picker inherits direction from its DOM ancestor — wrap in dir="rtl" and the trigger + search field flip to right-to-left.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <CodeThemePicker>.`
                    }
                }
            },
            codeViewer: {
                default: {
                    title: `Default`,
                    description: `A read-only Monaco-backed code view with line numbers, syntax highlighting, and word-wrap.`
                },
                editable: {
                    title: `Editable`,
                    description: `Set editable to let the user type. Bind onCodeChange to receive the new value as the user edits.`
                },
                fitContent: {
                    title: `Fit to content`,
                    description: `fitContent sizes the wrapper to Monaco's content height — no internal scrollbar. Pair with <ExpandableCode> to collapse long snippets.`
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
                        body: `Import <CodeViewer> and pass it code + language. The Monaco bundle is loaded lazily via React.lazy, so apps that don't render the viewer don't pay the bundle cost.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<CodeViewer> wraps Monaco's standalone editor with sensible defaults (line numbers / wrap / whitespace markers / syntax highlighting). It honours the active code theme from <MowsProvider>; consumers can override individual display options per-instance.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Read-only view with line numbers and syntax highlighting.`
                        },
                        editable: {
                            title: `Editable`,
                            description: `editable + onCodeChange turns the viewer into a small editor.`
                        },
                        fitContent: {
                            title: `Fit to content`,
                            description: `Wrapper grows to fit Monaco's full content height.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <CodeViewer> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersLazyEditor: `Renders the lazy-loaded Monaco editor with the supplied code.`,
                            forwardsClassName: `Forwards className to the editor wrapper.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Source code is direction-agnostic. Wrapping in dir="rtl" keeps token order intact; only surrounding prose flow flips.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <CodeViewer>.`
                    }
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
            },
            primaryMenu: {
                inline: {
                    title: `Inline`,
                    description: `Full-width trigger that fits in a sidebar footer or row — clicks open the dropdown above/below the trigger.`
                },
                fixed: {
                    title: `Fixed`,
                    description: `Pins the trigger to a viewport corner. In a real app it sits on top of every page; the preview uses a positioned wrapper to contain it.`
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
                        body: `Mount <PrimaryMenu> exactly once inside <MowsProvider>. It exposes Login / Logout, the language / theme / code-theme pickers, the keyboard-shortcut editor, and the settings modal.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<PrimaryMenu> composes <DropdownMenu> with the picker components and the modal manager. The "fixed" variant pins to a viewport corner; the "inline" variant adapts to a sidebar footer.`
                    },
                    examples: {
                        title: `Examples`,
                        inline: {
                            title: `Inline`,
                            description: `variant="inline" — full-width trigger.`
                        },
                        fixed: {
                            title: `Fixed`,
                            description: `Default variant — pins to top-right.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <PrimaryMenu> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            loginVisibleWhenAuthConfigured: `Shows the Login entry when auth is configured and the user is not signed in.`,
                            loginHiddenWhenAuthNotConfigured: `Hides the Login entry entirely when no OIDC config was passed to <MowsProvider>.`,
                            providerWithoutOidcYieldsNoAuth: `A real <MowsProvider> mounted without an oidc prop yields authConfigured=false — and no Login entry appears.`,
                            dropsLeadingSeparator: `Drops the leading separator above Language when there is no auth section to separate from.`,
                            keepsSeparatorWithLogin: `Keeps the separator between Login and Language when the Login entry is visible.`,
                            inlineRendersFullWidth: `variant="inline" renders a full-width trigger (no fixed positioning) and shows the user display name next to the avatar when logged in.`,
                            inlineLoggedOutMenuIcon: `variant="inline" renders the menu icon only (no text) when logged out — the openMenu label lives on the title attribute.`,
                            staleSessionTreatedAsLoggedOut: `A cached authenticated session is treated as logged out when authConfigured=false — neither Login nor Logout entries appear.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The menu inherits text direction from its ancestor. Wrap in dir="rtl" to mirror the avatar / icon / chevron order in the trigger.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <PrimaryMenu>.`
                    }
                }
            },
            globalContextMenu: {
                default: {
                    title: `Right-click target`,
                    description: `A bordered drop zone whose data-actionscope is wired to the GlobalContextMenu. Right-click inside the box to open the menu at the cursor.`
                },
                submenus: {
                    title: `Submenus`,
                    description: `An ActionHandler whose children() returns more actions renders as a submenu. No special menu primitive in your call site — declare data, the menu picks DropdownMenuSub automatically.`
                },
                modifierVariants: {
                    title: `Modifier-key variants`,
                    description: `An action can declare variants keyed by held modifiers. Holding Shift live-morphs the label from "Move to bin" to "Delete permanently"; a Shift-held click skips the confirm. The executed branch is re-resolved from event.shiftKey, so releasing Shift before the click safely reverts to the default.`
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
                        body: `Mount <GlobalContextMenu> once inside <MowsProvider>. Any descendant element carrying data-actionscope="<scope>" intercepts the native context menu and opens the menu at the cursor with the actions registered for that scope.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<GlobalContextMenu> walks up the DOM from the right-click target looking for the nearest [data-actionscope], asks the <ActionManager> for matching actions, and renders them through <DropdownMenu>.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Right-click target`,
                            description: `The dashed area below carries data-actionscope; right-click inside it.`
                        },
                        submenus: {
                            title: `Submenus`,
                            description: `Right-click — "Share" opens into Copy link / Email / Slack via an ActionHandler.children resolver.`
                        },
                        modifierVariants: {
                            title: `Modifier-key variants`,
                            description: `Right-click on the target, then hold Shift to switch the affordance from "Move to bin" to "Delete permanently". The State tab below records which branch ran.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <GlobalContextMenu> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            positionsAtCursor: `Positions the trigger wrapper at the exact cursor coordinates so the menu opens under the click.`,
                            sideOffsetZero: `Opens with sideOffset=0 so the menu top edge starts at the cursor, not below it.`,
                            suppressesNativeOnlyWhenMatched: `Only suppresses the native context menu when the action scope under the cursor has at least one registered action.`,
                            doesNotSuppressWhenScopeEmpty: `Lets the native context menu through when the scope under the cursor has no actions registered.`,
                            clickItemDispatches: `Selecting a menu entry dispatches the action and prevents the native context menu.`,
                            updatesOnSecondClick: `Updates the cursor position on every subsequent right-click instead of staying anchored to the first one.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The menu inherits direction from its ancestor; menu entries flip when wrapped in dir="rtl". Cursor anchoring uses viewport coordinates and is direction-agnostic.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <GlobalContextMenu>.`
                    }
                }
            },
            copyValueButton: {
                label: {
                    title: `With label`,
                    description: `Shows the label next to the copy icon. Use when the value isn't visible elsewhere.`
                },
                iconOnly: {
                    title: `Icon only`,
                    description: `Omit the label for compact placements (e.g. inside a token row).`
                },
                withToast: {
                    title: `With toast`,
                    description: `Set toastOnCopy to fire a Sonner toast on successful copy. Pass a string to override the default "Copied" message.`
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
                        body: `Pass a value. Clicks copy it to the clipboard and flip the icon to a checkmark for ~1.5s.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<CopyValueButton> wraps navigator.clipboard with a transient "copied" state and an optional Sonner toast. The visible label is optional — pass title to expose the full value via the native tooltip.`
                    },
                    examples: {
                        title: `Examples`,
                        label: {
                            title: `With label`,
                            description: `Label next to the icon.`
                        },
                        iconOnly: {
                            title: `Icon only`,
                            description: `No label — for inline placements.`
                        },
                        withToast: {
                            title: `With toast`,
                            description: `Fires a Sonner toast on copy.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <CopyValueButton> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersLabelWhenProvided: `Renders the label when one is provided.`,
                            omitsLabelWhenAbsent: `Omits the label when none is provided.`,
                            writesClipboardOnClick: `Writes the value to the clipboard on click.`,
                            showsCopiedTitleTransient: `Shows the "Copied!" title for ~1.5s after a successful copy, then reverts.`,
                            firesToastWhenTrue: `Fires a toast when toastOnCopy is true (default message).`,
                            usesProvidedToastMessage: `Uses the provided string as the toast message when toastOnCopy is a string.`,
                            noToastWhenOmitted: `Does not fire a toast when toastOnCopy is omitted.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Wrapping in dir="rtl" swaps the label/icon order so the icon sits to the left of the label.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <CopyValueButton>.`
                    }
                }
            },
            buttonSelect: {
                default: {
                    title: `Default`,
                    description: `Three options grouped into one segmented control. The selected option uses the accent background; others use the outline variant.`
                },
                disabled: {
                    title: `Disabled group`,
                    description: `disabled disables every option in the group. Use for a read-only segmented control.`
                },
                disabledOption: {
                    title: `Disabled option`,
                    description: `Per-option disabled — only that option is inert; the rest still respond to clicks.`
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
                        body: `Pass options as { id, icon, label?, disabled? } and a controlled selectedId. onSelectionChange fires with the new id.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<ButtonSelect> stacks <Button> primitives into a segmented group, sharing borders so it reads as a single control. role="group" is set on the outer wrapper; aria-pressed reflects the selected option.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Three options, one selected.`
                        },
                        disabled: {
                            title: `Disabled group`,
                            description: `All options disabled.`
                        },
                        disabledOption: {
                            title: `Disabled option`,
                            description: `One option disabled.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <ButtonSelect> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersAllOptions: `Renders every option as a button in the group.`,
                            selectedDefaultVariant: `Marks the selected option with the accent background.`,
                            nonSelectedOutline: `Renders non-selected options with the outline variant.`,
                            clickFiresChange: `Calls onSelectionChange when an option is clicked.`,
                            disabledOptionNoChange: `Does not call onSelectionChange when a disabled option is clicked.`,
                            groupDisabledNoChange: `Does not call onSelectionChange when the entire group is disabled.`,
                            forwardsClassName: `Forwards className onto the outer group wrapper.`,
                            forwardsStyle: `Forwards style onto the outer group wrapper.`,
                            accessibility: `Exposes role="group" and an aria-pressed attribute reflecting the selected option.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The segmented control follows the surrounding text direction. Inside dir="rtl" the first option sits on the right and rounds the right edge.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <ButtonSelect>.`
                    }
                }
            },
            settingsPanel: {
                default: {
                    title: `Default`,
                    description: `Three sections: Appearance, Code editor, Language. A second tab exposes the live JSON so power-users can paste a settings blob.`
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
                        body: `Mount <SettingsPanel> inside <MowsProvider>. It reads / writes theme, code theme, language, code editor settings and toast settings on the surrounding context.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<SettingsPanel> stitches together <ThemePicker>, <CodeThemePicker>, <LanguagePicker>, the code-editor toggles and the toast position picker, plus a JSON tab that round-trips the entire MowsSettings object.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `The full panel inside a 640px-tall container.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <SettingsPanel> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            threeHeadings: `Renders the three section headings (Appearance, Code editor, Language).`,
                            standalonePickersShowCurrent: `Uses the standalone-style theme / code-theme / language pickers and shows their current values.`,
                            jsonTabShowsSettings: `Switching to the JSON tab shows the live current settings.`,
                            jsonSaveAppliesEdit: `Editing the JSON and clicking Save applies the new settings on the surrounding context.`,
                            notificationsSection: `Renders the Notifications section with the toast position picker.`,
                            jsonIncludesToast: `Includes toast settings in the JSON view.`,
                            toastPositionFromJson: `Applies toast.position from edited JSON to the surrounding context.`,
                            jsonErrorOnInvalid: `Shows an error message when the edited JSON is invalid.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Section layout mirrors under dir="rtl"; the JSON tab is direction-agnostic.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <SettingsPanel>.`
                    }
                }
            },
            terminal: {
                default: {
                    title: `Default`,
                    description: `Lazy-loaded xterm.js surface with a tiny echo "shell" wired through onData. Click "Clear" to call the imperative handle.`
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
                        body: `<Terminal> is a lazy-loaded xterm.js surface. The consumer drives the terminal via the imperative TerminalHandle (write / writeln / clear / focus / fit) instead of a "value" prop.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Pair <Terminal> with onData (user input) and onReady (initial banner / focus). xterm + its CSS (~250 KB) load lazily — consumers that never mount a <Terminal> never pay the cost.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Echo shell`,
                            description: `Tiny in-process "shell" that echoes typed characters and prints a fake prompt on Enter.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Terminal> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            suspendsAndMounts: `Shows the suspense fallback while the xterm chunk resolves, then mounts xterm.`,
                            forwardsHandle: `Forwards the imperative handle (write / writeln / clear / focus / fit) through the lazy boundary.`,
                            firesOnData: `Invokes onData when xterm reports user input.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Terminal output is line-oriented and direction-agnostic. xterm itself does not reverse glyph order under dir="rtl".`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Terminal> and the TerminalHandle exposed via ref.`
                    }
                }
            },
            logView: {
                default: {
                    title: `Push lines`,
                    description: `Each click appends one line and the view autoscrolls to the bottom. The search input filters by case-insensitive substring; the trash icon calls onClear.`
                },
                hideToolbar: {
                    title: `Without toolbar`,
                    description: `hideToolbar removes search + clear — useful when the surrounding chrome already supplies them.`
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
                        body: `<LogView> is fully controlled — the consumer owns the lines array and the clear handler. The view autoscrolls to the bottom while the user is at the bottom; scrolling up pauses autoscroll until the user scrolls back down.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<LogView> wraps a <ScrollArea> with a toolbar (<SearchInput> + clear button). Localise via placeholders. Pass hideToolbar when the toolbar lives outside the view.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Push lines`,
                            description: `Click "Push line" to append a sample line; search filters in real time.`
                        },
                        hideToolbar: {
                            title: `Without toolbar`,
                            description: `Just the scrolling viewport — for embeds where the toolbar lives elsewhere.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <LogView> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersAllLines: `Renders every line from the lines prop.`,
                            emptyPlaceholder: `Shows the empty placeholder when there are no lines.`,
                            filtersBySearch: `Filters lines by case-insensitive substring match.`,
                            emptyWhenFilteredOut: `Shows the empty placeholder when the filter matches no lines.`,
                            hidesClearWhenNoCallback: `Hides the clear button when onClear is omitted.`,
                            invokesOnClear: `Invokes onClear when the clear button is clicked.`,
                            hideToolbar: `Hides the toolbar when hideToolbar is set.`,
                            reflectsLineUpdates: `Reflects updated lines when the prop changes.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Lines remain in source order; the toolbar mirrors under dir="rtl" so the clear button sits on the leading edge.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <LogView>.`
                    }
                }
            },
            machineMonitor: {
                default: {
                    title: `Connect to a VNC server`,
                    description: `Paste a ws:// or wss:// URL and click Connect. The viewer lazy-loads the react-vnc bundle on the first connection.`
                },
                readOnly: {
                    title: `Read-only preview`,
                    description: `readOnly implies viewOnly AND prevents auto-focus on hover, suppresses the dot cursor, and lets the page scroll through the canvas.`
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
                        body: `<MachineMonitor> is a lazy-loaded react-vnc / @novnc/novnc wrapper. Provide either url or a pre-constructed websocket; everything else is driven through the imperative MachineMonitorHandle.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<MachineMonitor> wraps the VncScreen with a Suspense fallback, optional pointer-events suppression for readOnly previews, and an imperative handle that exposes connect / disconnect / sendCtrlAltDel / clipboardPaste / shutdown / reboot / reset.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Live connection`,
                            description: `Enter a ws:// URL and connect. The example in the docs has no server attached.`
                        },
                        readOnly: {
                            title: `Read-only preview`,
                            description: `readOnly forces viewOnly and suppresses pointer events.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <MachineMonitor> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            remountsOnUrl: `Remounts the inner VncScreen when the url prop changes.`,
                            readOnlyForcesViewOnly: `readOnly forces viewOnly + disables focusOnClick and the dot cursor.`,
                            readOnlyPointerEventsNone: `readOnly wraps the canvas in a pointer-events:none element so the page can scroll through it.`,
                            noPointerEventsWithoutReadOnly: `Does not set pointer-events:none when readOnly is omitted.`,
                            preservesExplicitViewOnly: `Preserves an explicit viewOnly prop when readOnly is not set.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The remote framebuffer is the server's responsibility; the wrapper is direction-agnostic.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <MachineMonitor> and the MachineMonitorHandle exposed via ref.`
                    }
                }
            },
            sidebar: {
                default: {
                    title: `Header / content / footer`,
                    description: `Composed from <SidebarHeader>, <SidebarContent> (with <SidebarGroup> + <SidebarMenu>) and <SidebarFooter>. collapsible="icon" keeps the icon strip visible when collapsed.`
                },
                iconCollapsible: {
                    title: `Collapsible to icon strip`,
                    description: `<Sidebar collapsible="icon"> snaps between the full <SidebarProvider> width and a 3rem icon-only strip. The strip is driven by the open/collapsed state on <SidebarProvider>; <SidebarTrigger> toggles it, and ⌘B / Ctrl+B does the same globally.`
                },
                collapsibleGroups: {
                    title: `Collapsible groups`,
                    description: `Wrap each <SidebarMenuItem> in a <Collapsible> and put the sub-items inside <SidebarMenuSub>. The chevron rotates from the group's data-state, and the sub-list renders the vertical accent line on its leading edge.`
                },
                resizable: {
                    title: `Resizable`,
                    description: `Drag the right edge of the sidebar to resize. Width is clamped to [minWidthPx, maxWidthPx] and persisted to the sidebar_width cookie. Double-click the handle to reset to defaultWidthPx.`
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
                        body: `Wrap the surrounding chrome in <SidebarProvider> and place <Sidebar> wherever the rail should live. The provider owns the open / collapsed / width state; useSidebar() exposes it to descendants.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<Sidebar> composes Header / Content / Footer slots, with Group / GroupLabel / GroupContent / Menu / MenuItem / MenuButton for menu trees. <SidebarProvider> stores open + width in cookies so layout survives a reload.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Header / content / footer`,
                            description: `A static sidebar with three menu entries.`
                        },
                        iconCollapsible: {
                            title: `Collapsible to icon strip`,
                            description: `Click the toggle in the header (or press ⌘B / Ctrl+B) to snap the sidebar between full width and the icon-only strip. Labels collapse behind tooltips when narrow.`
                        },
                        collapsibleGroups: {
                            title: `Collapsible groups`,
                            description: `Top-level groups with an icon and a chevron that rotates when expanded. Sub-items render under a vertical accent line.`
                        },
                        resizable: {
                            title: `Resizable`,
                            description: `Drag the right edge to resize; double-click to reset.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Sidebar> + <SidebarProvider> are expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            cssVarApplies: `Uses Tailwind v4 var() syntax so the width custom property actually applies.`,
                            seedsDefaultWidth: `Seeds the --sidebar-width custom property from defaultWidthPx on mount.`,
                            rendersHandleWhenResizable: `Renders the resize handle when resizable is set.`,
                            noHandleWhenNotResizable: `Does not render the resize handle when resizable is false.`,
                            dragPersists: `Updates the width on drag and persists the result to the sidebar_width cookie.`,
                            clampsToMax: `Clamps drag to maxWidthPx.`,
                            clampsToMin: `Clamps drag to minWidthPx.`,
                            doubleClickReset: `Double-clicking the handle resets the width to defaultWidthPx.`,
                            restoresFromCookie: `Restores a persisted width from the sidebar_width cookie on mount.`,
                            reclampsPersisted: `Re-clamps a persisted width that falls outside the current [min, max] bounds.`,
                            dragsInwardOnRight: `Drags inward when the sidebar is anchored to the right side.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the sidebar still pins to its declared side; only inner content flips. side="right" + RTL effectively mirrors the LTR layout.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by the most common Sidebar surfaces. The full set (Header / Footer / Group / Menu …) is exported from @mows/react-components.`
                    }
                }
            },
            tabs: {
                default: {
                    title: `Default`,
                    description: `Uncontrolled — pass defaultValue and let <Tabs> manage the active tab.`
                },
                disabled: {
                    title: `Disabled trigger`,
                    description: `Mark a trigger disabled to lock the panel out of UI navigation. The corresponding content is unreachable.`
                },
                controlled: {
                    title: `Controlled`,
                    description: `Pass value + onValueChange to drive the tabs from outside.`
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
                        body: `<Tabs> is Radix Tabs in shadcn's new-york style. Each <TabsTrigger value> must match exactly one <TabsContent value>.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Compose <Tabs> with <TabsList> (the trigger row) and <TabsContent> panels. defaultValue / value control the active panel; disabled disables individual triggers; orientation switches keyboard arrow navigation.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Three triggers, one active.`
                        },
                        disabled: {
                            title: `Disabled trigger`,
                            description: `The third trigger is disabled — its panel can't be reached.`
                        },
                        controlled: {
                            title: `Controlled`,
                            description: `value + onValueChange drive the active tab from outside.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Tabs> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            showsDefaultPanel: `Shows the panel matching defaultValue on first render.`,
                            switchesOnClick: `Switches the visible panel when a trigger is clicked.`,
                            dataStateActive: `Marks the active trigger via data-state="active" / "inactive".`,
                            disabledNoActivate: `Does not activate a disabled trigger.`,
                            controlledValue: `Honours a controlled value prop — the active panel follows the parent's state.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the trigger row mirrors and arrow-key navigation flips direction so Left/Right go to the visually-adjacent trigger.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Tabs>, <TabsTrigger> and <TabsContent>.`
                    }
                }
            },
            badge: {
                default: {
                    title: `Default`,
                    description: `The default variant uses the primary colour and renders solid against the page background.`
                },
                variants: {
                    title: `Variants`,
                    description: `Every available variant. The four semantic status variants (success / warning / info / muted) are app-wide conventions for resource state.`
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
                        body: `<Badge> is a small inline element that surfaces status. Pass children for the label and optionally a variant for the colour treatment.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<Badge> wraps its children in a styled div. All standard HTML div attributes forward to the rendered element.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `The base variant.`
                        },
                        variants: {
                            title: `Variants`,
                            description: `Eight visual treatments.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Badge> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersChildren: `Renders its children inside the badge surface.`,
                            defaultVariantClasses: `Applies the default variant classes (bg-primary / text-primary-foreground) when no variant is provided.`,
                            eachVariantClasses: `Each variant applies its expected background + foreground tailwind classes (secondary / destructive / outline / success / warning / info / muted).`,
                            forwardsClassName: `Forwards an extra className without dropping the variant classes.`,
                            forwardsAttributes: `Forwards arbitrary HTML attributes (e.g. data-*) onto the rendered element.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Badges are direction-agnostic — content order inside the badge follows the text direction of the surrounding container.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Badge>.`
                    }
                }
            },
            button: {
                default: {
                    title: `Default`,
                    description: `The base button — primary background, default size.`
                },
                variants: {
                    title: `Variants`,
                    description: `Six built-in visual treatments. The iconStandalone variant is a transparent-background variant used for icon-only buttons that should not have any container chrome.`
                },
                sizes: {
                    title: `Sizes`,
                    description: `sm / default / lg + three icon-* sizes for square icon buttons.`
                },
                asChild: {
                    title: `asChild`,
                    description: `Render the button styling onto its single child element via Radix Slot — typical use is rendering a link with button styling without nesting a <button> inside an <a>.`
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
                        body: `<Button> renders a native <button> with the shadcn variant + size classes applied. Forward any native button attribute (onClick, type, disabled, …).`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Use asChild to render the styling onto a single child element instead of a native <button> — the typical case is wrapping a <Link> or <a>.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `The base button.`
                        },
                        variants: {
                            title: `Variants`,
                            description: `default / secondary / destructive / outline / ghost / link.`
                        },
                        sizes: {
                            title: `Sizes`,
                            description: `sm / default / lg + three icon-* sizes.`
                        },
                        asChild: {
                            title: `asChild`,
                            description: `Forward the styling onto an <a>.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Button> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersNativeButton: `Renders a native <button> element when asChild is not set.`,
                            defaultVariantAndSize: `Applies the default variant + size when none is provided.`,
                            appliesVariants: `Each variant applies its expected tailwind classes (destructive / outline / secondary / ghost / link / iconStandalone).`,
                            appliesSizes: `Each size applies its expected height / padding tailwind classes (sm / lg / icon / icon-sm / icon-lg / icon-xs).`,
                            firesOnClick: `Fires onClick when clicked.`,
                            noClickWhenDisabled: `Does not fire onClick when disabled.`,
                            asChildRendersChild: `asChild renders the child element (e.g. <a>) instead of a native button, with the button styling applied.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Buttons inherit text direction from their ancestor; icon + label order flips under dir="rtl".`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Button>.`
                    }
                }
            },
            card: {
                default: {
                    title: `Header / content / footer`,
                    description: `A full card with title + description in the header, body content, and action buttons in the footer.`
                },
                headerOnly: {
                    title: `Header only`,
                    description: `Cards work fine with just a header — every slot is optional.`
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
                        body: `Compose <Card> with the header / title / description / content / footer slots. Each slot is independent — omit any of them and the surrounding spacing still works.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Every Card slot is a plain forwardRef'd div with shadcn typography + padding classes. All standard HTML div attributes forward to the rendered element.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Header / content / footer`,
                            description: `Full card with all slots populated.`
                        },
                        headerOnly: {
                            title: `Header only`,
                            description: `Just <CardHeader> with title + description.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how the Card surfaces are expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            shell: `Renders the card shell with rounded border + card background.`,
                            slotOrder: `Renders header / title / description / content / footer in DOM order.`,
                            titleTypography: `<CardTitle> carries the heading typography classes (font-semibold, text-2xl).`,
                            descriptionColour: `<CardDescription> uses the muted-foreground colour token.`,
                            refForwarding: `Every Card subcomponent forwards a ref to its rendered div.`,
                            classNameMerge: `Every Card subcomponent merges a forwarded className with its base classes.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Cards are direction-agnostic; inner flex containers (footer, header) mirror under dir="rtl" so action buttons stay on the leading edge.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `All Card subcomponents share the same props — they're each a forwardRef'd div.`
                    }
                }
            },
            checkbox: {
                default: {
                    title: `Default`,
                    description: `Wrap inside <Label> so clicks on the label toggle the checkbox.`
                },
                indeterminate: {
                    title: `Indeterminate`,
                    description: `Pass checked="indeterminate" to render the dash glyph — useful for "select-all" headers when a partial selection exists.`
                },
                disabled: {
                    title: `Disabled`,
                    description: `disabled disables both states (unchecked and checked).`
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
                        body: `<Checkbox> is tri-state — pass true / false / "indeterminate" via checked. onCheckedChange fires with the new value.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<Checkbox> wraps the Radix Checkbox primitive and renders the Lucide Check icon for the indicator. Wrap inside <Label> for a clickable label.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Controlled checkbox inside a <Label>.`
                        },
                        indeterminate: {
                            title: `Indeterminate`,
                            description: `Tri-state mode.`
                        },
                        disabled: {
                            title: `Disabled`,
                            description: `Both unchecked and checked variants disabled.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Checkbox> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            defaultUnchecked: `Renders an unchecked checkbox by default (data-state="unchecked").`,
                            indicatorWhenChecked: `Renders the check indicator only when checked.`,
                            defaultCheckedOnMount: `Reflects defaultChecked on first mount.`,
                            firesOnCheckedChange: `Fires onCheckedChange on click in uncontrolled mode.`,
                            fullyControllable: `Is fully controllable via checked + onCheckedChange.`,
                            noToggleWhenDisabled: `Does not toggle when disabled.`,
                            indeterminateDataState: `Exposes the indeterminate state via data-state="indeterminate".`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The checkbox is a square — direction-agnostic. Label + checkbox order follows the surrounding text direction.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Checkbox>.`
                    }
                }
            },
            switch: {
                default: {
                    title: `Default`,
                    description: `Boolean on/off — no indeterminate state.`
                },
                disabled: {
                    title: `Disabled`,
                    description: `disabled disables both off and on states.`
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
                        body: `<Switch> is the Radix Switch primitive — a boolean on/off toggle. onCheckedChange fires with the new boolean.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<Switch> wraps the Radix Switch primitive. Wrap inside <Label> so clicking the label toggles it. Unlike <Checkbox>, there is no indeterminate state.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Controlled switch inside a <Label>.`
                        },
                        disabled: {
                            title: `Disabled`,
                            description: `Disabled off / disabled on.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Switch> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            defaultUnchecked: `Renders unchecked by default (data-state="unchecked").`,
                            defaultCheckedOnMount: `Reflects defaultChecked on first mount.`,
                            firesOnCheckedChange: `Fires onCheckedChange on click in uncontrolled mode.`,
                            fullyControllable: `Is fully controllable via checked + onCheckedChange.`,
                            noToggleWhenDisabled: `Does not toggle when disabled.`,
                            thumbTranslates: `Thumb translates only when checked.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The switch track is laid out horizontally. Under dir="rtl" the thumb still slides from the leading edge to the trailing edge — which visually mirrors LTR behaviour.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Switch>.`
                    }
                }
            },
            collapsible: {
                default: {
                    title: `Default`,
                    description: `Uncontrolled — defaultOpen seeds the state and the trigger flips it. data-state on the trigger lets you animate the chevron.`
                },
                controlled: {
                    title: `Controlled`,
                    description: `Drive open from your own state with onOpenChange. An external button and the inline trigger share the same source of truth.`
                },
                nested: {
                    title: `Nested menu groups`,
                    description: `Sidebar-style menu groups: an icon, a label, a chevron that rotates on data-state, and indented sub-items behind a vertical accent line — the same pattern <Sidebar>'s "Collapsible groups" example uses, recreated with only Collapsible + Tailwind.`
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
                        body: `<Collapsible> wraps the Radix Collapsible primitive. Place a <CollapsibleTrigger> next to a <CollapsibleContent>; both children get data-state="open" | "closed" so CSS can react.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Use group/collapsible on the root so descendants can target the open state. A chevron rotated with group-data-[state=open]/collapsible:rotate-180 is the typical affordance.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Uncontrolled with defaultOpen and a chevron icon.`
                        },
                        controlled: {
                            title: `Controlled`,
                            description: `Two triggers — an external button and the inline trigger — share one open state.`
                        },
                        nested: {
                            title: `Nested menu groups`,
                            description: `Icon + chevron + indented sub-items with a vertical accent line — the sidebar pattern, built from Collapsible primitives.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Collapsible> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            closedByDefault: `Renders closed by default (data-state="closed", aria-expanded="false").`,
                            reflectsDefaultOpen: `Reflects defaultOpen on first mount.`,
                            opensClosesOnClick: `Opens and closes on trigger click.`,
                            firesOnOpenChange: `Fires onOpenChange when toggled.`,
                            fullyControllable: `Is fully controllable via open + onOpenChange.`,
                            disabledNoToggle: `Does not toggle when disabled.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `<Collapsible> is direction-agnostic — it does not render any directional affordance itself. Children inherit the surrounding dir, so layout flips naturally under dir="rtl".`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Collapsible>, <CollapsibleTrigger>, and <CollapsibleContent>.`
                    }
                }
            },
            input: {
                default: {
                    title: `With label`,
                    description: `Pair <Input> with <Label htmlFor> for accessible labelling.`
                },
                types: {
                    title: `Common types`,
                    description: `text / password / number — every standard HTML input type forwards through.`
                },
                disabled: {
                    title: `Disabled`,
                    description: `disabled disables the input and dims it.`
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
                        body: `<Input> is a thin styled wrapper over the native <input>. All native input attributes forward (type, value, onChange, placeholder, disabled, autoComplete, …).`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Pair with <Label htmlFor> for accessible labelling. Wire value + onChange for controlled mode.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `With label`,
                            description: `Labelled email input.`
                        },
                        types: {
                            title: `Common types`,
                            description: `text / password / number.`
                        },
                        disabled: {
                            title: `Disabled`,
                            description: `Disabled read-only field.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Input> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersTextInput: `Renders a native input element by default.`,
                            forwardsType: `Forwards the type attribute (e.g. password) onto the native input.`,
                            firesOnChange: `Fires onChange when the user types.`,
                            fullyControllable: `Is fully controllable via value + onChange.`,
                            noInputWhenDisabled: `Does not accept input when disabled.`,
                            forwardsRef: `Forwards a ref to the underlying input element.`,
                            classNameMerge: `Merges a custom className with the base classes.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the input flips: caret starts on the right, placeholder + selected text follow the surrounding text direction.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Input>.`
                    }
                }
            },
            label: {
                default: {
                    title: `Wrapping`,
                    description: `Wrap the control inside the label — clicking the label area toggles it.`
                },
                htmlFor: {
                    title: `htmlFor`,
                    description: `Use htmlFor when the control sits outside the label. Clicking the label focuses the matching input.`
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
                        body: `<Label> wraps the Radix Label primitive with shadcn typography. Pair with form controls — clicking the label focuses the associated input.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Two equally-valid patterns: wrap the control inside the label, OR set htmlFor to the control's id.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Wrapping`,
                            description: `Checkbox nested inside <Label>.`
                        },
                        htmlFor: {
                            title: `htmlFor`,
                            description: `Label adjacent to a separate Input.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Label> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersNativeLabel: `Renders a native label element.`,
                            typographyClasses: `Carries the heading typography classes (text-sm, font-medium).`,
                            htmlForFocuses: `Forwards htmlFor and focuses the matched input on click.`,
                            classNameMerge: `Merges a custom className with the base classes.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Labels follow the surrounding text direction. The label-text reads RTL when wrapped in dir="rtl".`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Label>.`
                    }
                }
            },
            textarea: {
                default: {
                    title: `With label`,
                    description: `Multi-line text input. Minimum height is 60px; grow it via rows={n} or a className.`
                },
                disabled: {
                    title: `Disabled`,
                    description: `disabled disables typing and dims the textarea.`
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
                        body: `<Textarea> is a styled wrapper over the native <textarea>. All native attributes forward (rows, value, onChange, placeholder, disabled, …).`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Combine with rows={n} or h-{n} to set the size. Wire value + onChange for controlled mode.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `With label`,
                            description: `Labelled bio textarea.`
                        },
                        disabled: {
                            title: `Disabled`,
                            description: `Read-only textarea with default value.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Textarea> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersNativeTextarea: `Renders a native textarea element.`,
                            firesOnChange: `Fires onChange when the user types.`,
                            fullyControllable: `Is fully controllable via value + onChange.`,
                            forwardsRef: `Forwards a ref to the underlying textarea element.`,
                            disabledPreventsTyping: `Disabled prevents typing.`,
                            baseStyling: `Carries the min-height + rounded styling.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the textarea flips so the caret starts on the right.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Textarea>.`
                    }
                }
            },
            skeleton: {
                default: {
                    title: `Avatar + lines`,
                    description: `A common loading shape: circular avatar plus two text lines.`
                },
                card: {
                    title: `Card placeholder`,
                    description: `Block + heading + body lines — used while a real Card is loading.`
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
                        body: `<Skeleton> is a pulse-animated div. Size it via tailwind utility classes (h-*, w-*, rounded-*) to mimic the shape of the content you're loading.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Compose multiple Skeletons together in the same shape and DOM order as the real content. Swap to the real content when data resolves.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Avatar + lines`,
                            description: `Common placeholder shape.`
                        },
                        card: {
                            title: `Card placeholder`,
                            description: `Image block + heading + body lines.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Skeleton> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            baseClasses: `Renders a div with the animate-pulse + rounded base classes.`,
                            forwardsClassName: `Forwards an extra className for sizing / shape overrides.`,
                            forwardsAttributes: `Forwards arbitrary HTML attributes (e.g. id, data-*).`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Skeletons are purely visual rectangles — direction-agnostic.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Skeleton>.`
                    }
                }
            },
            progress: {
                default: {
                    title: `Static value`,
                    description: `value=60 — the indicator translates by -(100 - value)% to reveal the filled portion.`
                },
                animated: {
                    title: `Animated`,
                    description: `Increment the value on a timer to drive an animated progress bar.`
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
                        body: `<Progress> is the Radix Progress primitive — pass value (0-100). The indicator is GPU-accelerated via transform: translateX.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Drive value from external state for upload progress, long-running task feedback, etc. Pass undefined for an indeterminate state.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Static value`,
                            description: `Fixed value=60.`
                        },
                        animated: {
                            title: `Animated`,
                            description: `Timer-driven progress.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Progress> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersTrack: `Renders the track with a relative-positioned, overflow-hidden, rounded-full shell.`,
                            translateAtZero: `Translates the indicator by -100% at value=0.`,
                            translateAtFifty: `Translates the indicator by -50% at value=50.`,
                            translateAtHundred: `Translates the indicator by 0 at value=100.`,
                            omittedAsZero: `Treats an omitted / undefined value as 0.`,
                            classNameMerge: `Merges a custom className with the base classes on the track.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the indicator fills from the right edge towards the left — Radix mirrors the transform direction automatically.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Progress>.`
                    }
                }
            },
            dialog: {
                default: {
                    title: `Confirm destructive action`,
                    description: `Click the button to open a modal dialog with title, body, and Cancel / Delete actions in the footer.`
                },
                hideClose: {
                    title: `Without the corner X`,
                    description: `showCloseButton={false} hides the built-in corner close — useful when closing must go through an explicit footer action.`
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
                        body: `<Dialog> wraps Radix Dialog. Compose with <DialogTrigger>, <DialogContent>, <DialogHeader> (with <DialogTitle> and <DialogDescription>), <DialogFooter>, and <DialogClose>.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `DialogContent renders a corner close button by default; pass showCloseButton={false} to hide it. Escape and overlay-clicks also close the dialog.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Confirm destructive action`,
                            description: `Dialog with header + body + Cancel/Delete footer.`
                        },
                        hideClose: {
                            title: `Without the corner X`,
                            description: `showCloseButton={false} forces explicit footer action.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Dialog> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            closedByDefault: `Is closed by default — the content is not rendered.`,
                            defaultOpen: `Renders the content when defaultOpen is set.`,
                            opensOnTrigger: `Opens when the trigger is clicked.`,
                            ariaWiring: `Exposes role="dialog" with the title + description wired into aria-labelledby / aria-describedby.`,
                            closeButton: `Renders a built-in close button labelled "Close" that closes the dialog when clicked.`,
                            closesOnEscape: `Closes on Escape.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the corner close button moves to the leading edge; footer actions follow the surrounding text direction.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Dialog> and <DialogContent>. The other slots (<DialogHeader>, <DialogTitle>, <DialogDescription>, <DialogFooter>, <DialogClose>) accept all native attributes for their underlying element.`
                    }
                }
            },
            popover: {
                default: {
                    title: `Trigger + body`,
                    description: `A minimal popover anchored to its trigger button.`
                },
                form: {
                    title: `Inline form`,
                    description: `Popovers are non-modal — perfect for lightweight inline forms (rename, quick-edit).`
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
                        body: `<Popover> wraps the Radix Popover primitive. Compose with <PopoverTrigger> and <PopoverContent>.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Popovers are non-modal: clicks outside dismiss, focus is not trapped. For modal blocking interactions reach for <Dialog> instead.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Trigger + body`,
                            description: `Minimal popover.`
                        },
                        form: {
                            title: `Inline form`,
                            description: `Lightweight form inside the popover.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Popover> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            closedByDefault: `Is closed by default — the content is not rendered.`,
                            defaultOpen: `Renders the content when defaultOpen is set.`,
                            opensOnTrigger: `Opens when the trigger is clicked.`,
                            closesOnEscape: `Closes on Escape.`,
                            portalsToBody: `Portals the content to document.body — it is not nested in the trigger's parent div.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the popover anchor and alignment mirror — Radix flips align="start"/"end" automatically.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Popover> and <PopoverContent>.`
                    }
                }
            },
            scrollArea: {
                default: {
                    title: `Vertical scroll`,
                    description: `A list of 30 items inside a 48-tall viewport. The scrollbar shows on overflow.`
                },
                horizontal: {
                    title: `Horizontal scroll`,
                    description: `Render an explicit <ScrollBar orientation="horizontal" /> to get a horizontal scrollbar — Radix does not render one by default.`
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
                        body: `<ScrollArea> wraps the Radix ScrollArea primitive. Size the container with h-*/ w-* utilities — content beyond that size triggers the custom-styled scrollbar.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `For horizontal scrolling, render <ScrollBar orientation="horizontal" /> inside the ScrollArea. Use viewportRef to scroll imperatively from parent code (autoscroll log viewers etc.).`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Vertical scroll`,
                            description: `30 items inside a 48-tall viewport.`
                        },
                        horizontal: {
                            title: `Horizontal scroll`,
                            description: `Cards laid out horizontally with explicit ScrollBar.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <ScrollArea> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            shell: `Renders a relative-positioned, overflow-hidden shell.`,
                            viewport: `Renders its children inside a viewport with h-full / w-full.`,
                            viewportRef: `Forwards viewportRef to the inner viewport.`,
                            viewportClassName: `Merges viewportClassName onto the viewport.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the vertical scrollbar pins to the left edge; horizontal scrolling direction follows the text direction.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <ScrollArea> and <ScrollBar>.`
                    }
                }
            },
            radioGroup: {
                default: {
                    title: `Controlled selection`,
                    description: `Three options, one selected — onValueChange fires with the new value when the user picks.`
                },
                disabledOption: {
                    title: `Disabled option`,
                    description: `Mark a single <RadioGroupItem disabled> to lock it out of selection; the rest of the group remains interactive.`
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
                        body: `<RadioGroup> wraps Radix RadioGroup. Each <RadioGroupItem value> must be unique inside the group.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Wrap each item inside a <Label> for accessible labelling. Mark individual items disabled or disable the whole group at the root.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Controlled selection`,
                            description: `Three options with onValueChange.`
                        },
                        disabledOption: {
                            title: `Disabled option`,
                            description: `One item disabled.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <RadioGroup> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersRadios: `Renders each item as a radio.`,
                            roleRadiogroup: `Uses role="radiogroup" on the wrapper.`,
                            defaultValueOnMount: `Reflects defaultValue on first mount.`,
                            firesOnValueChange: `Fires onValueChange when an item is clicked.`,
                            fullyControllable: `Is fully controllable via value + onValueChange.`,
                            disabledNoSwitch: `Does not switch to a disabled item.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the radio indicator and its label flip; arrow-key navigation mirrors so Left/Right step to the visually-adjacent item.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <RadioGroup> and <RadioGroupItem>.`
                    }
                }
            },
            slider: {
                default: {
                    title: `Single thumb`,
                    description: `Standard 0-100 slider with a single thumb. value is always a number[].`
                },
                range: {
                    title: `Range (two thumbs)`,
                    description: `Pass a two-entry array to get a range slider; the second thumb cannot cross the first.`
                },
                disabled: {
                    title: `Disabled`,
                    description: `disabled ignores pointer + keyboard input; the wrapper is dimmed via opacity-60.`
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
                        body: `<Slider> wraps Radix Slider with the shadcn track / thumb styling. The library renders one thumb per entry in value / defaultValue — pass a two-entry array for a range slider.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `onValueChange fires while dragging; onValueCommit fires once when the drag ends.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Single thumb`,
                            description: `Controlled single-thumb slider.`
                        },
                        range: {
                            title: `Range (two thumbs)`,
                            description: `Controlled range slider.`
                        },
                        disabled: {
                            title: `Disabled`,
                            description: `Inactive slider.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Slider> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            singleThumbDefault: `Renders a single thumb by default.`,
                            thumbsFromDefaultValue: `Renders one thumb per entry in defaultValue.`,
                            thumbsFromControlledValue: `Renders one thumb per entry in controlled value.`,
                            forwardsMinMax: `Forwards min / max to the underlying slider (aria-valuemin / aria-valuemax).`,
                            defaultRange: `Uses 0-100 as the default range.`,
                            disabledForwards: `disabled forwards onto the thumbs (data-disabled).`,
                            classNameMerge: `Merges a custom className with the base classes.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the slider direction flips: dragging right decreases the value.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Slider>.`
                    }
                }
            },
            contextMenu: {
                default: {
                    title: `Right-click target`,
                    description: `Right-click anywhere in the dashed area to open a per-region context menu. Use Escape or click outside to close.`
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
                        body: `<ContextMenu> is the local Radix-driven context menu. Compose with <ContextMenuTrigger>, <ContextMenuContent>, <ContextMenuItem>, and <ContextMenuSeparator>.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Use ContextMenu for per-region menus that do not need to participate in the action manager. For global, action-scope-driven menus reach for <GlobalContextMenu> instead.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Right-click target`,
                            description: `Right-click the dashed area to open the menu.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <ContextMenu> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            closedByDefault: `Is closed by default — no menu items rendered.`,
                            opensOnContextmenu: `Opens on a contextmenu event on the trigger.`,
                            firesOnSelect: `Fires onSelect when an item is clicked.`,
                            disabledIgnored: `Disabled items are exposed via data-disabled and ignore selection.`,
                            closesOnSelect: `Closes when an enabled item is selected.`,
                            separator: `Renders a separator between item groups.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" menu items flip; the menu still anchors to the cursor.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <ContextMenu> and <ContextMenuItem>.`
                    }
                }
            },
            dropdownMenu: {
                default: {
                    title: `Default`,
                    description: `Trigger button opens a labelled menu with separator + three items.`
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
                        body: `<DropdownMenu> wraps Radix DropdownMenu. Compose with Trigger, Content, Label, Separator, and Item slots.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Selecting an item closes the menu by default; call event.preventDefault() inside onSelect to keep the menu open (useful for checkbox-style items that toggle external state).`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Default`,
                            description: `Account menu with icons.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <DropdownMenu> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            closedByDefault: `Is closed by default — no menu items rendered.`,
                            opensOnTrigger: `Opens when the trigger is clicked.`,
                            firesOnSelectAndCloses: `Fires onSelect when an item is clicked and closes the menu.`,
                            disabledData: `Disabled items are exposed via data-disabled.`,
                            closesOnEscape: `Closes on Escape.`,
                            labelNotMenuitem: `Label is not a menuitem — it is excluded from keyboard navigation.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the menu mirrors so it opens on the leading edge of the trigger.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <DropdownMenu> and <DropdownMenuItem>.`
                    }
                }
            },
            hoverCard: {
                default: {
                    title: `Username preview`,
                    description: `Hover (or focus) the link to see a preview card. Open and close delays are tunable on the root.`
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
                        body: `<HoverCard> wraps Radix HoverCard. The card opens on hover or focus on the trigger; it is keyboard-accessible.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Tune the openDelay / closeDelay on the root to control timing. The trigger should be a link / button (the card is informational, not actionable).`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Username preview`,
                            description: `Hover over @mows to see the preview card.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <HoverCard> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            closedByDefault: `Is closed by default — content is not rendered.`,
                            defaultOpenRenders: `Renders the content when defaultOpen is set.`,
                            contentStyling: `Applies width + popover background to the content surface.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the card mirrors so it opens on the leading edge of the trigger.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <HoverCard> and <HoverCardContent>.`
                    }
                }
            },
            select: {
                default: {
                    title: `Controlled selection`,
                    description: `Click the trigger to open the listbox. value + onValueChange drive the controlled state.`
                },
                disabledOption: {
                    title: `Disabled option`,
                    description: `Mark a single <SelectItem disabled> to lock it out of selection.`
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
                        body: `<Select> wraps Radix Select. Compose with <SelectTrigger>+<SelectValue> for the trigger and <SelectContent>+<SelectItem> for the listbox.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Each <SelectItem value> must be unique within the listbox. Pass value + onValueChange to drive the active item from outside.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Controlled selection`,
                            description: `Three items with controlled state.`
                        },
                        disabledOption: {
                            title: `Disabled option`,
                            description: `One option disabled.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Select> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            placeholderWhenEmpty: `Renders a combobox trigger with placeholder text when empty.`,
                            reflectsDefaultValue: `Reflects defaultValue on the trigger.`,
                            fullyControllable: `Is fully controllable via value + onValueChange.`,
                            firesOnExternalValueChange: `Trigger text follows the controlled value when it changes from outside.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the trigger arrow flips to the leading edge; the listbox aligns with the trigger.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Select> and <SelectItem>.`
                    }
                }
            },
            sonner: {
                default: {
                    title: `Fire toasts`,
                    description: `Three buttons fire a default, success, and error toast respectively.`
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
                        body: `Mount <Toaster> once near the root; fire toasts from anywhere via the toast() function exported from sonner.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `<Toaster> reads position from MowsContext.toastSettings.position by default; pass position on the Toaster itself to override per-mount.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Fire toasts`,
                            description: `Default / success / error.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Toaster> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            contextTopLeft: `Reads position from MowsContext (top-left).`,
                            contextBottomCenter: `Reads position from MowsContext (bottom-center).`,
                            propOverrides: `An explicit position prop overrides the context.`,
                            noProvider: `Renders outside a MowsProvider without throwing.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" toast layout mirrors so the action button sits on the leading edge.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Toaster>.`
                    }
                }
            },
            inputGroup: {
                default: {
                    title: `Leading icon`,
                    description: `An <InputGroupAddon> before the input acts as a leading icon. Clicking the addon focuses the input.`
                },
                trailingAddon: {
                    title: `Trailing addon`,
                    description: `Place a trailing addon (e.g. currency code) by setting align="inline-end" on the addon — the order order-last class moves it to the end of the flex row.`
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
                        body: `<InputGroup> composes <InputGroupAddon> and <InputGroupInput>. Addons can be icons, buttons, or styled text via <InputGroupButton> / <InputGroupText>.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Place the addon before the input for leading content, after for trailing — and set align="inline-end" on trailing addons so they sit at the end of the row.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Leading icon`,
                            description: `Search icon followed by the input.`
                        },
                        trailingAddon: {
                            title: `Trailing addon`,
                            description: `Numeric input + EUR suffix.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <InputGroup> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersGroup: `Renders a role="group" wrapper with the input and leading addon.`,
                            focusOnAddonClick: `Focuses the inner input when the addon is clicked.`,
                            alignInlineEnd: `align="inline-end" places the addon last (data-align attribute + order-last class).`,
                            alignDefault: `Addon align defaults to inline-start when omitted.`,
                            forwardsAriaInvalid: `Forwards aria-invalid onto the inner input.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the leading addon flips to the right of the input; align="inline-end" addons follow accordingly.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <InputGroup> and <InputGroupAddon>.`
                    }
                }
            },
            resizable: {
                default: {
                    title: `Horizontal three-panel`,
                    description: `Drag the dividers to resize. Double-clicking a divider resets every panel to its declared defaultSize.`
                },
                vertical: {
                    title: `Vertical with grip`,
                    description: `direction="vertical" lays the panels top-to-bottom. withHandle adds a visible grip indicator on the resize bar.`
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
                        body: `<ResizablePanelGroup> wraps react-resizable-panels with shadcn styling. Compose with <ResizablePanel> and <ResizableHandle>.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Declare defaultSize on the panels you care about — the helper splits the remaining space evenly among the rest. Double-click on a handle resets the layout to those declared defaults.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Horizontal three-panel`,
                            description: `25/50/25 split with two draggable dividers.`
                        },
                        vertical: {
                            title: `Vertical with grip`,
                            description: `Top + bottom panels with a visible grip indicator.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <ResizablePanelGroup> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            everyPanelDeclared: `Returns the declared sizes when every panel supplies one.`,
                            fillsMissing: `Fills missing defaults with the remainder split evenly.`,
                            splitsAcrossMany: `Splits the remainder across multiple undeclared panels.`,
                            returnsNullOnOverflow: `Returns null when an undeclared panel would need a negative remainder.`,
                            returnsNullWhenEmpty: `Returns null when there are no panels.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the horizontal layout mirrors so the first declared panel sits on the right.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <ResizablePanelGroup>, <ResizablePanel>, and <ResizableHandle>.`
                    }
                }
            },
            calendar: {
                default: {
                    title: `Single-date picker`,
                    description: `mode="single" with controlled selected + onSelect.`
                },
                disableFuture: {
                    title: `disableFuture`,
                    description: `Convenience for date-of-birth pickers: every day after today is disabled.`
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
                        body: `<Calendar> wraps react-day-picker with shadcn styling. Pass mode + selected + onSelect for the standard controlled flow.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Pass disableFuture for "no future dates"; pass captionLayout="dropdown" for clickable month + year selectors; pass disabled with a Matcher for arbitrary disabled ranges.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Single-date picker`,
                            description: `Controlled single selection.`
                        },
                        disableFuture: {
                            title: `disableFuture`,
                            description: `Future days are disabled.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Calendar> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersGrid: `Renders a grid of day cells for the visible month.`,
                            marksSelected: `Marks the selected day on the cell or button via data-selected* attributes.`,
                            firesOnSelect: `Fires onSelect when the user picks a day in single mode.`,
                            disableFutureDisables: `disableFuture disables every day after today.`,
                            navigatesMonths: `Navigates to the next month when the next-month button is clicked.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the calendar grid flips so weekday headers read right-to-left; navigation buttons mirror.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Calendar>. The component forwards every react-day-picker prop in addition to the listed ones.`
                    }
                }
            },
            compass: {
                default: {
                    title: `Slider-driven`,
                    description: `Drag the slider 0-360° to change the heading; the bar scrolls so the centre marker stays pinned to the current bearing.`
                },
                markers: {
                    title: `With waypoints`,
                    description: `Pass markers={[{ bearing, label }]} to label extra bearings on the bar.`
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
                        body: `<Compass> is a HUD-style horizontal compass bar. Drive heading from any yaw source — Image360Viewer onHeadingChange, a 3D controller, vehicle telemetry, etc.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Tune fieldOfView for the zoom level, tickInterval for the tick spacing, and pass markers to label additional bearings. Negative or > 360° headings are normalised automatically.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Slider-driven`,
                            description: `Bar follows a slider that goes 0-360°.`
                        },
                        markers: {
                            title: `With waypoints`,
                            description: `Two extra labelled bearings.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Compass> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            defaultReadout: `Renders the default readout as integer degrees + cardinal direction.`,
                            normalisesNegative: `Normalises a negative heading into the 0-359° range.`,
                            normalisesLarge: `Normalises a heading > 360°.`,
                            mapsCardinal: `Maps headings near a cardinal to that cardinal direction.`,
                            cardinalsByDefault: `Renders cardinal labels (N / E / S / W) by default.`,
                            readoutNullHides: `Hides the readout when readout={null}.`,
                            customReadout: `Accepts a custom readout node.`,
                            rendersMarkers: `Renders extra markers passed via the markers prop.`,
                            hideCardinals: `hideCardinals removes the default cardinal labels from the bar.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `The bar scrolls horizontally regardless of text direction. The numeric readout follows the surrounding text direction.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Compass>.`
                    }
                }
            },
            avatar: {
                default: {
                    title: `Initials`,
                    description: `The first character of displayName, uppercased, inside a circular outline.`
                },
                loading: {
                    title: `Loading state`,
                    description: `Without a displayName the avatar renders a Skeleton placeholder — useful while auth is still resolving.`
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
                        body: `<Avatar> renders the uppercased first letter of displayName inside a circle. Omit displayName for a Skeleton placeholder.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Compose with className for size variants (e.g. h-7 w-7 text-xs for an inline trigger, h-16 w-16 text-xl for a profile header).`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Initials`,
                            description: `Four avatars — three with names, one loading.`
                        },
                        loading: {
                            title: `Loading state`,
                            description: `Single placeholder while waiting on auth.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <Avatar> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            uppercasedInitial: `Shows the uppercased first letter of displayName.`,
                            unicodeInitial: `Accepts non-ASCII first letters (ü, é, ñ, …).`,
                            skeletonWhenMissing: `Renders the skeleton placeholder when displayName is omitted.`,
                            skeletonWhenEmpty: `Renders the skeleton placeholder when displayName is the empty string.`,
                            classNameMerge: `Merges className onto the outer wrapper without losing the rounded outline.`,
                            styleForwards: `Forwards inline style onto the wrapper.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Avatar is direction-agnostic — the circular initial reads the same in either text direction.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <Avatar>.`
                    }
                }
            },
            actionDisplay: {
                default: {
                    title: `Registered action`,
                    description: `Reads the Greet action from the surrounding ActionManager and renders its label + icon + bound hotkeys.`
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
                        body: `<ActionDisplay> renders a single Action — its translated label, optional icon, and bound hotkeys. Pull the Action from the surrounding actionManager.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Action handlers can supply a custom component() in their state to fully override the rendered content (icon + label).`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Registered action`,
                            description: `Greet + key combo.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <ActionDisplay> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            translatesLabel: `Renders the action label from MowsContext.t.actions[id].`,
                            fallsBackToId: `Falls back to the action id when no translation is registered.`,
                            rendersIcon: `Renders the icon returned by the action state.`,
                            exposesDisabledReason: `Exposes disabledReasonText via the title attribute.`,
                            rendersHotkeys: `Renders one KeyComboDisplay per registered hotkey.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the label and trailing hotkey row mirror around the icon.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <ActionDisplay>.`
                    }
                }
            },
            keyComboDisplay: {
                default: {
                    title: `Common combos`,
                    description: `Each combo renders as a styled <kbd> per segment, with universal keys (Enter, arrows, …) rendered as Lucide icons.`
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
                        body: `<KeyComboDisplay> takes a single "+"-separated combo string and renders styled keycaps. "mod" resolves to ⌘ on Mac and Ctrl elsewhere.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Universal-icon keys (Enter, Tab, arrows, …) always render as icons. Modifier keys render as Mac-only glyphs (⌘ / ⌃ / ⌥) on Apple devices, translated words elsewhere ("Strg", "Alt", …).`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Common combos`,
                            description: `mod+k, mod+shift+p, alt+enter, escape, shift+arrowup.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <KeyComboDisplay> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            eachSegmentKbd: `Each combo segment renders inside its own <kbd> element.`,
                            alphaUppercased: `Renders alphabetic keys uppercased.`,
                            modifiersTranslated: `Renders modifiers as translated words on non-Mac platforms.`,
                            iconForUniversal: `Renders an icon for universal-icon keys (e.g. Enter).`,
                            arrowupIcon: `Renders arrowup as an icon, not text.`,
                            plusSeparator: `Splits compound combos with a "+" separator between kbds.`,
                            escapeWord: `Renders escape as a translated word.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the kbd sequence flips so the first key is on the right.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <KeyComboDisplay>.`
                    }
                }
            },
            keyboardShortcutEditor: {
                default: {
                    title: `Edit shortcuts`,
                    description: `Lists every action registered on the surrounding ActionManager along with its current key combos. Use the search box to filter.`
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
                        body: `Mount inside <MowsProvider>. The editor reads every registered action from actionManager and lets the user re-bind its hotkeys via a key-recording dialog.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Bindings are persisted via HotkeyManager to localStorage. Reset returns to the action's defaultHotkeys; the trash icon deletes a binding.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Edit shortcuts`,
                            description: `Live editor inside the example.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <KeyboardShortcutEditor> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            listsActions: `Lists every registered action.`,
                            rendersCurrentCombos: `Renders the currently-bound key combos for each action.`,
                            filtersBySearch: `Filters the action list by the typed search query.`,
                            emptyStateOnNoMatches: `Shows no entries when no actions match the search.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Action labels and key-combo columns mirror under dir="rtl".`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <KeyboardShortcutEditor>.`
                    }
                }
            },
            expandableCode: {
                default: {
                    title: `Long snippet`,
                    description: `A snippet taller than 280px renders behind a gradient fade with an Expand button below.`
                },
                short: {
                    title: `Short snippet`,
                    description: `Content shorter than collapsedHeight renders as-is — no affordance.`
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
                        body: `<ExpandableCode> wraps any content (typically a <CodeViewer fitContent />) in a collapsible container. Below collapsedHeight no affordance renders.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Pair with <CodeViewer fitContent /> so the inner editor reports its natural height. ExpandableCode then sizes the wrapper accordingly.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `Long snippet`,
                            description: `40 lines clipped behind the gradient.`
                        },
                        short: {
                            title: `Short snippet`,
                            description: `No Expand button — content fits.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <ExpandableCode> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersChildren: `Renders the children verbatim.`,
                            noButtonWhenFits: `Hides the Expand button when content fits within collapsedHeight.`,
                            buttonWhenOverflow: `Shows the Expand button when content exceeds collapsedHeight.`,
                            togglesLabels: `Toggles between Expand and Collapse labels.`,
                            defaultExpanded: `Honours defaultExpanded.`,
                            labelOverrides: `Honours expandLabel / collapseLabel overrides.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Direction-agnostic — the affordance row remains centred under dir="rtl".`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <ExpandableCode>.`
                    }
                }
            },
            searchInput: {
                default: {
                    title: `With clear button`,
                    description: `Type to see the clear button appear; hover or focus the input to reveal it.`
                },
                hideIcon: {
                    title: `Without leading icon`,
                    description: `Set hideIcon to drop the leading Search icon — useful when the surrounding chrome already supplies one.`
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
                        body: `<SearchInput> is a thin wrapper over <InputGroup> that wires the leading search icon, the clear button, and the password-manager-friendly autocomplete dance.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `Hide the leading icon with hideIcon; hide the clear button with hideClearButton.`
                    },
                    examples: {
                        title: `Examples`,
                        default: {
                            title: `With clear button`,
                            description: `Default styling — icon + input + clear.`
                        },
                        hideIcon: {
                            title: `Without leading icon`,
                            description: `Icon suppressed.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <SearchInput> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            typeSearch: `Renders a type="search" input.`,
                            leadingIcon: `Renders the leading search icon by default.`,
                            hideIcon: `hideIcon removes the leading addon.`,
                            firesOnValueChange: `Fires onValueChange when the user types.`,
                            showsClearWhenNonEmpty: `Shows the clear button once the value is non-empty.`,
                            clearResetsValue: `Clicking the clear button resets the value to "".`,
                            hideClearButton: `hideClearButton suppresses the clear button even when non-empty.`,
                            disabledForwards: `disabled forwards onto both the input and the clear button.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the leading icon flips to the right and the clear button to the left.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <SearchInput>.`
                    }
                }
            },
            numberInput: {
                default: {
                    title: `Integer with stepper`,
                    description: `Drag-clamp to [0, 64] with step=1. The − / + buttons disable when at min/max.`
                },
                decimal: {
                    title: `Decimal value`,
                    description: `integerOnly={false} accepts decimals; step=0.1 controls the increment.`
                },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<NumberInput> is a controlled numeric input with inline stepper buttons and min/max/step clamping. Empty value is communicated as null so callers can fall back to a server-side default.` },
                    composition: { title: `Composition`, body: `Pair with the placeholder to communicate "what gets used when empty". Use integerOnly={false} for decimal values; hideStepper drops the − / + buttons.` },
                    examples: { title: `Examples`, default: { title: `Integer with stepper`, description: `0-64 vCPUs, step=1.` }, decimal: { title: `Decimal value`, description: `0.1-10 GiB, step=0.1.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <NumberInput> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersValue: `Renders an input with the controlled value.`,
                            nullRendersEmpty: `Renders empty when value is null.`,
                            clearEmitsNull: `Fires onChange with null when the user clears the field.`,
                            bumpsByStepPlus: `Bumps by step when the + button is clicked.`,
                            bumpsByStepMinus: `Bumps by −step when the − button is clicked.`,
                            clampsToMin: `Clamps to min on −.`,
                            clampsToMax: `Clamps to max on +.`,
                            clampOnBlur: `Clamps an out-of-range typed value on blur.`,
                            hideStepper: `hideStepper drops the +/- buttons.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" the stepper buttons stay on the trailing edge of the input.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <NumberInput>.` }
                }
            },
            colorCurves: {
                photo: {
                    title: `Photo curves`,
                    description: `Lightroom-style tonal curves applied to a real photo. The histogram backdrop is computed from the source pixels; drag the points to recolour, drag any non-endpoint off the surface to delete it.`
                },
                standalone: {
                    title: `Standalone editor`,
                    description: `The editor without a connected canvas — useful when the curves are saved as a preset or sent to a server-side image pipeline.`
                },
                photoLabels: {
                    channelHint: `Tabs above switch the active channel: composite RGB, then R / G / B.`,
                    addPointHint: `Click on the surface to add a control point.`,
                    deletePointHint: `Drag a non-endpoint point off the surface, or focus it and press Delete, to remove.`,
                    keyboardHint: `Focus a point and use arrow keys (Shift = coarse) for keyboard control.`,
                    loading: `Loading photo…`,
                    photoLabel: `Photo:`,
                    byLabel: `by`
                },
                componentStrings: {
                    channelRgb: `RGB`,
                    channelRed: `R`,
                    channelGreen: `G`,
                    channelBlue: `B`,
                    resetChannel: `Reset channel`,
                    resetAll: `Reset all`,
                    editorAriaLabel: `Color curves editor`
                },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<ColorCurves> is a controlled, channel-aware tonal-curve editor. It emits a per-channel array of control points; feed the result through applyColorCurvesToImageData() against a canvas to actually transform pixels.` },
                    composition: { title: `Composition`, body: `Pair <ColorCurves> with a <canvas> for live grading: compute a histogram from the source ImageData with computeColorCurvesHistogram(), then re-apply the curves on every change. The math (buildCurveLUT, sampleCurve) is exported for server-side or offline use.` },
                    examples: { title: `Examples`, photo: { title: `Photo curves`, description: `Real photo + live histogram + 4 channels.` }, standalone: { title: `Standalone editor`, description: `Editor only, no canvas wiring.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <ColorCurves> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersSurface: `Renders the SVG curve editing surface.`,
                            rendersChannelButtons: `Renders one channel tab per RGB/R/G/B channel.`,
                            channelClickSwitches: `Clicking a channel tab switches the active channel.`,
                            resetChannelRestoresIdentity: `Reset channel button restores the active channel to the identity curve.`,
                            resetAllRestoresIdentity: `Reset all button restores every channel to the identity curve.`,
                            clickAddsPoint: `Clicking empty space on the surface adds a control point.`,
                            deleteRemovesPoint: `Pressing Delete on a focused non-endpoint point removes it.`,
                            disabledPreventsInput: `disabled prop hides pointer interaction and disables the action buttons.`
                        }
                    },
                    rtl: { title: `RTL`, body: `The editor is direction-agnostic — the x-axis is always input-low → input-high regardless of writing direction. Surrounding text in the controls flips under dir="rtl".` },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <ColorCurves>.`,
                        props: {
                            value: `Required. One curve per channel — each curve is an ordered list of { x, y } control points with coordinates in [0, 1].`,
                            onChange: `Required. Fires with the next value after every edit, add, delete, or reset.`,
                            channel: `Externally-controlled active channel. Omit to let the component own the selection internally.`,
                            onChannelChange: `Fires when the user picks a channel tab.`,
                            histogram: `Optional 256-bin histogram drawn behind the curve. Build one from a canvas via computeColorCurvesHistogram(imageData).`,
                            showHistogram: `Toggle the histogram backdrop. Has no effect if no histogram is supplied.`,
                            size: `Edge length of the square graphing surface, in SVG viewBox units.`,
                            disabled: `Disable pointer interaction, focus, and the action buttons.`,
                            hideResetAll: `Hide the "Reset all" button if only per-channel resets are wanted.`,
                            strings: `Translated labels for the channel tabs, reset buttons, and ARIA strings. Falls back to English defaults for any key you omit.`,
                            ariaLabel: `Accessible label for the editor container.`
                        }
                    }
                }
            },
            optionPicker: {
                default: { title: `Multi-select`, description: `Three options inside a popover. Toggling an option keeps the menu open; the trigger shows "(enabled/total)" by default.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<OptionPicker> is a multi-select dropdown built on DropdownMenuCheckboxItem. Options are { id, label, enabled }; the consumer toggles them via onOptionChange.` },
                    composition: { title: `Composition`, body: `Pass triggerComponent for a custom trigger label. The menu deliberately does NOT close on select so the user can toggle multiple options in one interaction.` },
                    examples: { title: `Examples`, default: { title: `Multi-select`, description: `Three view options.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <OptionPicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersLabel: `Renders the trigger label.`,
                            showsCountByDefault: `Renders the enabled/total count on the trigger by default.`,
                            hidesCountWhenFalse: `Omits the count when showCount={false}.`,
                            menuItemsAfterOpen: `Renders one menuitemcheckbox per option after opening.`,
                            firesOnToggle: `Fires onOptionChange when a menu item is toggled.`,
                            staysOpenOnToggle: `Stays open after toggling an option (preventDefault on select).`,
                            rendersHeader: `Renders the optional header label.`,
                            disabledForwards: `Disabled trigger forwards the disabled attribute and ignores clicks.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" the menu mirrors so it opens on the leading edge.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <OptionPicker>.` }
                }
            },
            searchSelectPicker: {
                standalone: { title: `Standalone`, description: `Inline searchable list — no popover trigger. Type to filter; click to select.` },
                popover: { title: `Popover trigger`, description: `Default form — the picker lives behind a popover trigger.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<SearchSelectPicker> is a generic searchable single-select. It takes items + a getId + a matchesSearch + a renderItemContent, and works in both popover and standalone modes.` },
                    composition: { title: `Composition`, body: `<LanguagePicker>, <ThemePicker>, and <CodeThemePicker> are all thin wrappers over <SearchSelectPicker> that fill in items + selected + matchers from MowsProvider.` },
                    examples: { title: `Examples`, standalone: { title: `Standalone`, description: `Inline list with five items.` }, popover: { title: `Popover trigger`, description: `Three items behind a popover.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <SearchSelectPicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersInlineList: `Renders every item inline in standalone mode.`,
                            filtersBySearch: `Filters items by search in standalone mode.`,
                            emptyTextOnNoMatches: `Shows the empty-text fallback when search matches nothing.`,
                            firesOnSelect: `Fires onSelect with the chosen item in standalone mode.`,
                            fullyControllable: `Is fully controllable via selected + onSelect.`,
                            popoverTriggerOpens: `Popover mode renders a trigger that opens the search list.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" the search input + list mirror; selection indicator flips accordingly.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <SearchSelectPicker>. The component is generic in T — pass the item type when using.` }
                }
            },
            languagePicker: {
                popover: { title: `Popover trigger`, description: `Default form — the picker lives behind a popover.` },
                standalone: { title: `Standalone`, description: `Searchable list inline, no popover.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `Mount <LanguagePicker> inside <MowsProvider>. It reads the available languages and the current language from context and calls setLanguage on selection.` },
                    composition: { title: `Composition`, body: `<LanguagePicker> is a thin wrapper around <SearchSelectPicker> with renderItemContent / renderTriggerContent specialised for { code, name, emoji } language entries.` },
                    examples: { title: `Examples`, popover: { title: `Popover trigger`, description: `Trigger + popover list.` }, standalone: { title: `Standalone`, description: `Inline searchable list.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <LanguagePicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            listsLanguages: `Lists every language in standalone mode.`,
                            firesSetLanguage: `Calls setLanguage on the surrounding context when a language is picked.`,
                            popoverShowsCurrent: `Renders the popover trigger with the current language by default.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Wrap inside dir="rtl" and the trigger + search field flip to right-to-left.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <LanguagePicker>.` }
                }
            },
            themePicker: {
                popover: { title: `Popover trigger`, description: `Default form — the picker lives behind a popover.` },
                standalone: { title: `Standalone`, description: `Searchable list inline, no popover.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `Mount <ThemePicker> inside <MowsProvider>. It reads the available themes and current theme from context and calls setTheme on selection.` },
                    composition: { title: `Composition`, body: `<ThemePicker> is a thin wrapper around <SearchSelectPicker>. The "system" entry shows the OS-resolved variant ("(dark)" / "(light)") in the popover row.` },
                    examples: { title: `Examples`, popover: { title: `Popover trigger`, description: `Trigger + popover list.` }, standalone: { title: `Standalone`, description: `Inline searchable list.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <ThemePicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            listsThemes: `Lists every theme in standalone mode.`,
                            firesSetTheme: `Calls setTheme on the surrounding context when a theme is picked.`,
                            popoverShowsCurrent: `Renders the popover trigger with the current theme by default.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Wrap inside dir="rtl" and the trigger + search field flip to right-to-left.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <ThemePicker>.` }
                }
            },
            mapStylePicker: {
                popover: { title: `Popover trigger`, description: `Default form — picks live behind a popover trigger.` },
                standalone: { title: `Standalone`, description: `Searchable list inline, no popover.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `Mount <MapStylePicker> inside <MowsProvider>. It reads the available styles and currentMapStyle from context and calls setMapStyle on selection.` },
                    composition: { title: `Composition`, body: `Selecting a style here updates every mounted <Map> that does not pin its own mapStyle prop, and persists the pick in localStorage under storagePrefix_map_style.` },
                    examples: { title: `Examples`, popover: { title: `Popover trigger`, description: `Trigger + popover list.` }, standalone: { title: `Standalone`, description: `Inline searchable list.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <MapStylePicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            listsStyles: `Lists every map style in standalone mode.`,
                            firesSetMapStyle: `Calls setMapStyle on the surrounding context when a style is picked.`,
                            popoverShowsCurrent: `Renders the popover trigger with the current map style by default.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Wrap inside dir="rtl" and the trigger + search field flip to right-to-left.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <MapStylePicker>.` }
                }
            },
            map: {
                default: { title: `Default`, description: `Mapbox-gl viewport. The active style follows the user's settings-panel pick.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<Map> renders a mapbox-gl viewport. Both mapbox-gl's JS and its CSS are lazy-loaded on first mount so consumers that never render a map pay zero bundle cost.` },
                    composition: { title: `Composition`, body: `By default <Map> follows currentMapStyle from MowsContext, so the SettingsPanel can switch styles across the whole app at once. Pin a mapStyle prop to opt out per instance.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Live mapbox-gl viewport at world zoom.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <Map> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            lazyLoadsMapbox: `Shows a loading skeleton until the mapbox-gl chunk resolves.`,
                            usesContextStyle: `Instantiates mapbox-gl with the context's currentMapStyle by default.`,
                            propOverridesContext: `An explicit mapStyle prop overrides the context value.`,
                            appliesAccessToken: `Assigns the active style's accessToken before instantiation.`,
                            reactsToContextChange: `Calls setStyle when the context's current map style changes.`,
                            firesOnLoad: `Fires onLoad once the underlying map emits "load".`,
                            cleansUpOnUnmount: `Calls map.remove() on unmount.`
                        }
                    },
                    rtl: { title: `RTL`, body: `mapbox-gl renders its own canvas; <Map> adds no direction-sensitive chrome, so dir="rtl" leaves the viewport unchanged.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <Map>.` }
                }
            },
            locationPicker: {
                default: { title: `Default`, description: `Click anywhere on the map to pick a coordinate; the picked value appears under the canvas.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<LocationPicker> wraps <Map> and turns map clicks into a single picked point. Use value + onChange for controlled forms, or defaultValue for uncontrolled inputs.` },
                    composition: { title: `Composition`, body: `LocationPicker reuses currentMapStyle from MowsContext, so the SettingsPanel's MapStylePicker controls its tiles. Clear via the inline button or by setting value to null.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Click-to-pin coordinate picker.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <LocationPicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersMap: `Renders an embedded map with the empty-state hint until the user clicks.`,
                            uncontrolledClickUpdates: `In uncontrolled mode a map click updates the internal value and shows the readout.`,
                            controlledFiresOnChange: `In controlled mode a click fires onChange but leaves the visible value alone until the parent updates value.`,
                            clearResets: `The clear button resets the picked value to null.`,
                            mountsMarker: `Mounts a themed pin marker on the map once the first value is set.`
                        }
                    },
                    rtl: { title: `RTL`, body: `The map canvas is direction-agnostic; only the readout below mirrors when dir="rtl".` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <LocationPicker>.` }
                }
            },
            dateTimePicker: {
                default: { title: `Default`, description: `A text input + popover calendar + time picker.` },
                withTimezone: { title: `With timezone`, description: `Set showTimezone to add an IANA timezone selector inside the popover.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<DateTimePicker> wires a text input to a popover containing a calendar + time picker. Pass value + onChange for controlled use, or defaultValue for uncontrolled.` },
                    composition: { title: `Composition`, body: `Set showSeconds for a second column; showTimezone to surface a timezone selector; disableFuture to prevent picking dates after today (DOB-style pickers).` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Text input + calendar + time picker.` }, withTimezone: { title: `With timezone`, description: `Includes the timezone selector.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <DateTimePicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersTextInput: `Renders a date+time text input.`,
                            seedsFromDefault: `Uses defaultValue to seed the displayed value.`,
                            reflectsControlled: `Reflects a controlled value prop.`,
                            firesOnConfirm: `Fires onChange when the user edits the text input and confirms.`,
                            disabledForwards: `Renders disabled when disabled is set.`,
                            placeholderReflectsFormat: `Exposes a placeholder reflecting the time format / seconds.`,
                            showsTimezoneSelector: `Shows the timezone selector when showTimezone is set.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" the calendar header / time pickers mirror direction.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <DateTimePicker>.` }
                }
            },
            timePicker: {
                default: { title: `24h + seconds`, description: `Three scroller columns: hours, minutes, seconds.` },
                twelveHour: { title: `12h with AM/PM`, description: `12-hour layout adds a fourth column for AM/PM.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<TimePicker> is the inner column-based time selector used inside <DateTimePicker>. Drive it via a Date + onChange; columns are vertically-scrollable lists of fixed cells.` },
                    composition: { title: `Composition`, body: `12h mode renders 12 hour entries + an AM/PM column; 24h renders 24 entries. showSeconds toggles the seconds column.` },
                    examples: { title: `Examples`, default: { title: `24h + seconds`, description: `Three columns.` }, twelveHour: { title: `12h with AM/PM`, description: `Hour + minute + AM/PM column.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <TimePicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersColumns24h: `Renders an hours column and a minutes column in 24h mode.`,
                            secondsColumn: `Renders a seconds column when showSeconds is set.`,
                            firesOnHourPick: `Fires onChange with a new Date when an hour cell is picked.`,
                            fullyControllable: `Is fully controllable via date + onChange.`,
                            amPmColumn: `Renders an AM/PM column in 12h mode.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" column order mirrors so hours sit on the right.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <TimePicker>.` }
                }
            },
            timezoneSelector: {
                default: { title: `Default`, description: `A combobox-style trigger that opens a searchable IANA timezone list.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<TimezoneSelector> wraps Radix Popover + cmdk Command to expose every IANA timezone with offset info. value / onChange use the canonical IANA id.` },
                    composition: { title: `Composition`, body: `Used standalone for explicit "log timezone" pickers, and inside <DateTimePicker> when showTimezone is set.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Searchable timezone picker.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <TimezoneSelector> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersTrigger: `Renders the trigger button.`,
                            showsSelected: `Shows the selected timezone on the trigger.`,
                            opensSearch: `Opens a search list when the trigger is clicked.`,
                            firesOnChange: `Fires onChange when the user picks a timezone.`,
                            fullyControllable: `Is fully controllable via value + onChange.`,
                            disabledNoOpen: `Disabled prevents opening the popover.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" the trigger arrow and listbox mirror.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <TimezoneSelector>.` }
                }
            },
            dateTimeRangePicker: {
                default: { title: `Default`, description: `Two date+time inputs sharing one calendar popover. Click a day to set the start, click another to set the end. Drag either endpoint to adjust.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<DateTimeRangePicker> exposes two text inputs (start / end) and a shared popover with the calendar + time pickers. range is { from, to }.` },
                    composition: { title: `Composition`, body: `Set showDuration to display the computed "5 days 6h 30m" inside the popover; showTimezone to add the timezone selector; timeLayout="beside" to put time pickers next to the calendar.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Two text inputs sharing one popover calendar.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <DateTimeRangePicker> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersBothInputs: `Renders two text inputs: start and end.`,
                            reflectsFrom: `Reflects defaultValue.from on the start input.`,
                            reflectsTo: `Reflects defaultValue.to on the end input.`,
                            fullyControllable: `Is fully controllable via value + onChange.`,
                            disabledForwards: `Disables both inputs when disabled is set.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" the inputs mirror order; the calendar inside the popover follows the surrounding text direction.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <DateTimeRangePicker>.` }
                }
            },
            loggingConfig: {
                default: { title: `Default`, description: `Default log level + per-file filters. Changes update Logger.defaultLevel / Logger.fileFilter immediately.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<LoggingConfig> exposes the global Logger configuration UI. Changes call Logger.saveConfig() which persists to localStorage.` },
                    composition: { title: `Composition`, body: `Drop into the settings page or modal. No props besides className.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Full logging settings panel.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <LoggingConfig> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersDefaultLevel: `Renders the default-level section.`,
                            exposesFilterInput: `Exposes an input for adding a per-file filter.`,
                            addsFilter: `Adds a file filter when the add button is clicked.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Section layout mirrors under dir="rtl".` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <LoggingConfig>.` }
                }
            },
            inlineEdit: {
                basic: {
                    title: `Basic`,
                    description: `Click the text or pencil to edit. Press Enter or click the green check to commit; press Escape or click the red X to cancel.`
                },
                heading: {
                    title: `Heading`,
                    description: `Use the as prop to render the editable surface as <h2> (or any other heading tag) while keeping inline editing.`
                },
                placeholder: {
                    title: `Placeholder`,
                    description: `When the value is empty the placeholder is shown in muted italic until the user types something.`
                },
                fixedWidth: {
                    title: `Fixed width`,
                    description: `Pin the editor to a fixed CSS width with the width prop. Typing past the box scrolls horizontally instead of expanding the row.`
                },
                disabled: {
                    title: `Disabled`,
                    description: `disabled hides the edit affordances and renders the text as static content.`
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
                        body: `<InlineEdit> is a controlled text field that edits in place without swapping the surrounding layout. It uses contentEditable instead of an <input>, so font metrics and row height stay identical between display and edit modes.`
                    },
                    composition: {
                        title: `Composition`,
                        body: `The affordance column is a fixed-width 2-slot grid. The edit, save and cancel buttons share those slots via opacity toggles, so the parent row keeps the same width whether the user is idle, hovering, or actively editing.`
                    },
                    examples: {
                        title: `Examples`,
                        basic: {
                            title: `Basic`,
                            description: `Inline-rename a short string. The row width is identical before, during and after editing.`
                        },
                        heading: {
                            title: `Heading`,
                            description: `Render the editable surface as an <h2> using the as prop, useful for in-place page titles.`
                        },
                        placeholder: {
                            title: `Placeholder`,
                            description: `Empty values show the placeholder in muted italic until the user types something.`
                        },
                        fixedWidth: {
                            title: `Fixed width`,
                            description: `When the width prop is set, the contentEditable element stays at that fixed size while typing. Overflow is clipped and the caret scrolls inside the box, so the row width is locked.`
                        },
                        disabled: {
                            title: `Disabled`,
                            description: `Disabling InlineEdit hides the buttons entirely and renders the text as static content. Row geometry still matches the editable variant.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`,
                        intro: `Statements describing how <InlineEdit> is expected to behave, each linked to the test that verifies it.`,
                        verifiedBy: `verified by`,
                        statements: {
                            rendersValue: `Renders the current value in display mode.`,
                            commitsOnEnter: `Pressing Enter blurs the editor and fires onCommit with the trimmed value.`,
                            cancelsOnEscape: `Pressing Escape exits edit mode without firing onCommit and restores the original value.`,
                            discardsUnchanged: `Empty or unchanged values are silently discarded — onCommit is never called with them.`,
                            hidesButtonsWhenDisabled: `When disabled the edit / save / cancel buttons are not rendered.`,
                            stableAffordanceWidth: `The affordance column has a fixed width so the row does not reflow when entering or leaving edit mode.`,
                            fixedWidthDoesNotGrow: `When width is set the editor element keeps that exact width regardless of the typed value.`
                        }
                    },
                    rtl: {
                        title: `RTL`,
                        body: `Under dir="rtl" the affordance column flips to the left of the text; the fixed-width slot guarantees the row stays the same width.`
                    },
                    apiReference: {
                        title: `API Reference`,
                        intro: `Props accepted by <InlineEdit>.`
                    }
                }
            },
            commandPalette: {
                default: { title: `Default`, description: `Opens via the registered action. Type to filter, click or press Enter to dispatch.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<CommandPalette> is mounted once globally inside <MowsProvider>. It registers itself as the handler for CoreActionIds.OPEN_COMMAND_PALETTE and lists every action currently registered with the ActionManager.` },
                    composition: { title: `Composition`, body: `Open via mowsContext.actionManager.dispatchAction(CoreActionIds.OPEN_COMMAND_PALETTE) or by binding a hotkey through HotkeyManager. Pass open / onOpenChange to control state externally.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Click the button to open the palette, then type to filter the registered actions.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <CommandPalette> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            closedByDefault: `Is closed by default — no list items rendered.`,
                            opensOnControlled: `Opens when the controlled open prop flips to true.`,
                            rendersActions: `Renders one row per registered action.`,
                            filtersBySearch: `Filters the action list by the typed query.`,
                            dispatchesOnClick: `Dispatches the action when an item is clicked.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Under dir="rtl" the search input and command list mirror.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <CommandPalette>.` }
                }
            },
            modalHandler: {
                default: { title: `Default`, description: `Click a button to open one of the core modals; ModalHandler reads MowsContext.currentlyOpenModal and renders the matching dialog.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<ModalHandler> is mounted once globally inside <MowsProvider>. It listens to currentlyOpenModal and renders the matching core dialog (theme / language / keyboard shortcuts / code theme / settings).` },
                    composition: { title: `Composition`, body: `Register app-specific dialogs via extraModals. Open any modal by calling mowsContext.changeActiveModal(id).` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Trigger the theme, language, and keyboard-shortcut modals through the action manager.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <ModalHandler> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            invisibleWhenNoModal: `Renders nothing visible when no modal is active.`,
                            themeSelector: `Renders the theme-selector dialog when modal=themeSelector.`,
                            languageSelector: `Renders the language-selector dialog when modal=languageSelector.`,
                            keyboardShortcutEditor: `Renders the keyboard-shortcut editor when modal=keyboardShortcutEditor.`,
                            customModal: `Renders a custom modal supplied via extraModals.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Dialog content mirrors under dir="rtl".` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <ModalHandler>.` }
                }
            },
            fileViewer: {
                default: { title: `Default`, description: `Bundled landscape image renders through ImageViewer. Swap the URL, name, or MIME type to exercise different code paths.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<FileViewer> takes a resolved src URL plus name and mimeType, and renders the appropriate built-in viewer. URL resolution (auth, signed URLs, etc.) is the consumer's responsibility.` },
                    composition: { title: `Composition`, body: `FileViewer dispatches on mimeType: image/* → ImageViewer (or Image360Viewer when is360 is set); video/* and DASH / HLS manifests → VideoViewer. Unknown types fall back to the file name or a custom fallback node.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Preview a bundled image. Edit any of the three fields to inspect different render paths.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <FileViewer> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            imageViewer: `Renders ImageViewer for image/* without is360.`,
                            image360Viewer: `Renders Image360Viewer for image/* when is360 is true.`,
                            videoViewer: `Renders VideoViewer for any video/* mime type.`,
                            dashHls: `Renders VideoViewer for DASH and HLS manifest mime types.`,
                            nameFallback: `Falls back to the name when no viewer matches.`,
                            customFallback: `Renders the explicit fallback when provided and nothing matches.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Inner viewers follow their own RTL behaviour; the wrapper itself is layout-neutral.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <FileViewer>.` }
                }
            },
            image360Viewer: {
                default: { title: `Default`, description: `Plain Image360Viewer mounting a single equirectangular panorama — drag to look around, scroll to zoom.` },
                switchImages: {
                    title: `Switch images`,
                    description: `Two-source switcher driven by buttons below the viewer. Each click updates the src prop; the viewer reuses its WebGL context (setPanorama) instead of remounting — the previous frame stays visible until the new texture is ready.`
                },
                compassOverlay: {
                    title: `Compass overlay`,
                    description: `Compass component absolutely positioned ON TOP of the viewer (HUD-style) instead of below, so the bearing readout stays in view while the user pans.`
                },
                virtualTour: {
                    title: `Virtual tour`,
                    description: `Markers overlay click-to-navigate hotspots on the sphere. Each pin carries a data.target payload; onMarkerClick swaps the src + marker set, demonstrating the scene-switch pattern. The teal dot is a tooltip-only info hotspot.`
                },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<Image360Viewer> wraps Photo Sphere Viewer (three.js) with shadcn-friendly defaults: hidden navbar, no in-app loading indicator, and an onHeadingChange callback for HUD-style yaw indicators.` },
                    composition: { title: `Composition`, body: `Combine with <Compass> to render a directional indicator that follows the user's view. Pass markers + onMarkerClick to overlay clickable hotspots — backed by the markers-plugin from Photo Sphere Viewer, so HTML/image/polygon markers and tooltips are all supported. Updating the markers prop diff-replaces the live set, which is exactly the pattern a virtual-tour scene swap needs.` },
                    examples: {
                        title: `Examples`,
                        default: { title: `Default`, description: `Plain viewer, no compass, no markers.` },
                        switchImages: {
                            title: `Switch images`,
                            description: `Two buttons swap the src between panoramas; the viewer reuses its WebGL context via setPanorama.`
                        },
                        compassOverlay: {
                            title: `Compass overlay`,
                            description: `Compass rendered on top of the viewer with absolute positioning.`
                        },
                        virtualTour: {
                            title: `Virtual tour`,
                            description: `Markers-plugin hotspots with click-to-navigate between two scenes.`
                        }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <Image360Viewer> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            mountsViewer: `Mounts a Photo Sphere Viewer with the given src.`,
                            subscribesPosition: `Subscribes to the PSV position-updated event to forward heading changes.`,
                            noLoadingIndicator: `Renders no loading indicator while the initial panorama loads.`,
                            hardCutSwitch: `Hides the old panorama under a Skeleton during an src swap and tells PSV to skip its crossfade — the Skeleton clears when the new texture is ready.`,
                            crossfadeOptIn: `crossfadeOnSwitch={true} skips the Skeleton and asks PSV to crossfade between panoramas instead.`,
                            forwardsClassName: `Forwards className onto the outer wrapper.`,
                            forwardsStyle: `Forwards inline style onto the outer wrapper.`
                        }
                    },
                    rtl: { title: `RTL`, body: `The 3D scene is direction-agnostic; the wrapper does not flip.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <Image360Viewer>.` }
                }
            },
            consoleManager: {
                default: { title: `Default`, description: `Tabbed console multiplexer with a Terminal tab and a LogView tab. Double-click a tab to rename, drag to reorder, click + to spawn another.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<ConsoleManager> hosts one or more registered console types (Terminal, LogView, custom) in a tabbed + splittable layout. Tabs stay mounted across tab and pane switches so long-running consoles never reset.` },
                    composition: { title: `Composition`, body: `Each ConsoleType.render() is called once per spawned tab; the result mounts for the lifetime of that tab. defaultName(ordinal) controls per-type auto-naming.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Two registered console types: an interactive Terminal and a static LogView pane.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <ConsoleManager> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            seedsTabs: `Renders the seeded initial tabs and marks the first as active.`,
                            opensNewTab: `Pressing + opens a new tab in the currently active pane (single registered type).`,
                            closesTab: `Closes the active tab and falls back to the previous tab.`,
                            renamesOnDblClick: `Double-click → rename → Enter commits the new name.`,
                            typePicker: `Shows the type-picker chevron when more than one console type is registered.`,
                            splitRight: `Split-right turns the leaf into a horizontal split with a new sibling pane.`,
                            collapseSplit: `Closing the last tab in a split-spawned pane collapses the split back to a single pane.`,
                            keepsInactiveMounted: `Keeps inactive tab bodies mounted so they survive a tab switch.`,
                            dragReorder: `Drag-reorder within a pane swaps the dropped tabs' order.`,
                            dragCrossPane: `Dragging a tab from one pane onto a tab in another moves it across.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Tab list and split layout mirror under dir="rtl"; tab bodies preserve their own direction.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <ConsoleManager>.` }
                }
            },
            timeline: {
                default: { title: `Default`, description: `A 10-hour deployment history with point and range events across the success / warning / error / info statuses. Drag the bottom scrubber's edges to zoom into a slice of the day; drag the middle to pan.` },
                videoScrubbing: { title: `Video scrubbing`, description: `90-second clip with chapter markers and a controlled playhead. Click anywhere on the track to seek, or grab the playhead handle and drag — this is the same scrubbing model as a video editor.` },
                rtl: { title: `RTL`, description: `Timeline under dir="rtl". The track itself stays left-to-right (time always flows forward), labels and titles mirror.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<Timeline> renders a continuous time axis with events plotted at their real timestamps. A resizable scrubber underneath always controls the visible range — drag the thumb to pan, drag its edges to zoom.` },
                    composition: { title: `Composition`, body: `Wire currentTime + onCurrentTimeChange to turn the main track into an interactive video-editor-style scrubber. Wire viewRange + onViewRangeChange to take control of pan/zoom. Lower minViewRangeMs for frame-level precision.` },
                    examples: {
                        title: `Examples`,
                        default: { title: `Default`, description: `A 10-hour deployment history with point and range events across the success / warning / error / info statuses. Drag the bottom scrubber's edges to zoom into a slice of the day; drag the middle to pan.` },
                        videoScrubbing: { title: `Video scrubbing`, description: `90-second clip with chapter markers and a controlled playhead. Click anywhere on the track to seek, or grab the playhead handle and drag — this is the same scrubbing model as a video editor.` }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <Timeline> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            plotsPoints: `Plots a point event at the correct x position based on its timestamp and the active view range.`,
                            plotsRanges: `Plots a range event (with endTimestamp) as a bar whose width matches the span.`,
                            hidesOutsideView: `Hides events whose timestamp falls outside the current view range.`,
                            rendersPlayhead: `Renders the playhead at the currentTime position within the view range.`,
                            scrubsOnClick: `Clicking the track moves the playhead to that timestamp when onCurrentTimeChange is wired.`,
                            scrubsOnDrag: `Dragging across the track updates the playhead continuously as the pointer moves.`,
                            readOnlyWhenNoHandler: `Without onCurrentTimeChange the playhead is read-only and track pointer-downs are ignored.`,
                            pansOnThumb: `Dragging the scrubber thumb shifts the view range while preserving its width.`,
                            zoomsOnHandle: `Dragging either scrubber edge resizes the view range without moving the opposite edge.`,
                            clampsZoom: `Zoom is clamped so the view range can never become smaller than minViewRangeMs.`,
                            controlled: `In controlled mode the component reports gestures via onViewRangeChange and never mutates internal state.`,
                            resetZoom: `A reset-zoom button appears whenever the view is zoomed in, and restores the full window when clicked.`
                        }
                    },
                    rtl: { title: `RTL`, body: `The track keeps a left-to-right time axis under dir="rtl" — time always flows forward — while surrounding labels mirror.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <Timeline>.` }
                }
            },
            nodeEditor: {
                default: { title: `Typed graph`, description: `Four nodes wired through typed ports. The Slider node outputs a number; drag from its right handle to the Doubler's input to see 2× appear live. The Text node outputs a string — dragging it to a number input is rejected by the typed validator. Each node body embeds an arbitrary React component (Slider, Input, live values) to show intermediary results.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<NodeEditor> wraps @xyflow/react (React Flow) with built-in port-type validation, a default node renderer (TypedNode) that embeds arbitrary React content, and a lazy-loaded implementation chunk so consumers only pay the bundle cost when a node editor actually mounts.` },
                    composition: { title: `Composition`, body: `Use <TypedHandle portType="..."> inside custom nodes to declare strict-equality port types. The editor's isValidConnection rejects any connection whose source/target portTypes differ — or where one side is typed and the other isn't. Pass your own renderers via nodeTypes; the built-in "typed" renderer (TypedNode) is always registered and reads inputs/outputs/body off node.data.` },
                    examples: {
                        title: `Examples`,
                        default: { title: `Typed graph`, description: `Four nodes wired through typed ports. The Slider node outputs a number; drag from its right handle to the Doubler's input to see 2× appear live. The Text node outputs a string — dragging it to a number input is rejected by the typed validator. Each node body embeds an arbitrary React component (Slider, Input, live values) to show intermediary results.` }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <NodeEditor> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            acceptsMatchingTypes: `Connection between two TypedHandles is accepted when both portType strings are equal.`,
                            rejectsMismatchedTypes: `Connection between two TypedHandles is rejected when portTypes differ.`,
                            rejectsMixedTypedUntyped: `Connection where one side is a TypedHandle and the other is a bare Handle is rejected.`,
                            allowsTwoUntyped: `Connection between two untyped Handles is allowed.`,
                            rejectsIncompleteDrag: `An incomplete drag (any of source / sourceHandle / target / targetHandle is null) is rejected.`,
                            extraAfterTyped: `A caller-provided isValidConnection is consulted only after the typed check passes.`,
                            lazyChunk: `The implementation chunk is loaded lazily via React.lazy so the @xyflow/react bundle ships only when a NodeEditor mounts.`
                        }
                    },
                    rtl: { title: `RTL`, body: `The graph canvas itself is direction-agnostic — coordinates are absolute. Custom node renderers should respect direction in their text content if needed.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <NodeEditor>, <TypedHandle>, and the data shape consumed by the built-in TypedNode renderer.` }
                }
            },
            dateTimeDisplay: {
                default: { title: `Default`, description: `Formats timestamps and naive datetime strings through Intl.DateTimeFormat using the active language.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<DateTimeDisplay> renders a UTC timestamp or a naive datetime string, formatted through Intl.DateTimeFormat with the active language code.` },
                    composition: { title: `Composition`, body: `Pass timestampMilliseconds (UTC) for absolute times, or dateTimeNaive for "YYYY-MM-DD HH:mm:ss" strings — set utcTime to declare the naive string as UTC instead of local.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Now, a fixed timestamp, and the same naive string rendered as local vs UTC.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <DateTimeDisplay> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            formatsTimestamp: `Renders a formatted timestamp without throwing.`,
                            utcNaive: `Renders a naive UTC datetime when utcTime is set.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Output respects the locale's BIDI rules; the wrapper is layout-neutral.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <DateTimeDisplay>.` }
                }
            },
            resourceList: {
                default: { title: `Default`, description: `Tabular view of 600 deployments rendered via the column row handler. Resize columns by dragging the header borders; click a header to sort.` },
                grid: { title: `Grid`, description: `360 colour swatches rendered as a fixed-cell gallery via GridListRowHandler. Drag the slider in the header to change the column count.` },
                multipleLayouts: { title: `Multiple layouts`, description: `Same product catalog under both a Column and a Grid row handler. Switch layouts via the icon picker in the header — the list keeps its scroll position.` },
                selection: { title: `Selection`, description: `Selection state surfaced via the onSelect handler. Click rows, ctrl/cmd-click to toggle, or shift-click for a range; the panel above mirrors the current count and last selected id.` },
                reorderable: { title: `Reorderable`, description: `Set reorderable on the list to render a drag grip on every row. Dropping a row above or below another fires onReorder(fromIndex, toIndex); the consumer owns the data and applies the move.` },
                crossListDrag: { title: `Cross-list drag`, description: `Three lists. A ↔ B accept each other's drops via reorderAcceptsFrom; C accepts only its own drags. While a drag is in flight every other list paints an overlay: a primary outline for accepting lists, a dimmed wash + "does not accept drops" badge for rejecting ones.` },
                contextMenu: { title: `Context menu`, description: `Right-click any row to open an action menu (Open / Duplicate / Delete). The example wires a Radix DropdownMenu to onContextMenu inside the column render so the right-click target is the row itself.` },
                multipleListsSharedAction: { title: `Shared action across lists`, description: `Two ResourceLists rendered side by side share a single "Delete" action via the global ActionManager. Each row is wrapped in [data-actionscope] + [data-list-id] + [data-item-id]; the one handler reads those attributes off the right-clicked element to dispatch back into the correct list's state.` },
                horizontalStrip: { title: `Horizontal strip`, description: `Custom RowRendererDirection.Horizontal handler renders a horizontally-scrolling strip of cards. Each card embeds a FileViewer in "embedded" mode so the 60 thumbnails decode lazily as they scroll into view.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<ResourceList> renders a large paginated + virtualised list of any resource type. Plug in a getResourcesList function that fetches contiguous windows of items from the server, and pass one or more row handlers to control the layout.` },
                    composition: { title: `Composition`, body: `Provide one or more rowHandlers (Column / Grid / custom) — the user can switch between them via the header. Sort state is forwarded to getResourcesList so the server can return the correct page.` },
                    examples: {
                        title: `Examples`,
                        default: { title: `Default`, description: `Tabular view of 600 deployments rendered via the column row handler. Resize columns by dragging the header borders; click a header to sort.` },
                        grid: { title: `Grid`, description: `360 colour swatches rendered as a fixed-cell gallery via GridListRowHandler. Drag the slider in the header to change the column count.` },
                        multipleLayouts: { title: `Multiple layouts`, description: `Same product catalog under both a Column and a Grid row handler. Switch layouts via the icon picker in the header — the list keeps its scroll position.` },
                        selection: { title: `Selection`, description: `Selection state surfaced via the onSelect handler. Click rows, ctrl/cmd-click to toggle, or shift-click for a range; the panel above mirrors the current count and last selected id.` },
                        reorderable: { title: `Reorderable`, description: `Set reorderable on the list to render a drag grip on every row. Dropping a row above or below another fires onReorder(fromIndex, toIndex); the consumer owns the data and applies the move.` },
                        crossListDrag: { title: `Cross-list drag`, description: `Three lists. A ↔ B accept each other's drops via reorderAcceptsFrom; C accepts only its own drags. While a drag is in flight every other list paints an overlay: a primary outline for accepting lists, a dimmed wash + "does not accept drops" badge for rejecting ones.` },
                        contextMenu: { title: `Context menu`, description: `Right-click any row to open an action menu (Open / Duplicate / Delete). The example wires a Radix DropdownMenu to onContextMenu inside the column render so the right-click target is the row itself.` },
                        multipleListsSharedAction: { title: `Shared action across lists`, description: `Two ResourceLists rendered side by side share a single "Delete" action via the global ActionManager. Each row is wrapped in [data-actionscope] + [data-list-id] + [data-item-id]; the one handler reads those attributes off the right-clicked element to dispatch back into the correct list's state.` },
                        horizontalStrip: { title: `Horizontal strip`, description: `Custom RowRendererDirection.Horizontal handler renders a horizontally-scrolling strip of cards. Each card embeds a FileViewer in "embedded" mode so the 60 thumbnails decode lazily as they scroll into view.` }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <ResourceList> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            callsFetcher: `Calls getResourcesList on mount.`,
                            firstWindow: `First fetch passes fromIndex=0 and a finite positive limit.`,
                            forwardsSort: `Forwards sortBy and sortDirection in the request body.`,
                            reorderFires: `Fires onReorder with the from / to indices after a drag-and-drop reorder.`,
                            crossListAccept: `Accepts drops from lists listed in reorderAcceptsFrom and rejects all others.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Header buttons and column order mirror under dir="rtl".` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <ResourceList>.` }
                }
            },
            keyComboRecorder: {
                default: { title: `Default`, description: `Click "Start recording" and press any combo on your keyboard — each press is captured and appended to the list. Releasing a modifier on its own (e.g. just Shift) is also captured.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the following dependencies:`, manualStep2: `Copy and paste the following code into your project.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<KeyComboRecorder> captures live key combos and formats them through the active HotkeyManager, producing strings that round-trip with HotkeyManager.setHotkey() and KeyComboDisplay.` },
                    composition: { title: `Composition`, body: `Wire the onCombo callback to whatever consumes the combo strings — a settings editor, a quick demo, or a debugger. The component renders its own start / stop / clear buttons and a history list out of the box.` },
                    examples: { title: `Examples`, default: { title: `Default`, description: `Start recording, then press a combo. The last captured combo is shown in the harness state panel.` } },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how <KeyComboRecorder> is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            startsIdle: `Renders the start button and hint copy before recording.`,
                            togglesListening: `Flips to a stop button and a listening indicator once recording starts.`,
                            capturesCombo: `Captures a real combo as a list entry and fires onCombo.`,
                            capturesModifier: `Captures a standalone modifier release (Shift down → Shift up with no key in between).`,
                            clearResets: `Clear button empties the captured-combo list.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Layout flips under dir="rtl"; combos are direction-agnostic.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by <KeyComboRecorder>.` }
                }
            },
            chart: {
                bar: { title: `Bar`, description: `Grouped bars with a shared XAxis. Series colours come from <ChartConfig>; the tooltip and legend pull labels from the same map.` },
                line: { title: `Line`, description: `Smooth monotone line. The tooltip uses an inline "line" indicator that matches the stroke colour of the series.` },
                area: { title: `Area`, description: `Stacked area with per-series gradients. <defs> hosts the gradients; series reference them via fill="url(#…)".` },
                pie: { title: `Pie`, description: `Donut pie. The legend wraps to two rows on narrow widths so the chart never overflows its container.` },
                radar: { title: `Radar`, description: `Polar radar with two overlaid series. The dashed series is rendered without fill so the solid layer reads as the primary signal.` },
                radial: { title: `Radial`, description: `Radial bar with a muted background ring. Each ring is a slice from the same dataset, coloured via the <ChartConfig> palette.` },
                themed: { title: `Themed colours`, description: `Uses the <ChartConfig> "theme" shape to pick a different colour in light vs. dark mode — flip the app theme and the same series re-paints with no JS work.` },
                doc: {
                    installation: { title: `Installation`, commandTab: `Command`, manualTab: `Manual`, manualStep1: `Install the package (recharts ships as a transitive dependency):`, manualStep2: `Copy a chart from the examples below and adjust the <ChartConfig> to match your series.`, manualStep3: `Update the import paths to match your project setup.` },
                    usage: { title: `Usage`, body: `<ChartContainer> wraps any recharts chart, injects per-series CSS colour variables, and provides the context that <ChartTooltipContent> and <ChartLegendContent> read to resolve labels. The config map is the single source of truth for series colours and display names.` },
                    composition: { title: `Composition`, body: `Colours flow as CSS custom properties so the same chart can re-skin under light vs. dark themes without re-rendering. Use the "theme" shape on a config entry to provide per-theme values; use "color" when one shared value is enough.` },
                    examples: {
                        title: `Examples`,
                        bar: { title: `Bar`, description: `Grouped bars driven by two series in the <ChartConfig>.` },
                        line: { title: `Line`, description: `Single-series line with a custom tooltip indicator.` },
                        area: { title: `Area`, description: `Stacked area with per-series gradients defined in <defs>.` },
                        pie: { title: `Pie`, description: `Donut pie with a legend that wraps across narrow widths.` },
                        radar: { title: `Radar`, description: `Polar radar overlaying current vs. target.` },
                        radial: { title: `Radial`, description: `Radial bar showing each datum as a coloured ring.` },
                        themed: { title: `Themed colours`, description: `Per-theme colour values that flip with the app theme.` }
                    },
                    definedBehaviour: {
                        title: `Defined behaviour`, intro: `Statements describing how the chart primitive is expected to behave, each linked to the test that verifies it.`, verifiedBy: `verified by`,
                        statements: {
                            rendersWrapper: `Renders a <div data-slot="chart"> wrapper that owns the chart's CSS scope.`,
                            stableDataChartId: `Tags the wrapper with a stable data-chart="chart-…" id derived from the id prop or React useId.`,
                            forwardsClassName: `Merges the consumer's className onto the wrapper without dropping the base classes.`,
                            emitsStyleVars: `Emits a <style> block that defines "--color-<key>" custom properties for every config entry that has a color or theme.`,
                            mountsRecharts: `Mounts a recharts subtree (BarChart + Tooltip + Bar) inside the container without throwing.`,
                            styleNothingWithoutColor: `<ChartStyle> renders nothing when no config entry declares a color or theme.`,
                            styleThemeScopes: `<ChartStyle> emits one rule for the light theme and one ".dark"-scoped rule for the dark theme.`,
                            tooltipInactive: `<ChartTooltipContent> renders nothing when not active.`,
                            tooltipRendersLabel: `<ChartTooltipContent> renders the configured label and the formatted (toLocaleString) value for each payload entry.`,
                            legendEmptyPayload: `<ChartLegendContent> renders nothing when its payload is empty.`,
                            legendRendersRows: `<ChartLegendContent> renders one row per payload entry and reads the display label from the config.`
                        }
                    },
                    rtl: { title: `RTL`, body: `Recharts lays out left-to-right; the wrapper and tooltip flip under dir="rtl" but the axes themselves are direction-agnostic.` },
                    apiReference: { title: `API Reference`, intro: `Props accepted by the chart primitives.` }
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
