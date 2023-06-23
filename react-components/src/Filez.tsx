import { FileGroup, FilezClient, FilezFile } from "@firstdorsal/filez-client";
import { createContext } from "react";
import { PureComponent } from "react";
import update from "immutability-helper";

export interface FilezContext {
    groupList: FileGroup[] | null;
    fileList: FilezFile[] | null;
    filezClient: FilezClient;
    updateFileList: () => void;
}

export const FilezContext = createContext<FilezContext | null>(null);

interface FilezProps {
    readonly children?: React.ReactNode;
}

interface FilezState {
    readonly fileList: FilezFile[];
    readonly groupList: FileGroup[];
    readonly filezClient: FilezClient;
    readonly uiConfig: UiConfig;
}

export default class Filez extends PureComponent<FilezProps, FilezState> {
    constructor(props: FilezProps) {
        super(props);
        this.state = {
            fileList: [],
            groupList: [],
            filezClient: null as unknown as FilezClient,
            uiConfig: null as unknown as UiConfig
        };
    }

    componentDidMount = async () => {
        const uiConfig: UiConfig = await fetch("/config.json").then(res => res.json());

        const client = new FilezClient(
            uiConfig.filezServerAddress,
            uiConfig.interosseaServerAddress,
            uiConfig.interosseaWebAddress,
            "filez",
            uiConfig.skipInterossea
        );

        this.setState(state => {
            return update(state, {
                uiConfig: { $set: uiConfig },
                filezClient: {
                    $set: client
                }
            });
        });
    };

    updateFileList = async () => {};
    loadMoreFiles = async () => {};

    render = () => {
        if (this.state.filezClient === undefined) {
            return null;
        }
        return (
            <FilezContext.Provider
                value={{
                    fileList: this.state.fileList,
                    groupList: this.state.groupList,
                    filezClient: this.state.filezClient,
                    updateFileList: this.updateFileList
                }}
            >
                {this.props.children}
            </FilezContext.Provider>
        );
    };
}

export interface UiConfig {
    interosseaServerAddress: string;
    interosseaWebAddress: string;
    filezServerAddress: string;
    skipInterossea: boolean;
}
