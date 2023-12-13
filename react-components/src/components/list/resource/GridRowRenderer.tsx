import { PureComponent } from "react";
import {
    BaseResource,
    ListRowProps,
    RowRenderer,
    RowRendererDirection,
    SelectedItemsAfterKeypress
} from "./ResourceList";
import { useContextMenu } from "react-contexify";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import FilezFileViewer, { FileViewerViewMode } from "../../viewer/FileViewer";
import RowContextMenu from "./RowContextMenu";
import { BsFillGridFill } from "react-icons/bs";
import { DraggableItem } from "../../dnd/DraggableItem";

interface GridRowState {}

class GridRowComp<ResourceType extends BaseResource> extends PureComponent<
    ListRowProps<ResourceType>,
    GridRowState
> {
    constructor(props: ListRowProps<ResourceType>) {
        super(props);
        this.state = {};
    }

    render = () => {
        const style = this.props.style;
        if (!this.props.data) return;
        const { data, index } = this.props;
        const {
            items,
            rowHeight,
            resourceType,
            gridColumnCount,
            disableContextMenu,
            handlers,
            menuItems,
            total_count
        } = data;
        const { onItemClick } = handlers;
        const startIndex = index * gridColumnCount;
        const endIndex = startIndex + gridColumnCount;
        const currentItems = items.slice(startIndex, endIndex);

        return (
            <div className="GridRow" style={{ ...style }}>
                {currentItems.map((item, i) => {
                    const actualListIndex = index * gridColumnCount + i;

                    if (actualListIndex >= total_count) return;
                    if (!item) return;
                    const { show } = useContextMenu({
                        id: item._id
                    });
                    const isSelected =
                        this.props.data.selectedItems[actualListIndex];

                    const isLastSelected =
                        actualListIndex ===
                        this.props.data.lastSelectedItemIndex;

                    const key = "GridRowItem" + actualListIndex;
                    return (
                        <div
                            onClick={(e) =>
                                onItemClick?.(e, item, actualListIndex)
                            }
                            onContextMenu={(e) => {
                                onItemClick?.(e, item, actualListIndex, true);

                                show({ event: e });
                            }}
                            className={`Row ${isSelected ? " selected" : ""}${
                                isLastSelected ? " lastSelected" : ""
                            } fadeIn`}
                            key={key}
                            style={{
                                height: "100%",
                                width: rowHeight - 15 / currentItems.length,
                                outline: "1px solid var(--gutters)",
                                float: "left",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                padding: "1px"
                            }}
                        >
                            <DraggableItem
                                resource={item}
                                dropHandler={this.props.data.handlers.onDrop}
                                getSelectedItems={
                                    this.props.data.functions.getSelectedItems
                                }
                                type={resourceType}
                            >
                                {(() => {
                                    if (resourceType === "File") {
                                        return (
                                            <FilezFileViewer
                                                width={rowHeight}
                                                file={
                                                    item as unknown as FilezFile
                                                }
                                                style={{
                                                    width: "100%",
                                                    height: "100%"
                                                }}
                                                viewMode={
                                                    FileViewerViewMode.Preview
                                                }
                                                disablePreviewFalback={true}
                                            />
                                        );
                                    }
                                })()}
                            </DraggableItem>
                            {!disableContextMenu && (
                                <RowContextMenu
                                    menuItems={menuItems}
                                    menuId={item._id}
                                    currentItem={item}
                                    onContextMenuItemClick={
                                        handlers.onContextMenuItemClick
                                    }
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };
}

const GridRowRenderer: RowRenderer<BaseResource> = {
    name: "GridRowRenderer",
    icon: (
        <BsFillGridFill
            style={{ transform: "scale(0.9)", pointerEvents: "none" }}
            size={17}
        />
    ),
    component: GridRowComp,
    getRowCount: (itemCount, gridColumnCount) => {
        return Math.ceil(itemCount / gridColumnCount);
    },
    getRowHeight: (width, _height, gridColumnCount) => {
        return width / gridColumnCount;
    },
    direction: RowRendererDirection.Vertical,
    getItemKey: (_items, index, gridColumnCount) => {
        return index * gridColumnCount;
    },
    isItemLoaded: (items, rowIndex, gridColumnCount) => {
        const startIndex = rowIndex * gridColumnCount;
        const endIndex = startIndex + gridColumnCount;

        return (
            items.filter(
                (item, i) =>
                    i >= startIndex && i < endIndex && item !== undefined
            ).length === gridColumnCount
        );
    },
    getStartIndexAndLimit(startIndex, limit, gridColumnCount) {
        return {
            startIndex: startIndex * gridColumnCount,
            limit: limit * gridColumnCount
        };
    },
    getSelectedItemsAfterKeypress: (
        e,
        items,
        total_count,
        selectedItems,
        lastSelectedItemIndex,
        arrowKeyShiftSelectItemIndex,
        gridColumnCount
    ) => {
        const keyOptions = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
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

                const lastIndex = total_count - 1;

                const newIndex = (() => {
                    if (e.key === "ArrowUp") {
                        const mb = lastSelectedItemIndex - gridColumnCount;

                        return mb > 0
                            ? mb
                            : lastIndex -
                                  (lastIndex % gridColumnCount) +
                                  (lastSelectedItemIndex % gridColumnCount);
                    } else if (e.key === "ArrowDown") {
                        const mb = lastSelectedItemIndex + gridColumnCount;
                        return mb < lastIndex
                            ? mb
                            : 0 + (lastSelectedItemIndex % gridColumnCount);
                    } else if (e.key === "ArrowLeft") {
                        const mb = lastSelectedItemIndex - 1;
                        return mb >= 0 ? mb : lastIndex;
                    } else if (e.key === "ArrowRight") {
                        const mb = lastSelectedItemIndex + 1;
                        return mb <= lastIndex ? mb : 0;
                    } else {
                        return lastSelectedItemIndex;
                    }
                })();

                return {
                    nextSelectedItemIndex: newIndex,
                    scrollToRowIndex: Math.floor(newIndex / gridColumnCount),
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
};

export default GridRowRenderer;
