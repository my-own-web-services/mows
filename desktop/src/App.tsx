import { invoke } from "@tauri-apps/api";
import { Component, h } from "preact";
import { IoArrowForward } from "react-icons/io5";
import { configDir as getConfigDir } from "@tauri-apps/api/path";
import update from "immutability-helper";

const syncMode = [
    { name: "push" },
    { name: "pushDelete" },
    { name: "pull" },
    { name: "pullDelete" },
    { name: "merge" }
];

export interface SyncConfig {
    serverUrl: string;
    localFolder: string;
    remoteVolume: string;
    syncMethod: string;
}

const defaultConfig: SyncConfig[] = [
    {
        serverUrl: "http://localhost:8080",
        localFolder: "/home/paul/Downloads/filez_test/",
        remoteVolume: "filez-test",
        syncMethod: "merge"
    },
    {
        serverUrl: "http://localhost:8080",
        localFolder: "/home/paul/Downloads/filez_test_2/",
        remoteVolume: "filez-test",
        syncMethod: "merge"
    }
];
interface AppProps {}
interface AppState {
    syncConfig: SyncConfig[];
}
export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = { syncConfig: defaultConfig };
    }

    render = () => {
        return (
            <div className="App">
                <div style={{ padding: "20px" }}>
                    <h1>Filez Client</h1>
                    {this.state.syncConfig.map((cfg, i) => {
                        return (
                            <div>
                                <input
                                    type="text"
                                    value={cfg.serverUrl}
                                    onChange={e =>
                                        this.setState(({ syncConfig }) => {
                                            syncConfig = update(syncConfig, {
                                                [i]: {
                                                    serverUrl: { $set: e.currentTarget.value }
                                                }
                                            });
                                            {
                                                syncConfig;
                                            }
                                        })
                                    }
                                />
                                <div style={{ float: "left" }}>
                                    <div>Local Path</div>
                                    <input
                                        type="text"
                                        value={cfg.localFolder}
                                        onChange={e =>
                                            this.setState(({ syncConfig }) => {
                                                syncConfig = update(syncConfig, {
                                                    [i]: {
                                                        localFolder: { $set: e.currentTarget.value }
                                                    }
                                                });
                                                {
                                                    syncConfig;
                                                }
                                            })
                                        }
                                    />
                                </div>
                                <div style={{ float: "left", marginTop: "25px" }}>
                                    <select
                                        name=""
                                        id=""
                                        onChange={e =>
                                            this.setState(({ syncConfig }) => {
                                                syncConfig = update(syncConfig, {
                                                    [i]: {
                                                        syncMethod: { $set: e.currentTarget.value }
                                                    }
                                                });
                                                {
                                                    syncConfig;
                                                }
                                            })
                                        }
                                        value={cfg.syncMethod}
                                    >
                                        {syncMode.map(s => {
                                            return <option value={s.name}>{s.name}</option>;
                                        })}
                                    </select>
                                </div>
                                <div style={{ float: "left" }}>
                                    <div>Remote Volume</div>
                                    <input
                                        type="text"
                                        value={cfg.remoteVolume}
                                        onChange={e =>
                                            this.setState(({ syncConfig }) => {
                                                syncConfig = update(syncConfig, {
                                                    [i]: {
                                                        remoteVolume: {
                                                            $set: e.currentTarget.value
                                                        }
                                                    }
                                                });
                                                {
                                                    syncConfig;
                                                }
                                            })
                                        }
                                    />
                                </div>
                                <div style={{ clear: "both" }} />
                            </div>
                        );
                    })}

                    <button
                        onClick={async () => {
                            const configDir = await getConfigDir();
                            this.state.syncConfig.forEach(async cfg => {
                                const res = await invoke("sync", {
                                    serverUrl: cfg.serverUrl,
                                    localFolder: cfg.localFolder,
                                    remoteVolume: cfg.remoteVolume,
                                    syncMethod: cfg.syncMethod,
                                    localConfigDir: configDir
                                });
                                console.log(res);
                            });
                        }}
                    >
                        Sync
                    </button>
                </div>
            </div>
        );
    };
}
