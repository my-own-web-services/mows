import { FilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezUser";
import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { VcardUser, displayVcardUser, parseVcards } from "../utils/vcard";

interface UserProps {
    readonly userId?: string;
    readonly user?: ReducedFilezUser;
    readonly requestingUser?: FilezUser;
    readonly onChange?: (user: FilezUser) => void;
}

interface UserState {
    readonly user: ReducedFilezUser | null;
    readonly vcardUsers?: VcardUser[];
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
            const gurb = await this.context.filezClient.get_users([
                this.props.userId
            ]);

            if (gurb.reduced_users?.length === 0) {
                throw new Error("User not found");
            }

            this.setState({ user: gurb.reduced_users?.[0] ?? null });
        }
    };

    importFromVcard = async () => {};

    importVcardChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // get content of file
        if (file.type !== "text/vcard") return;

        const reader = new FileReader();
        reader.readAsText(file, "UTF-8");
        reader.onload = async (evt) => {
            if (!evt.target) return;
            const vcard = evt.target.result as string;
            this.setState({ vcardUsers: parseVcards(vcard) });
        };
    };

    render = () => {
        return (
            <div className="User">
                <label htmlFor=""> Import from Vcard/.vcs</label>
                <br />
                <input type="file" onChange={this.importVcardChange} />
                <div>
                    {this.state.vcardUsers?.map((vcardUser, index) => {
                        return (
                            <div key={index}>{displayVcardUser(vcardUser)}</div>
                        );
                    })}
                </div>
            </div>
        );
    };
}
