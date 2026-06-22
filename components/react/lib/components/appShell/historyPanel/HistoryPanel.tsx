import { MowsContext } from "@/lib/mowsContext/MowsContext";
import {
    type ActionManager,
    type AuditEntry,
    formatActionLabel
} from "@/lib/mowsContext/ActionManager";
import { log } from "@/lib/logging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";

interface HistoryPanelProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface HistoryPanelState {
    readonly search: string;
    readonly categoryFilter: string;
    readonly confirmingClear: boolean;
    /** Bumped on every ActionManager change so render uses the latest state. */
    readonly version: number;
}

/**
 * Modal-mounted panel listing every dispatched action, with affordances
 * to undo back to a specific entry and to clear the entire history.
 *
 * Mounting: rendered by the modal-handler for `CoreModalTypes.history`.
 * Opens via the `mows.history.open` action.
 *
 * Cross-tab semantics: entries from other tabs (matched by `tabId`) are
 * rendered muted with no "undo to here" affordance — undo stacks are
 * per-tab. Entries for actions no longer registered in this session show
 * the literal `actionId` so the user knows what was originally invoked.
 */
export default class HistoryPanel extends PureComponent<HistoryPanelProps, HistoryPanelState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    private unsubscribe: (() => void) | null = null;

    constructor(props: HistoryPanelProps) {
        super(props);
        this.state = {
            search: ``,
            categoryFilter: `all`,
            confirmingClear: false,
            version: 0
        };
    }

    componentDidMount = () => {
        const manager = this.getManager();
        if (!manager) {
            // Mount outside <MowsProvider> is a wiring bug — without a
            // manager the panel can never render data and the renderer
            // below would early-return forever. Log so the developer
            // notices instead of staring at an empty modal.
            log.warn(`HistoryPanel mounted without MowsContext; history will not render`);
            return;
        }
        this.unsubscribe = manager.subscribe(() => {
            this.setState((prev) => ({ version: prev.version + 1 }));
        });
    };

    componentWillUnmount = () => {
        this.unsubscribe?.();
        this.unsubscribe = null;
    };

    private getManager = (): ActionManager | undefined => this.context?.actionManager;

    private get currentTabId(): string {
        return this.getManager()?.tabId ?? ``;
    }

    private get undoStackIds(): Set<string> {
        return new Set(this.getManager()?.getUndoStack().map((entry) => entry.id) ?? []);
    }

    /**
     * Entries that survive the category filter, newest first. The search
     * filter is applied later in `render` against the *resolved* label
     * (so users can search the same text they see). Kept as a separate
     * step here because category lookup runs off the raw entry and doesn't
     * need translation.
     */
    private get entriesAfterCategoryFilter(): AuditEntry[] {
        const manager = this.getManager();
        if (!manager) return [];
        const log = manager.getAuditLog();
        const category = this.state.categoryFilter;
        return [...log]
            .reverse()
            .filter((entry) => category === `all` || entry.category === category);
    }

    private categories = (): string[] => {
        const manager = this.getManager();
        if (!manager) return [];
        const seen = new Set<string>();
        for (const entry of manager.getAuditLog()) seen.add(entry.category);
        return Array.from(seen).sort();
    };

    private undoToHere = (entry: AuditEntry) => {
        const manager = this.getManager();
        if (!manager) return;
        // Pop entries off the undo stack until the target entry is gone.
        // Each `manager.undo()` pops either one entry or a whole
        // transaction group, so target presence — not stack length — is
        // the canonical halt condition. Stack-length comparison is a
        // secondary safeguard against an unmoving stack (failed undo,
        // missing handler) so we don't loop forever.
        const performAll = async () => {
            while (true) {
                const before = manager.getUndoStack();
                if (!before.some((stackEntry) => stackEntry.id === entry.id)) return;
                await manager.undo();
                const after = manager.getUndoStack();
                if (after.length === before.length) return;
            }
        };
        void performAll();
    };

    render = () => {
        if (!this.context) return null;
        const { t } = this.context;
        const manager = this.getManager();
        if (!manager) return null;

        const search = this.state.search.trim().toLowerCase();
        const categories = this.categories();
        const undoableIds = this.undoStackIds;
        const tabId = this.currentTabId;

        const entries = this.entriesAfterCategoryFilter.filter((entry) => {
            if (!search) return true;
            const handler = manager.getAction(entry.actionId)?.getCurrentHandler();
            const label = handler
                ? `${entry.actionId} ${entry.category}`
                : `${t.historyPanel.unknownAction} ${entry.actionId}`;
            return label.toLowerCase().includes(search);
        });

        return (
            <div
                style={this.props.style}
                className={cn(`HistoryPanel flex flex-col gap-4 p-4`, this.props.className)}
                aria-label={t.historyPanel.title}
            >
                <div className={`flex items-center gap-2`}>
                    <Input
                        type={`search`}
                        value={this.state.search}
                        placeholder={t.historyPanel.searchPlaceholder}
                        onChange={(e) => this.setState({ search: e.target.value })}
                        aria-label={t.historyPanel.searchPlaceholder}
                        className={`flex-1`}
                    />
                    <Select
                        value={this.state.categoryFilter}
                        onValueChange={(value) => this.setState({ categoryFilter: value })}
                    >
                        <SelectTrigger
                            aria-label={t.historyPanel.categoryFilter}
                            className={`w-48`}
                        >
                            <SelectValue placeholder={t.historyPanel.categoryFilter} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={`all`}>
                                {t.historyPanel.categoryFilter}
                            </SelectItem>
                            {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                    {category}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant={`outline`}
                        size={`sm`}
                        onClick={this.handleClearClick}
                        aria-label={t.historyPanel.clearButton}
                    >
                        <Trash2 className={`size-4`} />
                        {this.state.confirmingClear
                            ? t.historyPanel.clearConfirmation
                            : t.historyPanel.clearButton}
                    </Button>
                </div>

                {entries.length === 0 ? (
                    <p
                        className={`text-muted-foreground py-12 text-center text-sm`}
                        role={`status`}
                    >
                        {t.historyPanel.emptyState}
                    </p>
                ) : (
                    <ScrollArea className={`HistoryPanel-list h-96 rounded-md border`}>
                        <ul className={`flex flex-col`}>
                            {entries.map((entry) => {
                                const fromOtherTab = entry.tabId !== tabId;
                                const handler = manager
                                    .getAction(entry.actionId)
                                    ?.getCurrentHandler();
                                const isKnown = !!handler;
                                const stillUndoable =
                                    entry.undoable && undoableIds.has(entry.id) && !fromOtherTab;
                                const label = isKnown
                                    ? formatActionLabel(
                                          { labelKey: entry.actionId },
                                          this.context!.t
                                      )
                                    : `${this.context!.t.historyPanel.unknownAction}: ${entry.actionId}`;
                                return (
                                    <li
                                        key={entry.id}
                                        className={cn(
                                            `flex items-center gap-3 border-b px-3 py-2 last:border-b-0`,
                                            fromOtherTab && `opacity-50`,
                                            !isKnown && `opacity-60`
                                        )}
                                        data-entry-id={entry.id}
                                        data-from-other-tab={fromOtherTab || undefined}
                                        data-unknown-action={!isKnown || undefined}
                                    >
                                        <History
                                            className={`text-muted-foreground size-4 shrink-0`}
                                            aria-hidden
                                        />
                                        <div className={`flex flex-1 flex-col overflow-hidden`}>
                                            <span className={`truncate text-sm`}>{label}</span>
                                            <span
                                                className={`text-muted-foreground text-xs`}
                                                title={new Date(entry.timestamp).toISOString()}
                                            >
                                                {new Date(entry.timestamp).toLocaleTimeString()}
                                                {fromOtherTab && (
                                                    <>
                                                        {` · `}
                                                        {this.context!.t.historyPanel.otherTab}
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        {stillUndoable && (
                                            <Button
                                                variant={`ghost`}
                                                size={`sm`}
                                                onClick={() => this.undoToHere(entry)}
                                                aria-label={
                                                    this.context!.t.historyPanel.undoToHere
                                                }
                                            >
                                                <RotateCcw
                                                    className={`size-4`}
                                                    aria-hidden
                                                />
                                                <span className={`sr-only sm:not-sr-only`}>
                                                    {this.context!.t.historyPanel.undoToHere}
                                                </span>
                                            </Button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </ScrollArea>
                )}
            </div>
        );
    };

    /** Two-stage clear: first click arms the confirmation label, second
     * click executes. Resets if the user changes any other filter. */
    private handleClearClick = () => {
        if (this.state.confirmingClear) {
            this.getManager()?.clearHistory();
            this.setState({ confirmingClear: false });
            return;
        }
        this.setState({ confirmingClear: true });
    };
}
