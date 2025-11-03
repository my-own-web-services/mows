import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { Check, Loader2, Play, Search, X } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";
import LoggingConfig from "../loggingConfig/LoggingConfig";

interface DevPanelProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

type TestStatus = `idle` | `running` | `success` | `error`;

interface TestResult {
    status: TestStatus;
    error?: string;
    duration?: number;
}

interface TestMetadata {
    id: string;
    name: string;
    description: string;
}

interface DevPanelState {
    searchQuery: string;
    testResults: Record<string, TestResult>;
    isRunningAll: boolean;
    runMode: `sequential` | `parallel`;
    taskSearchQuery: string;
    taskResults: Record<string, TestResult>;
    isRunningAllTasks: boolean;
}

const tests: TestMetadata[] = [
    {
        id: `accessPoliciesListFiles`,
        name: `Access Policies List Files`,
        description: `Test access policies when listing files`
    },
    {
        id: `allround1`,
        name: `All-Round Test 1`,
        description: `Comprehensive test covering multiple API features`
    },
    {
        id: `doubleOptionUpdate`,
        name: `Double Option Update`,
        description: `Test updating nested options`
    },
    {
        id: `imageJob`,
        name: `Image Job`,
        description: `Test image processing job creation and execution (May fail if image processing app is occupied)`
    },
    {
        id: `listTags`,
        name: `List Tags`,
        description: `Test listing tags for files`
    },
    {
        id: `metadataJob`,
        name: `Metadata Job`,
        description: `Test metadata extraction job creation and execution`
    },
    {
        id: `nameValidation`,
        name: `Name Validation`,
        description: `Test file name validation rules`
    },
    {
        id: `storageQuota`,
        name: `Storage Quota`,
        description: `Test storage quota enforcement and management`
    },
    {
        id: `tags`,
        name: `Tags`,
        description: `Test adding, removing, and querying tags on files`
    }
];

const tasks: TestMetadata[] = [
    {
        id: `createMockFiles`,
        name: `Create Mock Files`,
        description: `Create 1000 mock files for testing`
    },
    {
        id: `createAdminStorageQuota`,
        name: `Create Admin Storage Quota`,
        description: `Create a storage quota for the admin user`
    },
    {
        id: `resetDatabase`,
        name: `Reset Database`,
        description: `Resets the database, DELETES ALL DATA (Only works in development mode, set in the server config)`
    }
];

