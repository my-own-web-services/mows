import { Progress } from "@/components/ui/progress";
import { FilezContext } from "@/lib/filezContext/FilezContext";
import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties } from "react";
import type { FilezJob, MowsApp, MowsAppId } from "filez-client-typescript";

interface JobsProgressProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly refreshInterval?: number;
    readonly showOnlyRunning?: boolean;
}

interface AppJobProgress {
    readonly appId: MowsAppId;
    readonly appName?: string;
    readonly totalJobs: number;
    readonly completedJobs: number;
    readonly failedJobs: number;
    readonly cancelledJobs: number;
    readonly inProgressJobs: number;
    readonly createdJobs: number;
}

interface JobsProgressState {
    readonly jobsByApp: Map<MowsAppId, AppJobProgress>;
    readonly apps: Map<MowsAppId, MowsApp>;
    readonly loading: boolean;
}

export default class JobsProgress extends PureComponent<JobsProgressProps, JobsProgressState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    private refreshTimer?: NodeJS.Timeout;

    constructor(props: JobsProgressProps) {
        super(props);
        this.state = {
            jobsByApp: new Map(),
            apps: new Map(),
            loading: true
        };
    }

    componentDidMount = async () => {
        await this.fetchJobs();
        this.startRefreshTimer();
    };

    componentWillUnmount = () => {
        this.stopRefreshTimer();
    };

    startRefreshTimer = () => {
        const interval = this.props.refreshInterval ?? 5000;
        this.refreshTimer = setInterval(() => {
            this.fetchJobs();
        }, interval);
    };

    stopRefreshTimer = () => {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    };

    fetchJobs = async () => {
        try {
            const { filezClient } = this.context!;
            const response = await filezClient.api.listJobs({
                from_index: 0,
                limit: 100
            });

            const jobs = response.data?.data?.jobs || [];
            const jobsByApp = this.groupJobsByApp(jobs);

            // Fetch app names for all unique app IDs
            const appIds = Array.from(jobsByApp.keys());
            if (appIds.length > 0) {
                await this.fetchAppNames(appIds);
            }

            this.setState({ jobsByApp, loading: false });
        } catch (error) {
            console.error(`Failed to fetch jobs:`, error);
            this.setState({ loading: false });
        }
    };

    fetchAppNames = async (appIds: MowsAppId[]) => {
        try {
            const { filezClient } = this.context!;
            const response = await filezClient.api.getApps({ app_ids: appIds });

            const apps = response.data?.data?.apps || {};
            const appsMap = new Map<MowsAppId, MowsApp>(
                Object.entries(apps).map(([id, app]) => [id as MowsAppId, app])
            );

            this.setState({ apps: appsMap });
        } catch (error) {
            console.error(`Failed to fetch app names:`, error);
        }
    };

    groupJobsByApp = (jobs: FilezJob[]): Map<MowsAppId, AppJobProgress> => {
        const grouped = new Map<MowsAppId, AppJobProgress>();

        for (const job of jobs) {
            const appId = job.app_id;
            const existing = grouped.get(appId) || {
                appId,
                totalJobs: 0,
                completedJobs: 0,
                failedJobs: 0,
                cancelledJobs: 0,
                inProgressJobs: 0,
                createdJobs: 0
            };

            const updated: AppJobProgress = {
                ...existing,
                totalJobs: existing.totalJobs + 1,
                completedJobs: existing.completedJobs + (job.status === `Completed` ? 1 : 0),
                failedJobs: existing.failedJobs + (job.status === `Failed` ? 1 : 0),
                cancelledJobs: existing.cancelledJobs + (job.status === `Cancelled` ? 1 : 0),
                inProgressJobs: existing.inProgressJobs + (job.status === `InProgress` ? 1 : 0),
                createdJobs: existing.createdJobs + (job.status === `Created` ? 1 : 0)
            };

            grouped.set(appId, updated);
        }

        return grouped;
    };

    calculateProgress = (progress: AppJobProgress): number => {
        if (progress.totalJobs === 0) return 0;
        return Math.round(
            ((progress.completedJobs + progress.failedJobs + progress.cancelledJobs) /
                progress.totalJobs) *
                100
        );
    };

    hasActiveJobs = (progress: AppJobProgress): boolean => {
        return progress.inProgressJobs > 0 || progress.createdJobs > 0;
    };

    render = () => {
        const { t } = this.context!;
        const { jobsByApp, apps, loading } = this.state;

        if (loading) {
            return null;
        }

        const entries = Array.from(jobsByApp.values());
        const visibleEntries = this.props.showOnlyRunning
            ? entries.filter((app) => this.hasActiveJobs(app))
            : entries;

        if (visibleEntries.length === 0) {
            return null;
        }

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(
                    `JobsProgress bg-background border-border flex flex-col gap-2 rounded-lg border p-3 shadow-sm`,
                    this.props.className
                )}
            >
                <div className={`text-muted-foreground text-xs font-medium`}>
                    {t.jobsProgress.title}
                </div>
                {visibleEntries.map((appProgress) => {
                    const progressValue = this.calculateProgress(appProgress);
                    const hasActive = this.hasActiveJobs(appProgress);
                    const appName = apps.get(appProgress.appId)?.name || appProgress.appId;

                    return (
                        <div key={appProgress.appId} className={`flex flex-col gap-1`}>
                            <div className={`flex items-center justify-between text-xs`}>
                                <span className={`text-foreground truncate font-medium`}>
                                    {appName}
                                </span>
                                <span className={`text-muted-foreground ml-2 shrink-0 text-xs`}>
                                    {appProgress.completedJobs + appProgress.failedJobs + appProgress.cancelledJobs}/{appProgress.totalJobs}
                                </span>
                            </div>
                            <Progress
                                value={progressValue}
                                className={cn(`h-1.5`, hasActive && `animate-pulse`)}
                            />
                            <div className={`text-muted-foreground flex gap-2 text-xs`}>
                                {appProgress.inProgressJobs > 0 && (
                                    <span className={`text-blue-500`}>
                                        {t.jobsProgress.inProgress}: {appProgress.inProgressJobs}
                                    </span>
                                )}
                                {appProgress.createdJobs > 0 && (
                                    <span className={`text-yellow-500`}>
                                        {t.jobsProgress.created}: {appProgress.createdJobs}
                                    </span>
                                )}
                                {appProgress.failedJobs > 0 && (
                                    <span className={`text-red-500`}>
                                        {t.jobsProgress.failed}: {appProgress.failedJobs}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };
}
