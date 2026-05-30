import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import {
    useCallback,
    useId,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode
} from "react";
import { SearchInput } from "../searchInput/SearchInput";

export interface StaggeredCheckboxNode {
    readonly id: string;
    readonly label: ReactNode;
    readonly disabled?: boolean;
    readonly children?: readonly StaggeredCheckboxNode[];
    /**
     * Extra search keywords beyond the rendered `label`. Use when the
     * label is non-textual (icon + sub-elements) or the user might
     * search by synonyms.
     */
    readonly searchKeywords?: readonly string[];
    /**
     * Plain-text shadow of `label` used by the built-in search filter.
     * Required when `label` is not a plain string (a React element).
     */
    readonly searchLabel?: string;
}

export type StaggeredCheckboxState = `checked` | `unchecked` | `indeterminate`;

export interface StaggeredCheckboxesProps {
    readonly nodes: readonly StaggeredCheckboxNode[];
    /** Set of currently-checked node IDs (leaves and/or branches). */
    readonly value: ReadonlySet<string>;
    /** Fires with the next full selection set. */
    readonly onValueChange: (next: ReadonlySet<string>) => void;
    /** Show a search input above the tree. */
    readonly searchable?: boolean;
    readonly searchPlaceholder?: string;
    /**
     * Controlled search value. Pass `onSearchChange` together to keep
     * the input in sync. Omit both for an internal-only search field.
     */
    readonly searchValue?: string;
    readonly onSearchChange?: (value: string) => void;
    /**
     * Initial expanded state. Pass `true` to expand every branch on
     * first render, a `ReadonlySet<string>` to expand specific ids, or
     * omit for collapsed-by-default.
     */
    readonly defaultExpanded?: boolean | ReadonlySet<string>;
    /** Controlled expansion state. */
    readonly expanded?: ReadonlySet<string>;
    readonly onExpandedChange?: (next: ReadonlySet<string>) => void;
    /** Body to render when the search query matches no nodes. */
    readonly emptyLabel?: ReactNode;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Disable every checkbox in the tree. */
    readonly disabled?: boolean;
    /**
     * Override how a node's selection cascades. Defaults to
     * `"propagateToLeaves"` — clicking a branch checks every enabled
     * leaf descendant (the classic tri-state pattern). Use `"selfOnly"`
     * when the consumer tracks branches as opaque ids.
     */
    readonly cascade?: `propagateToLeaves` | `selfOnly`;
}

const collectLeafIds = (
    node: StaggeredCheckboxNode,
    out: string[] = []
): string[] => {
    if (!node.children || node.children.length === 0) {
        if (!node.disabled) out.push(node.id);
        return out;
    }
    for (const child of node.children) collectLeafIds(child, out);
    return out;
};

const collectAllIds = (
    node: StaggeredCheckboxNode,
    out: string[] = []
): string[] => {
    if (!node.disabled) out.push(node.id);
    if (node.children) {
        for (const child of node.children) collectAllIds(child, out);
    }
    return out;
};

const getNodeState = (
    node: StaggeredCheckboxNode,
    value: ReadonlySet<string>
): StaggeredCheckboxState => {
    if (!node.children || node.children.length === 0) {
        return value.has(node.id) ? `checked` : `unchecked`;
    }
    const childStates = node.children.map((child) => getNodeState(child, value));
    const allChecked = childStates.every((s) => s === `checked`);
    const noneChecked = childStates.every((s) => s === `unchecked`);
    if (allChecked) return `checked`;
    if (noneChecked) return `unchecked`;
    return `indeterminate`;
};

const matchesQuery = (node: StaggeredCheckboxNode, query: string): boolean => {
    const haystack = node.searchLabel
        ? node.searchLabel
        : typeof node.label === `string`
          ? node.label
          : ``;
    if (haystack.toLowerCase().includes(query)) return true;
    if (node.searchKeywords) {
        for (const kw of node.searchKeywords) {
            if (kw.toLowerCase().includes(query)) return true;
        }
    }
    return false;
};

interface FilteredNode {
    readonly node: StaggeredCheckboxNode;
    readonly children: readonly FilteredNode[];
    /** A descendant (or this node) matched the search. */
    readonly matchedInBranch: boolean;
}

