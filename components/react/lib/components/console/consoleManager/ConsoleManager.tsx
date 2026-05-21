import {
    ChevronDown,
    Plus,
    SplitSquareHorizontal,
    Trash2,
    type LucideIcon
} from "lucide-react";
import {
    PureComponent,
    createRef,
    type CSSProperties,
    type DragEvent,
    type ReactNode,
    type RefObject
} from "react";
import { Button } from "@/components/ui/button";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from "@/components/ui/context-menu";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "@/components/ui/resizable";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";

// VSCode-style console host. Source-derived layout from
// `vscode/src/vs/workbench/contrib/terminal/browser/terminalTabsList.ts`
// and `…/media/terminal.css`:
//   • Right-side flat list of all terminals, grouped by "terminal group"
//   • A group's split siblings get a box-drawing prefix in the label
//     (┌ / ├ / └) — VSCode uses ASCII art, not CSS indent
//   • Active terminal carries a 1px `::before` accent bar on the left
//   • Per-row Split + Kill icons appear only on row hover / focus-within
//   • Switching tabs in the list switches which group is shown in the
//     content area; the content area shows the active group's split
//     tree side-by-side via ResizablePanelGroup
//
// Notes vs. our previous "tabs stacked inside a leaf" model:
//   • We dropped tab stacking — VSCode has no equivalent. Each entry
//     in the list IS a terminal that lives in exactly one slot in its
//     group's layout. Multiple terminals in the same group are always
//     visible together (via splits), never overlaid.
//   • `+` opens a brand-new top-level group (matches VSCode `+`).
//     Per-row "Split" creates a sibling slot inside the existing
//     group (matches VSCode `splitInstance`).

/**
 * A console "type": one registered console kind the manager can spawn
 * terminals of. The `render` callback is invoked once per terminal
 * and the result is mounted for the lifetime of that terminal — bodies
 * survive group switches so xterm scrollback / websocket state is
 * preserved.
 */
export interface ConsoleType {
    /** Stable id used inside the layout state. Must be unique. */
    readonly id: string;
    /** Visible label in the "new terminal" menu. */
    readonly label: string;
    /** Optional icon shown in the menu and on each row. */
    readonly icon?: LucideIcon;
    /** Render the terminal's body. Called once per terminal instance. */
    readonly render: () => ReactNode;
    /**
     * Per-type name generator for new terminals. Receives the 1-based
     * ordinal so multiple terminals get unique names
     * (`Terminal 1`, `Terminal 2`, …). Defaults to `label + ordinal`.
     */
    readonly defaultName?: (ordinal: number) => string;
}

export interface ConsoleManagerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Console kinds the manager can open. Order drives the menu order. */
    readonly types: readonly ConsoleType[];
    /**
     * Id of the type opened when the user clicks `+` without picking
     * a kind, and used to seed a sibling split. Defaults to `types[0].id`.
     */
    readonly defaultTypeId?: string;
    /** Terminals opened on mount, each as its own top-level group. */
    readonly initialTabs?: readonly InitialTab[];
    /** Default width of the right-side tab list, in percent. Default 22. */
    readonly tabListDefaultSize?: number;
    /** Min width of the right-side tab list, in percent. Default 14. */
    readonly tabListMinSize?: number;
    /** Max width of the right-side tab list, in percent. Default 45. */
    readonly tabListMaxSize?: number;
}

export interface InitialTab {
    readonly typeId: string;
    /** Override the auto-generated name. */
    readonly name?: string;
}

interface Tab {
    readonly id: string;
    readonly typeId: string;
    readonly name: string;
}

interface TerminalSlot {
    readonly kind: `terminal`;
    readonly tabId: string;
}

interface SplitNode {
    readonly kind: `split`;
    readonly id: string;
    readonly direction: `horizontal` | `vertical`;
    readonly children: readonly [LayoutNode, LayoutNode];
}

type LayoutNode = TerminalSlot | SplitNode;

interface Group {
    readonly id: string;
    readonly layout: LayoutNode;
}

const DRAG_MIME = `application/x-mows-console-tab`;

interface DragPayload {
    readonly tabId: string;
}

/** Drop position relative to the row that the cursor is hovering over. */
type DropPosition = `before` | `after`;

interface DropIndicator {
    readonly tabId: string;
    readonly position: DropPosition;
}

