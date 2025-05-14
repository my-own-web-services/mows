import { FilezClient } from "@firstdorsal/filez-client";
import { createContext, PureComponent } from "react";
import update from "immutability-helper";
import "rsuite/styles/index.less";
import "./default.scss";
import { CustomProvider } from "rsuite";
import { FilezFileGroup } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFileGroup";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Preview } from "react-dnd-preview";
import { generateDndPreview } from "./components/dnd/generatePreview";

export interface FilezContext {
    filezClient: FilezClient;
    uiConfig: UiConfig;
}

export const FilezContext = createContext<FilezContext | null>(null);

interface FilezProviderProps {
    readonly uiConfig?: UiConfig;
    readonly children?: React.ReactNode;
}

interface FilezProviderState {
    readonly fileList: FilezFile[];
    readonly groupList: FilezFileGroup[];
    readonly filezClient: FilezClient | null;
    readonly uiConfig: UiConfig | null;
}

export default class FilezProvider extends PureComponent<
    FilezProviderProps,
    FilezProviderState
> {
    constructor(props: FilezProviderProps) {
        super(props);
        this.state = {
            fileList: [],
            groupList: [],
            filezClient: null,
            uiConfig: null
        };
    }

    componentDidMount = async () => {
        const uiConfig: UiConfig = await (async () => {
            if (!this.props.uiConfig) {
                const res = await fetch("/config.json");
                const json = await res.json();
                return json as UiConfig;
            } else {
                return this.props.uiConfig;
            }
        })();

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

        this.setState((state) => {
            return update(state, {
                uiConfig: { $set: uiConfig },
                filezClient: {
                    $set: client
                }
            });
        });
    };

    render = () => {
        if (this.state.filezClient === null || this.state.uiConfig === null) {
            return null;
        }
        return (
            <CustomProvider theme="dark">
                <DndProvider backend={HTML5Backend}>
                    <Preview generator={generateDndPreview} />

                    <FilezContext.Provider
                        value={{
                            filezClient: this.state.filezClient,
                            uiConfig: this.state.uiConfig
                        }}
                    >
                        {this.props.children}{" "}
                    </FilezContext.Provider>
                </DndProvider>
            </CustomProvider>
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