const filterTree = (
    nodes: readonly StaggeredCheckboxNode[],
    normalizedQuery: string
): readonly FilteredNode[] => {
    if (normalizedQuery.length === 0) {
        return nodes.map((node) => ({
            node,
            children: filterTree(node.children ?? [], normalizedQuery),
            matchedInBranch: false
        }));
    }
    const out: FilteredNode[] = [];
    for (const node of nodes) {
        const selfMatches = matchesQuery(node, normalizedQuery);
        const filteredChildren = filterTree(node.children ?? [], normalizedQuery);
        const childMatched = filteredChildren.length > 0;
        if (selfMatches || childMatched) {
            out.push({
                node,
                // When the node itself matches, surface its full subtree so
                // the user can still expand into it. When only a descendant
                // matches, keep just the matching branches.
                children: selfMatches
                    ? filterTree(node.children ?? [], ``)
                    : filteredChildren,
                matchedInBranch: true
            });
        }
    }
    return out;
};

const StaggeredCheckboxes = ({
    nodes,
    value,
    onValueChange,
    searchable = false,
    searchPlaceholder,
    searchValue,
    onSearchChange,
    defaultExpanded,
    expanded,
    onExpandedChange,
    emptyLabel,
    className,
    style,
    disabled = false,
    cascade = `propagateToLeaves`
}: StaggeredCheckboxesProps) => {
    const reactId = useId();
    const treeId = `StaggeredCheckboxes-${reactId}`;

    const [internalSearch, setInternalSearch] = useState(``);
    const isSearchControlled = searchValue !== undefined;
    const search = isSearchControlled ? searchValue : internalSearch;
    const handleSearchChange = useCallback(
        (next: string) => {
            if (!isSearchControlled) setInternalSearch(next);
            onSearchChange?.(next);
        },
        [isSearchControlled, onSearchChange]
    );

    const initialExpanded = useMemo<ReadonlySet<string>>(() => {
        if (defaultExpanded === true) {
            const ids: string[] = [];
            const walk = (ns: readonly StaggeredCheckboxNode[]) => {
                for (const n of ns) {
                    if (n.children && n.children.length > 0) {
                        ids.push(n.id);
                        walk(n.children);
                    }
                }
            };
            walk(nodes);
            return new Set(ids);
        }
        if (defaultExpanded instanceof Set) return defaultExpanded;
        return new Set<string>();
        // Default-expanded is captured once on mount — later prop changes are
        // ignored unless the consumer fully controls expansion.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [internalExpanded, setInternalExpanded] =
        useState<ReadonlySet<string>>(initialExpanded);
    const isExpandedControlled = expanded !== undefined;
    const expandedSet = isExpandedControlled ? expanded : internalExpanded;
    const setExpandedSet = useCallback(
        (next: ReadonlySet<string>) => {
            if (!isExpandedControlled) setInternalExpanded(next);
            onExpandedChange?.(next);
        },
        [isExpandedControlled, onExpandedChange]
    );

    const normalizedQuery = search.trim().toLowerCase();
    const filtered = useMemo(
        () => filterTree(nodes, normalizedQuery),
        [nodes, normalizedQuery]
    );

    const handleToggle = useCallback(
        (node: StaggeredCheckboxNode, nextChecked: boolean) => {
            const next = new Set(value);
            const targets =
                cascade === `selfOnly` || !node.children || node.children.length === 0
                    ? [node.id]
                    : collectLeafIds(node);
            if (nextChecked) {
                for (const id of targets) next.add(id);
            } else {
                for (const id of targets) next.delete(id);
            }
            onValueChange(next);
        },
        [value, onValueChange, cascade]
    );

    const handleExpandToggle = useCallback(
        (id: string) => {
            const next = new Set(expandedSet);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setExpandedSet(next);
        },
        [expandedSet, setExpandedSet]
    );

    const isSearching = normalizedQuery.length > 0;
    // Auto-reveal matched subtrees: while a search is active, treat every
    // ancestor as expanded so the user can see the matching descendants
    // without having to click into every branch.
    const autoExpandedSet = useMemo(() => {
        if (!isSearching) return expandedSet;
        const out = new Set(expandedSet);
        const walk = (ns: readonly FilteredNode[]) => {
            for (const fn of ns) {
                if (fn.children.length > 0) {
                    out.add(fn.node.id);
                    walk(fn.children);
                }
            }
        };
        walk(filtered);
        return out;
    }, [expandedSet, filtered, isSearching]);

    const renderNode = (filteredNode: FilteredNode, depth: number): ReactNode => {
        const { node } = filteredNode;
        const hasChildren =
            node.children !== undefined && node.children.length > 0;
        const state = getNodeState(node, value);
        const isExpanded = autoExpandedSet.has(node.id);
        const checkboxId = `${treeId}-cb-${node.id}`;
        const isDisabled = disabled || !!node.disabled;
        const checkedProp: boolean | `indeterminate` =
            state === `checked` ? true : state === `indeterminate` ? `indeterminate` : false;

        return (
            <li
                key={node.id}
                role={`treeitem`}
                aria-expanded={hasChildren ? isExpanded : undefined}
                aria-checked={
                    state === `indeterminate` ? `mixed` : state === `checked`
                }
                aria-level={depth + 1}
                className={`StaggeredCheckboxes-node`}
            >
                <div
                    className={`group flex items-center gap-1 rounded-sm py-1`}
                    style={{ paddingInlineStart: `${depth * 1.25}rem` }}
                >
                    {hasChildren ? (
                        <Button
                            type={`button`}
                            variant={`ghost`}
                            size={`icon`}
                            className={`h-6 w-6 shrink-0`}
                            aria-label={isExpanded ? `Collapse` : `Expand`}
                            aria-expanded={isExpanded}
                            aria-controls={`${treeId}-group-${node.id}`}
                            onClick={() => handleExpandToggle(node.id)}
                        >
                            <ChevronRight
                                className={cn(
                                    `h-4 w-4 transition-transform`,
                                    isExpanded && `rotate-90`
                                )}
                            />
                        </Button>
                    ) : (
                        <span
                            aria-hidden
                            className={`inline-block h-6 w-6 shrink-0`}
                        />
                    )}
                    <Checkbox
                        id={checkboxId}
                        checked={checkedProp}
                        disabled={isDisabled}
                        onCheckedChange={(c) => {
                            // Radix passes `boolean | "indeterminate"`. The user
                            // only ever toggles between checked/unchecked.
                            handleToggle(node, c === true);
                        }}
                    />
                    <Label
                        htmlFor={checkboxId}
                        className={cn(
                            `flex-1 cursor-pointer select-none truncate text-sm font-normal`,
                            isDisabled && `cursor-not-allowed opacity-60`
                        )}
                    >
                        {node.label}
                    </Label>
                </div>
                {hasChildren && isExpanded && filteredNode.children.length > 0 && (
                    <ul
                        id={`${treeId}-group-${node.id}`}
                        role={`group`}
                        className={`flex flex-col`}
                    >
                        {filteredNode.children.map((child) =>
                            renderNode(child, depth + 1)
                        )}
                    </ul>
                )}
            </li>
        );
    };

    const searchInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <div
            className={cn(`StaggeredCheckboxes flex flex-col gap-2`, className)}
            style={style}
        >
            {searchable && (
                <SearchInput
                    ref={searchInputRef}
                    value={search}
                    onValueChange={handleSearchChange}
                    placeholder={searchPlaceholder}
                />
            )}
            {filtered.length === 0 ? (
                <p
                    className={`text-sm text-muted-foreground`}
                    role={`status`}
                    aria-live={`polite`}
                >
                    {emptyLabel ?? `No matches`}
                </p>
            ) : (
                <ul
                    role={`tree`}
                    aria-multiselectable
                    className={`flex flex-col`}
                >
                    {filtered.map((node) => renderNode(node, 0))}
                </ul>
            )}
        </div>
    );
};

export default StaggeredCheckboxes;
export { StaggeredCheckboxes, getNodeState, collectLeafIds, collectAllIds };
