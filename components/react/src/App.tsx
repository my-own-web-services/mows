import { type CSSProperties, PureComponent } from "react";
import CommandPalette from "../lib/components/atoms/commandPalette/CommandPalette";
import GlobalContextMenu from "../lib/components/atoms/globalContextMenu/GlobalContextMenu";
import ModalHandler from "../lib/components/atoms/modalHandler/ModalHandler";
import PrimaryMenu from "../lib/components/atoms/primaryMenu/PrimaryMenu";
import SearchInput from "../lib/components/atoms/searchInput/SearchInput";
import { ScrollArea } from "../lib/components/ui/scroll-area";
import { MowsContext } from "../lib/lib/mowsContext/MowsContext";
import { cn } from "../lib/lib/utils";
import { demos, type DemoEntry, type DemoGroupKey } from "./demos";
import { exampleTranslationRef } from "./exampleActions";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {
    readonly selectedId: string;
    readonly search: string;
}

const DEMO_PATH_PREFIX = `/`;

const idFromPath = (pathname: string): string | undefined => {
    const id = pathname.replace(DEMO_PATH_PREFIX, ``).split(`/`)[0];
    return demos.some((d) => d.id === id) ? id : undefined;
};

const pathForId = (id: string) => `${DEMO_PATH_PREFIX}${id}`;

export default class App extends PureComponent<AppProps, AppState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: AppProps) {
        super(props);
        const initial = idFromPath(window.location.pathname) ?? demos[0].id;
        this.state = { selectedId: initial, search: `` };
    }

    setSearch = (search: string) => this.setState({ search });

    componentDidMount = () => {
        exampleTranslationRef.current = this.context!.t;

        // If the URL did not point at a known demo, normalize it to the resolved
        // selection without adding a history entry.
        if (idFromPath(window.location.pathname) !== this.state.selectedId) {
            window.history.replaceState({}, ``, pathForId(this.state.selectedId));
        }
        this.syncTitle(this.state.selectedId);

        window.addEventListener(`popstate`, this.handlePopState);
    };

    componentWillUnmount = () => {
        window.removeEventListener(`popstate`, this.handlePopState);
    };

    componentDidUpdate = (_prevProps: AppProps, prevState: AppState) => {
        exampleTranslationRef.current = this.context!.t;
        if (prevState.selectedId !== this.state.selectedId) {
            this.syncTitle(this.state.selectedId);
        }
    };

    handlePopState = () => {
        const id = idFromPath(window.location.pathname);
        if (id && id !== this.state.selectedId) this.setState({ selectedId: id });
    };

    syncTitle = (id: string) => {
        const demo = demos.find((d) => d.id === id);
        if (!demo) return;
        document.title = `${demo.name} · ${this.context!.t.example.pageTitle}`;
    };

    select = (id: string) => {
        if (id === this.state.selectedId) return;
        window.history.pushState({}, ``, pathForId(id));
        this.setState({ selectedId: id });
    };

    render = () => {
        const ctx = this.context!;
        const t = ctx.t.example;
        const selected = demos.find((d) => d.id === this.state.selectedId) ?? demos[0];
        const groupOrder: DemoGroupKey[] = [
            `atoms`,
            `dateAndTime`,
            `actionsAndShortcuts`,
            `settings`,
            `lists`,
            `uiPrimitives`
        ];
        const search = this.state.search.trim().toLowerCase();
        const matches = (demo: DemoEntry): boolean => {
            if (!search) return true;
            if (demo.name.toLowerCase().includes(search)) return true;
            const groupLabel = t.sidebar.groups[demo.groupKey].toLowerCase();
            return groupLabel.includes(search);
        };
        const grouped = groupOrder
            .map(
                (key): [DemoGroupKey, DemoEntry[]] => [
                    key,
                    demos.filter((d) => d.groupKey === key && matches(d))
                ]
            )
            .filter(([, items]) => items.length > 0);

        return (
            <div
                style={this.props.style}
                className={cn(
                    `App flex h-screen w-full flex-col bg-background text-foreground`,
                    this.props.className
                )}
            >
                <header className={`shrink-0 border-b px-6 py-4 pr-20`}>
                    <h1 className={`text-xl font-semibold`}>{t.pageTitle}</h1>
                    <p className={`text-sm text-muted-foreground`}>
                        {ctx.currentLanguage?.englishName} · {ctx.currentTheme.name} —{` `}
                        {t.pageSubtitle}
                    </p>
                </header>

                <div className={`flex min-h-0 flex-1`}>
                    <aside className={`flex w-64 shrink-0 flex-col border-r`}>
                        <div className={`shrink-0 border-b p-3`}>
                            <SearchInput
                                value={this.state.search}
                                onValueChange={this.setSearch}
                                placeholder={t.sidebar.searchPlaceholder}
                                aria-label={t.sidebar.searchAriaLabel}
                                clearAriaLabel={t.sidebar.searchClearAriaLabel}
                            />
                        </div>
                        <ScrollArea className={`min-h-0 flex-1`}>
                            <nav className={`p-3`}>
                                {grouped.length === 0 && (
                                    <p
                                        className={`px-2 py-4 text-sm text-muted-foreground`}
                                    >
                                        {t.sidebar.noMatches}
                                    </p>
                                )}
                                {grouped.map(([groupKey, items]) => (
                                    <div key={groupKey} className={`mb-4`}>
                                        <div
                                            className={`px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase`}
                                        >
                                            {t.sidebar.groups[groupKey]}
                                        </div>
                                        <ul className={`flex flex-col gap-0.5`}>
                                            {items.map((demo) => {
                                                const active = demo.id === selected.id;
                                                return (
                                                    <li key={demo.id}>
                                                        <a
                                                            href={pathForId(demo.id)}
                                                            onClick={(e) => {
                                                                if (
                                                                    e.metaKey ||
                                                                    e.ctrlKey ||
                                                                    e.shiftKey ||
                                                                    e.altKey ||
                                                                    e.button !== 0
                                                                ) {
                                                                    return;
                                                                }
                                                                e.preventDefault();
                                                                this.select(demo.id);
                                                            }}
                                                            className={cn(
                                                                `block w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors`,
                                                                active
                                                                    ? `bg-accent text-accent-foreground`
                                                                    : `hover:bg-accent/50`
                                                            )}
                                                        >
                                                            {demo.name}
                                                        </a>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </nav>
                        </ScrollArea>
                    </aside>

                    <main className={`min-w-0 flex-1`}>
                        <ScrollArea className={`h-full`}>
                            <div className={`mx-auto max-w-5xl p-6`}>
                                <div className={`mb-4`}>
                                    <h2 className={`text-2xl font-semibold`}>{selected.name}</h2>
                                    <p className={`text-xs text-muted-foreground`}>
                                        {t.sidebar.groups[selected.groupKey]}
                                    </p>
                                </div>
                                {selected.render()}
                            </div>
                        </ScrollArea>
                    </main>
                </div>

                <PrimaryMenu user={{ displayName: `Demo User`, id: `demo-user-id` }} />
                <CommandPalette />
                <ModalHandler />
                <GlobalContextMenu />
            </div>
        );
    };
}
