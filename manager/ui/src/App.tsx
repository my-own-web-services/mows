import { PureComponent } from "react";
import { Api } from "./api-client";

interface AppProps {}

interface AppState {
    config: string;
}

export default class App extends PureComponent<AppProps, AppState> {
    client: Api<unknown>;

    constructor(props: AppProps) {
        super(props);
        this.state = {
            config: ""
        };
        this.client = new Api({ baseUrl: "http://localhost:3000" });
    }

    componentDidMount = async () => {
        await this.loadConfig();
    };

    loadConfig = async () => {
        const config = (await this.client.api.getConfig()).data;
        this.setState({ config: JSON.stringify(config) });
    };

    createMachines = async () => {
        await this.client.api
            .createMachines({ LocalQemu: { memory: 4, cpus: 2 } })
            .catch(console.error);
        await this.loadConfig();
    };

    createCluster = async () => {
        await this.client.api.createCluster({}).catch(console.error);
        await this.loadConfig();
    };

    updateConfig = async () => {
        await this.client.api.updateConfig(JSON.parse(this.state.config)).catch(console.error);
    };

    deleteAllMowsMachines = async () => {
        await this.client.api.deleteAllMachines().catch(console.error);
        await this.loadConfig();
    };

    render = () => {
        return (
            <div className="App">
                <textarea
                    style={{ width: "500px", height: "500px" }}
                    value={this.state.config}
                    onChange={e => this.setState({ config: e.target.value })}
                ></textarea>
                <br />
                <button onClick={this.deleteAllMowsMachines}>Delete all MOWS machines</button>
                <button onClick={this.updateConfig}>Update config</button>
                <button onClick={this.createMachines}>Create machines</button>
                <button onClick={this.createCluster}>Create cluster</button>
            </div>
        );
    };
}
