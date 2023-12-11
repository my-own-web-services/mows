import { CSSProperties, PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import ResourceList, { RowHandlers } from "../resource/ResourceList";
import CreateFileGroup from "./CreateFileGroup";
import EditFileGroup from "./EditFileGroup";
import FileGroupRowRenderer from "./FileGroupRowRenderer";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";

interface FileGroupListProps {
    readonly displayTopBar?: boolean;
    readonly style?: CSSProperties;
    readonly rowHandlers?: RowHandlers<FilezFileGroup>;
}

interface FileGroupListState {}

export default class FileGroupList extends PureComponent<FileGroupListProps, FileGroupListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: FileGroupListProps) {
        super(props);
        this.state = {};
    }

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
                    rowRenderers={[FileGroupRowRenderer]}
                    displayTopBar={this.props.displayTopBar}
                    rowHandlers={this.props.rowHandlers}
                />
            </div>
        );
    };
}
