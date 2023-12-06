import { PureComponent } from "react";
import { BaseResource, ListRowProps } from "./ResourceList";
import { useContextMenu } from "react-contexify";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import FilezFileViewer, { FileViewerViewMode } from "../../viewer/FileViewer";
import RowContextMenu from "./RowContextMenu";

interface GridRowState {}

export default class GridRow<ResourceType extends BaseResource> extends PureComponent<
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
            menuItems
        } = data;
        const { onItemClick, updateRenderModalName, getSelectedItems } = handlers;
        const startIndex = index * gridColumnCount;
        const endIndex = startIndex + gridColumnCount;
        const currentItems = items.slice(startIndex, endIndex);

        return (
            <div className="GridRow" style={{ ...style }}>
                {currentItems.map((item, i) => {
                    const { show } = useContextMenu({
                        id: item._id
                    });
                    const isSelected = this.props.data.selectedItems[item._id];
                    return (
                        <div
                            onClick={e => onItemClick?.(e, item)}
                            onContextMenu={e => {
                                onItemClick?.(e, item, true);

                                show({ event: e });
                            }}
                            className={`Row ${isSelected ? " selected" : ""}`}
                            key={"GridRow" + index + item._id}
                            style={{
                                height: "100%",
                                width: rowHeight - 15 / currentItems.length,
                                outline: "1px solid var(--gutters)",
                                float: "left",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                padding: "5px"
                            }}
                        >
                            {(() => {
                                if (resourceType === "File") {
                                    return (
                                        <FilezFileViewer
                                            width={rowHeight}
                                            file={item as unknown as FilezFile}
                                            style={{ width: "100%", height: "100%" }}
                                            viewMode={FileViewerViewMode.Preview}
                                        />
                                    );
                                }
                            })()}
                            {!disableContextMenu && (
                                <RowContextMenu
                                    menuItems={menuItems}
                                    updateRenderModalName={updateRenderModalName}
                                    resourceType={resourceType}
                                    getSelectedItems={getSelectedItems}
                                    menuId={item._id}
                                    currentItem={item}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };
}
