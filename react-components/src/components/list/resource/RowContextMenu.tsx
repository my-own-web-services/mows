import { PureComponent } from "react";
import { Item, Menu } from "react-contexify";
import ResourceList, { BaseResource, FilezMenuItems } from "./ResourceList";

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
                                onClick={() => {
                                    // select the current item
                                    // TODO this does not work if no item is selected yet
                                    let selected = this.props.getSelectedItems();
                                    if (menuItem.onClick) {
                                        menuItem.onClick(
                                            selected.length > 1
                                                ? [this.props.currentItem]
                                                : selected
                                        );
                                    }

                                    this.props.updateRenderModalName?.(menuItem.name);
                                }}
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
