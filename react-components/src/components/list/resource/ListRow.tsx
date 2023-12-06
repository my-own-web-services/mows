import { PureComponent, createRef } from "react";
import { BaseResource, CommonRowProps } from "./ResourceList";
import { dragHandleWidth } from "./SortingBar";
import RowContextMenu from "./RowContextMenu";

export interface ListRowProps<ResourceType> extends CommonRowProps<ResourceType> {
    readonly item: ResourceType;
    readonly isSelected?: boolean;
    readonly rowRenderer?: (arg0: ListRowProps<ResourceType>) => JSX.Element;
}

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

    componentDidMount = async () => {};

    onItemClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) =>
        this.props.onItemClick?.(e, this.props.item);

    onContextMenu = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        this.props.onItemClick?.(e, this.props.item, true);
        this.contextMenuRef.current?.open(e);
    };

    render = () => {
        const { item, style, isSelected, columns } = this.props;

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
                                          `Field '${column.field}' does not exist on this ${this.props.resourceType}`}
                                </span>
                            );
                        });
                    })()
                ) : this.props.rowRenderer ? (
                    this.props.rowRenderer(this.props)
                ) : (
                    <span>{item._id}</span>
                )}
                {!this.props.disableContextMenu && (
                    <RowContextMenu
                        ref={this.contextMenuRef}
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
    };
}
