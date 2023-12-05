import { FilezClient } from "@firstdorsal/filez-client";
import { createContext, PureComponent } from "react";
import update from "immutability-helper";
import "rsuite/styles/index.less";
import "./default.scss";
import { CustomProvider } from "rsuite";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

export interface FilezContext {
    filezClient: FilezClient;
    uiConfig: UiConfig;
}

export const FilezContext = createContext<FilezContext | null>(null);

interface FilezProviderProps {
    readonly children?: React.ReactNode;
}

interface FilezProviderState {
    readonly fileList: FilezFile[];
    readonly groupList: FilezFileGroup[];
    readonly filezClient: FilezClient;
    readonly uiConfig: UiConfig;
}

export default class FilezProvider extends PureComponent<FilezProviderProps, FilezProviderState> {
    constructor(props: FilezProviderProps) {
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
            uiConfig.applicationId,
            uiConfig.skipInterossea
        );

        await client.init();
        await client.create_own_user();
        //console.log(uiConfig);

        this.setState(state => {
            return update(state, {
                uiConfig: { $set: uiConfig },
                filezClient: {
                    $set: client
                }
            });
        });
    };

    render = () => {
        if (!this.state.filezClient) {
            return null;
        }
        return (
            <FilezContext.Provider
                value={{
                    filezClient: this.state.filezClient,
                    uiConfig: this.state.uiConfig
                }}
            >
                <CustomProvider theme="dark">{this.props.children}</CustomProvider>
            </FilezContext.Provider>
        );
    };
}

export interface UiConfig {
    interosseaServerAddress: string;
    interosseaWebAddress: string;
    filezServerAddress: string;
    skipInterossea: boolean;
    applicationId: string;
}
