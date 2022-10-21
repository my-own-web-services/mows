import { invoke } from "@tauri-apps/api";
import { Component, h } from "preact";
import { IoArrowForward } from "react-icons/io5";
interface AppProps {}
interface AppState {
    serverUrl: string;
    localFolder: string;
    remoteVolume: string;
    syncMethod: string;
}

const syncMode = [
    { name: "push" },
    { name: "pushDelete" },
    { name: "pull" },
    { name: "pullDelete" },
    { name: "merge" }
];

export default class App extends Component<AppProps, AppState> {
    constructor(props: AppProps) {
        super(props);
        this.state = {
            serverUrl: "http://localhost:8080",
            localFolder: "/home/paul/Documents/greeter/public/",
            remoteVolume: "greeter-public",
            syncMethod: "push"
        };
    }

    render = () => {
        return (
            <div className="App">
                <div style={{ padding: "20px" }}>
                    <h1>Filez Client</h1>
                    <h2>Server</h2>
                    <input
                        type="text"
                        value={this.state.serverUrl}
                        onChange={e => this.setState({ serverUrl: e.currentTarget.value })}
                    />
                    <h2>Sync Folder</h2>
                    <div style={{ float: "left" }}>
                        <div>Local Path</div>
                        <input
                            type="text"
                            value={this.state.localFolder}
                            onChange={e => this.setState({ localFolder: e.currentTarget.value })}
                        />
                    </div>
                    <div style={{ float: "left", marginTop: "25px" }}>
                        <select
                            name=""
                            id=""
                            onChange={e => this.setState({ syncMethod: e.currentTarget.value })}
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
                            value={this.state.remoteVolume}
                            onChange={e => this.setState({ remoteVolume: e.currentTarget.value })}
                        />
                    </div>
                    <div style={{ clear: "both" }} />

                    <button
                        onClick={async () => {
                            const res = await invoke("sync", {
                                serverUrl: this.state.serverUrl,
                                localFolder: this.state.localFolder,
                                remoteVolume: this.state.remoteVolume,
                                syncMethod: this.state.syncMethod
                            });
                            console.log(res);
                        }}
                    >
                        Sync
                    </button>
                </div>
            </div>
        );
    };
}
