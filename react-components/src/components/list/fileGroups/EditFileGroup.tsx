import { PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import FileGroup from "./FileGroup";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";

interface EditFileGroupProps {
    readonly resourceIds?: string[];
}

interface EditFileGroupState {
    readonly fileGroups: FilezFileGroup[];
}

export default class EditFileGroup extends PureComponent<EditFileGroupProps, EditFileGroupState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    ref: React.RefObject<FileGroup>;

    constructor(props: EditFileGroupProps) {
        super(props);
        this.state = {
            fileGroups: []
        };
        this.ref = createRef();
    }

    componentDidMount = async () => {
        if (!this.context) return;

        const { items } = await this.context.filezClient.get_own_file_groups({
            filter: "",
            from_index: 0,
            limit: null,
            sort_field: "name",
            sort_order: "Ascending"
        });

        const fileGroups = items.filter(item => {
            return this.props.resourceIds?.includes(item._id) ?? false;
        });

        this.setState({ fileGroups });
    };

    update = async (): Promise<boolean> => {
        const res = await this.ref.current?.update();
        return res ? true : false;
    };

    render = () => {
        if (!this.state.fileGroups[0]) return null;
        return (
            <div className="EditFileGroup">
                <FileGroup group={this.state.fileGroups[0]} ref={this.ref} />
            </div>
        );
    };
}
