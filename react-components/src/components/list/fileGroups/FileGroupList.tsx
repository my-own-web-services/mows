import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { AiOutlineFolder, AiOutlineFolderView } from "react-icons/ai";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import ResourceList from "../resource/ResourceList";
import CreateFileGroup from "./CreateFileGroup";
import EditFileGroup from "./EditFileGroup";
import { ListRowProps } from "../resource/ListRow";
import { GridRowProps } from "../resource/GridRow";

interface FileGroupListProps {
    readonly displayTopBar?: boolean;
    readonly style?: CSSProperties;
    /**
     A function that renders the resource in the list.
     */
    readonly listRowRenderer?: (arg0: ListRowProps<FilezFileGroup>) => JSX.Element;
    /**
      A function that renders the resource in the list.
      */
    readonly gridRowRenderer?: (arg0: GridRowProps<FilezFileGroup>) => JSX.Element;
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

    listRowRenderer = (arg0: ListRowProps<FilezFileGroup>) => {
        const { item } = arg0;
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
                    listRowRenderer={
                        this.props.listRowRenderer
                            ? this.props.listRowRenderer
                            : this.listRowRenderer
                    }
                    gridRowRenderer={this.props.gridRowRenderer}
                    displayTopBar={this.props.displayTopBar}
                />
            </div>
        );
    };
}
