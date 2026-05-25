import { ComponentType, JSX } from "react";
import ResourceList from "./ResourceList";

export enum SortDirection {
    Ascending = `Ascending`,
    Descending = `Descending`,
    Neutral = `Neutral`
}

export interface ListResourceResponseBody<ResourceType> {
    items: ResourceType[];
    totalCount: number;
}

export interface ListResourceRequestBody {
    fromIndex: number;
    limit: number;
    sortBy: string;
    sortDirection: SortDirection;
}

export enum LoadItemMode {
    Reload,
    NewId,
    All
}

/**
 * Items are individual resources. Rows may contain multiple items depending on the layout.
 */
export interface ListRowHandler<ResourceType> {
    readonly id: string;
    readonly name: string;
    readonly icon: JSX.Element;
    readonly rowRenderer: ComponentType<RowComponentProps<ResourceType>>;
    readonly headerRenderer?: () => JSX.Element;
    readonly getRowHeight: (width: number, height: number) => number;
    readonly getRowCount: (itemCount: number) => number;
    readonly direction: RowRendererDirection;
    readonly isItemLoaded: (items: (ResourceType | undefined)[], rowIndex: number) => boolean;
    readonly getItemKey: (items: (ResourceType | undefined)[], index: number) => number;

    readonly getStartIndexAndLimit: (
        startIndex: number,
        limit: number
    ) => { startIndex: number; limit: number };
    readonly getSelectedItemsAfterKeypress: (
        e: React.KeyboardEvent<HTMLDivElement>,
        items: (ResourceType | undefined)[],
        total_count: number,
        selectedItems: (boolean | undefined)[],
        lastSelectedItemIndex: number | undefined,
        arrowKeyShiftSelectItemIndex: number | undefined
    ) => SelectedItemsAfterKeypress | undefined;
    resourceList: InstanceType<typeof ResourceList> | undefined;

    getMinimumBatchSize: (totalCount: number) => number;
    getLoadMoreItemsThreshold: (totalCount: number) => number;
}

export interface SelectedItemsAfterKeypress {
    readonly scrollToRowIndex?: number;
    readonly nextSelectedItemIndex: number;
    readonly arrowKeyShiftSelectItemIndex?: number;
}

export type ResourceListGetSelectedItems<ResourceType> = () => ResourceType[];

export type ResourceListGetLastSelectedItem<ResourceType> = () => ResourceType | undefined;

export type ResourceListRowHandlersOnClick<ResourceType> = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
    item: ResourceType,
    index: number,
    rightClick?: boolean,
    dragged?: boolean
) => void;

export type ResourceListRowHandlersOnDrop<ResourceType> = (
    targetItemId: string,
    targetItemType: string,
    selectedItems: ResourceType[]
) => void;

export type ResourceListRowHandlersIsDroppable<ResourceType> = (item: ResourceType) => boolean;

export type ResourceListRowHandlersOnContextMenuItemClick<ResourceType> = (
    item: ResourceType,
    menuItemId: string,
    selectedItems: ResourceType[],
    lastSelectedItem?: ResourceType
) => void;

export interface ResourceListRowHandlers<ResourceType> {
    readonly onClick?: ResourceListRowHandlersOnClick<ResourceType>;
    readonly onDrop?: ResourceListRowHandlersOnDrop<ResourceType>;
    readonly onContextMenuItemClick?: ResourceListRowHandlersOnContextMenuItemClick<ResourceType>;
    readonly isDroppable?: ResourceListRowHandlersIsDroppable<ResourceType>;
}

export type ResourceListHandlersOnSearch = (search: string) => void;

export type ResourceListHandlersOnRefresh = () => void;

export type ResourceListHandlersOnListTypeChange = (listType: string) => void;

export type ResourceListHandlersOnCreateClick = () => void;

export type ResourceListHandlersOnSelect<ResourceType> = (
    selectedItems: ResourceType[],
    lastSelectedItem: ResourceType | undefined
) => void;

export type ResourceListHandlersOnItemRightClick<ResourceType> = (
    item: ResourceType,
    event: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>
) => void;

export type ResourceListHandlersOnReorder = (fromIndices: number[], toIndex: number) => void;

export type ResourceListHandlersOnItemsAccepted<ResourceType> = (
    items: ResourceType[],
    insertBeforeIndex: number,
    sourceListInstanceId: string
) => void;

export type ResourceListHandlersOnItemsMovedOut = (
    fromIndices: number[],
    targetListInstanceId: string
) => void;

