// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { JobStage } from "./JobStage";
import type { JobStatus } from "./JobStatus";
import type { JobType } from "./JobType";

export interface Job { _id: string, for_app_id: string, app_info: Record<string, any>, job_type: JobType, status: JobStatus, created_time_millis: number, updated_time_millis: number, end_time_millis: number, stages: Array<JobStage>, }