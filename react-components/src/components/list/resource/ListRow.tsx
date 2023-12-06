import { PureComponent, createRef } from "react";
import { BaseResource, ListData, ListRowProps } from "./ResourceList";
import { dragHandleWidth } from "./SortingBar";
import RowContextMenu from "./RowContextMenu";

interface ListRowState {}

export default class ListRow<ResourceType extends BaseResource> extends PureComponent<
    ListRowProps<ResourceType>,
    ListRowState
> {
    contextMenuRef: React.RefObject<RowContextMenu<ResourceType>>;

    constructor(props: ListRowProps<ResourceType>) {
        super(props);
        this.state = {};
        this.contextMenuRef = createRef();
    }

    getCurentItem = () => {
        return this.props.data?.items?.[this.props.index];
    };

    onItemClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        this.props.data.handlers.onItemClick?.(e, this.getCurentItem());
    };

    onContextMenu = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        this.props.data.handlers.onItemClick?.(e, this.getCurentItem(), true);
        this.contextMenuRef.current?.open(e);
    };

    render = () => {
        if (!this.props.data) return;
        const item = this.getCurentItem();
        const columns = this.props.data.columns;
        const isSelected = this.props.data.selectedItems[item._id];
        const style = this.props.style;

        return (
            <div
                onClick={this.onItemClick}
                style={{
                    ...style,
                    whiteSpace: "nowrap",
                    overflow: "hidden"
                }}
                onContextMenu={this.onContextMenu}
                className={`ListRow Row${isSelected ? " selected" : ""}`}
            >
                {columns ? (
                    (() => {
                        const activeColumns = columns.filter(c => c.visible);

                        return activeColumns.map((column, index) => {
                            /*@ts-ignore*/
                            const field = item[column.field]
                                ? /*@ts-ignore*/
                                  item[column.field]
                                : /*@ts-ignore*/
                                  item[column.alternateField];

                            const width = (() => {
                                if (index === activeColumns.length - 1) {
                                    // 17px is the width of the scrollbar
                                    return `calc(${column.widthPercent}% - 17px)`;
                                }
                                const dhwFixed = dragHandleWidth - 5;
                                if (index === 0) {
                                    return `calc(${column.widthPercent}% + ${dhwFixed}px)`;
                                }
                                // for some reason this works
                                return `calc(${column.widthPercent}% + ${dhwFixed / 2}px)`;
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
                                          `Field '${column.field}' does not exist on this ${this.props.data.resourceType}`}
                                </span>
                            );
                        });
                    })()
                ) : (
                    <span>{item._id}</span>
                )}
                {!this.props.data.disableContextMenu && (
                    <RowContextMenu
                        ref={this.contextMenuRef}
                        menuItems={this.props.data.menuItems}
                        updateRenderModalName={this.props.data.handlers.updateRenderModalName}
                        resourceType={this.props.data.resourceType}
                        getSelectedItems={this.props.data.handlers.getSelectedItems}
                        menuId={item._id}
                        currentItem={item}
                    />
                )}
            </div>
        );
    };
}
