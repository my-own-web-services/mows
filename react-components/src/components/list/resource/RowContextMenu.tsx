import { PureComponent } from "react";
import { Item, ItemParams, Menu, contextMenu } from "react-contexify";
import { BaseResource } from "./ResourceList";
import { MenuItems } from "./DefaultMenuItems";

export type onContextMenuItemClick<ResourceType> = (
    item: ResourceType,
    menuItemId?: string
) => void;

interface RowContextMenuProps<ResourceType> {
    readonly menuItems: MenuItems;
    readonly menuId: string;
    readonly currentItem: ResourceType;
    readonly onContextMenuItemClick?: onContextMenuItemClick<ResourceType>;
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
        this.props.onContextMenuItemClick?.(this.props.currentItem, menuItemParams?.id);
    };

    render = () => {
        return (
            <div className="RowContextMenu">
                <Menu id={this.props.menuId}>
                    {Object.entries(this.props.menuItems).flatMap(([itemId, menuItem]) => {
                        return [
                            <Item
                                key={itemId}
                                className="clickable"
                                onClick={this.onMenuItemClick}
                                id={itemId}
                            >
                                {menuItem.label}
                            </Item>
                        ];
                    })}
                </Menu>
            </div>
        );
    };
}
