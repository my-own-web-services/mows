import {
    AppWindow,
    BookOpen,
    Boxes,
    CalendarClock,
    Code,
    FileImage,
    Keyboard,
    List,
    ListTree,
    Map as MapIcon,
    Settings,
    SquarePen,
    Star,
    TerminalSquare,
    User,
    Workflow,
    type LucideIcon
} from "lucide-react";
import { createRef, type CSSProperties, PureComponent } from "react";
import CommandPalette from "../lib/components/appShell/commandPalette/CommandPalette";
import GlobalContextMenu from "../lib/components/appShell/globalContextMenu/GlobalContextMenu";
import ModalHandler from "../lib/components/appShell/modalHandler/ModalHandler";
import PrimaryMenu from "../lib/components/appShell/primaryMenu/PrimaryMenu";
import SearchInput from "../lib/components/input/searchInput/SearchInput";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "../lib/components/ui/resizable";
import { Button } from "../lib/components/ui/button";
import { ScrollArea } from "../lib/components/ui/scroll-area";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from "../lib/components/ui/sidebar";
import { Toaster } from "../lib/components/ui/sonner";
import { MowsContext } from "../lib/lib/mowsContext/MowsContext";
import { cn } from "../lib/lib/utils";
import { demos, type DemoEntry, type DemoGroupKey } from "./demos";
import { exampleTranslationRef } from "./exampleActions";
import { guides, type GuideEntry } from "./guides";
import {
    DEMO_PATH_PREFIX,
    GUIDE_PATH_PREFIX,
    pathForDemoName,
    pathForGuideName
} from "./componentRoutes";

type SelectionKind = `demo` | `guide`;
interface Selection {
    readonly kind: SelectionKind;
    readonly id: string;
}

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {
    readonly selected: Selection;
    readonly search: string;
    readonly favorites: ReadonlySet<string>;
}

const FAVORITES_STORAGE_KEY = `mows-components-example-favorites`;

const loadFavorites = (): Set<string> => {
    try {
        const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((v): v is string => typeof v === `string`));
    } catch {
        // Corrupted or unavailable storage — start fresh; favorites are
        // purely a convenience feature so it's safe to lose them.
        return new Set();
    }
};

const saveFavorites = (favorites: ReadonlySet<string>): void => {
    try {
        window.localStorage.setItem(
            FAVORITES_STORAGE_KEY,
            JSON.stringify([...favorites])
        );
    } catch {
        // localStorage may be unavailable (private mode, quota); favorites
        // simply won't persist this session.
    }
};

// FUTURE-22: the canonical list of sidebar groups lives in
// `src/languages.ts` under `example.sidebar.groups`. Adding a new
// group means (1) extending that translation key (en-US + de), then
// (2) adding the matching icon here. `DemoGroupKey` is inferred from
// the translation tree, so TypeScript catches the icon-side gap at
// compile time but the doc trail starts at the translation file.
const GROUP_ICONS: Record<DemoGroupKey, LucideIcon> = {
    actions: Keyboard,
    appShell: AppWindow,
    code: Code,
    console: TerminalSquare,
    dateTime: CalendarClock,
    editor: Workflow,
    files: FileImage,
    identity: User,
    input: SquarePen,
    list: List,
    map: MapIcon,
    navigation: ListTree,
    settings: Settings,
    uiPrimitives: Boxes
};

// URLs use the demo's PascalCase `name` as the path segment so the address
// bar always reflects the exact component name, including ui primitives
// (e.g. `/Button` instead of `/ui-button`). Guides live under
// `/guide/<PascalCaseName>` so they never collide with the component
// namespace.
const selectionFromPath = (pathname: string): Selection | undefined => {
    // Parse via WHATWG URL so query strings ("/Button?focus=variants") and
    // trailing slashes ("/Button/") are handled uniformly — naive
    // `pathname.split('/')` would either keep the query string in the
    // segment or stumble on an empty trailing entry (TASTE-14).
    const url = new URL(pathname, window.location.origin);
    const normalized = url.pathname;
    if (normalized.startsWith(GUIDE_PATH_PREFIX)) {
        const remainder = normalized.slice(GUIDE_PATH_PREFIX.length);
        const guideSegment = remainder.split(`/`).filter(Boolean)[0];
        if (!guideSegment) return undefined;
        const guideLower = guideSegment.toLowerCase();
        const guide = guides.find((entry) => entry.name.toLowerCase() === guideLower);
        return guide ? { kind: `guide`, id: guide.id } : undefined;
    }
    const remainder = normalized.startsWith(DEMO_PATH_PREFIX)
        ? normalized.slice(DEMO_PATH_PREFIX.length)
        : normalized;
    const segment = remainder.split(`/`).filter(Boolean)[0];
    if (!segment) return undefined;
    const lower = segment.toLowerCase();
    const demo = demos.find((entry) => entry.name.toLowerCase() === lower);
    return demo ? { kind: `demo`, id: demo.id } : undefined;
};

