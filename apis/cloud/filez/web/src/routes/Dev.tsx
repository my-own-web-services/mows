import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Api } from "../api-client";
import Nav from "../components/Nav";
import { ClientConfig, logError, logSuccess } from "../utils";

interface DevProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly filezClient: Api<unknown> | null;
    readonly clientConfig: ClientConfig;
}

interface DevState {}

const tests = [
    "allround1",
    "tags",
    "storageQuota",
    "imageJob",
    "doubleOptionUpdate",
    "nameValidation",
    "accessPoliciesListFiles"
];

export default class Dev extends Component<DevProps, DevState> {
    constructor(props: DevProps) {
        super(props);
        this.state = {
            user: null
        };
    }

    runAllTests = async () => {
        if (!this.props.filezClient) {
            console.error("Filez client is not initialized.");
            return;
        }
        console.log("Running test suite...");
        for (const test of tests) {
            console.log(`Running test: ${test}`);
            await this.runTest(test);
        }
        logSuccess("All tests completed successfully.");
    };

    runTest = async (testName: string) => {
        if (!this.props.filezClient) {
            console.error("Filez client is not initialized.");
            return;
        }
        console.log(`Importing test module for ${testName}...`);
        const mod = await import(`../apiTests/misc/${testName}.ts`);
        if (!mod.default) {
            console.error(`Test module for ${testName} not found or does not export default.`);
            return;
        }
        console.log(`Running test: ${testName}`);
        try {
            await mod.default(this.props.filezClient);
            logSuccess(`Test ${testName} completed successfully.`);
        } catch (error) {
            logError(`Test ${testName} failed: ${error}`);
            throw error;
        }
    };

    componentDidMount = async () => {};

    resetDatabase = async () => {
        if (!this.props.filezClient) {
            console.error("Filez client is not initialized.");
            return;
        }
        try {
            await this.props.filezClient.api.resetDatabase({});
            logSuccess("Database reset successfully.");
        } catch (error) {
            logError(`Failed to reset database: ${error}`);
        }
    };

    render = () => {
        const h1Style = "text-4xl font-bold";
        const buttonStyle = "rounded bg-blue-500 p-2 text-white";
        return (
            <div
                style={{ ...this.props.style }}
                className={`Dev ${this.props.className ?? ""} h-full w-full`}
            >
                <Nav></Nav>
                <div className="flex h-full w-full flex-row items-start justify-center gap-8 p-8">
                    <div className={"flex w-1/2 flex-col items-center gap-4"}>
                        <h1 className={h1Style}>Tests</h1>
                        <button onClick={this.runAllTests} className={buttonStyle}>
                            Run All Tests
                        </button>
                        <div className="flex flex-col gap-2">
                            {tests.map((test) => (
                                <button
                                    key={test}
                                    onClick={() => this.runTest(test)}
                                    className={buttonStyle}
                                >
                                    Run {test} Test
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className={"flex w-1/2 flex-col items-center gap-4"}>
                        <h1 className={h1Style}>Actions</h1>
                        <button
                            onClick={this.resetDatabase}
                            className={buttonStyle + " bg-red-500"}
                            title="Resets the database, DELETES ALL DATA (Only works in development mode, set in the server config)"
                        >
                            Reset Database
                        </button>
                        <button
                            onClick={() => {
                                window.open(
                                    `${this.props.clientConfig.serverUrl}/api/health`,
                                    "_blank"
                                );
                            }}
                            className={buttonStyle}
                        >
                            Open Health Check in new tab
                        </button>
                    </div>
                </div>
            </div>
        );
    };
}
