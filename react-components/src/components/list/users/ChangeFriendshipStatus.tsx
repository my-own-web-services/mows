import { PureComponent } from "react";
import { FilezContext } from "../../../FilezProvider";
import { BiUserVoice, BiUserMinus, BiUserPlus, BiUserCheck, BiUserX } from "react-icons/bi";
import { Button, ButtonGroup, Message, useToaster } from "rsuite";
import { match } from "ts-pattern";
import { ReducedFilezUser } from "@firstdorsal/filez-client/dist/js/apiTypes/ReducedFilezUser";
import { withToasterHook } from "../../../utils";
import { UpdateFriendStatus } from "@firstdorsal/filez-client/dist/js/apiTypes/UpdateFriendStatus";
import { FriendshipStatus } from "@firstdorsal/filez-client/dist/js/apiTypes/FriendshipStatus";

interface ChangeFriendshipStatusProps {
    readonly user: ReducedFilezUser;
    readonly toaster: ReturnType<typeof useToaster>;
    readonly size?: "xs" | "sm" | "md" | "lg";
}

interface ChangeFriendshipStatusState {
    readonly status: FriendshipStatus;
}

class ChangeFriendshipStatus extends PureComponent<
    ChangeFriendshipStatusProps,
    ChangeFriendshipStatusState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: ChangeFriendshipStatusProps) {
        super(props);
        this.state = {
            status: props.user.friendship_status
        };
    }

    updateStatus = async (status: UpdateFriendStatus) => {
        if (!this.context) return;
        const user = this.props.user;

        const res = await this.context.filezClient.update_friendship_status(user._id, status);

        const text = await res.text();

        if (res.status === 200) {
            const newStatus: FriendshipStatus = match(status)
                .with("AcceptFriendRequest", () => "Friends" as FriendshipStatus)
                .with("RejectFriendRequest", () => "NotFriends" as FriendshipStatus)
                .with("RemoveFriend", () => "NotFriends" as FriendshipStatus)
                .with("SendFriendRequest", () => "AwaitingTheirConfirmation" as FriendshipStatus)
                .exhaustive();

            this.setState({ status: newStatus });
        }

        this.props.toaster.push(
            <Message showIcon type={res.status === 200 ? "success" : "error"} closable>
                {text}
            </Message>,
            {
                placement: "bottomCenter",
                duration: 5000
            }
        );
    };

    render = () => {
        const size = this.props.size ?? "sm";
        return (
            <span className="ChangeFriendshipStatus">
                {match(this.state.status)
                    .with("AwaitingTheirConfirmation", () => (
                        <Button
                            title="Awaiting their confirmation"
                            disabled
                            size={size}
                            appearance="default"
                        >
                            <BiUserVoice />
                        </Button>
                    ))
                    .with("AwaitingYourConfirmation", () => (
                        <ButtonGroup>
                            <Button
                                size={size}
                                title="Accept friend request"
                                appearance="primary"
                                color="green"
                                onClick={async () => {
                                    await this.updateStatus("AcceptFriendRequest");
                                }}
                            >
                                <BiUserCheck />
                            </Button>
                            <Button
                                size={size}
                                title="Reject friend request"
                                appearance="primary"
                                color="red"
                                onClick={async () => {
                                    await this.updateStatus("RejectFriendRequest");
                                }}
                            >
                                <BiUserX />
                            </Button>
                        </ButtonGroup>
                    ))
                    .with("Friends", () => (
                        <Button
                            size={size}
                            title="Remove friend"
                            appearance="primary"
                            color="red"
                            onClick={async () => {
                                await this.updateStatus("RemoveFriend");
                            }}
                        >
                            <BiUserMinus />
                        </Button>
                    ))
                    .with("NotFriends", () => (
                        <Button
                            size={size}
                            title="Send friend request"
                            color="green"
                            appearance="primary"
                            onClick={async () => {
                                await this.updateStatus("SendFriendRequest");
                            }}
                        >
                            <BiUserPlus />
                        </Button>
                    ))
                    .exhaustive()}
            </span>
        );
    };
}
export default withToasterHook(ChangeFriendshipStatus);
