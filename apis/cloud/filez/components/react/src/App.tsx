import CommandPalette from "@/components/atoms/CommandPalette";
import PrimaryMenu from "@/components/PrimaryMenu";
import { ModalHandler, Toaster } from "@/main";
import { type CSSProperties, PureComponent } from "react";

interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {}

export default class App extends PureComponent<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`App h-full w-full ${this.props.className ?? ""}`}
            >
                <PrimaryMenu position="top-right"></PrimaryMenu>
                <CommandPalette />
                <ModalHandler />
                <Toaster></Toaster>
            </div>
        );
    };
}
