use pektin_common::{
    deadpool_redis::Pool,
    proto::rr::{Name, RecordType},
    DbEntry,
};
use serde::{Deserialize, Serialize};

use crate::macros::impl_from_request_body;

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RecordIdentifier {
    pub name: Name,
    pub rr_type: RecordType,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum RequestBody {
    Get { records: Vec<RecordIdentifier> },
    GetZoneRecords { names: Vec<Name> },
    Set { records: Vec<DbEntry> },
    Delete { records: Vec<RecordIdentifier> },
    Search { globs: Vec<Glob> },
    Health,
}

#[derive(Deserialize, Debug, Clone)]
pub struct GetRequestBody {
    pub client_username: String,
    pub confidant_password: String,
    pub records: Vec<RecordIdentifier>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct GetZoneRecordsRequestBody {
    pub client_username: String,
    pub confidant_password: String,
    pub names: Vec<Name>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct SetRequestBody {
    pub client_username: String,
    pub confidant_password: String,
    pub records: Vec<DbEntry>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct DeleteRequestBody {
    pub client_username: String,
    pub confidant_password: String,
    pub records: Vec<RecordIdentifier>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Glob {
    pub name_glob: String,
    pub rr_type_glob: String,
}
#[derive(Deserialize, Debug, Clone)]
pub struct SearchRequestBody {
    pub client_username: String,
    pub confidant_password: String,
    pub globs: Vec<Glob>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct HealthRequestBody {
    pub client_username: String,
    pub confidant_password: String,
}

#[derive(Clone)]
pub struct AppState {
    pub db_pool: Pool,
    pub db_pool_dnssec: Pool,
    pub vault_uri: String,
    pub ribston_uri: String,
    pub vault_password: String,
    pub vault_user_name: String,
    pub skip_auth: String,
}

impl_from_request_body!(GetRequestBody, Get, records);
impl_from_request_body!(GetZoneRecordsRequestBody, GetZoneRecords, names);
impl_from_request_body!(SetRequestBody, Set, records);
impl_from_request_body!(DeleteRequestBody, Delete, records);
impl_from_request_body!(SearchRequestBody, Search, globs);
impl_from_request_body!(HealthRequestBody, Health);

pub struct RequestInfo {
    pub api_method: String,
    pub ip: Option<String>,
    pub utc_millis: u128,
    pub user_agent: String,
}

#[derive(Debug)]
pub struct AuthAnswer {
    pub success: bool,
    pub message: String,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq)]
pub enum ResponseType {
    #[serde(rename = "success")]
    Success,
    #[serde(rename = "partial-success")]
    PartialSuccess,
    #[serde(rename = "ignored")]
    Ignored,
    #[serde(rename = "error")]
    Error,
}
