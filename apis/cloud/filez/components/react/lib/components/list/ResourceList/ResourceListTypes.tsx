import { SortDirection } from "filez-client-typescript";
import { ComponentType, JSX } from "react";
import ResourceList from "./ResourceList";

export interface ListResourceResponseBody<FilezResourceType> {
    items: FilezResourceType[];
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
export interface ListRowHandler<FilezResourceType> {
    // Unique ID for the row handler
    readonly id: string;
    // Display name for the row handler
    readonly name: string;
    // Icon for the row handler
    readonly icon: JSX.Element;
    // The component rendering each row
    readonly rowRenderer: ComponentType<RowComponentProps<FilezResourceType>>;
    // Optional component rendering the header (e.g., for column titles)
    readonly headerRenderer?: () => JSX.Element;
    // Height of each row in pixels
    readonly getRowHeight: (width: number, height: number) => number;
    // Number of rows to display
    readonly getRowCount: (itemCount: number) => number;
    // The direction of the row renderer (vertical or horizontal)
    readonly direction: RowRendererDirection;
    // Check whether an item is loaded at a given index or not
    readonly isItemLoaded: (items: (FilezResourceType | undefined)[], rowIndex: number) => boolean;
    // Get the unique key for an item
    readonly getItemKey: (items: (FilezResourceType | undefined)[], index: number) => number;

    // Transform the start index and limit based on the row handler's layout
    readonly getStartIndexAndLimit: (
        startIndex: number,
        limit: number
    ) => { startIndex: number; limit: number };
    // Handle keypress events for selection and navigation based on the row handler's layout
    readonly getSelectedItemsAfterKeypress: (
        e: React.KeyboardEvent<HTMLDivElement>,
        items: (FilezResourceType | undefined)[],
        total_count: number,
        selectedItems: (boolean | undefined)[],
        lastSelectedItemIndex: number | undefined,
        arrowKeyShiftSelectItemIndex: number | undefined
    ) => SelectedItemsAfterKeypress | undefined;
    // Reference to the parent ResourceList component
    resourceList: InstanceType<typeof ResourceList> | undefined;

    // Minimum batch size for loading items from the server
    getMinimumBatchSize: (totalCount: number) => number;
    // Threshold to trigger loading more items when scrolling
    getLoadMoreItemsThreshold: (totalCount: number) => number;
}

export interface SelectedItemsAfterKeypress {
    readonly scrollToRowIndex?: number;
    readonly nextSelectedItemIndex: number;
    readonly arrowKeyShiftSelectItemIndex?: number;
}

export type ResourceListGetSelectedItems<FilezResourceType> = () => FilezResourceType[];

export type ResourceListGetLastSelectedItem<FilezResourceType> = () =>
    | FilezResourceType
    | undefined;

export type ResourceListRowHandlersOnClick<FilezResourceType> = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent> | React.TouchEvent<HTMLDivElement>,
    item: FilezResourceType,
    index: number,
    rightClick?: boolean,
    dragged?: boolean
) => void;

export type ResourceListRowHandlersOnDrop<FilezResourceType> = (
    targetItemId: string,
    targetItemType: string,
    selectedItems: FilezResourceType[]
) => void;

export type ResourceListRowHandlersIsDroppable<FilezResourceType> = (
    item: FilezResourceType
) => boolean;

export type ResourceListRowHandlersOnContextMenuItemClick<FilezResourceType> = (
    item: FilezResourceType,
    menuItemId: string,
    selectedItems: FilezResourceType[],
    lastSelectedItem?: FilezResourceType
) => void;

export interface ResourceListRowHandlers<FilezResourceType> {
    readonly onClick?: ResourceListRowHandlersOnClick<FilezResourceType>;
    readonly onDrop?: ResourceListRowHandlersOnDrop<FilezResourceType>;
    readonly onContextMenuItemClick?: ResourceListRowHandlersOnContextMenuItemClick<FilezResourceType>;
    readonly isDroppable?: ResourceListRowHandlersIsDroppable<FilezResourceType>;
}

export type ResourceListHandlersOnSearch = (search: string) => void;

export type ResourceListHandlersOnRefresh = () => void;

export type ResourceListHandlersOnListTypeChange = (listType: string) => void;

export type ResourceListHandlersOnCreateClick = () => void;

export type ResourceListHandlersOnSelect<FilezResourceType> = (
    selectedItems: FilezResourceType[],
    lastSelectedItem: FilezResourceType | undefined
) => void;

export interface ResourceListHandlers<FilezResourceType> {
    readonly onSearch?: ResourceListHandlersOnSearch;
    readonly onRefresh?: ResourceListHandlersOnRefresh;
    readonly onListTypeChange?: ResourceListHandlersOnListTypeChange;
    readonly onCreateClick?: ResourceListHandlersOnCreateClick;
    readonly onSelect?: ResourceListHandlersOnSelect<FilezResourceType>;
}
export enum RowRendererDirection {
    Vertical = "vertical",
    Horizontal = "horizontal"
}

export interface RowComponentProps<FilezResourceType> {
    readonly data?: RowComponentData<FilezResourceType>;
    readonly style: React.CSSProperties;
    readonly index: number;
}

export interface RowComponentData<FilezResourceType> {
    readonly items: (FilezResourceType | undefined)[];
    readonly total_count: number;
    readonly handlers: {
        readonly onItemClick: ResourceListRowHandlersOnClick<FilezResourceType>;
        //readonly onDrop: ResourceListRowHandlersOnDrop<FilezResourceType>;
        //readonly onContextMenuItemClick?: ResourceListRowHandlersOnContextMenuItemClick<FilezResourceType>;
    };
    readonly functions: {
        readonly getSelectedItems: ResourceListGetSelectedItems<FilezResourceType>;
        readonly getLastSelectedItem: ResourceListGetLastSelectedItem<FilezResourceType>;
    };
    readonly selectedItems: (boolean | undefined)[];
    readonly dropTargetAcceptsTypes?: string[];
    readonly lastSelectedItemIndex?: number;
    readonly disableContextMenu?: boolean;
    readonly resourceType: string;
    readonly rowHeight: number;
    readonly rowHandlers?: ListRowHandler<FilezResourceType>[];
}

export interface BaseResource {
    id: string;

    [key: string]: any;
}
