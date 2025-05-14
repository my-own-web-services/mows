import { ComponentType } from "react";
import { MenuItems } from "./DefaultContextMenuItems";

export interface RowRenderer<FilezResource> {
    readonly name: string;
    readonly icon: JSX.Element;
    readonly component: ComponentType<ListRowProps<FilezResource>>;
    readonly getRowHeight: (
        width: number,
        height: number,
        gridColumnCount: number
    ) => number;
    readonly getRowCount: (
        itemCount: number,
        gridColumnCount: number
    ) => number;
    readonly direction: RowRendererDirection;
    readonly isItemLoaded: (
        items: (FilezResource | undefined)[],
        index: number,
        gridColumnCount: number
    ) => boolean;
    readonly getItemKey: (
        items: (FilezResource | undefined)[],
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
        items: (FilezResource | undefined)[],
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

export type ResourceListGetSelectedItems<FilezResource> = () => FilezResource[];

export type ResourceListGetLastSelectedItem<FilezResource> = () =>
    | FilezResource
    | undefined;

export type ResourceListRowHandlersOnClick<FilezResource> = (
    e:
        | React.MouseEvent<HTMLDivElement, MouseEvent>
        | React.TouchEvent<HTMLDivElement>,
    item: FilezResource,
    index: number,
    rightClick?: boolean,
    dragged?: boolean
) => void;

export type ResourceListRowHandlersOnDrop<FilezResource> = (
    targetItemId: string,
    targetItemType: string,
    selectedItems: FilezResource[]
) => void;

export type ResourceListRowHandlersIsDroppable<FilezResource> = (
    item: FilezResource
) => boolean;

export type ResourceListRowHandlersOnContextMenuItemClick<FilezResource> = (
    item: FilezResource,
    menuItemId: string,
    selectedItems: FilezResource[],
    lastSelectedItem?: FilezResource
) => void;

export interface ResourceListRowHandlers<FilezResource> {
    readonly onClick?: ResourceListRowHandlersOnClick<FilezResource>;
    readonly onDrop?: ResourceListRowHandlersOnDrop<FilezResource>;
    readonly onContextMenuItemClick?: ResourceListRowHandlersOnContextMenuItemClick<FilezResource>;
    readonly isDroppable?: ResourceListRowHandlersIsDroppable<FilezResource>;
}

export type ResourceListHandlersOnSearch = (search: string) => void;

export type ResourceListHandlersOnRefresh = () => void;

export type ResourceListHandlersOnListTypeChange = (listType: string) => void;

export type ResourceListHandlersOnCreateClick = () => void;

export type ResourceListHandlersOnSelect<FilezResource> = (
    selectedItems: FilezResource[],
    lastSelectedItem: FilezResource | undefined
) => void;

export interface ResourceListHandlers<FilezResource> {
    readonly onSearch?: ResourceListHandlersOnSearch;
    readonly onRefresh?: ResourceListHandlersOnRefresh;
    readonly onListTypeChange?: ResourceListHandlersOnListTypeChange;
    readonly onCreateClick?: ResourceListHandlersOnCreateClick;
    readonly onSelect?: ResourceListHandlersOnSelect<FilezResource>;
}
export enum RowRendererDirection {
    Horizontal,
    Vertical
}

export interface ListRowProps<FilezResource> {
    readonly data?: ListData<FilezResource>;
    readonly style: React.CSSProperties;
    readonly index: number;
}

export interface ListData<FilezResource> {
    readonly items: (FilezResource | undefined)[];
    readonly total_count: number;
    readonly handlers: {
        readonly onItemClick: ResourceListRowHandlersOnClick<FilezResource>;
        readonly onDrop: ResourceListRowHandlersOnDrop<FilezResource>;
        readonly onContextMenuItemClick?: ResourceListRowHandlersOnContextMenuItemClick<FilezResource>;
    };
    readonly functions: {
        readonly getSelectedItems: ResourceListGetSelectedItems<FilezResource>;
        readonly getLastSelectedItem: ResourceListGetLastSelectedItem<FilezResource>;
    };
    readonly selectedItems: (boolean | undefined)[];
    readonly dropTargetAcceptsTypes?: string[];
    readonly lastSelectedItemIndex?: number;
    readonly columns?: Column<FilezResource>[];
    readonly disableContextMenu?: boolean;
    readonly menuItems: MenuItems;
    readonly resourceType: string;
    readonly gridColumnCount: number;
    readonly rowHeight: number;
    readonly rowHandlers?: ResourceListRowHandlers<FilezResource>;
}

export interface Column<FilezResource> {
    field: string;
    alternateField?: string;
    label: string;
    direction: ColumnDirection;
    widthPercent: number;
    minWidthPixels: number;
    visible: boolean;
    render?: (item: FilezResource) => JSX.Element;
}

export enum ColumnDirection {
    ASCENDING = 0,
    DESCENDING = 1,
    NEUTRAL = 2
}

export interface BaseResource {
    _id: string;
    [key: string]: any;
}
