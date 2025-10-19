import CommandPalette from "@/components/atoms/CommandPalette";
import { ResourceTagsMap } from "@/components/atoms/ResourceTags/ResourceTags";
import PrimaryMenu from "@/components/PrimaryMenu";
import { FileList, FilezContext, GlobalContextMenu, ModalHandler, Toaster } from "@/main";
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
                    { key: "City", value: "Nürnberg" },
                    { key: "Country", value: "Germany" },
                    { key: "People", value: "Paul Hennig" }
                ],
                bildVonAugsburg: [
                    { key: "City", value: "Augsburg" },
                    { key: "Country", value: "Germany" }
                ]
            }
        };
    }

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`App h-full w-full ${this.props.className ?? ""}`}
            >
                <PrimaryMenu position="bottom-right"></PrimaryMenu>
                <CommandPalette />
                <ModalHandler />
                <Toaster></Toaster>
                <FileList
                    fileGroupId="01999b67-500a-7f90-aa59-77737adbabc2"
                    className="h-[500px] w-full"
                ></FileList>
                <GlobalContextMenu></GlobalContextMenu>
            </div>
        );
    };
}

/*
                              <Upload className="h-[800px] w-full"></Upload>

                <ResourceTags
                    className="w-[500px] p-4"
                    tagsMap={this.state.tagsMap}
                    resourceType={TagResourceType.File}
                    onCommit={(changes) => {
                        log.debug("Committed changes:", changes);
                    }}
                ></ResourceTags>

*/
