import { PureComponent, createRef } from "react";
import {
    BaseResource,
    ListRowProps,
    RowRenderer,
    RowRendererDirection
} from "../resource/ResourceList";
import { FaThList } from "react-icons/fa";
import RowContextMenu from "../resource/RowContextMenu";
import { AiOutlineFolder, AiOutlineFolderView } from "react-icons/ai";
import { DraggableTarget } from "../../dnd/DraggableTarget";

interface FileGroupRowRendererState {}

class FileGroupRowRendererComp<ResourceType extends BaseResource> extends PureComponent<
    ListRowProps<ResourceType>,
    FileGroupRowRendererState
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

    canDrop = () => {
        const item = this.getCurentItem();
        if (item.readonly || item.group_type === "Dynamic") return false;
        return true;
    };

    render = () => {
        if (!this.props.data) return;
        const item = this.getCurentItem();
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
                className={`Row${isSelected ? " selected" : ""}`}
            >
                <DraggableTarget acceptType="File" id={item._id} canDrop={this.canDrop}>
                    <div className="Group">
                        <div className="GroupItems">
                            <span>
                                {item?.group_type === "Static" ? (
                                    <AiOutlineFolder size={20} />
                                ) : (
                                    <AiOutlineFolderView size={20} />
                                )}
                            </span>
                            <span className="itemName">{item?.name}</span>
                            <span className="itemCount">{item?.item_count}</span>
                        </div>
                    </div>
                </DraggableTarget>
                {!this.props.data.disableContextMenu && (
                    <RowContextMenu
                        ref={this.contextMenuRef}
                        menuItems={this.props.data.menuItems}
                        updateRenderModalName={this.props.data.handlers.updateRenderModalName}
                        resourceType={this.props.data.resourceType}
                        getSelectedItems={this.props.data.functions.getSelectedItems}
                        menuId={item._id}
                        currentItem={item}
                    />
                )}
            </div>
        );
    };
}

const FileGroupRowRenderer: RowRenderer<BaseResource> = {
    name: "FileGroupRowRenderer",
    icon: <FaThList style={{ transform: "scale(0.9)", pointerEvents: "none" }} size={17} />,
    component: FileGroupRowRendererComp,
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
    }
};

export default FileGroupRowRenderer;
