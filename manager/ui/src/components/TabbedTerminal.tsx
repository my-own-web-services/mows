import { Input } from "mows-components-react/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "mows-components-react/components/ui/tabs";
import { MowsContext } from "mows-components-react/lib/mowsContext/MowsContext";
import { PureComponent, type CSSProperties } from "react";
import { IoAdd, IoClose } from "react-icons/io5";
import TerminalComponent from "./Terminal";

interface Tab {
    id: string;
    title: string;
    terminalId: string;
}

interface TabbedTerminalProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly defaultTerminalId: string;
    readonly defaultTitle?: string;
}

interface TabbedTerminalState {
    tabs: Tab[];
    activeTabId: string;
    nextTabIndex: number;
    editingTabId: string | null;
    editingTitle: string;
}

export default class TabbedTerminal extends PureComponent<
    TabbedTerminalProps,
    TabbedTerminalState
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: TabbedTerminalProps) {
        super(props);

        const initialTab: Tab = {
            id: `tab-0`,
            title: props.defaultTitle || `Terminal 1`,
            terminalId: props.defaultTerminalId
        };

        this.state = {
            tabs: [initialTab],
            activeTabId: initialTab.id,
            nextTabIndex: 1,
            editingTabId: null,
            editingTitle: ``
        };
    }

    componentDidMount = () => {
        document.addEventListener(`keydown`, this.handleKeyDown);
    };

    componentWillUnmount = () => {
        document.removeEventListener(`keydown`, this.handleKeyDown);
    };

    handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === `t` && e.target === document.body) {
            e.preventDefault();
            this.addNewTab();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === `w` && e.target === document.body) {
            e.preventDefault();
            this.closeTab(this.state.activeTabId);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === `Tab` && !e.shiftKey) {
            e.preventDefault();
            this.switchToNextTab();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === `Tab` && e.shiftKey) {
            e.preventDefault();
            this.switchToPreviousTab();
        }
        if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
            e.preventDefault();
            const tabIndex = parseInt(e.key) - 1;
            if (tabIndex < this.state.tabs.length) {
                this.switchTab(this.state.tabs[tabIndex].id);
            }
        }
    };

    switchToNextTab = () => {
        const { tabs, activeTabId } = this.state;
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        this.switchTab(tabs[nextIndex].id);
    };

    switchToPreviousTab = () => {
        const { tabs, activeTabId } = this.state;
        const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        this.switchTab(tabs[prevIndex].id);
    };

    addNewTab = () => {
        const newTab: Tab = {
            id: `tab-${this.state.nextTabIndex}`,
            title: `${this.context!.t.manager.terminal.terminal} ${this.state.nextTabIndex + 1}`,
            terminalId: this.props.defaultTerminalId
        };

        this.setState({
            tabs: [...this.state.tabs, newTab],
            activeTabId: newTab.id,
            nextTabIndex: this.state.nextTabIndex + 1
        });
    };

    closeTab = (tabId: string) => {
        const { tabs, activeTabId } = this.state;
        if (tabs.length === 1) return;

        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        const newTabs = tabs.filter((t) => t.id !== tabId);

        let newActiveTabId = activeTabId;
        if (tabId === activeTabId) {
            newActiveTabId = tabIndex > 0 ? newTabs[tabIndex - 1].id : newTabs[0].id;
        }

        this.setState({ tabs: newTabs, activeTabId: newActiveTabId });
    };

    switchTab = (tabId: string) => {
        this.setState({ activeTabId: tabId });
    };

    startEditingTab = (tabId: string) => {
        const tab = this.state.tabs.find((t) => t.id === tabId);
        if (tab) {
            this.setState({ editingTabId: tabId, editingTitle: tab.title });
        }
    };

    finishEditingTab = () => {
        const { editingTabId, editingTitle } = this.state;
        if (editingTabId && editingTitle.trim()) {
            this.setState({
                tabs: this.state.tabs.map((t) =>
                    t.id === editingTabId ? { ...t, title: editingTitle.trim() } : t
                ),
                editingTabId: null,
                editingTitle: ``
            });
        } else {
            this.setState({ editingTabId: null, editingTitle: `` });
        }
    };

    cancelEditingTab = () => {
        this.setState({ editingTabId: null, editingTitle: `` });
    };

    render = () => {
        const { tabs, activeTabId, editingTabId, editingTitle } = this.state;
        const t = this.context!.t.manager.terminal;

        return (
            <div
                style={this.props.style}
                className={`TabbedTerminal flex h-full w-full flex-col ${this.props.className ?? ``}`}
            >
                <div className={`flex items-center gap-1 px-1 pt-1`}>
                    <Tabs
                        value={activeTabId}
                        onValueChange={(value) => this.switchTab(value)}
                    >
                        <TabsList className={`h-auto bg-transparent p-0 gap-1`}>
                            {tabs.map((tab, index) => (
                                <TabsTrigger
                                    key={tab.id}
                                    value={tab.id}
                                    onDoubleClick={() => this.startEditingTab(tab.id)}
                                    className={`gap-2 px-3 py-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm`}
                                >
                                    {editingTabId === tab.id ? (
                                        <Input
                                            value={editingTitle}
                                            onChange={(e) =>
                                                this.setState({
                                                    editingTitle: e.currentTarget.value
                                                })
                                            }
                                            onBlur={this.finishEditingTab}
                                            onKeyDown={(e) => {
                                                if (e.key === `Enter`) this.finishEditingTab();
                                                else if (e.key === `Escape`) this.cancelEditingTab();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`h-6 w-[120px]`}
                                            autoFocus
                                        />
                                    ) : (
                                        <span
                                            className={`flex items-center gap-2`}
                                            title={t.renameTab}
                                        >
                                            {index < 9 && (
                                                <span
                                                    className={`text-xs font-bold opacity-60`}
                                                >
                                                    {index + 1}
                                                </span>
                                            )}
                                            {tab.title}
                                        </span>
                                    )}
                                    {tabs.length > 1 && (
                                        <span
                                            role={`button`}
                                            tabIndex={0}
                                            className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                this.closeTab(tab.id);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === `Enter` || e.key === ` `) {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    this.closeTab(tab.id);
                                                }
                                            }}
                                            title={t.closeTab}
                                        >
                                            <IoClose />
                                        </span>
                                    )}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    <button
                        type={`button`}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
                        onClick={this.addNewTab}
                        title={t.newTab}
                        aria-label={t.newTabAria}
                    >
                        <IoAdd />
                    </button>
                </div>

                <div className={`relative flex-1`}>
                    {tabs.map((tab) => (
                        <div
                            key={tab.id}
                            className={`absolute inset-0 ${tab.id === activeTabId ? `block` : `hidden`}`}
                        >
                            <TerminalComponent id={tab.terminalId} />
                        </div>
                    ))}
                </div>
            </div>
        );
    };
}
