import update from "immutability-helper";
import cloneDeep from "lodash/cloneDeep";
import { RefreshCw } from "lucide-react";
import React, { CSSProperties, Component, JSX, createRef } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import ButtonSelect from "../../input/buttonSelect/ButtonSelect";
import { Button } from "../../ui/button";
import { log } from "../../../lib/logging";
import { MowsContext } from "../../../lib/mowsContext/MowsContext";
import { cn } from "../../../lib/utils";
import {
    BaseResource,
    ListResourceRequestBody,
    ListResourceResponseBody,
    ListRowHandler,
    LoadItemMode,
    ResourceListHandlers,
    RowRendererDirection,
    SortDirection
} from "./ResourceListTypes";
import {
    completeDrag,
    type DragSession,
    endDrag,
    getDragSession,
    subscribeDrag
} from "./dragBus";
import { getSelectedCount, getSelectedItems } from "./utils";

interface ResourceListProps<ResourceType> {
    /**
     A DOM wide unique ID for the list instance.
     */
    readonly listInstanceId: string;

    /**
     The type of the resource to be displayed.
     */
    readonly resourceType: string;

    /**
     The available row handlers
     */
    readonly rowHandlers: ListRowHandler<ResourceType>[];

    /**
     * The initial row handler to use. This has to match one of the names of the provided row handlers.
     */
    readonly initialRowHandler: string;

    /**
     A function that gets the resource in from the server/db and returns it. This has to be implemented in a specific way to support the infinite scrolling.
     */
    readonly getResourcesList: (
        listResourceRequestBody: ListResourceRequestBody
    ) => Promise<ListResourceResponseBody<ResourceType>>;

    readonly style?: CSSProperties;
    readonly className?: string;

    /**
     The default field to sort the list by.
     */
    readonly defaultSortBy?: string;
    /**
     The default direction to sort the list by.
     */
    readonly defaultSortDirection?: SortDirection;

    readonly displayListHeader?: boolean;

    /**
     * The number of items to render outside of the visible area. This can help with smoother scrolling.
     * Default is 20.
     */
    readonly overscanCount?: number;
    readonly listHeaderElement?: JSX.Element;
    readonly handlers?: ResourceListHandlers<ResourceType>;
    readonly dropTargetAcceptsTypes?: string[];

    readonly displayDebugBar?: boolean;

    /**
     * When true, opt-in row handlers (currently `ColumnListRowHandler`)
     * render a drag handle on each row and allow the user to reorder
     * items by dragging. The list itself is unopinionated about how the
     * data moves — fire `handlers.onReorder(fromIndex, toIndex)` and
     * apply the change in your data source, then the list will
     * re-render the next time it loads its window.
     */
    readonly reorderable?: boolean;

    /**
     * Other lists (by `listInstanceId`) whose drags this list will
     * accept as drops. The list always accepts drags from itself; the
     * IDs here are *additional* sources. While a drag is in flight
     * each list draws an overlay marking whether it accepts the
     * current source. Items moved across lists fire
     * `handlers.onItemsAccepted` on the target and
     * `handlers.onItemsMovedOut` on the source.
     */
    readonly reorderAcceptsFrom?: string[];
}

interface ResourceListState<ResourceType> {
    readonly resources: (ResourceType | undefined)[];
    readonly totalItemCount: number;
    readonly committedSearch: string;
    readonly selectedItems: (true | undefined)[];

    readonly lastSelectedItemIndex?: number;
    readonly arrowKeyShiftSelectItemIndex?: number;
    readonly scrollOffset: number;
    readonly width: number | null;
    readonly height: number | null;
    readonly sortBy: string;
    readonly sortDirection: SortDirection;
    readonly currentRowHandler: ListRowHandler<ResourceType>;
    readonly dropIndicatorBeforeIndex: number | null;
    readonly dragSession: DragSession | null;
}