interface State {
    readonly groups: readonly Group[];
    readonly activeTabId: string | null;
    readonly tabs: { readonly [tabId: string]: Tab };
    readonly renamingTabId: string | null;
    readonly dropIndicator: DropIndicator | null;
}

const genId = (prefix: string): string =>
    `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------
// Layout helpers — pure tree transformations.
// ---------------------------------------------------------------------

const findSlotInLayout = (
    node: LayoutNode,
    tabId: string
): TerminalSlot | null => {
    if (node.kind === `terminal`) return node.tabId === tabId ? node : null;
    return (
        findSlotInLayout(node.children[0], tabId) ??
        findSlotInLayout(node.children[1], tabId)
    );
};

const findGroupOfTab = (
    groups: readonly Group[],
    tabId: string
): Group | undefined =>
    groups.find((g) => findSlotInLayout(g.layout, tabId) !== null);

const replaceSlotInLayout = (
    node: LayoutNode,
    tabId: string,
    replacement: LayoutNode
): LayoutNode => {
    if (node.kind === `terminal`) {
        return node.tabId === tabId ? replacement : node;
    }
    const next0 = replaceSlotInLayout(node.children[0], tabId, replacement);
    const next1 = replaceSlotInLayout(node.children[1], tabId, replacement);
    if (next0 === node.children[0] && next1 === node.children[1]) return node;
    return { ...node, children: [next0, next1] };
};

// Remove a terminal slot from a layout, collapsing any surrounding
// `SplitNode` whose other child takes its slot. Returns null when the
// entire layout has been consumed (group is empty).
const removeSlotFromLayout = (
    node: LayoutNode,
    tabId: string
): LayoutNode | null => {
    if (node.kind === `terminal`) return node.tabId === tabId ? null : node;
    const next0 = removeSlotFromLayout(node.children[0], tabId);
    const next1 = removeSlotFromLayout(node.children[1], tabId);
    if (next0 === null && next1 === null) return null;
    if (next0 === null) return next1;
    if (next1 === null) return next0;
    if (next0 === node.children[0] && next1 === node.children[1]) return node;
    return { ...node, children: [next0, next1] };
};

const flattenLayout = (node: LayoutNode, out: TerminalSlot[]): void => {
    if (node.kind === `terminal`) {
        out.push(node);
        return;
    }
    flattenLayout(node.children[0], out);
    flattenLayout(node.children[1], out);
};

const groupTerminals = (group: Group): TerminalSlot[] => {
    const out: TerminalSlot[] = [];
    flattenLayout(group.layout, out);
    return out;
};

/**
 * VSCode-style box-drawing prefix for split siblings. Mirrors the
 * exact strings used in vscode's `terminalTabsList.ts` (`renderElement`
 * builds `┌ ` / `├ ` / `└ ` from `terminalInstances.indexOf` against
 * the group's terminal list). Single-terminal groups get no prefix.
 */
const groupPrefix = (index: number, total: number): string => {
    if (total <= 1) return ``;
    if (index === 0) return `┌ `;
    if (index === total - 1) return `└ `;
    return `├ `;
};

const buildDefaultName = (
    type: ConsoleType,
    existingNames: ReadonlySet<string>
): string => {
    const make = type.defaultName ?? ((n: number) => `${type.label} ${n}`);
    // Walk integers in order until we find an unused name. The Set lookup
    // is O(1); worst case is O(n+1) probes for n existing names, which is
    // already the minimum work required. No magic ceiling, no Date.now()
    // fallback that could collide (SLOP-26).
    for (let i = 1; ; i += 1) {
        const candidate = make(i);
        if (!existingNames.has(candidate)) return candidate;
    }
};

// ---------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------

const initialState = (props: ConsoleManagerProps): State => {
    const tabs: Record<string, Tab> = {};
    const groups: Group[] = [];
    const names = new Set<string>();
    for (const seed of props.initialTabs ?? []) {
        const type = props.types.find((t) => t.id === seed.typeId);
        if (!type) continue;
        const name = seed.name ?? buildDefaultName(type, names);
        const tabId = genId(`tab`);
        tabs[tabId] = { id: tabId, typeId: type.id, name };
        names.add(name);
        // Each seeded tab becomes its own top-level group — same as
        // clicking `+` once per seed in VSCode.
        groups.push({
            id: genId(`grp`),
            layout: { kind: `terminal`, tabId }
        });
    }
    const firstSlot = groups[0]
        ? groupTerminals(groups[0])[0]?.tabId ?? null
        : null;
    return {
        groups,
        activeTabId: firstSlot,
        tabs,
        renamingTabId: null,
        dropIndicator: null
    };
};

export default class ConsoleManager extends PureComponent<
    ConsoleManagerProps,
    State
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    private renameInputRef: RefObject<HTMLInputElement | null> =
        createRef<HTMLInputElement | null>();

    /** In-flight drag mirror — the DataTransfer is read-only until drop. */
    private dragPayload: DragPayload | null = null;

    constructor(props: ConsoleManagerProps) {
        super(props);
        this.state = initialState(props);
    }

    private getType = (typeId: string): ConsoleType | undefined =>
        this.props.types.find((t) => t.id === typeId);

    private getDefaultType = (): ConsoleType | undefined => {
        const { defaultTypeId, types } = this.props;
        return (defaultTypeId ? this.getType(defaultTypeId) : undefined) ?? types[0];
    };

    private allTabNames = (): Set<string> =>
        new Set(Object.values(this.state.tabs).map((t) => t.name));

    /**
     * Open a brand-new top-level group with one terminal. Matches the
     * VSCode toolbar `+`: a new group always starts at depth 0 in the
     * list and becomes the active group/instance.
     */
    private openNewGroup = (typeId: string): void => {
        const type = this.getType(typeId);
        if (!type) return;
        const name = buildDefaultName(type, this.allTabNames());
        const tabId = genId(`tab`);
        this.setState((prev) => ({
            tabs: { ...prev.tabs, [tabId]: { id: tabId, typeId, name } },
            groups: [
                ...prev.groups,
                { id: genId(`grp`), layout: { kind: `terminal`, tabId } }
            ],
            activeTabId: tabId
        }));
    };

    /**
     * Split the terminal `tabId` inside its current group. Adds a
     * sibling slot via a new `SplitNode` whose first child is the
     * original slot and second child is the new terminal — same as
     * `createTerminal({ location: { parentTerminal: instance } })`.
     */
    private splitTerminal = (tabId: string): void => {
        const type = this.getDefaultType();
        if (!type) return;
        this.setState((prev) => {
            const group = findGroupOfTab(prev.groups, tabId);
            if (!group) return null;
            const newTabId = genId(`tab`);
            const newName = buildDefaultName(
                type,
                new Set(Object.values(prev.tabs).map((t) => t.name))
            );
            const split: SplitNode = {
                kind: `split`,
                id: genId(`split`),
                direction: `horizontal`,
                children: [
                    { kind: `terminal`, tabId },
                    { kind: `terminal`, tabId: newTabId }
                ]
            };
            const newLayout = replaceSlotInLayout(group.layout, tabId, split);
            return {
                tabs: {
                    ...prev.tabs,
                    [newTabId]: { id: newTabId, typeId: type.id, name: newName }
                },
                groups: prev.groups.map((g) =>
                    g.id === group.id ? { ...g, layout: newLayout } : g
                ),
                activeTabId: newTabId
            };
        });
    };

    private closeTerminal = (tabId: string): void => {
        this.setState((prev) => {
            const group = findGroupOfTab(prev.groups, tabId);
            if (!group) return null;
            const tabs = { ...prev.tabs };
            delete tabs[tabId];
            const newLayout = removeSlotFromLayout(group.layout, tabId);
            let groups: Group[];
            if (newLayout === null) {
                groups = prev.groups.filter((g) => g.id !== group.id);
            } else {
                groups = prev.groups.map((g) =>
                    g.id === group.id ? { ...g, layout: newLayout } : g
                );
            }
            // Pick a sensible next active terminal: prefer a sibling
            // inside the same group, fall back to the first terminal in
            // any remaining group, else null.
            let activeTabId: string | null = prev.activeTabId;
            if (activeTabId === tabId) {
                // Drop the stale id first so the fallback chain isn't
                // gated by `!activeTabId`.
                activeTabId = null;
                if (newLayout) {
                    const remaining = groupTerminals({ ...group, layout: newLayout });
                    activeTabId = remaining[remaining.length - 1]?.tabId ?? null;
                }
                if (!activeTabId && groups[0]) {
                    activeTabId = groupTerminals(groups[0])[0]?.tabId ?? null;
                }
            }
            return { tabs, groups, activeTabId };
        });
    };

    private setActiveTab = (tabId: string): void => {
        if (this.state.activeTabId === tabId) return;
        this.setState({ activeTabId: tabId });
    };

    private startRenameTab = (tabId: string): void => {
        this.setState({ renamingTabId: tabId }, () => {
            this.renameInputRef.current?.focus();
            this.renameInputRef.current?.select();
        });
    };

    private commitRename = (tabId: string, name: string): void => {
        const trimmed = name.trim();
        this.setState((prev): Pick<State, `tabs` | `renamingTabId`> => {
            const existing = prev.tabs[tabId];
            if (!existing || !trimmed || trimmed === existing.name) {
                return { tabs: prev.tabs, renamingTabId: null };
            }
            return {
                tabs: { ...prev.tabs, [tabId]: { ...existing, name: trimmed } },
                renamingTabId: null
            };
        });
    };

    private cancelRename = (): void => {
        this.setState({ renamingTabId: null });
    };

    // -----------------------------------------------------------------
    // Drag & drop: reorder within a group, move across groups.
    // -----------------------------------------------------------------

    private handleDragStart = (
        event: DragEvent<HTMLDivElement>,
        tabId: string
    ): void => {
        const payload: DragPayload = { tabId };
        this.dragPayload = payload;
        try {
            event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
            event.dataTransfer.effectAllowed = `move`;
        } catch {
            /* jsdom + some browsers reject custom MIMEs in tests. */
        }
    };

    private handleDragEnd = (): void => {
        this.dragPayload = null;
        this.setState({ dropIndicator: null });
    };

    private handleRowDragOver = (
        event: DragEvent<HTMLDivElement>,
        overTabId: string
    ): void => {
        if (!this.dragPayload) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = `move`;
        const rect = event.currentTarget.getBoundingClientRect();
        const position: DropPosition =
            event.clientY - rect.top < rect.height / 2 ? `before` : `after`;
        const next: DropIndicator = { tabId: overTabId, position };
        const current = this.state.dropIndicator;
        if (
            !current ||
            current.tabId !== next.tabId ||
            current.position !== next.position
        ) {
            this.setState({ dropIndicator: next });
        }
    };

    private readDropPayload = (
        event: DragEvent<HTMLDivElement>
    ): DragPayload | null => {
        if (this.dragPayload) return this.dragPayload;
        try {
            const raw = event.dataTransfer.getData(DRAG_MIME);
            if (!raw) return null;
            return JSON.parse(raw) as DragPayload;
        } catch {
            return null;
        }
    };

    /**
     * Move `payload.tabId` so it sits before/after `targetTabId` in the
     * flat list. Same-group reorder folds the source into the target's
     * group's layout at the target's location; cross-group move pulls
     * the slot out of its current group (collapsing splits, dropping
     * the group if it becomes empty) and grafts it into the target's
     * group as a horizontal split sibling of the target.
     */
    private moveTab = (
        payload: DragPayload,
        targetTabId: string,
        position: DropPosition
    ): void => {
        const { tabId } = payload;
        if (tabId === targetTabId) {
            this.setState({ dropIndicator: null });
            return;
        }
        this.setState((prev): Pick<State, `groups` | `activeTabId` | `dropIndicator`> => {
            const sourceGroup = findGroupOfTab(prev.groups, tabId);
            const targetGroup = findGroupOfTab(prev.groups, targetTabId);
            if (!sourceGroup || !targetGroup) {
                return {
                    groups: prev.groups,
                    activeTabId: prev.activeTabId,
                    dropIndicator: null
                };
            }
            // Pluck the source slot out of its layout.
            const sourceWithout = removeSlotFromLayout(sourceGroup.layout, tabId);
            // Build the inserted split shape: target keeps its place,
            // source attaches as the appropriate child given the drop
            // half (top half = before = first child).
            const movedSlot: TerminalSlot = { kind: `terminal`, tabId };
            const children: [LayoutNode, LayoutNode] =
                position === `before`
                    ? [movedSlot, { kind: `terminal`, tabId: targetTabId }]
                    : [{ kind: `terminal`, tabId: targetTabId }, movedSlot];
            const wrapped: SplitNode = {
                kind: `split`,
                id: genId(`split`),
                direction: `horizontal`,
                children
            };
            // For same-group: apply the wrap against the post-pluck
            // layout so we don't lose the target slot when source and
            // target are the same layout.
            let groups: Group[];
            if (sourceGroup.id === targetGroup.id) {
                const base = sourceWithout ?? sourceGroup.layout;
                const newLayout = replaceSlotInLayout(base, targetTabId, wrapped);
                groups = prev.groups.map((g) =>
                    g.id === sourceGroup.id ? { ...g, layout: newLayout } : g
                );
            } else {
                const newTargetLayout = replaceSlotInLayout(
                    targetGroup.layout,
                    targetTabId,
                    wrapped
                );
                groups = prev.groups.flatMap((g) => {
                    if (g.id === targetGroup.id) {
                        return [{ ...g, layout: newTargetLayout }];
                    }
                    if (g.id === sourceGroup.id) {
                        return sourceWithout
                            ? [{ ...g, layout: sourceWithout }]
                            : [];
                    }
                    return [g];
                });
            }
            return {
                groups,
                activeTabId: tabId,
                dropIndicator: null
            };
        });
    };

    private handleDrop = (event: DragEvent<HTMLDivElement>): void => {
        const payload = this.readDropPayload(event);
        const indicator = this.state.dropIndicator;
        this.dragPayload = null;
        if (!payload || !indicator) {
            this.setState({ dropIndicator: null });
            return;
        }
        event.preventDefault();
        this.moveTab(payload, indicator.tabId, indicator.position);
    };

    // -----------------------------------------------------------------
    // Rendering.
    // -----------------------------------------------------------------

    private renderGroupContent = (node: LayoutNode): ReactNode => {
        if (node.kind === `terminal`) {
            const tab = this.state.tabs[node.tabId];
            if (!tab) return null;
            const type = this.getType(tab.typeId);
            if (!type) return null;
            return (
                <div
                    data-console-slot={node.tabId}
                    data-active-slot={
                        this.state.activeTabId === node.tabId ? `true` : `false`
                    }
                    onMouseDownCapture={() => this.setActiveTab(node.tabId)}
                    className={`relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-background`}
                >
                    {type.render()}
                </div>
            );
        }
        return (
            <ResizablePanelGroup direction={node.direction} className={`h-full w-full`}>
                <ResizablePanel defaultSize={50} minSize={10}>
                    {this.renderGroupContent(node.children[0])}
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={50} minSize={10}>
                    {this.renderGroupContent(node.children[1])}
                </ResizablePanel>
            </ResizablePanelGroup>
        );
    };

    private renderTabRow = (
        tab: Tab,
        groupIndexAmongTerminals: number,
        groupTerminalsCount: number
    ): ReactNode => {
        const type = this.getType(tab.typeId);
        const Icon = type?.icon;
        const isActive = this.state.activeTabId === tab.id;
        const renaming = tab.id === this.state.renamingTabId;
        const indicator = this.state.dropIndicator;
        const showBefore =
            indicator?.tabId === tab.id && indicator.position === `before`;
        const showAfter =
            indicator?.tabId === tab.id && indicator.position === `after`;
        const prefix = groupPrefix(groupIndexAmongTerminals, groupTerminalsCount);
        return (
            <ContextMenu key={tab.id}>
                <ContextMenuTrigger asChild>
                    <div
                        role={`tab`}
                        aria-selected={isActive}
                        data-tab-id={tab.id}
                        data-active={isActive ? `true` : `false`}
                        draggable={!renaming}
                        onDragStart={(e) => this.handleDragStart(e, tab.id)}
                        onDragEnd={this.handleDragEnd}
                        onDragOver={(e) => this.handleRowDragOver(e, tab.id)}
                        onDrop={this.handleDrop}
                        onClick={() => this.setActiveTab(tab.id)}
                        onDoubleClick={() => this.startRenameTab(tab.id)}
                        className={cn(
                            // Compact 22 px row, mirrors VSCode's
                            // `.terminal-tabs-entry` layout. The
                            // `is-active` accent bar lives in the
                            // `before:` pseudo (left edge, 1 px).
                            `group/console-row relative flex h-[22px] min-w-0 cursor-pointer items-center gap-1.5 px-2 text-xs leading-[22px] text-sidebar-foreground/85 select-none`,
                            `hover:bg-sidebar-accent/40 hover:text-sidebar-foreground`,
                            isActive &&
                                `bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-primary before:content-['']`
                        )}
                    >
                        {showBefore && (
                            <div
                                aria-hidden
                                data-drop-indicator={`before`}
                                className={`pointer-events-none absolute inset-x-0 -top-px h-0.5 bg-primary`}
                            />
                        )}
                        {showAfter && (
                            <div
                                aria-hidden
                                data-drop-indicator={`after`}
                                className={`pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-primary`}
                            />
                        )}
                        {/* The group-prefix box-drawing characters come
                         * before the icon — same as VSCode, where the
                         * prefix is literally prepended to the label
                         * string. We use a fixed-width monospace span
                         * so the icon column aligns across rows. */}
                        {prefix && (
                            <span
                                aria-hidden
                                className={`shrink-0 font-mono text-sidebar-foreground/50`}
                            >
                                {prefix}
                            </span>
                        )}
                        {Icon && (
                            <Icon
                                className={`size-3.5 shrink-0 text-sidebar-foreground/60`}
                                aria-hidden
                            />
                        )}
                        {renaming ? (
                            <Input
                                ref={this.renameInputRef}
                                defaultValue={tab.name}
                                onBlur={(e) =>
                                    this.commitRename(tab.id, e.currentTarget.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === `Enter`) {
                                        e.preventDefault();
                                        this.commitRename(
                                            tab.id,
                                            e.currentTarget.value
                                        );
                                    } else if (e.key === `Escape`) {
                                        e.preventDefault();
                                        this.cancelRename();
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                // shadcn Input defaults to `text-base md:text-sm`. Pin the
                                // responsive override too (`md:text-xs`) and match the
                                // surrounding row's `leading-[22px]` so the rename input
                                // sits at exactly the same glyph size as the display span.
                                className={`h-5 flex-1 min-w-0 px-1 py-0 text-xs leading-[22px] md:text-xs`}
                            />
                        ) : (
                            <span
                                className={`min-w-0 flex-1 truncate`}
                                title={tab.name}
                            >
                                {tab.name}
                            </span>
                        )}
                        {/*
                         * Per-row action bar: hidden until the row is
                         * hovered or focus-within (matches VSCode's
                         * `.terminal-tabs-chat-entry-delete` rule, but
                         * applied to our generic action set: Split
                         * then Kill, exact order from
                         * terminalTabsList.ts#fillActionBar).
                         */}
                        <div
                            className={`ml-auto hidden shrink-0 items-center gap-0.5 group-hover/console-row:flex group-focus-within/console-row:flex`}
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Split ${tab.name}`}
                                title={`Split ${tab.name}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    this.splitTerminal(tab.id);
                                }}
                                className="size-4 rounded-sm opacity-80 hover:opacity-100"
                            >
                                <SplitSquareHorizontal
                                    className="size-3"
                                    aria-hidden
                                />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Kill ${tab.name}`}
                                title={`Kill ${tab.name}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    this.closeTerminal(tab.id);
                                }}
                                className="size-4 rounded-sm opacity-80 hover:opacity-100"
                            >
                                <Trash2 className="size-3" aria-hidden />
                            </Button>
                        </div>
                    </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                    <ContextMenuItem
                        onSelect={() => this.startRenameTab(tab.id)}
                        className={`cursor-pointer`}
                    >
                        {`Rename`}
                    </ContextMenuItem>
                    <ContextMenuItem
                        onSelect={() => this.splitTerminal(tab.id)}
                        className={`cursor-pointer`}
                    >
                        <SplitSquareHorizontal
                            className={`size-3.5`}
                            aria-hidden
                        />
                        {`Split Terminal`}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                        onSelect={() => this.closeTerminal(tab.id)}
                        className={`cursor-pointer text-destructive focus:text-destructive`}
                    >
                        <Trash2 className={`size-3.5`} aria-hidden />
                        {`Kill Terminal`}
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        );
    };

    private renderToolbar = (): ReactNode => {
        const { types } = this.props;
        if (types.length === 0) return null;
        const defaultType = this.getDefaultType();
        if (!defaultType) return null;
        return (
            <div
                className={`flex h-8 shrink-0 items-center justify-end gap-0.5 border-b border-sidebar-border px-1.5`}
            >
                <Button
                    type={`button`}
                    size={`icon`}
                    variant={`ghost`}
                    aria-label={`New ${defaultType.label}`}
                    title={`New ${defaultType.label}`}
                    onClick={() => this.openNewGroup(defaultType.id)}
                    className={cn(`size-6`, types.length > 1 && `rounded-r-none`)}
                >
                    <Plus className={`size-3.5`} aria-hidden />
                </Button>
                {types.length > 1 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type={`button`}
                                size={`icon`}
                                variant={`ghost`}
                                aria-label={`Open new console of a specific type`}
                                className={`size-6 rounded-l-none border-l border-sidebar-border/60`}
                            >
                                <ChevronDown className={`size-3`} aria-hidden />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={`end`}>
                            {types.map((type) => {
                                const Icon = type.icon;
                                return (
                                    <DropdownMenuItem
                                        key={type.id}
                                        onClick={() => this.openNewGroup(type.id)}
                                        className={`cursor-pointer`}
                                    >
                                        {Icon && (
                                            <Icon
                                                className={`size-3.5`}
                                                aria-hidden
                                            />
                                        )}
                                        <span>{type.label}</span>
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        );
    };

    private renderTabList = (): ReactNode => (
        <div
            data-console-tab-list={``}
            role={`tablist`}
            aria-orientation={`vertical`}
            className={`flex h-full min-h-0 w-full min-w-0 flex-col bg-sidebar text-sidebar-foreground`}
        >
            {this.renderToolbar()}
            <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto py-1`}>
                {this.state.groups.length === 0 ? (
                    <div
                        className={`flex flex-1 items-center justify-center px-3 text-xs text-sidebar-foreground/50 select-none`}
                    >
                        {`No terminals`}
                    </div>
                ) : (
                    this.state.groups.map((group, groupIdx) => {
                        const terminals = groupTerminals(group);
                        return (
                            <div
                                key={group.id}
                                data-console-group={group.id}
                                className={cn(
                                    `flex flex-col`,
                                    groupIdx > 0 &&
                                        `mt-1 border-t border-sidebar-border/50 pt-1`
                                )}
                            >
                                {terminals.map((slot, i) => {
                                    const tab = this.state.tabs[slot.tabId];
                                    if (!tab) return null;
                                    return this.renderTabRow(
                                        tab,
                                        i,
                                        terminals.length
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    private renderContentArea = (): ReactNode => {
        const { groups, activeTabId } = this.state;
        const activeGroup = activeTabId
            ? groups.find((g) => findSlotInLayout(g.layout, activeTabId) !== null)
            : groups[0];
        const activeGroupId = activeGroup?.id ?? null;
        if (groups.length === 0) {
            return (
                <div
                    className={`flex h-full w-full items-center justify-center text-xs text-muted-foreground select-none`}
                >
                    {`No terminals open — press + to start one.`}
                </div>
            );
        }
        // Every group's content stays mounted; only the active one is
        // visible. This is what preserves xterm scrollback across group
        // switches.
        return (
            <div className={`relative h-full w-full`}>
                {groups.map((group) => (
                    <div
                        key={group.id}
                        data-console-group-pane={group.id}
                        aria-hidden={group.id !== activeGroupId}
                        className={cn(
                            `absolute inset-0`,
                            group.id === activeGroupId ? `visible` : `invisible`
                        )}
                    >
                        {this.renderGroupContent(group.layout)}
                    </div>
                ))}
            </div>
        );
    };

    render = (): ReactNode => {
        const tabListDefaultSize = this.props.tabListDefaultSize ?? 22;
        const tabListMinSize = this.props.tabListMinSize ?? 14;
        const tabListMaxSize = this.props.tabListMaxSize ?? 45;
        return (
            <div
                style={this.props.style}
                className={cn(
                    `ConsoleManager flex h-full w-full min-h-0 min-w-0 overflow-hidden rounded-md border border-border bg-background text-foreground`,
                    this.props.className
                )}
            >
                <ResizablePanelGroup
                    direction={`horizontal`}
                    className={`h-full w-full`}
                >
                    <ResizablePanel
                        defaultSize={100 - tabListDefaultSize}
                        minSize={30}
                    >
                        {this.renderContentArea()}
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel
                        defaultSize={tabListDefaultSize}
                        minSize={tabListMinSize}
                        maxSize={tabListMaxSize}
                    >
                        {this.renderTabList()}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        );
    };
}
