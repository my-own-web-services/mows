import CommandPalette from "@/components/atoms/commandPalette/CommandPalette";
import PrimaryMenu from "@/components/PrimaryMenu";
import {
    FileList,
    FilezContext,
    GlobalContextMenu,
    JobList,
    ModalHandler,
    Toaster,
    Upload
} from "@/main";
import { type CSSProperties, PureComponent } from "react";
interface AppProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface AppState {}

export default class App extends PureComponent<AppProps, AppState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: AppProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

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

/*
<Upload className="h-[800px] w-full"></Upload>
<JobsProgress></JobsProgress>

<ResourceTags
    className="w-[500px] p-4"
    tagsMap={this.state.tagsMap}
    resourceType={TagResourceType.File}
    onCommit={(changes) => {
        log.debug("Committed changes:", changes);
    }}
></ResourceTags>
*/