export default class DevPanel extends PureComponent<DevPanelProps, DevPanelState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: DevPanelProps) {
        super(props);
        this.state = {
            searchQuery: ``,
            testResults: {},
            isRunningAll: false,
            runMode: `sequential`,
            taskSearchQuery: ``,
            taskResults: {},
            isRunningAllTasks: false
        };
    }

    runAllTests = async () => {
        if (!this.context?.filezClient) {
            console.error(`Filez client is not initialized.`);
            return;
        }

        this.setState({ isRunningAll: true });
        log.debug(`Running test suite in ${this.state.runMode} mode...`);

        const filteredTests = this.getFilteredTests();

        if (this.state.runMode === `parallel`) {
            // Run all tests in parallel
            await Promise.allSettled(filteredTests.map((test) => this.runTest(test.id)));
        } else {
            // Run tests sequentially
            for (const test of filteredTests) {
                await this.runTest(test.id);
            }
        }

        this.setState({ isRunningAll: false });
        log.debug(`All tests completed.`);
    };

    runTest = async (testId: string) => {
        if (!this.context?.filezClient) {
            console.error(`Filez client is not initialized.`);
            return;
        }

        // Set test as running
        this.setState((prevState) => ({
            testResults: {
                ...prevState.testResults,
                [testId]: { status: `running` }
            }
        }));

        const startTime = performance.now();

        try {
            console.log(`Importing test module for ${testId}...`);
            const mod = await import(`./apiTests/${testId}.ts`);
            if (!mod.default) {
                throw new Error(`Test module for ${testId} not found or does not export default.`);
            }
            console.log(`Running test: ${testId}`);
            await mod.default(this.context.filezClient);

            const duration = performance.now() - startTime;
            log.debug(`Test ${testId} completed successfully in ${duration.toFixed(2)}ms.`);

            // Set test as success
            this.setState((prevState) => ({
                testResults: {
                    ...prevState.testResults,
                    [testId]: { status: `success`, duration }
                }
            }));
        } catch (error) {
            const duration = performance.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.debug(`Test ${testId} failed: ${errorMessage}`);

            // Set test as error
            this.setState((prevState) => ({
                testResults: {
                    ...prevState.testResults,
                    [testId]: { status: `error`, error: errorMessage, duration }
                }
            }));
        }
    };

    getFilteredTests = (): TestMetadata[] => {
        const query = this.state.searchQuery.toLowerCase();
        if (!query) return tests;
        return tests.filter(
            (test) =>
                test.name.toLowerCase().includes(query) ||
                test.description.toLowerCase().includes(query) ||
                test.id.toLowerCase().includes(query)
        );
    };

    getFilteredTasks = (): TestMetadata[] => {
        const query = this.state.taskSearchQuery.toLowerCase();
        if (!query) return tasks;
        return tasks.filter(
            (task) =>
                task.name.toLowerCase().includes(query) ||
                task.description.toLowerCase().includes(query) ||
                task.id.toLowerCase().includes(query)
        );
    };

    handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ searchQuery: e.target.value });
    };

    handleTaskSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ taskSearchQuery: e.target.value });
    };

    handleRunModeChange = (value: string) => {
        this.setState({ runMode: value as `sequential` | `parallel` });
    };

    runAllTasks = async () => {
        if (!this.context?.filezClient) {
            console.error(`Filez client is not initialized.`);
            return;
        }

        this.setState({ isRunningAllTasks: true });
        log.debug(`Running all tasks sequentially...`);

        const filteredTasks = this.getFilteredTasks();

        // Tasks always run sequentially
        for (const task of filteredTasks) {
            await this.runTask(task.id);
        }

        this.setState({ isRunningAllTasks: false });
        log.debug(`All tasks completed.`);
    };

    runTask = async (taskId: string) => {
        if (!this.context?.filezClient) {
            console.error(`Filez client is not initialized.`);
            return;
        }

        // Set task as running
        this.setState((prevState) => ({
            taskResults: {
                ...prevState.taskResults,
                [taskId]: { status: `running` }
            }
        }));

        const startTime = performance.now();

        try {
            console.log(`Importing task module for ${taskId}...`);
            const mod = await import(`./tasks/${taskId}.ts`);
            if (!mod.default) {
                throw new Error(`Task module for ${taskId} not found or does not export default.`);
            }
            console.log(`Running task: ${taskId}`);
            await mod.default(this.context.filezClient);

            const duration = performance.now() - startTime;
            log.debug(`Task ${taskId} completed successfully in ${duration.toFixed(2)}ms.`);

            // Set task as success
            this.setState((prevState) => ({
                taskResults: {
                    ...prevState.taskResults,
                    [taskId]: { status: `success`, duration }
                }
            }));
        } catch (error) {
            const duration = performance.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.debug(`Task ${taskId} failed: ${errorMessage}`);

            // Set task as error
            this.setState((prevState) => ({
                taskResults: {
                    ...prevState.taskResults,
                    [taskId]: { status: `error`, error: errorMessage, duration }
                }
            }));
        }
    };

    getStatusIcon = (status: TestStatus) => {
        switch (status) {
            case `running`:
                return <Loader2 className={`h-4 w-4 animate-spin text-blue-500`} />;
            case `success`:
                return <Check className={`h-4 w-4 text-green-500`} />;
            case `error`:
                return <X className={`h-4 w-4 text-red-500`} />;
            default:
                return null;
        }
    };

    getStatusBadge = (status: TestStatus) => {
        const { t } = this.context!;
        switch (status) {
            case `running`:
                return <Badge variant={`outline`}>{t.devPanel.status.running}</Badge>;
            case `success`:
                return <Badge variant={`outline`}>{t.devPanel.status.success}</Badge>;
            case `error`:
                return <Badge variant={`outline`}>{t.devPanel.status.error}</Badge>;
            default:
                return <Badge variant={`outline`}>{t.devPanel.status.idle}</Badge>;
        }
    };

    componentDidMount = async () => {};

    render = () => {
        const filteredTests = this.getFilteredTests();
        const filteredTasks = this.getFilteredTasks();
        const { testResults, isRunningAll, runMode, taskResults, isRunningAllTasks } = this.state;
        const { t } = this.context!;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`DevPanel space-y-6 p-6`, this.props.className)}
            >
                {/* Logging Configuration */}
                <LoggingConfig />

                {/* Tasks Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t.devPanel.tasks.title}</CardTitle>
                        <CardDescription>{t.devPanel.tasks.description}</CardDescription>
                    </CardHeader>
                    <CardContent className={`space-y-4`}>
                        {/* Search */}
                        <div className={`relative`}>
                            <Search
                                className={`text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform`}
                            />
                            <Input
                                type={`text`}
                                placeholder={t.devPanel.tasks.searchPlaceholder}
                                value={this.state.taskSearchQuery}
                                onChange={this.handleTaskSearchChange}
                                className={`pl-10`}
                            />
                        </div>

                        {/* Run All Tasks Section */}
                        <div className={`bg-muted space-y-3 rounded-lg border p-4`}>
                            <div className={`flex items-center justify-between`}>
                                <h3 className={`text-sm font-semibold`}>
                                    {t.devPanel.tasks.runAllTitle}
                                </h3>
                                <Badge variant={`secondary`}>
                                    {filteredTasks.length} {t.devPanel.tasks.tasksCount}
                                </Badge>
                            </div>

                            <Button
                                onClick={this.runAllTasks}
                                disabled={isRunningAllTasks || filteredTasks.length === 0}
                                className={`w-full`}
                            >
                                {isRunningAllTasks ? (
                                    <>
                                        <Loader2 className={`mr-2 h-4 w-4 animate-spin`} />
                                        {t.devPanel.tasks.running}
                                    </>
                                ) : (
                                    <>
                                        <Play className={`mr-2 h-4 w-4`} />
                                        {t.devPanel.tasks.runAllButton}
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Individual Tasks */}
                        <div className={`space-y-2`}>
                            <h3 className={`text-sm font-semibold`}>
                                {t.devPanel.tasks.individualTitle}
                            </h3>
                            {filteredTasks.length === 0 ? (
                                <p className={`text-muted-foreground py-4 text-center text-sm`}>
                                    {t.devPanel.tasks.noTasksFound} "{this.state.taskSearchQuery}"
                                </p>
                            ) : (
                                <div className={`space-y-2`}>
                                    {filteredTasks.map((task) => {
                                        const result = taskResults[task.id];
                                        const status = result?.status || `idle`;
                                        const isRunning = status === `running`;

                                        return (
                                            <div
                                                key={task.id}
                                                className={`hover:bg-muted flex items-center justify-between rounded-lg border p-3 transition-colors`}
                                            >
                                                <div
                                                    className={`flex min-w-0 flex-1 items-center gap-3`}
                                                >
                                                    <div className={`flex-shrink-0`}>
                                                        {this.getStatusIcon(status)}
                                                    </div>
                                                    <div className={`min-w-0 flex-1`}>
                                                        <p
                                                            className={`truncate text-sm font-semibold`}
                                                        >
                                                            {task.name}
                                                        </p>
                                                        <p
                                                            className={`text-muted-foreground truncate text-xs`}
                                                        >
                                                            {task.description}
                                                        </p>
                                                        {result?.error && (
                                                            <p
                                                                className={`text-destructive mt-1 truncate text-xs`}
                                                            >
                                                                {result.error}
                                                            </p>
                                                        )}
                                                        {result?.duration && (
                                                            <p
                                                                className={`text-muted-foreground mt-1 text-xs`}
                                                            >
                                                                {result.duration.toFixed(2)}ms
                                                            </p>
                                                        )}
                                                    </div>
                                                    {this.getStatusBadge(status)}
                                                </div>
                                                <Button
                                                    size={`sm`}
                                                    variant={`outline`}
                                                    onClick={() => this.runTask(task.id)}
                                                    disabled={isRunning}
                                                    className={`ml-2 flex-shrink-0`}
                                                >
                                                    {isRunning ? (
                                                        <Loader2
                                                            className={`h-3 w-3 animate-spin`}
                                                        />
                                                    ) : (
                                                        <Play className={`h-3 w-3`} />
                                                    )}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* API Tests Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t.devPanel.apiTests.title}</CardTitle>
                        <CardDescription>{t.devPanel.apiTests.description}</CardDescription>
                    </CardHeader>
                    <CardContent className={`space-y-4`}>
                        {/* Search */}
                        <div className={`relative`}>
                            <Search
                                className={`text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform`}
                            />
                            <Input
                                type={`text`}
                                placeholder={t.devPanel.apiTests.searchPlaceholder}
                                value={this.state.searchQuery}
                                onChange={this.handleSearchChange}
                                className={`pl-10`}
                            />
                        </div>

                        {/* Run All Section */}
                        <div className={`bg-muted space-y-3 rounded-lg border p-4`}>
                            <div className={`flex items-center justify-between`}>
                                <h3 className={`text-sm font-semibold`}>
                                    {t.devPanel.apiTests.runAllTitle}
                                </h3>
                                <Badge variant={`secondary`}>
                                    {filteredTests.length} {t.devPanel.apiTests.testsCount}
                                </Badge>
                            </div>

                            <RadioGroup value={runMode} onValueChange={this.handleRunModeChange}>
                                <div className={`flex items-center space-x-2`}>
                                    <RadioGroupItem value={`sequential`} id={`sequential`} />
                                    <Label htmlFor={`sequential`} className={`cursor-pointer`}>
                                        {t.devPanel.apiTests.runMode.sequential}
                                    </Label>
                                </div>
                                <div className={`flex items-center space-x-2`}>
                                    <RadioGroupItem value={`parallel`} id={`parallel`} />
                                    <Label htmlFor={`parallel`} className={`cursor-pointer`}>
                                        {t.devPanel.apiTests.runMode.parallel}
                                    </Label>
                                </div>
                            </RadioGroup>

                            <Button
                                onClick={this.runAllTests}
                                disabled={isRunningAll || filteredTests.length === 0}
                                className={`w-full`}
                            >
                                {isRunningAll ? (
                                    <>
                                        <Loader2 className={`mr-2 h-4 w-4 animate-spin`} />
                                        {t.devPanel.apiTests.running}
                                    </>
                                ) : (
                                    <>
                                        <Play className={`mr-2 h-4 w-4`} />
                                        {t.devPanel.apiTests.runAllButton}
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Individual Tests */}
                        <div className={`space-y-2`}>
                            <h3 className={`text-sm font-semibold`}>
                                {t.devPanel.apiTests.individualTitle}
                            </h3>
                            {filteredTests.length === 0 ? (
                                <p className={`text-muted-foreground py-4 text-center text-sm`}>
                                    {t.devPanel.apiTests.noTestsFound} "{this.state.searchQuery}"
                                </p>
                            ) : (
                                <div className={`space-y-2`}>
                                    {filteredTests.map((test) => {
                                        const result = testResults[test.id];
                                        const status = result?.status || `idle`;
                                        const isRunning = status === `running`;

                                        return (
                                            <div
                                                key={test.id}
                                                className={`hover:bg-muted flex items-center justify-between rounded-lg border p-3 transition-colors`}
                                            >
                                                <div
                                                    className={`flex min-w-0 flex-1 items-center gap-3`}
                                                >
                                                    <div className={`flex-shrink-0`}>
                                                        {this.getStatusIcon(status)}
                                                    </div>
                                                    <div className={`min-w-0 flex-1`}>
                                                        <p
                                                            className={`truncate text-sm font-semibold`}
                                                        >
                                                            {test.name}
                                                        </p>
                                                        <p
                                                            className={`text-muted-foreground truncate text-xs`}
                                                        >
                                                            {test.description}
                                                        </p>
                                                        {result?.error && (
                                                            <p
                                                                className={`text-destructive mt-1 truncate text-xs`}
                                                            >
                                                                {result.error}
                                                            </p>
                                                        )}
                                                        {result?.duration && (
                                                            <p
                                                                className={`text-muted-foreground mt-1 text-xs`}
                                                            >
                                                                {result.duration.toFixed(2)}ms
                                                            </p>
                                                        )}
                                                    </div>
                                                    {this.getStatusBadge(status)}
                                                </div>
                                                <Button
                                                    size={`sm`}
                                                    variant={`outline`}
                                                    onClick={() => this.runTest(test.id)}
                                                    disabled={isRunning}
                                                    className={`ml-2 flex-shrink-0`}
                                                >
                                                    {isRunning ? (
                                                        <Loader2
                                                            className={`h-3 w-3 animate-spin`}
                                                        />
                                                    ) : (
                                                        <Play className={`h-3 w-3`} />
                                                    )}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };
}
