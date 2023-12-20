use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use ts_rs::TS;

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Job {
    #[serde(rename = "_id")]
    pub job_id: String,
    /**
     The id of the app that should handle the job
    */
    pub for_app_id: String,
    /**
     A key value store to give the app information about how the job should be performed
    */
    #[ts(type = "Record<string, any>")]
    pub app_info: HashMap<String, Value>,
    pub job_type: JobType,
    pub status: JobStatus,
    #[ts(type = "number")]
    pub created_time_millis: i64,
    #[ts(type = "number")]
    pub updated_time_millis: i64,
    #[ts(type = "number")]
    pub end_time_millis: Option<i64>,
    pub stages: Vec<JobStage>,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum JobType {
    FileJob(FileJob),
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct FileJob {
    pub file_id: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct JobStage {
    pub status: JobStatus,
    #[ts(type = "number")]
    pub started_time_millis: i64,
    #[ts(type = "number")]
    pub end_time_millis: Option<i64>,
    pub title: String,
    pub description: String,
}

#[derive(TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub enum JobStatus {
    Pending,
    Running,
    Done,
    Error,
    Rejected,
}
