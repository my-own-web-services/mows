import { CSSProperties, ComponentType, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { AiOutlineFolder, AiOutlineFolderView } from "react-icons/ai";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import ResourceList, { ListRowProps } from "../resource/ResourceList";
import CreateFileGroup from "./CreateFileGroup";
import EditFileGroup from "./EditFileGroup";

interface FileGroupListProps {
    readonly displayTopBar?: boolean;
    readonly style?: CSSProperties;
    /**
     A component that renders the resource in the list.
     */
    readonly rowRenderer?: ComponentType<ListRowProps<FilezFileGroup>>;
}

interface FileGroupListState {}

export default class FileGroupList extends PureComponent<FileGroupListProps, FileGroupListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: FileGroupListProps) {
        super(props);
        this.state = {};
    }

    handleRightClick = (_e: any, data: any) => {
        console.log(data);
    };

    rowRenderer = (props: ListRowProps<FilezFileGroup>) => {
        const {
            data: { items },
            index
        } = props;
        const item = items[index];
        return (
            <div className="Group">
                <div className="GroupItems">
                    <span>
                        {item.group_type === "Static" ? (
                            <AiOutlineFolder size={20} />
                        ) : (
                            <AiOutlineFolderView size={20} />
                        )}
                    </span>
                    <span className="itemName">{item.name}</span>
                    <span className="itemCount">{item.item_count}</span>
                </div>
            </div>
        );
    };

    render = () => {
        if (!this.context) return null;

        return (
            <div className="Filez FileGroupList" style={{ ...this.props.style }}>
                <ResourceList
                    createResource={<CreateFileGroup />}
                    editResource={<EditFileGroup />}
                    resourceType="FileGroup"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_own_file_groups}
                    rowRenderer={this.props.rowRenderer ? this.props.rowRenderer : this.rowRenderer}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
