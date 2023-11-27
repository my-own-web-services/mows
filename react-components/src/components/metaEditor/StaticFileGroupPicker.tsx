import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { TagPicker } from "rsuite";

interface StaticFileGroupPickerProps {
    readonly fileIds: string[];
    readonly creatable?: boolean;
    readonly size?: "lg" | "md" | "sm" | "xs";
}

interface StaticFileGroupPickerState {
    readonly files: FilezFile[] | null;
    readonly staticGroups: FilezFileGroup[] | null;
}

export default class StaticFileGroupPicker extends PureComponent<
    StaticFileGroupPickerProps,
    StaticFileGroupPickerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: StaticFileGroupPickerProps) {
        super(props);
        this.state = {
            files: null,
            staticGroups: null
        };
    }

    componentDidMount = async () => {
        await this.getFiles();
        await this.getStaticFileGroups();
    };

    getFiles = async () => {
        if (!this.context) return;
        if (!this.props.fileIds) return;
        const files = await this.context.filezClient.get_file_infos(this.props.fileIds);
        this.setState({ files });
    };

    getStaticFileGroups = async () => {
        if (!this.context) return;
        const res = await this.context.filezClient.get_own_file_groups(
            {
                filter: "",
                from_index: 0,
                limit: null,
                sort_field: null,
                sort_order: null
            },
            "Static"
        );
        const staticGroups = res.items.filter(group => group.readonly === false);

        this.setState({ staticGroups });
    };

    render = () => {
        if (!this.state.staticGroups) return;

        return (
            <div className="StaticFileGroupPicker">
                <TagPicker
                    size={this.props.size}
                    data={this.state.staticGroups.map(sg => {
                        return {
                            label: sg.name,
                            value: sg._id
                        };
                    })}
                />
            </div>
        );
    };
}