export interface ResourceListHandlers<ResourceType> {
    readonly onSearch?: ResourceListHandlersOnSearch;
    readonly onRefresh?: ResourceListHandlersOnRefresh;
    readonly onListTypeChange?: ResourceListHandlersOnListTypeChange;
    readonly onCreateClick?: ResourceListHandlersOnCreateClick;
    readonly onSelect?: ResourceListHandlersOnSelect<ResourceType>;
    /**
     * Fires when the user right-clicks a row. The default behaviour
     * (selecting the row if not already selected) still runs; this is
     * an additional hook so consumers can open a custom context menu
     * anchored at `event.clientX` / `event.clientY`. Do not call
     * `event.preventDefault()` here if you also use the global
     * `data-actionscope` machinery — that handler reads the raw event
     * upstream.
     */
    readonly onItemRightClick?: ResourceListHandlersOnItemRightClick<ResourceType>;
    /**
     * Fires after the user drag-and-drops one or more rows to a new
     * position. `fromIndices` lists every moved row's index in the
     * BEFORE state (sorted ascending). `toIndex` is the final
     * position of the first moved item AFTER the splice — the moved
     * block occupies `[toIndex, toIndex + fromIndices.length)` in the
     * new array. The list has already applied the move to its own
     * cached order; the consumer is responsible for persisting the
     * change to whatever backing store it uses.
     */
    readonly onReorder?: ResourceListHandlersOnReorder;
    /**
     * Fires on the target list when a cross-list drop completes — i.e.
     * the user dragged items in from another list whose ID is in this
     * list's `reorderAcceptsFrom`. The list has already inserted the
     * items into its own cache; this hook is for persistence.
     */
    readonly onItemsAccepted?: ResourceListHandlersOnItemsAccepted<ResourceType>;
    /**
     * Fires on the source list after its items were dropped onto a
     * different list. The list has already removed them from its own
     * cache; this hook is for persistence.
     */
    readonly onItemsMovedOut?: ResourceListHandlersOnItemsMovedOut;
}
export enum RowRendererDirection {
    Vertical = `vertical`,
    Horizontal = `horizontal`
}

export interface RowComponentProps<ResourceType> {
    readonly data?: RowComponentData<ResourceType>;
    readonly style: React.CSSProperties;
    readonly index: number;
}

export interface RowComponentData<ResourceType> {
    readonly items: (ResourceType | undefined)[];
    readonly listInstanceId: string;
    readonly total_count: number;
    readonly handlers: {
        readonly onItemClick: ResourceListRowHandlersOnClick<ResourceType>;
    };
    readonly functions: {
        readonly getSelectedItems: ResourceListGetSelectedItems<ResourceType>;
        readonly getLastSelectedItem: ResourceListGetLastSelectedItem<ResourceType>;
    };
    readonly selectedItems: (boolean | undefined)[];
    readonly dropTargetAcceptsTypes?: string[];
    readonly lastSelectedItemIndex?: number;
    readonly disableContextMenu?: boolean;
    readonly resourceType: string;
    readonly rowHeight: number;
    readonly rowHandlers?: ListRowHandler<ResourceType>[];
    readonly listWidth: number;
    readonly listHeight: number;
    /**
     * When true, row handlers that opt in mark the whole row as
     * `draggable` and emit `onReorder(fromIndex, toIndex)` after a
     * drop. The single insertion indicator is owned by the list, not
     * the row — `onDragIndicatorChange` reports the would-be insert
     * position (or `null` to clear).
     */
    readonly reorderable?: boolean;
    /**
     * Internal: the row handler calls this with the source indices
     * (one or many) plus the boundary the pointer was over. The list
     * adjusts the position for the removed source, applies the move
     * to its cache, and then fires the consumer's
     * `handlers.onReorder`.
     */
    readonly onReorder?: (fromIndices: number[], insertBeforeIndex: number) => void;
    readonly onDragIndicatorChange?: (insertBeforeIndex: number | null) => void;
    /**
     * Internal: whether this list accepts a drag originating from the
     * given list-instance id. Same list always accepts itself.
     */
    readonly acceptsDragFrom?: (sourceListInstanceId: string) => boolean;
    /**
     * Internal: called by the row when a drop is committed on it. The
     * list reads the current bus session, routes to either the
     * within-list reorder path or the cross-list accept path, and
     * fires the appropriate consumer callback.
     */
    readonly handleDrop?: (insertBeforeIndex: number) => void;
    /**
     * Internal: called by the source row when its drag ends. If a
     * different list consumed the drag the list splices out the moved
     * items and fires `onItemsMovedOut`.
     */
    readonly handleDragEnd?: () => void;
}

export interface BaseResource {
    id: string;

    [key: string]: any;
}
