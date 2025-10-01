import CommandPalette from "@/components/atoms/CommandPalette";
import FileList from "@/components/list/FileList";
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
                <FileList
                    id="01999b67-500a-7f90-aa59-77737adbabc2"
                    className="bg-muted h-[500px] w-full"
                ></FileList>
            </div>
        );
    };
}
