import { Component } from "preact";
import { CSSProperties } from "preact/compat";

import { FilezContext } from "filez-components-react";
import { logError, logSuccess } from "../utils";

interface DevProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface DevState {}

const tests = [
    "allround1",
    "tags",
    "storageQuota",
    "imageJob",
    "doubleOptionUpdate",
    "nameValidation",
    "accessPoliciesListFiles",
    "createMockFiles",
    "createAdminStorageQuota"
];

export default class Dev extends Component<DevProps, DevState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: DevProps) {
        super(props);
        this.state = {
            user: null
        };
    }

    runAllTests = async () => {
        if (!this.context?.filezClient) {
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
        if (!this.context?.filezClient) {
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
            await mod.default(this.context.filezClient);
            logSuccess(`Test ${testName} completed successfully.`);
        } catch (error) {
            logError(`Test ${testName} failed: ${error}`);
            throw error;
        }
    };

    componentDidMount = async () => {};

    resetDatabase = async () => {
        if (!this.context?.filezClient) {
            console.error("Filez client is not initialized.");
            return;
        }
        try {
            await this.context.filezClient.api.resetDatabase({});
            logSuccess("Database reset successfully.");
        } catch (error) {
            logError(`Failed to reset database: ${error}`);
        }
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`Dev ${this.props.className ?? ""} h-full w-full`}
            >
                <div className={"flex flex-col gap-8 p-8"}>
                    <div className="justify-left flex h-full w-full flex-row items-start gap-8">
                        <div className="flex flex-col gap-4">
                            <button onClick={this.runAllTests}>Run All Tests</button>
                            <div className="flex flex-col gap-2">
                                {tests.map((test) => (
                                    <button key={test} onClick={() => this.runTest(test)}>
                                        Run {test} Test
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <button
                                onClick={this.resetDatabase}
                                title="Resets the database, DELETES ALL DATA (Only works in development mode, set in the server config)"
                            >
                                Reset Database
                            </button>
                            <button
                                onClick={() => {
                                    window.open(
                                        `${this.context?.clientConfig?.serverUrl}/api/health`,
                                        "_blank"
                                    );
                                }}
                            >
                                Open Health Check in new tab
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
}
