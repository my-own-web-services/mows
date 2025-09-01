import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Button, Panel, Table } from "rsuite";

import { Api } from "filez-client-typescript";
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
        return (
            <div
                style={{ ...this.props.style }}
                className={`Dev ${this.props.className ?? ""} h-full w-full`}
            >
                <Nav></Nav>
                <div className={"flex flex-col gap-8 p-8"}>
                    <div className="justify-left flex h-full w-full flex-row items-start gap-8">
                        <Panel
                            header="Tests"
                            bordered
                            collapsible
                            className="w-1/4"
                            defaultExpanded
                        >
                            <div className="flex flex-col gap-4">
                                <Button onClick={this.runAllTests}>Run All Tests</Button>
                                <div className="flex flex-col gap-2">
                                    {tests.map((test) => (
                                        <Button
                                            key={test}
                                            appearance="primary"
                                            onClick={() => this.runTest(test)}
                                        >
                                            Run {test} Test
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </Panel>

                        <Panel
                            header="Actions"
                            bordered
                            collapsible
                            className="w-1/4"
                            defaultExpanded
                        >
                            <div className="flex flex-col gap-4">
                                <Button
                                    onClick={this.resetDatabase}
                                    color="red"
                                    appearance="primary"
                                    title="Resets the database, DELETES ALL DATA (Only works in development mode, set in the server config)"
                                >
                                    Reset Database
                                </Button>
                                <Button
                                    onClick={() => {
                                        window.open(
                                            `${this.props.clientConfig.serverUrl}/api/health`,
                                            "_blank"
                                        );
                                    }}
                                >
                                    Open Health Check in new tab
                                </Button>
                            </div>
                        </Panel>
                    </div>
                    <Panel
                        header="Resources"
                        bordered
                        collapsible
                        className="w-full"
                        defaultExpanded
                    >
                        <Table virtualized>
                            {columns.map((column) => (
                                <Table.Column width={100} align="center" resizable sortable>
                                    <Table.HeaderCell>{column.label}</Table.HeaderCell>
                                    <Table.Cell dataKey={column.key} />
                                </Table.Column>
                            ))}
                        </Table>
                    </Panel>
                </div>
            </div>
        );
    };
}

const columns = [{ key: "id", label: "Id" }];
