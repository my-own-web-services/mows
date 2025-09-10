import { PureComponent } from "react";
import { AiOutlineSearch } from "react-icons/ai";
import { ButtonGroup, IconButton, Input, InputGroup, Slider } from "rsuite";
import { BaseResource, RowRenderer } from "./ResourceListTypes";

import { BiPlus } from "react-icons/bi";
import { IoReload } from "react-icons/io5";
import ResourceList, { getSelectedCount } from "./ResourceList";

interface ListTopBarProps<ResourceType> {
    readonly updateListType: InstanceType<
        typeof ResourceList
    >["updateListViewMode"];
    readonly commitSearch: InstanceType<typeof ResourceList>["commitSearch"];
    readonly updateGridColumnCount: InstanceType<
        typeof ResourceList
    >["updateGridColumnCount"];
    readonly gridColumnCount: number;
    readonly currentListType: string;
    readonly resourceType: string;
    readonly refreshList: () => void;
    readonly rowRenderers: RowRenderer<ResourceType>[];
    readonly selectedItems: (boolean | undefined)[];
    readonly items: (ResourceType | undefined)[];
    readonly total_count: number;
    readonly resourceCreatable?: boolean;
    readonly onAddResourceClick: InstanceType<
        typeof ResourceList
    >["onAddResourceClick"];
}

interface ListTopBarState {
    readonly search: string;
    readonly createModalOpen: boolean;
}

export default class ListTopBar<
    ResourceType extends BaseResource
> extends PureComponent<ListTopBarProps<ResourceType>, ListTopBarState> {
    constructor(props: ListTopBarProps<ResourceType>) {
        super(props);
        this.state = {
            search: "",
            createModalOpen: false
        };
    }

    commitSearch = () => {
        this.props.commitSearch(this.state.search);
    };

    changeSearch = (value: string) => {
        this.setState({ search: value });
    };

    searchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            this.commitSearch();
        }
    };

    updateListType = (
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const target = event.target as HTMLButtonElement;
        const listType = target.dataset.listtype;

        if (listType === undefined) return;
        this.props.updateListType(listType);
    };

    render = () => {
        return (
            <div
                style={{ width: "100%", height: "40px" }}
                className="ListTopBar"
            >
                <InputGroup
                    size="sm"
                    inside
                    style={{ width: "200px", float: "left" }}
                >
                    <Input
                        value={this.state.search}
                        onChange={this.changeSearch}
                        onKeyDown={this.searchKeyDown}
                        placeholder={`Search ${this.props.resourceType}s...`}
                    />
                    <InputGroup.Button onClick={this.commitSearch}>
                        <AiOutlineSearch size={21} />
                    </InputGroup.Button>
                </InputGroup>
                {this.props.resourceCreatable !== false && (
                    <span className="Buttons">
                        <IconButton
                            onClick={this.props.onAddResourceClick}
                            title={`Create new ${this.props.resourceType}`}
                            size="xs"
                            icon={<BiPlus size={18} />}
                        />
                    </span>
                )}
                <span className="Buttons">
                    <IconButton
                        onClick={this.props.refreshList}
                        title={`Reload`}
                        size="xs"
                        icon={<IoReload size={18} />}
                    />
                </span>

                <span className="Buttons">
                    <ButtonGroup size="xs">
                        {this.props.rowRenderers.length > 1 &&
                            this.props.rowRenderers.map((rowRenderer) => {
                                return (
                                    <IconButton
                                        key={rowRenderer.name}
                                        appearance={
                                            this.props.currentListType ===
                                            rowRenderer.name
                                                ? "primary"
                                                : "default"
                                        }
                                        onClick={this.updateListType}
                                        title={rowRenderer.name}
                                        data-listtype={rowRenderer.name}
                                        icon={rowRenderer.icon}
                                    />
                                );
                            })}
                    </ButtonGroup>
                </span>

                {this.props.currentListType === "GridRowRenderer" && (
                    <>
                        <Slider
                            style={{
                                width: "200px",
                                float: "left",
                                marginTop: "12px",
                                marginLeft: "10px"
                            }}
                            tooltip={false}
                            defaultValue={10}
                            value={this.props.gridColumnCount}
                            min={1}
                            max={30}
                            step={1}
                            onChange={this.props.updateGridColumnCount}
                        />
                        <div
                            style={{
                                marginLeft: "10px",
                                float: "left",
                                paddingTop: "4px"
                            }}
                        >
                            {this.props.gridColumnCount}
                        </div>
                    </>
                )}
                <div
                    style={{
                        marginTop: "5px",
                        marginRight: "20px",
                        float: "right"
                    }}
                >
                    <span style={{ marginRight: "10px" }}>
                        Total: {this.props.total_count}
                    </span>
                    <span style={{ marginRight: "10px" }}>
                        Loaded:{" "}
                        {this.props.items.filter((item) => item?._id).length}
                    </span>
                    <span>
                        Selected:
                        {getSelectedCount(
                            this.props.selectedItems,
                            this.props.total_count
                        )}
                    </span>
                </div>
            </div>
        );
    };
}
