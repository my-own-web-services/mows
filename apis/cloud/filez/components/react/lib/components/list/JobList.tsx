import { CSSProperties, PureComponent, createRef } from "react";

import { FilezJob, JobStatus, ListJobsSortBy, SortDirection } from "filez-client-typescript";

import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
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

    defaultColumns: Column<FilezJob>[] = [
        {
            field: `Name`,
            label: `Name`,
            direction: SortDirection.Ascending,
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
            direction: SortDirection.Neutral,
            widthPercent: 20,
            minWidthPixels: 50,
            enabled: true,
            render: (item: FilezJob, style: CSSProperties, className: string) => {
                return (
                    <span style={{ ...style }} className={className}>
                        {new Date(item.created_time).toLocaleString()}
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
                        {new Date(item.modified_time).toLocaleString()}
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
    }

    componentDidMount = async () => {
        log.debug(`JobList mounted:`, this.props);
    };

    componentDidUpdate = (_prevProps: JobListProps) => {
        log.debug(`JobList props updated:`, this.props);
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

        const apiRequest = {
            from_index: request.fromIndex,
            limit: request.limit,
            sort: {
                SortOrder: {
                    sort_by: request.sortBy as ListJobsSortBy,
                    sort_order: request.sortDirection
                }
            }
        };

        const res = await this.context.filezClient.api.listJobs(apiRequest);

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
                    defaultSortDirection={SortDirection.Descending}
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
