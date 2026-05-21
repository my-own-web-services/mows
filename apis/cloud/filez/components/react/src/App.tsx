import CommandPalette from "mows-components-react/components/appShell/commandPalette/CommandPalette";
import GlobalContextMenu from "mows-components-react/components/appShell/globalContextMenu/GlobalContextMenu";
import ModalHandler from "mows-components-react/components/appShell/modalHandler/ModalHandler";
import { Toaster } from "mows-components-react/components/ui/sonner";
import PrimaryMenu from "@/components/appShell/primaryMenu/PrimaryMenu";
import { FileList, JobList, Upload } from "@/main";
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

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`App h-full w-full overflow-x-hidden ${this.props.className ?? ``}`}
            >
                <PrimaryMenu position={`bottom-right`}></PrimaryMenu>
                <CommandPalette />
                <ModalHandler />
                <Toaster></Toaster>
                <GlobalContextMenu></GlobalContextMenu>
                <FileList
                    fileGroupId={`019a4a37-26bd-7079-866b-f9bf90531c1c`}
                    className={`h-[500px] w-full`}
                ></FileList>

                <Upload className={`h-[800px] w-full`}></Upload>
                <JobList className={`h-[500px] w-full`}></JobList>
            </div>
        );
    };
}
