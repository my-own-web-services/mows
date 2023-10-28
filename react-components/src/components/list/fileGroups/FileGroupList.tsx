import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { AiOutlineFolder, AiOutlineFolderView } from "react-icons/ai";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import ResourceList from "../resource/ResourceList";
import CreateFileGroup from "./CreateFileGroup";

interface FileGroupListProps {
    readonly displayTopBar?: boolean;
    readonly style?: CSSProperties;
    readonly rowRenderer?: (item: FilezFileGroup, style: CSSProperties) => JSX.Element;
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

    rowRenderer = (item: FilezFileGroup) => {
        return (
            <div className="Group">
                <div className="GroupItems clickable">
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
                    resourceType="File Group"
                    defaultSortField="name"
                    get_items_function={this.context.filezClient.get_own_file_groups}
                    rowRenderer={this.rowRenderer}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
