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
                    code: string;
                    console: string;
                    dateTime: string;
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
            };
            examples: {
                _harness: {
                    codeTab: string;
                    stateTab: string;
                    noStateReported: string;
                };
                steps: {
                    horizontal: { title: string; description: string };
                    endAlignment: { title: string; description: string };
                    vertical: { title: string; description: string };
                    statusOverride: { title: string; description: string };
                    wizard: { title: string; description: string };
                    loading: { title: string; description: string };
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
                            endAlignment: { title: string; description: string };
                            vertical: { title: string; description: string };
                            loading: { title: string; description: string };
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
                                endAlignmentSide: string;
                                endAlignmentCenter: string;
                                loadingIndeterminate: string;
                                loadingDeterminate: string;
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
                videoViewer: {
                    default: { title: string; description: string };
                    dash: { title: string; description: string };
                    hls: { title: string; description: string };
                    chapters: { title: string; description: string };
                    controls: { title: string; description: string };
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
                            dash: { title: string; description: string };
                            hls: { title: string; description: string };
                            chapters: { title: string; description: string };
                            controls: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                dispatchByMime: string;
                                dispatchManifest: string;
                                recognisesManifests: string;
                                constructsOnePlayer: string;
                                nativeFallback: string;
                                reusesOnSrcChange: string;
                                cleansUpOnUnmount: string;
                                keyboardTogglePlay: string;
                                keyboardModifierGuard: string;
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
                primaryMenu: {
                    inline: { title: string; description: string };
                    fixed: { title: string; description: string };
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
                            inline: { title: string; description: string };
                            fixed: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                loginVisibleWhenAuthConfigured: string;
                                loginHiddenWhenAuthNotConfigured: string;
                                providerWithoutOidcYieldsNoAuth: string;
                                dropsLeadingSeparator: string;
                                keepsSeparatorWithLogin: string;
                                inlineRendersFullWidth: string;
                                inlineLoggedOutMenuIcon: string;
                                staleSessionTreatedAsLoggedOut: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                globalContextMenu: {
                    default: { title: string; description: string };
                    submenus: { title: string; description: string };
                    modifierVariants: { title: string; description: string };
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
                            submenus: { title: string; description: string };
                            modifierVariants: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                positionsAtCursor: string;
                                sideOffsetZero: string;
                                suppressesNativeOnlyWhenMatched: string;
                                doesNotSuppressWhenScopeEmpty: string;
                                clickItemDispatches: string;
                                updatesOnSecondClick: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                copyValueButton: {
                    label: { title: string; description: string };
                    iconOnly: { title: string; description: string };
                    withToast: { title: string; description: string };
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
                            label: { title: string; description: string };
                            iconOnly: { title: string; description: string };
                            withToast: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersLabelWhenProvided: string;
                                omitsLabelWhenAbsent: string;
                                writesClipboardOnClick: string;
                                showsCopiedTitleTransient: string;
                                firesToastWhenTrue: string;
                                usesProvidedToastMessage: string;
                                noToastWhenOmitted: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                buttonSelect: {
                    default: { title: string; description: string };
                    disabled: { title: string; description: string };
                    disabledOption: { title: string; description: string };
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
                            disabled: { title: string; description: string };
                            disabledOption: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersAllOptions: string;
                                selectedDefaultVariant: string;
                                nonSelectedOutline: string;
                                clickFiresChange: string;
                                disabledOptionNoChange: string;
                                groupDisabledNoChange: string;
                                forwardsClassName: string;
                                forwardsStyle: string;
                                accessibility: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                settingsPanel: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                threeHeadings: string;
                                standalonePickersShowCurrent: string;
                                jsonTabShowsSettings: string;
                                jsonSaveAppliesEdit: string;
                                notificationsSection: string;
                                jsonIncludesToast: string;
                                toastPositionFromJson: string;
                                jsonErrorOnInvalid: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                terminal: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                suspendsAndMounts: string;
                                forwardsHandle: string;
                                firesOnData: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                logView: {
                    default: { title: string; description: string };
                    hideToolbar: { title: string; description: string };
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
                            hideToolbar: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersAllLines: string;
                                emptyPlaceholder: string;
                                filtersBySearch: string;
                                emptyWhenFilteredOut: string;
                                hidesClearWhenNoCallback: string;
                                invokesOnClear: string;
                                hideToolbar: string;
                                reflectsLineUpdates: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                machineMonitor: {
                    default: { title: string; description: string };
                    readOnly: { title: string; description: string };
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
                            readOnly: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                remountsOnUrl: string;
                                readOnlyForcesViewOnly: string;
                                readOnlyPointerEventsNone: string;
                                noPointerEventsWithoutReadOnly: string;
                                preservesExplicitViewOnly: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                sidebar: {
                    default: { title: string; description: string };
                    iconCollapsible: { title: string; description: string };
                    collapsibleGroups: { title: string; description: string };
                    resizable: { title: string; description: string };
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
                            iconCollapsible: { title: string; description: string };
                            collapsibleGroups: { title: string; description: string };
                            resizable: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                cssVarApplies: string;
                                seedsDefaultWidth: string;
                                rendersHandleWhenResizable: string;
                                noHandleWhenNotResizable: string;
                                dragPersists: string;
                                clampsToMax: string;
                                clampsToMin: string;
                                doubleClickReset: string;
                                restoresFromCookie: string;
                                reclampsPersisted: string;
                                dragsInwardOnRight: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                tabs: {
                    default: { title: string; description: string };
                    disabled: { title: string; description: string };
                    controlled: { title: string; description: string };
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
                            disabled: { title: string; description: string };
                            controlled: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                showsDefaultPanel: string;
                                switchesOnClick: string;
                                dataStateActive: string;
                                disabledNoActivate: string;
                                controlledValue: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                badge: {
                    default: { title: string; description: string };
                    variants: { title: string; description: string };
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
                            variants: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersChildren: string;
                                defaultVariantClasses: string;
                                eachVariantClasses: string;
                                forwardsClassName: string;
                                forwardsAttributes: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                button: {
                    default: { title: string; description: string };
                    variants: { title: string; description: string };
                    sizes: { title: string; description: string };
                    asChild: { title: string; description: string };
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
                            variants: { title: string; description: string };
                            sizes: { title: string; description: string };
                            asChild: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersNativeButton: string;
                                defaultVariantAndSize: string;
                                appliesVariants: string;
                                appliesSizes: string;
                                firesOnClick: string;
                                noClickWhenDisabled: string;
                                asChildRendersChild: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                card: {
                    default: { title: string; description: string };
                    headerOnly: { title: string; description: string };
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
                            headerOnly: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                shell: string;
                                slotOrder: string;
                                titleTypography: string;
                                descriptionColour: string;
                                refForwarding: string;
                                classNameMerge: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                checkbox: {
                    default: { title: string; description: string };
                    indeterminate: { title: string; description: string };
                    disabled: { title: string; description: string };
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
                            indeterminate: { title: string; description: string };
                            disabled: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                defaultUnchecked: string;
                                indicatorWhenChecked: string;
                                defaultCheckedOnMount: string;
                                firesOnCheckedChange: string;
                                fullyControllable: string;
                                noToggleWhenDisabled: string;
                                indeterminateDataState: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                switch: {
                    default: { title: string; description: string };
                    disabled: { title: string; description: string };
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
                            disabled: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                defaultUnchecked: string;
                                defaultCheckedOnMount: string;
                                firesOnCheckedChange: string;
                                fullyControllable: string;
                                noToggleWhenDisabled: string;
                                thumbTranslates: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                collapsible: {
                    default: { title: string; description: string };
                    controlled: { title: string; description: string };
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
                            controlled: { title: string; description: string };
                            nested: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                closedByDefault: string;
                                reflectsDefaultOpen: string;
                                opensClosesOnClick: string;
                                firesOnOpenChange: string;
                                fullyControllable: string;
                                disabledNoToggle: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                input: {
                    default: { title: string; description: string };
                    types: { title: string; description: string };
                    disabled: { title: string; description: string };
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
                            types: { title: string; description: string };
                            disabled: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersTextInput: string;
                                forwardsType: string;
                                firesOnChange: string;
                                fullyControllable: string;
                                noInputWhenDisabled: string;
                                forwardsRef: string;
                                classNameMerge: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                label: {
                    default: { title: string; description: string };
                    htmlFor: { title: string; description: string };
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
                            htmlFor: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersNativeLabel: string;
                                typographyClasses: string;
                                htmlForFocuses: string;
                                classNameMerge: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                textarea: {
                    default: { title: string; description: string };
                    disabled: { title: string; description: string };
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
                            disabled: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersNativeTextarea: string;
                                firesOnChange: string;
                                fullyControllable: string;
                                forwardsRef: string;
                                disabledPreventsTyping: string;
                                baseStyling: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                skeleton: {
                    default: { title: string; description: string };
                    card: { title: string; description: string };
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
                            card: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                baseClasses: string;
                                forwardsClassName: string;
                                forwardsAttributes: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                progress: {
                    default: { title: string; description: string };
                    animated: { title: string; description: string };
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
                            animated: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersTrack: string;
                                translateAtZero: string;
                                translateAtFifty: string;
                                translateAtHundred: string;
                                omittedAsZero: string;
                                classNameMerge: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                dialog: {
                    default: { title: string; description: string };
                    hideClose: { title: string; description: string };
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
                            hideClose: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                closedByDefault: string;
                                defaultOpen: string;
                                opensOnTrigger: string;
                                ariaWiring: string;
                                closeButton: string;
                                closesOnEscape: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                popover: {
                    default: { title: string; description: string };
                    form: { title: string; description: string };
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
                            form: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                closedByDefault: string;
                                defaultOpen: string;
                                opensOnTrigger: string;
                                closesOnEscape: string;
                                portalsToBody: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                scrollArea: {
                    default: { title: string; description: string };
                    horizontal: { title: string; description: string };
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
                            horizontal: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                shell: string;
                                viewport: string;
                                viewportRef: string;
                                viewportClassName: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                radioGroup: {
                    default: { title: string; description: string };
                    disabledOption: { title: string; description: string };
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
                            disabledOption: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersRadios: string;
                                roleRadiogroup: string;
                                defaultValueOnMount: string;
                                firesOnValueChange: string;
                                fullyControllable: string;
                                disabledNoSwitch: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                slider: {
                    default: { title: string; description: string };
                    range: { title: string; description: string };
                    disabled: { title: string; description: string };
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
                            range: { title: string; description: string };
                            disabled: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                singleThumbDefault: string;
                                thumbsFromDefaultValue: string;
                                thumbsFromControlledValue: string;
                                forwardsMinMax: string;
                                defaultRange: string;
                                disabledForwards: string;
                                classNameMerge: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                contextMenu: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                closedByDefault: string;
                                opensOnContextmenu: string;
                                firesOnSelect: string;
                                disabledIgnored: string;
                                closesOnSelect: string;
                                separator: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                dropdownMenu: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                closedByDefault: string;
                                opensOnTrigger: string;
                                firesOnSelectAndCloses: string;
                                disabledData: string;
                                closesOnEscape: string;
                                labelNotMenuitem: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                hoverCard: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                closedByDefault: string;
                                defaultOpenRenders: string;
                                contentStyling: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                select: {
                    default: { title: string; description: string };
                    disabledOption: { title: string; description: string };
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
                            disabledOption: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                placeholderWhenEmpty: string;
                                reflectsDefaultValue: string;
                                fullyControllable: string;
                                firesOnExternalValueChange: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                sonner: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                contextTopLeft: string;
                                contextBottomCenter: string;
                                propOverrides: string;
                                noProvider: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                inputGroup: {
                    default: { title: string; description: string };
                    trailingAddon: { title: string; description: string };
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
                            trailingAddon: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersGroup: string;
                                focusOnAddonClick: string;
                                alignInlineEnd: string;
                                alignDefault: string;
                                forwardsAriaInvalid: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                resizable: {
                    default: { title: string; description: string };
                    vertical: { title: string; description: string };
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
                            vertical: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                everyPanelDeclared: string;
                                fillsMissing: string;
                                splitsAcrossMany: string;
                                returnsNullOnOverflow: string;
                                returnsNullWhenEmpty: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                calendar: {
                    default: { title: string; description: string };
                    disableFuture: { title: string; description: string };
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
                            disableFuture: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersGrid: string;
                                marksSelected: string;
                                firesOnSelect: string;
                                disableFutureDisables: string;
                                navigatesMonths: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                compass: {
                    default: { title: string; description: string };
                    markers: { title: string; description: string };
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
                            markers: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                defaultReadout: string;
                                normalisesNegative: string;
                                normalisesLarge: string;
                                mapsCardinal: string;
                                cardinalsByDefault: string;
                                readoutNullHides: string;
                                customReadout: string;
                                rendersMarkers: string;
                                hideCardinals: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                avatar: {
                    default: { title: string; description: string };
                    loading: { title: string; description: string };
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
                            loading: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                uppercasedInitial: string;
                                unicodeInitial: string;
                                skeletonWhenMissing: string;
                                skeletonWhenEmpty: string;
                                classNameMerge: string;
                                styleForwards: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                actionDisplay: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                translatesLabel: string;
                                fallsBackToId: string;
                                rendersIcon: string;
                                exposesDisabledReason: string;
                                rendersHotkeys: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                keyComboDisplay: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                eachSegmentKbd: string;
                                alphaUppercased: string;
                                modifiersTranslated: string;
                                iconForUniversal: string;
                                arrowupIcon: string;
                                plusSeparator: string;
                                escapeWord: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                keyboardShortcutEditor: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                listsActions: string;
                                rendersCurrentCombos: string;
                                filtersBySearch: string;
                                emptyStateOnNoMatches: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                expandableCode: {
                    default: { title: string; description: string };
                    short: { title: string; description: string };
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
                            short: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersChildren: string;
                                noButtonWhenFits: string;
                                buttonWhenOverflow: string;
                                togglesLabels: string;
                                defaultExpanded: string;
                                labelOverrides: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                searchInput: {
                    default: { title: string; description: string };
                    hideIcon: { title: string; description: string };
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
                            hideIcon: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                typeSearch: string;
                                leadingIcon: string;
                                hideIcon: string;
                                firesOnValueChange: string;
                                showsClearWhenNonEmpty: string;
                                clearResetsValue: string;
                                hideClearButton: string;
                                disabledForwards: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                numberInput: {
                    default: { title: string; description: string };
                    decimal: { title: string; description: string };
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
                            decimal: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersValue: string;
                                nullRendersEmpty: string;
                                clearEmitsNull: string;
                                bumpsByStepPlus: string;
                                bumpsByStepMinus: string;
                                clampsToMin: string;
                                clampsToMax: string;
                                clampOnBlur: string;
                                hideStepper: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                optionPicker: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersLabel: string;
                                showsCountByDefault: string;
                                hidesCountWhenFalse: string;
                                menuItemsAfterOpen: string;
                                firesOnToggle: string;
                                staysOpenOnToggle: string;
                                rendersHeader: string;
                                disabledForwards: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                searchSelectPicker: {
                    standalone: { title: string; description: string };
                    popover: { title: string; description: string };
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
                            standalone: { title: string; description: string };
                            popover: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersInlineList: string;
                                filtersBySearch: string;
                                emptyTextOnNoMatches: string;
                                firesOnSelect: string;
                                fullyControllable: string;
                                popoverTriggerOpens: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                languagePicker: {
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
                                listsLanguages: string;
                                firesSetLanguage: string;
                                popoverShowsCurrent: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                themePicker: {
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
                                listsThemes: string;
                                firesSetTheme: string;
                                popoverShowsCurrent: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                mapStylePicker: {
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
                                listsStyles: string;
                                firesSetMapStyle: string;
                                popoverShowsCurrent: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                map: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                lazyLoadsMapbox: string;
                                usesContextStyle: string;
                                propOverridesContext: string;
                                appliesAccessToken: string;
                                reactsToContextChange: string;
                                firesOnLoad: string;
                                cleansUpOnUnmount: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                locationPicker: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersMap: string;
                                uncontrolledClickUpdates: string;
                                controlledFiresOnChange: string;
                                clearResets: string;
                                mountsMarker: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                dateTimePicker: {
                    default: { title: string; description: string };
                    withTimezone: { title: string; description: string };
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
                            withTimezone: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersTextInput: string;
                                seedsFromDefault: string;
                                reflectsControlled: string;
                                firesOnConfirm: string;
                                disabledForwards: string;
                                placeholderReflectsFormat: string;
                                showsTimezoneSelector: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                timePicker: {
                    default: { title: string; description: string };
                    twelveHour: { title: string; description: string };
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
                            twelveHour: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersColumns24h: string;
                                secondsColumn: string;
                                firesOnHourPick: string;
                                fullyControllable: string;
                                amPmColumn: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                timezoneSelector: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersTrigger: string;
                                showsSelected: string;
                                opensSearch: string;
                                firesOnChange: string;
                                fullyControllable: string;
                                disabledNoOpen: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                dateTimeRangePicker: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersBothInputs: string;
                                reflectsFrom: string;
                                reflectsTo: string;
                                fullyControllable: string;
                                disabledForwards: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                loggingConfig: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersDefaultLevel: string;
                                exposesFilterInput: string;
                                addsFilter: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                inlineEdit: {
                    basic: { title: string; description: string };
                    heading: { title: string; description: string };
                    placeholder: { title: string; description: string };
                    fixedWidth: { title: string; description: string };
                    disabled: { title: string; description: string };
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
                            basic: { title: string; description: string };
                            heading: { title: string; description: string };
                            placeholder: { title: string; description: string };
                            fixedWidth: { title: string; description: string };
                            disabled: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                rendersValue: string;
                                commitsOnEnter: string;
                                cancelsOnEscape: string;
                                discardsUnchanged: string;
                                hidesButtonsWhenDisabled: string;
                                stableAffordanceWidth: string;
                                fixedWidthDoesNotGrow: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                commandPalette: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                closedByDefault: string;
                                opensOnControlled: string;
                                rendersActions: string;
                                filtersBySearch: string;
                                dispatchesOnClick: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                modalHandler: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                invisibleWhenNoModal: string;
                                themeSelector: string;
                                languageSelector: string;
                                keyboardShortcutEditor: string;
                                customModal: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                fileViewer: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                imageViewer: string;
                                image360Viewer: string;
                                videoViewer: string;
                                dashHls: string;
                                nameFallback: string;
                                customFallback: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                image360Viewer: {
                    default: { title: string; description: string };
                    switchImages: { title: string; description: string };
                    compassOverlay: { title: string; description: string };
                    virtualTour: { title: string; description: string };
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
                            switchImages: { title: string; description: string };
                            compassOverlay: { title: string; description: string };
                            virtualTour: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                mountsViewer: string;
                                subscribesPosition: string;
                                noLoadingIndicator: string;
                                hardCutSwitch: string;
                                crossfadeOptIn: string;
                                forwardsClassName: string;
                                forwardsStyle: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                resourceList: {
                    default: { title: string; description: string };
                    grid: { title: string; description: string };
                    multipleLayouts: { title: string; description: string };
                    selection: { title: string; description: string };
                    reorderable: { title: string; description: string };
                    crossListDrag: { title: string; description: string };
                    contextMenu: { title: string; description: string };
                    multipleListsSharedAction: { title: string; description: string };
                    horizontalStrip: { title: string; description: string };
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
                            grid: { title: string; description: string };
                            multipleLayouts: { title: string; description: string };
                            selection: { title: string; description: string };
                            reorderable: { title: string; description: string };
                            crossListDrag: { title: string; description: string };
                            contextMenu: { title: string; description: string };
                            multipleListsSharedAction: { title: string; description: string };
                            horizontalStrip: { title: string; description: string };
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                callsFetcher: string;
                                firstWindow: string;
                                forwardsSort: string;
                                reorderFires: string;
                                crossListAccept: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                consoleManager: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                seedsTabs: string;
                                opensNewTab: string;
                                closesTab: string;
                                renamesOnDblClick: string;
                                typePicker: string;
                                splitRight: string;
                                collapseSplit: string;
                                keepsInactiveMounted: string;
                                dragReorder: string;
                                dragCrossPane: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                dateTimeDisplay: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                formatsTimestamp: string;
                                utcNaive: string;
                            };
                        };
                        rtl: { title: string; body: string };
                        apiReference: { title: string; intro: string };
                    };
                };
                keyComboRecorder: {
                    default: { title: string; description: string };
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
                        };
                        definedBehaviour: {
                            title: string;
                            intro: string;
                            verifiedBy: string;
                            statements: {
                                startsIdle: string;
                                togglesListening: string;
                                capturesCombo: string;
                                capturesModifier: string;
                                clearResets: string;
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
