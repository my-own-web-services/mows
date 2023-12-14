import { PureComponent, createRef } from "react";
import { FilezContext } from "../../../FilezProvider";
import FileGroup from "./FileGroup";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import Permission from "../permissions/Permission";

interface EditFileGroupProps {
    readonly resourceIds?: string[];
}

interface EditFileGroupState {
    readonly fileGroups: FilezFileGroup[];
}

export default class EditFileGroup extends PureComponent<
    EditFileGroupProps,
    EditFileGroupState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    fileGroupRef: React.RefObject<FileGroup>;
    oncePermissionRef: React.RefObject<Permission>;

    constructor(props: EditFileGroupProps) {
        super(props);
        this.state = {
            fileGroups: []
        };
        this.fileGroupRef = createRef();
        this.oncePermissionRef = createRef();
    }

    componentDidMount = async () => {
        if (!this.context) return;

        const { items } = await this.context.filezClient.get_own_file_groups({
            sort_field: "name"
        });

        const fileGroups = items.filter((item) => {
            return this.props.resourceIds?.includes(item._id) ?? false;
        });

        this.setState({ fileGroups });
    };

    update = async (): Promise<boolean> => {
        const useOncePermissionId =
            await this.oncePermissionRef?.current?.saveData();

        const res = await this.fileGroupRef.current?.update(
            useOncePermissionId
        );
        return typeof res === "string";
    };

    render = () => {
        if (this.state.fileGroups?.[0] === undefined) return null;
        return (
            <div className="EditFileGroup">
                <FileGroup
                    oncePermissionRef={this.oncePermissionRef}
                    group={this.state.fileGroups[0]}
                    ref={this.fileGroupRef}
                />
            </div>
        );
    };
}
