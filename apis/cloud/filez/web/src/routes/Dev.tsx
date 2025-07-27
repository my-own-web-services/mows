import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Api } from "../api-client";
import Nav from "../components/Nav";

interface DevProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly filezClient: Api<unknown> | null;
}

interface DevState {}

const tests = ["allround1", "tags", "storageQuota"];

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
            console.log(`Test ${testName} completed successfully.`);
        } catch (error) {
            console.error(`Test ${testName} failed:`, error);
        }
    };

    componentDidMount = async () => {};

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={`Dev ${this.props.className ?? ""} h-full w-full`}
            >
                <Nav></Nav>
                <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                    <button
                        onClick={this.runAllTests}
                        className="rounded bg-blue-500 p-2 text-white"
                    >
                        Run All Tests
                    </button>
                    <div className="flex flex-col gap-2">
                        {tests.map((test) => (
                            <button
                                key={test}
                                onClick={() => this.runTest(test)}
                                className="rounded bg-blue-500 p-2 text-white"
                            >
                                Run {test} Test
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };
}
