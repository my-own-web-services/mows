import { PureComponent, createRef } from "react";
import {
    BaseResource,
    ListRowProps,
    RowRenderer,
    RowRendererDirection,
    SelectedItemsAfterKeypress
} from "../ResourceListTypes";
import { dragHandleWidth } from "../SortingBar";
import RowContextMenu from "../RowContextMenu";
import { FaThList } from "react-icons/fa";
import { DraggableItem } from "../../../dnd/DraggableItem";
import { DraggableTarget } from "../../../dnd/DraggableTarget";

interface ListRowState {}

class ListRowComp<ResourceType extends BaseResource> extends PureComponent<
    ListRowProps<ResourceType>,
    ListRowState
> {
    contextMenuRef = createRef<RowContextMenu<ResourceType>>();

    constructor(props: ListRowProps<ResourceType>) {
        super(props);
        this.state = {};
    }

    getCurentItem = () => {
        return this.props.data?.items?.[this.props.index];
    };

    onItemClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        this.props.data?.handlers.onItemClick?.(
            e,
            this.getCurentItem() as ResourceType,
            this.props.index
        );
    };

    onItemDrag = (e: React.DragEvent<HTMLDivElement>) => {
        this.props.data?.handlers.onItemClick?.(
            e,
            this.getCurentItem() as ResourceType,
            this.props.index,
            false,
            true
        );
    };

    onContextMenu = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        this.props.data?.handlers.onItemClick?.(
            e,
            this.getCurentItem() as ResourceType,
            this.props.index,
            true
        );
        this.contextMenuRef.current?.open(e);
    };

    canDrop = () => {
        return (
            this.props.data?.rowHandlers?.isDroppable?.(
                this.getCurentItem() as ResourceType
            ) ?? false
        );
    };

    render = () => {
        if (this.props.data === undefined) return;
        const item = this.getCurentItem();
        if (!item) return;
        const columns = this.props.data.columns;
        const isSelected =
            this.props.data.selectedItems[this.props.index] === true;
        const style = this.props.style;
        const itemType = this.props.data.resourceType;
        const isLastSelected =
            this.props.data.lastSelectedItemIndex === this.props.index;

        return (
            <div
                onClick={this.onItemClick}
                onDrag={this.onItemDrag}
                style={{
                    ...style,
                    whiteSpace: "nowrap",
                    overflow: "hidden"
                }}
                onContextMenu={this.onContextMenu}
                className={`Row${isSelected ? " selected" : ""}${
                    isLastSelected ? " lastSelected" : ""
                }`}
            >
                <DraggableItem
                    resource={item}
                    dropHandler={this.props.data.handlers.onDrop}
                    getSelectedItems={
                        this.props.data.functions.getSelectedItems
                    }
                    type={itemType}
                >
                    <DraggableTarget
                        acceptTypes={
                            this.props.data.dropTargetAcceptsTypes ?? []
                        }
                        id={item._id}
                        type={itemType}
                        canDrop={this.canDrop}
                    >
                        {columns ? (
                            (() => {
                                const activeColumns = columns.filter(
                                    (c) => c.visible
                                );

                                return activeColumns.map((column, index) => {
                                    const field =
                                        item[column.field] !== undefined
                                            ? item[column.field]
                                            : item[column.alternateField ?? ""];

                                    const width = (() => {
                                        if (
                                            index ===
                                            activeColumns.length - 1
                                        ) {
                                            // 17px is the width of the scrollbar
                                            return `calc(${column.widthPercent}% - 17px)`;
                                        }
                                        const dhwFixed = dragHandleWidth - 5;
                                        if (index === 0) {
                                            return `calc(${column.widthPercent}% + ${dhwFixed}px)`;
                                        }
                                        // for some reason this works
                                        return `calc(${
                                            column.widthPercent
                                        }% + ${dhwFixed / 2}px)`;
                                    })();
                                    return (
                                        <span
                                            key={column.field + index}
                                            style={{
                                                width,
                                                height: "100%",
                                                display: "block",
                                                float: "left",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                paddingLeft: "5px"
                                            }}
                                        >
                                            {column.render
                                                ? column.render(item)
                                                : field ??
                                                  `Field '${column.field}' does not exist on this ${this.props.data?.resourceType}`}
                                        </span>
                                    );
                                });
                            })()
                        ) : (
                            <span>{item._id}</span>
                        )}
                    </DraggableTarget>
                </DraggableItem>
                {this.props.data.disableContextMenu !== true && (
                    <RowContextMenu
                        menuItems={this.props.data.menuItems}
                        menuId={item._id}
                        ref={this.contextMenuRef}
                        currentItem={item}
                        onContextMenuItemClick={
                            this.props.data.handlers.onContextMenuItemClick
                        }
                        getSelectedItems={
                            this.props.data.functions.getSelectedItems
                        }
                        getLastSelectedItem={
                            this.props.data.functions.getLastSelectedItem
                        }
                    />
                )}
            </div>
        );
    };
}

const ColumnListRowRenderer = <
    ResourceType extends BaseResource
>(): RowRenderer<ResourceType> => ({
    name: "ColumnListRowRenderer",
    icon: (
        <FaThList
            style={{ transform: "scale(0.9)", pointerEvents: "none" }}
            size={17}
        />
    ),
    component: ListRowComp,
    getRowCount: (itemCount, _gridColumnCount) => {
        return itemCount;
    },
    getRowHeight: (_width, _height, _gridColumnCount) => {
        return 20;
    },
    direction: RowRendererDirection.Vertical,
    getItemKey: (_items, index, _gridColumnCount) => {
        return index;
    },
    isItemLoaded: (items, index, _gridColumnCount) => {
        return items[index] !== undefined;
    },
    getStartIndexAndLimit: (startIndex, limit, _gridColumnCount) => {
        return { startIndex, limit };
    },
    getSelectedItemsAfterKeypress: (
        e,
        items,
        total_count,
        selectedItems,
        lastSelectedItemIndex,
        arrowKeyShiftSelectItemIndex,
        _gridColumnCount
    ) => {
        const keyOptions = ["ArrowUp", "ArrowDown"];
        if (keyOptions.includes(e.key)) {
            // if no item is selected select the first one

            const def: SelectedItemsAfterKeypress = {
                scrollToRowIndex: 0,
                nextSelectedItemIndex: 0
            };

            if (Object.keys(selectedItems).length === 0) {
                return def;
            } else {
                if (lastSelectedItemIndex === undefined) {
                    return def;
                }

                let newIndex =
                    e.key === "ArrowUp"
                        ? lastSelectedItemIndex - 1
                        : lastSelectedItemIndex + 1;

                if (newIndex >= items.length) {
                    newIndex = 0;
                } else if (newIndex < 0) {
                    newIndex = total_count - 1;
                }

                return {
                    scrollToRowIndex: newIndex,
                    nextSelectedItemIndex: newIndex,
                    arrowKeyShiftSelectItemIndex: (() => {
                        if (e.shiftKey) {
                            if (arrowKeyShiftSelectItemIndex === undefined) {
                                return lastSelectedItemIndex;
                            }
                            return arrowKeyShiftSelectItemIndex;
                        } else {
                            return undefined;
                        }
                    })()
                };
            }
        }
    }
});

export default ColumnListRowRenderer;
