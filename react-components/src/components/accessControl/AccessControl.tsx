import { PureComponent } from "react";

interface AccessControlProps {
    readonly type: "file" | "group";
}

interface AccessControlState {}

export default class AccessControl extends PureComponent<AccessControlProps, AccessControlState> {
    constructor(props: AccessControlProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return (
            <div className="AccessControl">
                <h5>Access Control</h5>
            </div>
        );
    };
}
