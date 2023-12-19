import { FilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUser";
import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";

interface UserProps {
    readonly userId?: string;
    readonly user?: FilezUser;
    readonly onChange?: (user: FilezUser) => void;
}

interface UserState {
    readonly user: FilezUser | null;
}

export default class User extends PureComponent<UserProps, UserState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: UserProps) {
        super(props);
        this.state = {
            user: props.user ?? null
        };
    }

    componentDidMount = async () => {
        this.init();
    };

    init = async () => {
        if (this.props.user && typeof this.props.userId === "string") {
            throw new Error("Cannot specify both user and userId");
        } else if (typeof this.props.userId === "string") {
            if (!this.context) return;
            const user = await this.context.filezClient.get_users([
                this.props.userId
            ]);

            if (user.users.length === 0) {
                throw new Error("User not found");
            }

            this.setState({ user: user.users[0] });
        }
    };

    importFromVcard = async (vcard: string) => {};

    render = () => {
        return <div className="User" />;
    };
}
