import { CSSProperties, PureComponent, createRef } from "react";

import { FilezJob, JobStatus, ListJobsSortBy, SortDirection } from "filez-client-typescript";

import { ActionIds } from "@/lib/defaultActions";
import { ActionHandler, ActionVisibility } from "@/lib/filezContext/ActionManager";
import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import DateTime from "../atoms/dateTime/DateTime";
import ResourceList from "./ResourceList/ResourceList";
import {
    ListResourceRequestBody,
    ListResourceResponseBody,
    ResourceListHandlers,
    ResourceListRowHandlers
} from "./ResourceList/ResourceListTypes";
import ColumnListRowHandler, { Column } from "./ResourceList/rowHandlers/Column";

interface JobListProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly displayTopBar?: boolean;
    readonly displaySortingBar?: boolean;
    readonly initialListType?: string;
    readonly resourceListRowHandlers?: ResourceListRowHandlers<FilezJob>;
    readonly resourceListHandlers?: ResourceListHandlers<FilezJob>;
    readonly handlers?: JobListHandlers;
}

export interface JobListHandlers {
    onChange?: () => void;
}

interface JobListState {
    readonly selectedJobs: FilezJob[];
}

export default class JobList extends PureComponent<JobListProps, JobListState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    resourceListRef = createRef<ResourceList<FilezJob>>();

    listId: string;
    listActionScopeId: string;

    actionHandler: ActionHandler;

    defaultColumns: Column<FilezJob>[] = [
        {
            field: `Name`,
            label: `Name`,
            direction: SortDirection.Neutral,
            widthPercent: 30,
            minWidthPixels: 50,
            enabled: true,
            render: (item: FilezJob, style: CSSProperties, className: string) => {
                return (
                    <span style={{ ...style }} className={className}>
                        {item.name}
                    </span>
                );
            }
        },
        {
            field: `Status`,
            label: `Status`,
            direction: SortDirection.Neutral,
            widthPercent: 15,
            minWidthPixels: 50,
            enabled: true,
            render: (item: FilezJob, style: CSSProperties, className: string) => {
                const statusColor = (() => {
                    switch (item.status) {
                        case JobStatus.Completed:
                            return `text-green-500`;
                        case JobStatus.Failed:
                            return `text-red-500`;
                        case JobStatus.InProgress:
                            return `text-blue-500`;
                        case JobStatus.Created:
                            return `text-yellow-500`;
                        case JobStatus.Cancelled:
                            return `text-gray-500`;
                        default:
                            return ``;
                    }
                })();

                return (
                    <span style={{ ...style }} className={cn(className, statusColor)}>
                        {item.status}
                    </span>
                );
            }
        },
        {
            field: `AppId`,
            label: `App`,
            direction: SortDirection.Neutral,
            widthPercent: 20,
            minWidthPixels: 50,
            enabled: true,
            render: (item: FilezJob, style: CSSProperties, className: string) => {
                return (
                    <span style={{ ...style }} className={className}>
                        {item.app_id}
                    </span>
                );
            }
        },
        {
            field: `CreatedTime`,
            label: `Created`,
            direction: SortDirection.Ascending,
            widthPercent: 20,
            minWidthPixels: 50,
            enabled: true,
            render: (item: FilezJob, style: CSSProperties, className: string) => {
                return (
                    <span style={{ ...style }} className={className}>
                        <DateTime utcTime dateTimeNaive={item.created_time} />
                    </span>
                );
            }
        },
        {
            field: `ModifiedTime`,
            label: `Modified`,
            direction: SortDirection.Neutral,
            widthPercent: 15,
            minWidthPixels: 50,
            enabled: true,
            render: (item: FilezJob, style: CSSProperties, className: string) => {
                return (
                    <span style={{ ...style }} className={className}>
                        <DateTime utcTime dateTimeNaive={item.modified_time} />
                    </span>
                );
            }
        }
    ];

    constructor(props: JobListProps) {
        super(props);
        this.state = {
            selectedJobs: []
        };

        this.listId = Math.random().toString(36).substring(2, 15);
        this.listActionScopeId = `JobList-${this.listId}`;

        this.actionHandler = {
            executeAction: async () => {
                const selectedItems = this.resourceListRef.current?.getSelectedItems() || [];
                if (selectedItems.length === 0) {
                    log.debug(`No jobs selected, cannot delete`);
                    return;
                }
                log.debug(`Delete jobs action triggered for jobs:`, selectedItems);
                for (const job of selectedItems) {
                    log.info(`Deleting job: ${job.name} (${job.id})`);
                    await this.context?.filezClient.api.deleteJob(job.id);
                    this.resourceListRef.current?.refreshList();
                }
            },
            id: this.listId,
            scopes: [this.listActionScopeId],
            getState: () => {
                const selectedItems = this.resourceListRef.current?.getSelectedItems() || [];
                if (selectedItems.length === 0) {
                    return {
                        visibility: ActionVisibility.Hidden,
                        disabledReasonText: `No jobs selected`
                    };
                }
                const { t } = this.context!;
                return {
                    visibility: ActionVisibility.Shown,
                    component: () => <span>{t.common.jobs.delete(selectedItems.length)}</span>
                };
            }
        };
    }

    componentDidMount = async () => {
        log.debug(`JobList mounted:`, this.props);
        this.registerActionHandler();
    };

    componentDidUpdate = (_prevProps: JobListProps) => {
        log.debug(`JobList props updated:`, this.props);
        this.registerActionHandler();
    };

    registerActionHandler = () => {
        if (this.context?.actionManager?.registerActionHandler) {
            this.context?.actionManager?.registerActionHandler(
                ActionIds.DELETE_JOBS,
                this.actionHandler
            );
        }
    };

    componentWillUnmount = () => {
        this.context?.actionManager?.unregisterActionHandler(
            ActionIds.DELETE_JOBS,
            this.actionHandler.id
        );
    };

    getJobsList = async (
        request: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<FilezJob>> => {
        if (!this.context?.filezClient) {
            log.warn(`No filezClient available`);
            return { totalCount: 0, items: [] };
        }

        if (!this.context?.clientAuthenticated) {
            log.warn(`Client not authenticated`);
            return { totalCount: 0, items: [] };
        }

        const res = await this.context.filezClient.api.listJobs({
            from_index: request.fromIndex,
            limit: request.limit,
            sort_by: request.sortBy as ListJobsSortBy,
            sort_order: request.sortDirection
        });

        if (res.status === 200 && res.data.data) {
            const result = { totalCount: res.data.data.total_count, items: res.data.data.jobs };
            return result;
        }

        log.warn(`API response not successful or no data`);
        return { totalCount: 0, items: [] };
    };

    render = () => {
        if (!this.context?.clientAuthenticated) {
            return <></>;
        }

        return (
            <div
                data-actionscope={this.listActionScopeId}
                className={cn(`JobList`, this.props.className)}
                style={{ ...this.props.style }}
            >
                <ResourceList<FilezJob>
                    ref={this.resourceListRef}
                    resourceType={`Job`}
                    defaultSortBy={`CreatedTime`}
                    defaultSortDirection={SortDirection.Ascending}
                    initialRowHandler={`ColumnListRowHandler`}
                    getResourcesList={this.getJobsList}
                    listInstanceId={this.listId}
                    rowHandlers={[
                        new ColumnListRowHandler({
                            columns: this.defaultColumns
                        })
                    ]}
                    displayListHeader={this.props.displayTopBar}
                    displayDebugBar={true}
                    handlers={{
                        ...this.props.resourceListHandlers
                    }}
                />
            </div>
        );
    };
}
