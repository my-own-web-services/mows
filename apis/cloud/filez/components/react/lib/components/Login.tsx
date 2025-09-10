import { CSSProperties, PureComponent } from "react";

interface LoginProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface LoginState {}

export default class Login extends PureComponent<LoginProps, LoginState> {
    constructor(props: LoginProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`Login fixed top-3 right-3 h-10 w-10 rounded-full bg-black ${this.props.className ?? ""}`}
            ></div>
        );
    };
}
