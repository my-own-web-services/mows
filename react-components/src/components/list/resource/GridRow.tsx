import { PureComponent } from "react";
import { BaseResource, CommonRowProps } from "./ResourceList";
import { useContextMenu } from "react-contexify";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import FilezFileViewer, { FileViewerViewMode } from "../../viewer/FileViewer";
import RowContextMenu from "./RowContextMenu";

export interface GridRowProps<ResourceType> extends CommonRowProps<ResourceType> {
    readonly items: ResourceType[];
    readonly rowHeight: number;
    readonly isSelected?: boolean[];
    readonly rowIndex: number;
    readonly rowRenderer?: (arg0: GridRowProps<ResourceType>) => JSX.Element;
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
        const { items, style, isSelected, onItemClick, rowHeight } = this.props;
        return (
            <div className="GridRow" style={{ ...style }}>
                {this.props.rowRenderer
                    ? this.props.rowRenderer(this.props)
                    : items.map((item, i) => {
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
                                      width: rowHeight - 15 / this.props.items.length,
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
                                  {!this.props.disableContextMenu && (
                                      <RowContextMenu
                                          menuItems={this.props.menuItems}
                                          updateRenderModalName={this.props.updateRenderModalName}
                                          resourceType={this.props.resourceType}
                                          getSelectedItems={this.props.getSelectedItems}
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
