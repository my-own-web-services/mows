import React, { CSSProperties, PureComponent, memo } from "react";
import ResourceList, { BaseResource, Column } from "./ResourceList";
import { useContextMenu } from "react-contexify";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import FilezFileViewer, { FileViewerViewMode } from "../../viewer/FileViewer";

interface GridRowProps<ResourceType> {
    readonly items: ResourceType[];
    readonly style: CSSProperties;
    readonly rowHeight: number;
    readonly isSelected?: boolean[];
    readonly onItemClick?: InstanceType<typeof ResourceList>["onItemClick"];
    readonly resourceType?: string;
    readonly columns?: Column<ResourceType>[];
    readonly rowIndex: number;
}

interface GridRowState {}

export default class GridRow<ResourceType extends BaseResource> extends PureComponent<
    GridRowProps<ResourceType>,
    GridRowState
> {
    constructor(props: GridRowProps<ResourceType>) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        const { items, style, rowHeight, isSelected, onItemClick } = this.props;
        return (
            <div className="GridRow" style={{ ...style }}>
                {items.map((item, i) => {
                    const { show } = useContextMenu({
                        id: item._id
                    });
                    return (
                        <div
                            onClick={e => onItemClick?.(e, item)}
                            onContextMenu={e => {
                                onItemClick?.(e, item, true);
                                show({ event: e });
                            }}
                            className={`Row ${isSelected?.[i] ? " selected" : ""}`}
                            key={"GridRow" + this.props.rowIndex + item._id}
                            style={{
                                height: "100%",
                                width: rowHeight - 2,
                                outline: "1px solid var(--gutters)",
                                float: "left",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                padding: "5px"
                            }}
                        >
                            {(() => {
                                if (this.props.resourceType === "File") {
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
                        </div>
                    );
                })}
            </div>
        );
    };
}
