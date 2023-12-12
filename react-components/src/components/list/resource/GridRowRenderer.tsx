import { PureComponent } from "react";
import {
  BaseResource,
  ListRowProps,
  RowRenderer,
  RowRendererDirection
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
          const isSelected = this.props.data.selectedItems[item._id];
          const key = "GridRowRenderer" + index + i;
          return (
            <div
              onClick={(e) => onItemClick?.(e, item)}
              onContextMenu={(e) => {
                onItemClick?.(e, item, true);

                show({ event: e });
              }}
              className={`Row ${isSelected ? " selected" : ""} fadeIn`}
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
                getSelectedItems={this.props.data.functions.getSelectedItems}
                type={resourceType}
              >
                {(() => {
                  if (resourceType === "File") {
                    return (
                      <FilezFileViewer
                        width={rowHeight}
                        file={item as unknown as FilezFile}
                        style={{
                          width: "100%",
                          height: "100%"
                        }}
                        viewMode={FileViewerViewMode.Preview}
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
                  onContextMenuItemClick={handlers.onContextMenuItemClick}
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
        (item, i) => i >= startIndex && i < endIndex && item !== undefined
      ).length === gridColumnCount
    );
  },
  getStartIndexAndLimit(startIndex, limit, gridColumnCount) {
    return {
      startIndex: startIndex * gridColumnCount,
      limit: limit * gridColumnCount
    };
  }
};

export default GridRowRenderer;
