import { PureComponent } from "react";
import { Item, ItemParams, Menu, contextMenu } from "react-contexify";
import ResourceList, { BaseResource } from "./ResourceList";
import { FilezMenuItems } from "./DefaultMenuItems";

interface RowContextMenuProps<ResourceType> {
    readonly menuItems: FilezMenuItems<ResourceType>[];
    readonly resourceType: string;
    readonly getSelectedItems: InstanceType<typeof ResourceList>["getSelectedItems"];
    readonly updateRenderModalName?: InstanceType<typeof ResourceList>["updateRenderModalName"];
    readonly menuId: string;
    readonly currentItem: ResourceType;
}

interface RowContextMenuState {}

export default class RowContextMenu<ResourceType extends BaseResource> extends PureComponent<
    RowContextMenuProps<ResourceType>,
    RowContextMenuState
> {
    constructor(props: RowContextMenuProps<ResourceType>) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    open = (event: any) => {
        event.preventDefault();
        contextMenu.show({ id: this.props.menuId, event });
    };

    onMenuItemClick = (menuItemParams: ItemParams<any, any>) => {
        // select the current item
        // TODO this does not work if no item is selected yet
        const menuItem = menuItemParams.data;
        if (!menuItem) return;
        const selected = this.props.getSelectedItems();
        if (menuItem.onClick) {
            menuItem.onClick(selected);
        }

        this.props.updateRenderModalName?.(menuItem.name);
    };

    render = () => {
        return (
            <div className="RowContextMenu">
                <Menu id={this.props.menuId}>
                    {this.props.menuItems.flatMap(menuItem => {
                        if (
                            menuItem.resources &&
                            !menuItem.resources.includes(this.props.resourceType)
                        ) {
                            return [];
                        }
                        return [
                            <Item
                                key={menuItem.name}
                                className="clickable"
                                onClick={this.onMenuItemClick}
                                data={menuItem}
                            >
                                {menuItem.name}
                            </Item>
                        ];
                    })}
                </Menu>
            </div>
        );
    };
}
