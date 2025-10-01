import { SortDirection } from "filez-client-typescript";
import { ComponentType, JSX } from "react";

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

export interface ListRowHandler<FilezResourceType> {
    readonly name: string;
    readonly icon: JSX.Element;
    readonly component: ComponentType<RowComponentProps<FilezResourceType>>;
    readonly getRowHeight: (width: number, height: number, gridColumnCount: number) => number;
    readonly getRowCount: (itemCount: number, gridColumnCount: number) => number;
    readonly direction: RowRendererDirection;
    readonly isItemLoaded: (
        items: (FilezResourceType | undefined)[],
        index: number,
        gridColumnCount: number
    ) => boolean;
    readonly getItemKey: (
        items: (FilezResourceType | undefined)[],
        index: number,
        gridColumnCount: number
    ) => number;
    readonly getStartIndexAndLimit: (
        startIndex: number,
        limit: number,
        gridColumnCount: number
    ) => { startIndex: number; limit: number };
    readonly getSelectedItemsAfterKeypress: (
        e: React.KeyboardEvent<HTMLDivElement>,
        items: (FilezResourceType | undefined)[],
        total_count: number,
        selectedItems: (boolean | undefined)[],
        lastSelectedItemIndex: number | undefined,
        arrowKeyShiftSelectItemIndex: number | undefined,
        gridColumnCount: number
    ) => SelectedItemsAfterKeypress | undefined;
}

export interface SelectedItemsAfterKeypress {
    readonly scrollToRowIndex: number;
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
    readonly gridColumnCount: number;
    readonly rowHeight: number;
    readonly rowHandlers?: ListRowHandler<FilezResourceType>[];
}

export interface Column<FilezResourceType> {
    field: string;
    alternateField?: string;
    label: string;
    direction: SortDirection;
    widthPercent: number;
    minWidthPixels: number;
    visible: boolean;
    render?: (item: FilezResourceType) => JSX.Element;
}

export interface BaseResource {
    id: string;
    name: string;
    created_time: string;
    modified_time: string;
    [key: string]: any;
}
