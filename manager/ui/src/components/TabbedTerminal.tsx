import { Component, CSSProperties } from "react";
import TerminalComponent from "./Terminal";
import { IoAdd, IoClose } from "react-icons/io5";
import { Nav, IconButton, ButtonToolbar, Input } from "rsuite";

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

export default class TabbedTerminal extends Component<TabbedTerminalProps, TabbedTerminalState> {
    constructor(props: TabbedTerminalProps) {
        super(props);

        // Create initial tab
        const initialTab: Tab = {
            id: "tab-0",
            title: props.defaultTitle || "Terminal 1",
            terminalId: props.defaultTerminalId,
        };

        this.state = {
            tabs: [initialTab],
            activeTabId: initialTab.id,
            nextTabIndex: 1,
            editingTabId: null,
            editingTitle: "",
        };
    }

    componentDidMount() {
        // Add keyboard shortcuts
        document.addEventListener("keydown", this.handleKeyDown);
    }

    componentWillUnmount() {
        // Remove keyboard shortcuts
        document.removeEventListener("keydown", this.handleKeyDown);
    }

    handleKeyDown = (e: KeyboardEvent) => {
        // Ctrl/Cmd + T: New tab
        if ((e.ctrlKey || e.metaKey) && e.key === "t" && e.target === document.body) {
            e.preventDefault();
            this.addNewTab();
        }

        // Ctrl/Cmd + W: Close tab (only when body is focused, not terminal)
        if ((e.ctrlKey || e.metaKey) && e.key === "w" && e.target === document.body) {
            e.preventDefault();
            this.closeTab(this.state.activeTabId);
        }

        // Ctrl/Cmd + Tab: Next tab
        if ((e.ctrlKey || e.metaKey) && e.key === "Tab" && !e.shiftKey) {
            e.preventDefault();
            this.switchToNextTab();
        }

        // Ctrl/Cmd + Shift + Tab: Previous tab
        if ((e.ctrlKey || e.metaKey) && e.key === "Tab" && e.shiftKey) {
            e.preventDefault();
            this.switchToPreviousTab();
        }

        // Ctrl/Cmd + 1-9: Switch to specific tab
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
            title: `Terminal ${this.state.nextTabIndex + 1}`,
            terminalId: this.props.defaultTerminalId,
        };

        this.setState({
            tabs: [...this.state.tabs, newTab],
            activeTabId: newTab.id,
            nextTabIndex: this.state.nextTabIndex + 1,
        });
    };

    closeTab = (tabId: string) => {
        const { tabs, activeTabId } = this.state;

        // Don't close if it's the last tab
        if (tabs.length === 1) {
            return;
        }

        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        const newTabs = tabs.filter((t) => t.id !== tabId);

        // If closing the active tab, switch to another tab
        let newActiveTabId = activeTabId;
        if (tabId === activeTabId) {
            // Switch to the previous tab if available, otherwise next tab
            if (tabIndex > 0) {
                newActiveTabId = newTabs[tabIndex - 1].id;
            } else {
                newActiveTabId = newTabs[0].id;
            }
        }

        this.setState({
            tabs: newTabs,
            activeTabId: newActiveTabId,
        });
    };

    switchTab = (tabId: string) => {
        this.setState({ activeTabId: tabId });
    };

    startEditingTab = (tabId: string) => {
        const tab = this.state.tabs.find((t) => t.id === tabId);
        if (tab) {
            this.setState({
                editingTabId: tabId,
                editingTitle: tab.title,
            });
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
                editingTitle: "",
            });
        } else {
            this.setState({
                editingTabId: null,
                editingTitle: "",
            });
        }
    };

    cancelEditingTab = () => {
        this.setState({
            editingTabId: null,
            editingTitle: "",
        });
    };

    render() {
        const { tabs, activeTabId, editingTabId, editingTitle } = this.state;

        return (
            <div
                className={`TabbedTerminal flex h-full w-full flex-col ${this.props.className ?? ""}`}
                style={{ ...this.props.style }}
            >
                {/* Tab bar with rsuite Nav */}
                <div className="flex items-center border-b border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
                    <Nav
                        appearance="tabs"
                        activeKey={activeTabId}
                        onSelect={(eventKey) => this.switchTab(eventKey as string)}
                        style={{ flex: 1 }}
                    >
                        {tabs.map((tab, index) => (
                            <Nav.Item
                                key={tab.id}
                                eventKey={tab.id}
                                onDblClick={() => this.startEditingTab(tab.id)}
                                style={{ position: "relative" }}
                            >
                                <div className="flex items-center gap-2">
                                    {editingTabId === tab.id ? (
                                        <Input
                                            size="xs"
                                            value={editingTitle}
                                            onChange={(value) => this.setState({ editingTitle: value })}
                                            onBlur={this.finishEditingTab}
                                            onKeyDown={(e: any) => {
                                                if (e.key === "Enter") {
                                                    this.finishEditingTab();
                                                } else if (e.key === "Escape") {
                                                    this.cancelEditingTab();
                                                }
                                            }}
                                            onClick={(e: any) => e.stopPropagation()}
                                            style={{ width: "120px" }}
                                            autoFocus
                                        />
                                    ) : (
                                        <span
                                            className="flex items-center gap-2"
                                            title="Double-click to rename"
                                        >
                                            {index < 9 && (
                                                <span
                                                    style={{
                                                        fontSize: "0.7em",
                                                        opacity: 0.6,
                                                        fontWeight: "bold",
                                                    }}
                                                >
                                                    {index + 1}
                                                </span>
                                            )}
                                            {tab.title}
                                        </span>
                                    )}
                                    {tabs.length > 1 && (
                                        <IconButton
                                            size="xs"
                                            icon={<IoClose />}
                                            appearance="subtle"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                this.closeTab(tab.id);
                                            }}
                                            title="Close tab"
                                            style={{ marginLeft: "4px" }}
                                        />
                                    )}
                                </div>
                            </Nav.Item>
                        ))}
                    </Nav>

                    {/* New tab button */}
                    <ButtonToolbar style={{ padding: "0 8px" }}>
                        <IconButton
                            size="sm"
                            icon={<IoAdd />}
                            appearance="subtle"
                            onClick={this.addNewTab}
                            title="New terminal tab (Ctrl+T)"
                        >
                            New
                        </IconButton>
                    </ButtonToolbar>
                </div>

                {/* Terminal content */}
                <div className="relative flex-1">
                    {tabs.map((tab) => (
                        <div
                            key={tab.id}
                            className={`absolute inset-0 ${tab.id === activeTabId ? "block" : "hidden"}`}
                        >
                            <TerminalComponent id={tab.terminalId} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}
