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

export interface ResourceListHandlers<ResourceType> {
    readonly onSearch?: ResourceListHandlersOnSearch;
    readonly onRefresh?: ResourceListHandlersOnRefresh;
    readonly onListTypeChange?: ResourceListHandlersOnListTypeChange;
    readonly onCreateClick?: ResourceListHandlersOnCreateClick;
    readonly onSelect?: ResourceListHandlersOnSelect<ResourceType>;
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
}

export interface BaseResource {
    id: string;

    [key: string]: any;
}
