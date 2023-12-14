import { PureComponent, createRef } from "react";
import Permission from "./Permission";
import { FilezContext } from "../../../FilezProvider";
import { FilezPermission } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezPermission";

interface EditPermissionProps {
    readonly resourceIds?: string[];
}

interface EditPermissionState {
    readonly permissions: FilezPermission[];
}

export default class EditPermission extends PureComponent<
    EditPermissionProps,
    EditPermissionState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    ref: React.RefObject<Permission>;

    constructor(props: EditPermissionProps) {
        super(props);
        this.state = {
            permissions: []
        };
        this.ref = createRef();
    }

    componentDidMount = async () => {
        if (!this.context) return;

        const { items } = await this.context.filezClient.get_own_permissions({
            sort_field: "name"
        });

        const permissions = items.filter((item) => {
            return this.props.resourceIds?.includes(item._id) ?? false;
        });

        this.setState({ permissions });
    };

    update = async (): Promise<boolean> => {
        const res = await this.ref.current?.saveData();
        return typeof res === "string";
    };

    render = () => {
        if (this.state.permissions?.[0] === undefined) return null;
        return (
            <div className="EditPermission">
                <Permission
                    permission={this.state.permissions[0]}
                    ref={this.ref}
                    useOnce={this.state.permissions[0].use_type === "Once"}
                    disableSaveButton={true}
                />
            </div>
        );
    };
}