const pathForSelection = (selection: Selection): string => {
    if (selection.kind === `guide`) {
        const guide = guides.find((guide) => guide.id === selection.id);
        return pathForGuideName(guide ? guide.name : selection.id);
    }
    const demo = demos.find((demo) => demo.id === selection.id);
    return pathForDemoName(demo ? demo.name : selection.id);
};

export default class App extends PureComponent<AppProps, AppState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    private viewportRef = createRef<HTMLDivElement>();

    constructor(props: AppProps) {
        super(props);
        const initial: Selection =
            selectionFromPath(window.location.pathname) ?? {
                kind: `demo`,
                id: demos[0].id
            };
        this.state = { selected: initial, search: ``, favorites: loadFavorites() };
    }

    toggleFavorite = (id: string) => {
        this.setState((prev) => {
            const next = new Set(prev.favorites);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            saveFavorites(next);
            return { favorites: next };
        });
    };

    setSearch = (search: string) => this.setState({ search });

    componentDidMount = () => {
        exampleTranslationRef.current = this.context!.t;

        // If the URL did not point at a known demo/guide, normalize it to the
        // resolved selection without adding a history entry.
        const fromPath = selectionFromPath(window.location.pathname);
        if (
            !fromPath ||
            fromPath.kind !== this.state.selected.kind ||
            fromPath.id !== this.state.selected.id
        ) {
            window.history.replaceState({}, ``, pathForSelection(this.state.selected));
        }
        this.syncTitle(this.state.selected);

        window.addEventListener(`popstate`, this.handlePopState);
    };

    componentWillUnmount = () => {
        window.removeEventListener(`popstate`, this.handlePopState);
    };

    componentDidUpdate = (_prevProps: AppProps, prevState: AppState) => {
        exampleTranslationRef.current = this.context!.t;
        const prevSel = prevState.selected;
        const sel = this.state.selected;
        if (prevSel.kind !== sel.kind || prevSel.id !== sel.id) {
            this.syncTitle(sel);
            // Reset the content viewport so the new doc page opens at the top
            // rather than inheriting the scroll position of the previous demo.
            // `PageIndex` will override this via its own mount effect when the
            // URL still names an anchor on the new page.
            if (!window.location.hash) {
                this.viewportRef.current?.scrollTo({ top: 0 });
            }
        }
    };

    handlePopState = () => {
        const next = selectionFromPath(window.location.pathname);
        if (!next) return;
        const cur = this.state.selected;
        if (next.kind !== cur.kind || next.id !== cur.id) {
            this.setState({ selected: next });
        }
    };

    syncTitle = (selection: Selection) => {
        const t = this.context!.t;
        if (selection.kind === `guide`) {
            const guide = guides.find((guide) => guide.id === selection.id);
            if (!guide) return;
            document.title = `${guide.label(t)} · ${t.example.pageTitle}`;
            return;
        }
        const demo = demos.find((demo) => demo.id === selection.id);
        if (!demo) return;
        document.title = `${demo.name} · ${t.example.pageTitle}`;
    };

    select = (selection: Selection) => {
        const cur = this.state.selected;
        if (selection.kind === cur.kind && selection.id === cur.id) return;
        window.history.pushState({}, ``, pathForSelection(selection));
        this.setState({ selected: selection });
    };

    render = () => {
        const t = this.context!.t.example;
        const isGuide = this.state.selected.kind === `guide`;
        const selectedGuide: GuideEntry | undefined = isGuide
            ? guides.find((guide) => guide.id === this.state.selected.id)
            : undefined;
        const selected =
            !isGuide
                ? demos.find((demo) => demo.id === this.state.selected.id) ?? demos[0]
                : demos[0]; // unused when isGuide; harmless placeholder
        const groupOrder: DemoGroupKey[] = [
            `actions`,
            `appShell`,
            `code`,
            `console`,
            `dateTime`,
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
        const search = this.state.search.trim().toLowerCase();
        const matches = (demo: DemoEntry): boolean => {
            if (!search) return true;
            if (demo.name.toLowerCase().includes(search)) return true;
            const groupLabel = t.sidebar.groups[demo.groupKey].toLowerCase();
            if (groupLabel.includes(search)) return true;
            // Extra synonyms / feature words declared by the demo itself
            // (e.g. "range" for the slider) so search is not limited to the
            // exact component name.
            return (demo.searchTags ?? []).some((tag) =>
                tag.toLowerCase().includes(search)
            );
        };
        const grouped = groupOrder
            .map(
                (key): [DemoGroupKey, DemoEntry[]] => [
                    key,
                    demos
                        .filter((d) => d.groupKey === key && matches(d))
                        // Always render items in alphabetical order so the
                        // sidebar stays predictable regardless of the order
                        // in `demos.tsx`.
                        .sort((a, b) =>
                            a.name.localeCompare(b.name, undefined, {
                                sensitivity: `base`
                            })
                        )
                ]
            )
            .filter(([, items]) => items.length > 0);

        // Favorites span across groups — collect them separately and keep
        // them sorted alphabetically. The same demos still appear in their
        // home group below, by design.
        const favoriteDemos = demos
            .filter((d) => this.state.favorites.has(d.id) && matches(d))
            .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: `base` })
            );

        const hasAnyResults = grouped.length > 0 || favoriteDemos.length > 0;

        const renderMenuItem = (demo: DemoEntry) => {
            const isFav = this.state.favorites.has(demo.id);
            return (
                <SidebarMenuItem key={demo.id}>
                    <SidebarMenuButton
                        asChild
                        isActive={!isGuide && demo.id === selected.id}
                    >
                        <a
                            href={pathForSelection({ kind: `demo`, id: demo.id })}
                            onClick={(event) => {
                                if (
                                    event.metaKey ||
                                    event.ctrlKey ||
                                    event.shiftKey ||
                                    event.altKey ||
                                    event.button !== 0
                                ) {
                                    return;
                                }
                                event.preventDefault();
                                this.select({ kind: `demo`, id: demo.id });
                            }}
                        >
                            <span>{demo.name}</span>
                        </a>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                        // Hide the outline-star affordance until the row
                        // is hovered/focused; favorited items keep their
                        // filled star permanently visible so you can see
                        // at a glance what's already starred.
                        showOnHover={!isFav}
                        onClick={(event) => {
                            // The action sits on top of the menu button;
                            // stop propagation so toggling a star doesn't
                            // also navigate to the demo.
                            event.preventDefault();
                            event.stopPropagation();
                            this.toggleFavorite(demo.id);
                        }}
                        aria-pressed={isFav}
                        aria-label={
                            isFav
                                ? t.sidebar.removeFromFavoritesAriaLabel
                                : t.sidebar.addToFavoritesAriaLabel
                        }
                        title={
                            isFav
                                ? t.sidebar.removeFromFavoritesAriaLabel
                                : t.sidebar.addToFavoritesAriaLabel
                        }
                        className={cn(
                            `cursor-pointer`,
                            isFav
                                ? `text-primary hover:text-primary/80`
                                : `text-muted-foreground hover:text-foreground`
                        )}
                    >
                        <Star
                            className={isFav ? `fill-current` : undefined}
                            aria-hidden
                        />
                    </SidebarMenuAction>
                </SidebarMenuItem>
            );
        };

        return (
            <SidebarProvider>
                <div
                    style={this.props.style}
                    className={cn(
                        `App flex h-screen w-full bg-background text-foreground`,
                        this.props.className
                    )}
                >
                    {/*
                     * Sidebar + content live in a ResizablePanelGroup so the
                     * sidebar width can be dragged. `react-resizable-panels`
                     * autosaves the layout to localStorage under the id below.
                     */}
                    <ResizablePanelGroup
                        direction={`horizontal`}
                        autoSaveId={`mows-components-example-sidebar`}
                        className={`min-h-0 flex-1`}
                    >
                        <ResizablePanel
                            id={`sidebar`}
                            order={1}
                            defaultSize={20}
                            minSize={12}
                            maxSize={40}
                            className={`flex min-w-0 flex-col`}
                        >
                            <Sidebar
                                collapsible={`none`}
                                className={`h-full w-full min-w-0`}
                            >
                                <SidebarHeader>
                                    <div
                                        className={`flex items-center gap-2 px-1 pb-1 text-sm font-semibold`}
                                    >
                                        <img
                                            src={`${DEMO_PATH_PREFIX}apps_logo.svg`}
                                            alt={`MOWS Apps logo`}
                                            className={`h-6 w-6 shrink-0`}
                                        />
                                        <span className={`truncate`}>
                                            MOWS React Components
                                        </span>
                                    </div>
                                    {/* Guides nav. Lives above the search so it
                                        always stays reachable even while the
                                        user is filtering the component list. */}
                                    <SidebarMenu>
                                        {guides.map((guide) => {
                                            const sel: Selection = {
                                                kind: `guide`,
                                                id: guide.id
                                            };
                                            const isActive =
                                                isGuide &&
                                                this.state.selected.id === guide.id;
                                            return (
                                                <SidebarMenuItem key={guide.id}>
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={isActive}
                                                    >
                                                        <a
                                                            href={pathForSelection(sel)}
                                                            onClick={(event) => {
                                                                if (
                                                                    event.metaKey ||
                                                                    event.ctrlKey ||
                                                                    event.shiftKey ||
                                                                    event.altKey ||
                                                                    event.button !== 0
                                                                ) {
                                                                    return;
                                                                }
                                                                event.preventDefault();
                                                                this.select(sel);
                                                            }}
                                                        >
                                                            <BookOpen
                                                                className={`h-3.5 w-3.5`}
                                                                aria-hidden
                                                            />
                                                            <span>
                                                                {guide.label(
                                                                    this.context!.t
                                                                )}
                                                            </span>
                                                        </a>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            );
                                        })}
                                    </SidebarMenu>
                                    <SearchInput
                                        value={this.state.search}
                                        onValueChange={this.setSearch}
                                        placeholder={t.sidebar.searchPlaceholder}
                                        aria-label={t.sidebar.searchAriaLabel}
                                        clearAriaLabel={t.sidebar.searchClearAriaLabel}
                                    />
                                </SidebarHeader>
                                <SidebarContent>
                                    {!hasAnyResults && (
                                        <p className={`px-4 py-4 text-sm text-muted-foreground`}>
                                            {t.sidebar.noMatches}
                                        </p>
                                    )}
                                    {favoriteDemos.length > 0 && (
                                        <SidebarGroup key={`__favorites__`}>
                                            <SidebarGroupLabel
                                                className={`flex items-center gap-2 uppercase`}
                                            >
                                                <Star
                                                    className={`h-3.5 w-3.5 fill-current text-primary`}
                                                    aria-hidden
                                                />
                                                <span>{t.sidebar.favorites}</span>
                                            </SidebarGroupLabel>
                                            <SidebarGroupContent>
                                                <SidebarMenu>
                                                    {favoriteDemos.map(renderMenuItem)}
                                                </SidebarMenu>
                                            </SidebarGroupContent>
                                        </SidebarGroup>
                                    )}
                                    {grouped.map(([groupKey, items]) => {
                                        const Icon = GROUP_ICONS[groupKey];
                                        return (
                                            <SidebarGroup key={groupKey}>
                                                <SidebarGroupLabel
                                                    className={`flex items-center gap-2 uppercase`}
                                                >
                                                    <Icon
                                                        className={`h-3.5 w-3.5`}
                                                        aria-hidden
                                                    />
                                                    <span>{t.sidebar.groups[groupKey]}</span>
                                                </SidebarGroupLabel>
                                                <SidebarGroupContent>
                                                    <SidebarMenu>
                                                        {items.map(renderMenuItem)}
                                                    </SidebarMenu>
                                                </SidebarGroupContent>
                                            </SidebarGroup>
                                        );
                                    })}
                                </SidebarContent>
                                {/* Inline PrimaryMenu brings its own top
                                    divider + edge-to-edge padding so it
                                    sits flush as the sidebar's bottom bar. */}
                                <PrimaryMenu
                                    variant={`inline`}
                                    user={{ displayName: `Demo User`, id: `demo-user-id` }}
                                />
                            </Sidebar>
                        </ResizablePanel>
                        <ResizableHandle />
                        <ResizablePanel id={`content`} order={2} minSize={40}>
                            <SidebarInset className={`h-full min-w-0`}>
                                <ScrollArea className={`h-full`} viewportRef={this.viewportRef}>
                                    <div className={`mx-auto max-w-6xl px-6 pt-12 pb-6`}>
                                        {isGuide && selectedGuide ? (
                                            <>
                                                <div className={`mb-10`}>
                                                    <h2
                                                        className={`text-4xl font-semibold tracking-tight`}
                                                    >
                                                        {selectedGuide.label(this.context!.t)}
                                                    </h2>
                                                    <p
                                                        className={`mt-3 flex items-center gap-1.5 text-xs uppercase text-muted-foreground`}
                                                    >
                                                        <BookOpen
                                                            className={`h-3.5 w-3.5`}
                                                            aria-hidden
                                                        />
                                                        <span>{t.sidebar.guidesLabel}</span>
                                                    </p>
                                                </div>
                                                {selectedGuide.render()}
                                            </>
                                        ) : (
                                            <>
                                                <div className={`mb-10`}>
                                                    <div
                                                        className={`flex items-center gap-3`}
                                                    >
                                                        <h2
                                                            className={`text-4xl font-semibold tracking-tight`}
                                                        >
                                                            {selected.name}
                                                        </h2>
                                                        {(() => {
                                                            const isFav = this.state.favorites.has(
                                                                selected.id
                                                            );
                                                            const label = isFav
                                                                ? t.sidebar.removeFromFavoritesAriaLabel
                                                                : t.sidebar.addToFavoritesAriaLabel;
                                                            return (
                                                                <Button
                                                                    type={`button`}
                                                                    variant={`ghost`}
                                                                    size={`icon`}
                                                                    onClick={() =>
                                                                        this.toggleFavorite(
                                                                            selected.id
                                                                        )
                                                                    }
                                                                    aria-pressed={isFav}
                                                                    aria-label={label}
                                                                    title={label}
                                                                    className={cn(
                                                                        isFav
                                                                            ? `text-primary hover:text-primary/80`
                                                                            : `text-muted-foreground hover:text-foreground`
                                                                    )}
                                                                >
                                                                    <Star
                                                                        className={cn(
                                                                            `h-6 w-6`,
                                                                            isFav && `fill-current`
                                                                        )}
                                                                        aria-hidden
                                                                    />
                                                                </Button>
                                                            );
                                                        })()}
                                                    </div>
                                                    {(() => {
                                                        const CategoryIcon =
                                                            GROUP_ICONS[selected.groupKey];
                                                        return (
                                                            <p
                                                                className={`mt-3 flex items-center gap-1.5 text-xs uppercase text-muted-foreground`}
                                                            >
                                                                <CategoryIcon
                                                                    className={`h-3.5 w-3.5`}
                                                                    aria-hidden
                                                                />
                                                                <span>
                                                                    {
                                                                        t.sidebar.groups[
                                                                            selected.groupKey
                                                                        ]
                                                                    }
                                                                </span>
                                                            </p>
                                                        );
                                                    })()}
                                                </div>
                                                {selected.render()}
                                            </>
                                        )}
                                    </div>
                                </ScrollArea>
                            </SidebarInset>
                        </ResizablePanel>
                    </ResizablePanelGroup>

                    <CommandPalette />
                    <ModalHandler />
                    <GlobalContextMenu />
                    <Toaster />
                </div>
            </SidebarProvider>
        );
    };
}
