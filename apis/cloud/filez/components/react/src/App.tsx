import CommandPalette from "@/components/atoms/commandPalette/CommandPalette";
import { ResourceTagsMap } from "@/components/atoms/resourceTags/ResourceTags";
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

interface AppState {
    readonly tagsMap: ResourceTagsMap;
}

export default class App extends PureComponent<AppProps, AppState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: AppProps) {
        super(props);
        this.state = {
            tagsMap: {
                bildVonNürnberg: [
                    { key: `City`, value: `Nürnberg` },
                    { key: `Country`, value: `Germany` },
                    { key: `People`, value: `Paul Hennig` }
                ],
                bildVonAugsburg: [
                    { key: `City`, value: `Augsburg` },
                    { key: `Country`, value: `Germany` }
                ]
            }
        };
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
                    fileGroupId={`019a3b0a-f060-7eb2-ab16-751e746de116`}
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
