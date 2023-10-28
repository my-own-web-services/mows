import { PureComponent } from "react";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";
import { FilezContext } from "../../FilezProvider";
import Permission from "../list/permissions/Permission";

interface FileAccessControlProps {
    readonly file: FilezFile;
    readonly inputSize: "lg" | "md" | "sm" | "xs";
}

interface FileAccessControlState {
    readonly serverPermissions: FilezPermission[];
    readonly clientPermissions: FilezPermission[];
}

export default class FileAccessControl extends PureComponent<
    FileAccessControlProps,
    FileAccessControlState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: FileAccessControlProps) {
        super(props);
        this.state = {
            serverPermissions: [],
            clientPermissions: []
        };
    }

    componentDidMount = async () => {
        if (!this.context) return;
        const { items } = await this.context.filezClient.get_own_permissions({
            filter: "",
            from_index: 0,
            limit: null,
            sort_field: null,
            sort_order: null
        });
        this.setState({
            serverPermissions: items,
            clientPermissions: items
        });
    };

    render = () => {
        return (
            <div className="FileAccessControl">
                <Permission inputSize={this.props.inputSize} itemId={this.props.file._id} />
            </div>
        );
    };
}

/*
<InputPicker
                    data={this.state.serverPermissions.map(p => {
                        return {
                            label: p.name ?? p._id,
                            value: p.name ?? p._id
                        };
                    })}
                    size={this.props.inputSize}
                />
                <Button size={this.props.inputSize}>Add</Button>


*/