export default class ResourceList<ResourceType extends BaseResource> extends Component<
    ResourceListProps<ResourceType>,
    ResourceListState<ResourceType>
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    infiniteLoaderRef = createRef<typeof InfiniteLoader>();
    listOuterRef = createRef<HTMLDivElement>();
    moreItemsLoading = false;
    lastStartIndex = 0;
    contextMenuRender: JSX.Element;
    dragUnsubscribe: (() => void) | null = null;

    constructor(props: ResourceListProps<ResourceType>) {
        super(props);
        this.contextMenuRender = <></>;

        this.state = {
            resources: [],
            totalItemCount: 0,
            committedSearch: ``,
            selectedItems: [],
            scrollOffset: 0,
            width: null,
            height: null,
            sortBy: this.props.defaultSortBy ?? `CreatedTime`,
            sortDirection: this.props.defaultSortDirection ?? SortDirection.Descending,
            currentRowHandler: this.getRowHandlerById(this.props.initialRowHandler)!,
            dropIndicatorBeforeIndex: null,
            dragSession: null
        };

        log.debug(`ResourceList initial state:`, this.state);
    }

    componentDidMount = async () => {
        log.debug(`ResourceList componentDidMount called`);
        this.dragUnsubscribe = subscribeDrag((session) => {
            if (session === null) {
                // Drag ended (dropped, aborted, escaped) — clear any
                // insertion line still drawn on this list. Without
                // this a release outside a row drop handler leaves a
                // stale indicator visible.
                this.setState({ dragSession: null, dropIndicatorBeforeIndex: null });
            } else {
                this.setState({ dragSession: session });
            }
        });
        await this.loadItems();
    };

    componentWillUnmount = () => {
        this.dragUnsubscribe?.();
        this.dragUnsubscribe = null;
    };

    componentDidUpdate = async (
        prevProps: Readonly<ResourceListProps<ResourceType>>,
        _prevState: Readonly<ResourceListState<ResourceType>>
    ) => {
        if (
            prevProps.listInstanceId !== this.props.listInstanceId ||
            prevProps.resourceType !== this.props.resourceType
        ) {
            await this.loadItems(LoadItemMode.NewId);
        }
    };

    getCurrentVisibleItemsRange = (
        scrollOffset: number
    ): { startIndex: number; endIndex: number } => {
        const { width, height } = this.state;
        if (width === null || height === null) return { startIndex: 0, endIndex: 30 };

        const rowHeight = this.state.currentRowHandler.getRowHeight(width, height);
        const startIndex = Math.floor(scrollOffset / rowHeight);
        const endIndex = Math.ceil((scrollOffset + height) / rowHeight);

        return { startIndex, endIndex };
    };

    loadItems = async (mode?: LoadItemMode) => {
        log.debug(`loadItems called with mode:`, mode);
        if (mode === LoadItemMode.NewId) {
            this.scrollToRow(0);
        }

        const currentlyVisibleItemRange = this.getCurrentVisibleItemsRange(
            mode === LoadItemMode.NewId ? 0 : this.state.scrollOffset
        );

        let { startIndex, limit } = this.state.currentRowHandler.getStartIndexAndLimit(
            currentlyVisibleItemRange.startIndex,
            currentlyVisibleItemRange.endIndex - currentlyVisibleItemRange.startIndex + 1
        );

        if (mode === LoadItemMode.All) {
            startIndex = 0;
            limit = this.state.totalItemCount;
        }

        this.moreItemsLoading = true;

        const { items: newItems, totalCount } = await this.props.getResourcesList({
            fromIndex: startIndex,
            limit,
            sortBy: this.state.sortBy,
            sortDirection: this.state.sortDirection
        });

        this.moreItemsLoading = false;

        this.setState(({ resources: items, selectedItems }) => {
            if (mode === LoadItemMode.NewId || mode === LoadItemMode.Reload) {
                items = [];
            }
            for (let i = 0; i < newItems.length; i++) {
                items[startIndex + i] = newItems[i];
            }

            if (mode === LoadItemMode.NewId) {
                selectedItems = [];
            }

            log.debug(`Updated items and selectedItems in state:`, {
                itemsLength: items.length,
                selectedItemsLength: selectedItems.length
            });

            return { resources: items, totalItemCount: totalCount, selectedItems };
        });
    };

    loadMoreItems = async (startIndex: number, endIndex: number) => {
        let limit = endIndex - startIndex + 1;

        const startIndexAndLimit = this.state.currentRowHandler.getStartIndexAndLimit(
            startIndex,
            limit
        );
        startIndex = startIndexAndLimit.startIndex;
        limit = startIndexAndLimit.limit;

        const { items: newItems } = await this.props.getResourcesList({
            fromIndex: startIndex,
            limit,
            sortBy: this.state.sortBy,
            sortDirection: this.state.sortDirection
        });

        const updatedItems = update(this.state.resources, {
            $apply: (currentItems: (ResourceType | undefined)[]) => {
                for (let i = 0; i < newItems.length; i++) {
                    currentItems[startIndex + i] = newItems[i];
                }
                return currentItems;
            }
        });

        this.setState({ resources: updatedItems });
    };

    commitSearch = (search: string) => {
        this.setState({ committedSearch: search }, () => {
            //@ts-expect-error
            this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
            this.loadItems(LoadItemMode.NewId);
        });
    };

    refreshList = async () => {
        //@ts-expect-error
        this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);
        await this.loadItems(LoadItemMode.Reload);
    };

    onItemClick = async (
        e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
        item: ResourceType,
        index: number,
        rightClick?: boolean,
        dragged?: boolean
    ) => {
        // @ts-expect-error
        if (e.target?.classList?.contains(`clickable`)) return;

        const afterStateUpdate = () =>
            this.props.handlers?.onSelect?.(this.getSelectedItems(), item);

        if (e.ctrlKey) {
            const selectedItems = cloneDeep(this.state.selectedItems);
            const currentSelectionState = this.state.selectedItems[index];
            selectedItems[index] = currentSelectionState === true ? undefined : true;

            const lastSelectedItemIndex = (() => {
                if (index === this.state.lastSelectedItemIndex || currentSelectionState) {
                    return undefined;
                }

                return index;
            })();

            this.setState(
                update(this.state, {
                    selectedItems: {
                        $set: selectedItems
                    },
                    lastSelectedItemIndex: {
                        $set: lastSelectedItemIndex
                    }
                }),
                afterStateUpdate
            );
        } else if (e.shiftKey) {
            const toBeSet = await (async () => {
                const state = this.state;
                const selectedItems = cloneDeep(state.selectedItems);
                const noneSelected = selectedItems.every((selected) => {
                    return selected === undefined;
                });

                if (noneSelected) {
                    //@ts-expect-error
                    selectedItems[index] = true;
                    return selectedItems;
                }

                const startIndex = this.state.lastSelectedItemIndex ?? 0;

                const endIndex = index;

                const minIndex = Math.min(startIndex, endIndex);
                const maxIndex = Math.max(startIndex, endIndex);

                const allToBeSelectedLoaded = this.isItemRangeLoaded(minIndex, maxIndex);

                if (!allToBeSelectedLoaded) {
                    await this.loadMoreItems(minIndex, maxIndex);
                }

                for (let i = minIndex; i <= maxIndex; i++) {
                    selectedItems[i] = true;
                }

                return selectedItems;
            })();

            this.setState((state) => {
                return update(state, {
                    selectedItems: {
                        $set: toBeSet
                    },
                    lastSelectedItemIndex: {
                        $set: index
                    }
                });
            }, afterStateUpdate);
        } else if (rightClick === true || dragged === true) {
            const selectedItems = this.getSelectedItems();
            const currentItemInSelectedItems =
                selectedItems.find((selectedItem) => selectedItem.id === item.id) !== undefined;

            if (!currentItemInSelectedItems) {
                const newSelectedItems: (true | undefined)[] = [];
                newSelectedItems[index] = true;
                this.setState({
                    selectedItems: newSelectedItems,
                    lastSelectedItemIndex: index
                });
            }
            if (rightClick === true) {
                this.props.handlers?.onItemRightClick?.(item, e);
            }
        } else {
            const selectedItems: (true | undefined)[] = [];
            selectedItems[index] = true;
            this.setState(
                {
                    selectedItems,
                    lastSelectedItemIndex: index
                },
                afterStateUpdate
            );
        }
    };

    isItemRangeLoaded = (startIndex: number, endIndex: number) => {
        const { resources: items } = this.state;
        for (let i = startIndex; i < endIndex; i++) {
            if (items[i] === undefined) return false;
        }
        return true;
    };

    getSelectedItems = (): ResourceType[] => {
        return getSelectedItems(this.state.resources, this.state.selectedItems);
    };

    isItemLoaded = (index: number) => {
        return this.state.currentRowHandler.isItemLoaded(this.state.resources, index);
    };

    onScroll = ({
        scrollOffset
    }: {
        scrollDirection: `forward` | `backward`;
        scrollOffset: number;
        scrollUpdateWasRequested: boolean;
    }) => {
        this.setState({ scrollOffset });
    };

    getItemKey = (index: number) => {
        return this.state.currentRowHandler?.getItemKey(this.state.resources, index);
    };

    updateDimensions = ({
        height,
        width
    }: {
        height: number;
        scaledHeight: number;
        scaledWidth: number;
        width: number;
    }) => {
        this.setState({ width, height });
    };

    onAddResourceClick = () => {
        this.props.handlers?.onCreateClick?.();
    };

    updateRowHandler = (rowHandlerId: string) => {
        const rowHandler = this.getRowHandlerById(rowHandlerId);
        this.setState({ currentRowHandler: rowHandler });
    };

    /**
     * Applies a drag-and-drop reorder locally and then fires the
     * consumer's `onReorder` for persistence. The list owns its
     * `state.resources` cache, so the consumer mutating its source
     * array is not enough — we have to splice the cached window too,
     * otherwise the user drops a row and nothing visibly moves.
     *
     * Selection indices are remapped so the same items stay selected
     * after the move (their indices shift around).
     */
    setDropIndicator = (insertBeforeIndex: number | null) => {
        if (this.state.dropIndicatorBeforeIndex === insertBeforeIndex) return;
        this.setState({ dropIndicatorBeforeIndex: insertBeforeIndex });
    };

    acceptsDragFrom = (sourceListInstanceId: string): boolean => {
        if (sourceListInstanceId === this.props.listInstanceId) return true;
        return this.props.reorderAcceptsFrom?.includes(sourceListInstanceId) ?? false;
    };

    handleDrop = (insertBeforeIndex: number) => {
        const session = getDragSession();
        if (!session) return;
        if (session.sourceListInstanceId === this.props.listInstanceId) {
            // Within-list drop — dragend has nothing to do, so we can
            // close the session immediately instead of waiting for it.
            endDrag();
            this.reorderItems([...session.fromIndices], insertBeforeIndex);
            return;
        }
        if (!this.acceptsDragFrom(session.sourceListInstanceId)) return;
        completeDrag(this.props.listInstanceId);
        this.acceptDroppedItems(
            [...session.items] as ResourceType[],
            insertBeforeIndex,
            session.sourceListInstanceId
        );
    };

    handleDragEnd = () => {
        const completed = endDrag();
        if (!completed) return;
        if (!completed.consumedBy) return;
        if (completed.consumedBy === this.props.listInstanceId) return;
        this.removeMovedItems([...completed.fromIndices], completed.consumedBy);
    };

    private isPointerInRow = (e: React.DragEvent<HTMLDivElement>): boolean => {
        const target = e.target as HTMLElement | null;
        return !!target?.closest(`.ColumnListRowRenderer`);
    };

    // Wrapper-level dragover. The row handler computes a precise
    // insertion boundary from the pointer's Y within the row, so when
    // the pointer is over a row we defer to it entirely — otherwise
    // bubbling would race the row and overwrite its boundary with
    // "append at end" on every tick.
    onListDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (this.props.reorderable !== true) return;
        if (this.isPointerInRow(e)) return;
        const session = getDragSession();
        if (!session) return;
        if (!this.acceptsDragFrom(session.sourceListInstanceId)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = `move`;
        this.setDropIndicator(this.state.totalItemCount);
    };

    // Wrapper-level drop catches releases in the empty tail area below
    // the last row. Without this, a release outside row bounds gets
    // swallowed by the browser even though we just painted an insertion
    // line at the end of the list.
    onListDrop = (e: React.DragEvent<HTMLDivElement>) => {
        if (this.props.reorderable !== true) return;
        if (this.isPointerInRow(e)) return;
        const session = getDragSession();
        if (!session) return;
        if (!this.acceptsDragFrom(session.sourceListInstanceId)) return;
        e.preventDefault();
        this.setDropIndicator(null);
        this.handleDrop(this.state.totalItemCount);
    };

    // Dragging from list A into list B never fires a dragleave on B
    // (the pointer never entered B before), so this handler on A is
    // where A's stale insertion line gets cleared. dragleave bubbles
    // from inner elements, so we check that the pointer actually exited
    // the wrapper instead of just hopping to a child.
    onListDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        if (this.props.reorderable !== true) return;
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (this.state.dropIndicatorBeforeIndex !== null) {
            this.setState({ dropIndicatorBeforeIndex: null });
        }
    };

    acceptDroppedItems = (
        items: ResourceType[],
        insertBeforeIndex: number,
        sourceListInstanceId: string
    ) => {
        if (items.length === 0) return;
        this.setState(
            (state) => {
                const resources = state.resources.slice();
                const clamped = Math.max(0, Math.min(insertBeforeIndex, resources.length));
                resources.splice(clamped, 0, ...items);

                const selectedItems: (true | undefined)[] = [];
                state.selectedItems.forEach((sel, oldIdx) => {
                    if (sel !== true) return;
                    const newIdx = oldIdx >= clamped ? oldIdx + items.length : oldIdx;
                    selectedItems[newIdx] = true;
                });

                let lastSelectedItemIndex = state.lastSelectedItemIndex;
                if (
                    lastSelectedItemIndex !== undefined &&
                    lastSelectedItemIndex >= clamped
                ) {
                    lastSelectedItemIndex += items.length;
                }

                return {
                    resources,
                    selectedItems,
                    lastSelectedItemIndex,
                    totalItemCount: state.totalItemCount + items.length
                };
            },
            () => {
                this.props.handlers?.onItemsAccepted?.(
                    items,
                    insertBeforeIndex,
                    sourceListInstanceId
                );
            }
        );
    };

    removeMovedItems = (fromIndices: number[], targetListInstanceId: string) => {
        const sorted = Array.from(new Set(fromIndices)).sort((a, b) => a - b);
        if (sorted.length === 0) return;
        this.setState(
            (state) => {
                const resources = state.resources.slice();
                // Remove in reverse so earlier splices don't shift later indices.
                for (let i = sorted.length - 1; i >= 0; i--) {
                    const idx = sorted[i]!;
                    if (idx < resources.length) resources.splice(idx, 1);
                }

                const sortedSet = new Set(sorted);
                const selectedItems: (true | undefined)[] = [];
                state.selectedItems.forEach((sel, oldIdx) => {
                    if (sel !== true) return;
                    if (sortedSet.has(oldIdx)) return;
                    const removedBefore = sorted.filter((i) => i < oldIdx).length;
                    selectedItems[oldIdx - removedBefore] = true;
                });

                let lastSelectedItemIndex = state.lastSelectedItemIndex;
                if (lastSelectedItemIndex !== undefined) {
                    if (sortedSet.has(lastSelectedItemIndex)) {
                        lastSelectedItemIndex = undefined;
                    } else {
                        const removedBefore = sorted.filter((i) => i < lastSelectedItemIndex!).length;
                        lastSelectedItemIndex -= removedBefore;
                    }
                }

                return {
                    resources,
                    selectedItems,
                    lastSelectedItemIndex,
                    totalItemCount: Math.max(0, state.totalItemCount - sorted.length)
                };
            },
            () => {
                this.props.handlers?.onItemsMovedOut?.(sorted, targetListInstanceId);
            }
        );
    };

    reorderItems = (fromIndices: number[], insertBeforeIndex: number) => {
        const sorted = Array.from(new Set(fromIndices)).sort((a, b) => a - b);
        if (sorted.length === 0) return;
        if (sorted[0]! < 0 || sorted[sorted.length - 1]! >= this.state.resources.length) {
            return;
        }
        if (insertBeforeIndex < 0 || insertBeforeIndex > this.state.resources.length) {
            return;
        }
        const removedBefore = sorted.filter((i) => i < insertBeforeIndex).length;
        const adjustedInsertAt = insertBeforeIndex - removedBefore;

        // A contiguous block dropped onto its own start position is a
        // no-op — early-out so the consumer callback doesn't fire.
        const isContiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1]! + 1);
        if (isContiguous && adjustedInsertAt === sorted[0]) return;

        this.setState(
            (state) => {
                const resources = state.resources.slice();

                const movedItems = sorted.map((i) => resources[i]);
                // Remove in reverse so earlier splices don't shift the
                // later indices we still need to read from.
                for (let i = sorted.length - 1; i >= 0; i--) {
                    resources.splice(sorted[i]!, 1);
                }
                resources.splice(adjustedInsertAt, 0, ...movedItems);

                const sortedSet = new Set(sorted);
                const len = sorted.length;
                const selectedItems: (true | undefined)[] = [];

                // Moved items occupy [adjustedInsertAt, adjustedInsertAt+len).
                sorted.forEach((oldIdx, k) => {
                    if (state.selectedItems[oldIdx] === true) {
                        selectedItems[adjustedInsertAt + k] = true;
                    }
                });

                // Items that stayed put shift left by how many removed
                // items came before them, then right by `len` if they
                // end up at or past the insertion point.
                state.selectedItems.forEach((sel, oldIdx) => {
                    if (sel !== true) return;
                    if (sortedSet.has(oldIdx)) return;
                    const removedBeforeThis = sorted.filter((i) => i < oldIdx).length;
                    let newIdx = oldIdx - removedBeforeThis;
                    if (newIdx >= adjustedInsertAt) newIdx += len;
                    selectedItems[newIdx] = true;
                });

                let lastSelectedItemIndex: number | undefined = undefined;
                if (state.lastSelectedItemIndex !== undefined) {
                    const idx = state.lastSelectedItemIndex;
                    if (sortedSet.has(idx)) {
                        lastSelectedItemIndex = adjustedInsertAt + sorted.indexOf(idx);
                    } else {
                        const removedBeforeThis = sorted.filter((i) => i < idx).length;
                        let newIdx = idx - removedBeforeThis;
                        if (newIdx >= adjustedInsertAt) newIdx += len;
                        lastSelectedItemIndex = newIdx;
                    }
                }

                return { resources, selectedItems, lastSelectedItemIndex };
            },
            () => {
                this.props.handlers?.onReorder?.(sorted, adjustedInsertAt);
            }
        );
    };

    getRowHandlerById = (id: string) => {
        const rowHandler = this.props.rowHandlers.find((r) => r.id === id);
        if (!rowHandler)
            throw new Error(`No row handler found with name ${this.props.initialRowHandler}`);

        //@ts-expect-error
        rowHandler.resourceList = this;
        return rowHandler;
    };

    getLastSelectedItem = () => {
        const index = this.state.lastSelectedItemIndex;
        if (index === undefined) return undefined;
        return this.state.resources[index];
    };

    selectAll = async () => {
        this.setState(
            {
                selectedItems: new Array(this.state.totalItemCount).fill(true)
            },
            async () => {
                await this.loadItems(LoadItemMode.All);
                this.props.handlers?.onSelect?.(
                    this.getSelectedItems(),
                    this.state.resources[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );
    };

    deselectAll = () => {
        this.setState(
            {
                selectedItems: new Array(this.state.totalItemCount).fill(false)
            },
            async () => {
                await this.loadItems(LoadItemMode.All);
                this.props.handlers?.onSelect?.(
                    this.getSelectedItems(),
                    this.state.resources[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );
    };

    handleCommonHotkeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.ctrlKey) {
            if (e.key === `a`) {
                e.preventDefault();
                this.selectAll();
            }
        }
    };

    onListKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.preventDefault();

        this.handleCommonHotkeys(e);

        const selectedItemsAfterKeypress =
            this.state.currentRowHandler.getSelectedItemsAfterKeypress(
                e,
                this.state.resources,
                this.state.totalItemCount,
                this.state.selectedItems,
                this.state.lastSelectedItemIndex,
                this.state.arrowKeyShiftSelectItemIndex
            );

        if (selectedItemsAfterKeypress === undefined) return;

        const { scrollToRowIndex, nextSelectedItemIndex, arrowKeyShiftSelectItemIndex } =
            selectedItemsAfterKeypress;

        const selectedItems = (() => {
            const s: (true | undefined)[] = [];
            const startIndex = Math.min(
                nextSelectedItemIndex,
                arrowKeyShiftSelectItemIndex ?? nextSelectedItemIndex
            );
            const endIndex = Math.max(
                nextSelectedItemIndex,
                arrowKeyShiftSelectItemIndex ?? nextSelectedItemIndex
            );

            for (let i = startIndex; i <= endIndex; i++) {
                s[i] = true;
            }
            return s;
        })();

        this.setState(
            {
                selectedItems,
                lastSelectedItemIndex: nextSelectedItemIndex,
                arrowKeyShiftSelectItemIndex
            },
            () => {
                this.props.handlers?.onSelect?.(
                    this.getSelectedItems(),
                    this.state.resources[this.state.lastSelectedItemIndex ?? 0]
                );
            }
        );

        this.scrollToRow(scrollToRowIndex);
    };

    scrollToRow = (index?: number) => {
        if (index === undefined) return;
        // @ts-expect-error
        this.infiniteLoaderRef.current._listRef.scrollToItem(index);
    };

    renderCrossListOverlay = () => {
        const session = this.state.dragSession;
        if (!session) return null;
        if (this.props.reorderable !== true) return null;
        // Don't paint over the source list — the user is dragging out
        // of it; the indicator line + the dragged ghost are enough.
        if (session.sourceListInstanceId === this.props.listInstanceId) return null;
        const accepts = this.acceptsDragFrom(session.sourceListInstanceId);
        return (
            <div
                aria-hidden
                className={cn(
                    `ResourceListCrossListOverlay pointer-events-none absolute inset-0 z-20 rounded-sm`,
                    accepts
                        ? `ring-primary bg-primary/5 ring-2 ring-inset`
                        : `bg-background/60`
                )}
                data-accepts-drag={accepts ? `true` : `false`}
            >
                {!accepts && (
                    <div className={`absolute inset-x-0 top-2 flex justify-center`}>
                        <span
                            className={`bg-background text-muted-foreground rounded-md border px-2 py-1 text-xs`}
                        >
                            {this.context!.t.resourceList.crossListDoesNotAcceptDrops}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    renderDropIndicator = (width: number, height: number) => {
        if (this.props.reorderable !== true) return null;
        const idx = this.state.dropIndicatorBeforeIndex;
        if (idx === null) return null;
        const rowHeight = this.state.currentRowHandler.getRowHeight(width, height);
        // Position the 2px line at the boundary `idx` would land on, in
        // the list's scroll space: 0 = above row 0, totalRowCount =
        // below the last row.
        const top = idx * rowHeight - this.state.scrollOffset;
        return (
            <div
                aria-hidden
                className={`ResourceListReorderIndicator bg-primary pointer-events-none absolute right-0 left-0 z-10 h-[2px]`}
                style={{ top: `${top}px` }}
            />
        );
    };

    debugBar = () => {
        if (this.props.displayDebugBar !== true) return null;
        return (
            <div
                className={`DebugBar text-primary/30 flex gap-2 border-t-1 border-b-1 p-1 text-xs`}
            >
                <span>
                    {this.state.resources.length} / {this.state.totalItemCount} items loaded.
                </span>
                <span>{getSelectedCount(this.state.selectedItems)} items selected. </span>
                <span>Last selected item index: {this.state.lastSelectedItemIndex}</span>
                <span>Current Row Handler: {this.state.currentRowHandler.id}. </span>
                <span>
                    Current Sorting: {this.state.sortBy} ({SortDirection[this.state.sortDirection]}
                    ).
                </span>
            </div>
        );
    };

    listHeader = () => {
        const { t } = this.context!;
        if (this.props.displayListHeader === false) return null;
        if (this.props.listHeaderElement) return this.props.listHeaderElement;
        return (
            <div className={`flex h-12 w-full items-center justify-end gap-2 pr-4`}>
                <Button
                    size={`icon-sm`}
                    variant={`outline`}
                    onClick={this.refreshList}
                    title={t.resourceList.reload}
                >
                    <RefreshCw />
                </Button>
                {this.props.rowHandlers.length > 1 && (
                    <ButtonSelect
                        size={`icon-sm`}
                        onSelectionChange={(id: string) => {
                            log.debug(`Switching row handler to`, id);
                            this.updateRowHandler(id);
                        }}
                        selectedId={this.state.currentRowHandler.id}
                        options={this.props.rowHandlers.map((rowHandler) => {
                            return {
                                id: rowHandler.id,
                                icon: rowHandler.icon,
                                label: rowHandler.name
                            };
                        })}
                    />
                )}
            </div>
        );
    };

    render = () => {
        const totalRowCount = this.state.currentRowHandler.getRowCount(this.state.totalItemCount);

        const minimumBatchSize = this.state.currentRowHandler.getMinimumBatchSize(
            this.state.totalItemCount
        );
        const loadMoreItemsThreshold = this.state.currentRowHandler.getLoadMoreItemsThreshold(
            this.state.totalItemCount
        );

        return (
            <div
                data-list-instance-id={this.props.listInstanceId}
                className={cn(
                    `ResourceList relative flex h-full w-full flex-col`,
                    this.props.className
                )}
                style={{ ...this.props.style }}
                onDragOver={this.props.reorderable ? this.onListDragOver : undefined}
                onDrop={this.props.reorderable ? this.onListDrop : undefined}
                onDragLeave={this.props.reorderable ? this.onListDragLeave : undefined}
            >
                {this.renderCrossListOverlay()}
                {this.listHeader()}
                {this.state.currentRowHandler.headerRenderer?.()}
                <div
                    className={`OuterResourceList relative h-full w-full focus:outline-none`}
                    onKeyDown={this.onListKeyDown}
                    tabIndex={0}
                >
                    <AutoSizer onResize={this.updateDimensions}>
                        {({ height, width }) => {
                            return (
                                <>
                                    {this.renderDropIndicator(width, height)}
                                <InfiniteLoader
                                    isItemLoaded={this.isItemLoaded}
                                    itemCount={totalRowCount}
                                    loadMoreItems={this.loadMoreItems}
                                    //@ts-expect-error
                                    ref={this.infiniteLoaderRef}
                                    minimumBatchSize={minimumBatchSize}
                                    threshold={loadMoreItemsThreshold}
                                >
                                    {({ onItemsRendered, ref }) => {
                                        const rowHeight = this.state.currentRowHandler.getRowHeight(
                                            width,
                                            height
                                        );

                                        const isHorizontal =
                                            this.state.currentRowHandler.direction ===
                                            RowRendererDirection.Horizontal;

                                        return (
                                            <FixedSizeList
                                                outerRef={this.listOuterRef}
                                                itemSize={rowHeight}
                                                itemKey={this.getItemKey}
                                                onScroll={this.onScroll}
                                                overscanCount={this.props.overscanCount ?? 20}
                                                width={width}
                                                height={height}
                                                itemCount={totalRowCount}
                                                onItemsRendered={onItemsRendered}
                                                ref={ref}
                                                style={{
                                                    willChange: `none`,
                                                    // Show only the scrollbar on the axis the
                                                    // active row handler actually scrolls on. A
                                                    // horizontal strip with a vertical scrollbar
                                                    // looks broken (and steals 17px of card
                                                    // width); vice versa for a vertical list.
                                                    overflowX: isHorizontal ? `scroll` : `hidden`,
                                                    overflowY: isHorizontal ? `hidden` : `scroll`
                                                }}
                                                layout={isHorizontal ? `horizontal` : `vertical`}
                                                itemData={{
                                                    items: this.state.resources,
                                                    total_count: this.state.totalItemCount,
                                                    dropTargetAcceptsTypes:
                                                        this.props.dropTargetAcceptsTypes,
                                                    handlers: {
                                                        onItemClick: this.onItemClick
                                                    },
                                                    functions: {
                                                        getSelectedItems: this.getSelectedItems,
                                                        getLastSelectedItem:
                                                            this.getLastSelectedItem
                                                    },
                                                    selectedItems: this.state.selectedItems,
                                                    lastSelectedItemIndex:
                                                        this.state.lastSelectedItemIndex,

                                                    resourceType: this.props.resourceType,
                                                    rowHeight,
                                                    rowHandlers: this.props.rowHandlers,
                                                    listInstanceId: this.props.listInstanceId,
                                                    listWidth: width,
                                                    listHeight: height,
                                                    reorderable: this.props.reorderable,
                                                    onReorder: this.reorderItems,
                                                    onDragIndicatorChange: this.setDropIndicator,
                                                    acceptsDragFrom: this.acceptsDragFrom,
                                                    handleDrop: this.handleDrop,
                                                    handleDragEnd: this.handleDragEnd
                                                }}
                                            >
                                                {/*@ts-expect-error*/}
                                                {this.state.currentRowHandler.rowRenderer}
                                            </FixedSizeList>
                                        );
                                    }}
                                </InfiniteLoader>
                                </>
                            );
                        }}
                    </AutoSizer>
                </div>
                {this.debugBar()}
            </div>
        );
    };
}
