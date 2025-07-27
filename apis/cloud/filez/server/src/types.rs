use crate::{
    http_api::{
        access_policies::{
            create::CreateAccessPolicyRequestBody, list::ListAccessPoliciesRequestBody,
            update::UpdateAccessPolicyRequestBody,
        },
        file_groups::create::CreateFileGroupRequestBody,
        file_versions::create::{CreateFileVersionRequestBody, CreateFileVersionResponseBody},
        files::create::{CreateFileRequestBody, CreateFileResponseBody},
        storage_quotas::create::CreateStorageQuotaRequestBody,
        user_groups::create::CreateUserGroupRequestBody,
    },
    models::{
        access_policies::AccessPolicy, file_groups::FileGroup, storage_quotas::StorageQuota,
        user_groups::UserGroup, users::FilezUser,
    },
};
use serde::{Deserialize, Serialize, Serializer};
use utoipa::ToSchema;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "filez-server", description = "MOWS Filez API"),
    ),
    components(
        schemas(
            // REQUESTS
            CreateFileRequestBody,
            CreateFileResponseBody,
            CreateFileVersionRequestBody,
            CreateFileVersionResponseBody,
            CreateFileGroupRequestBody,
            CreateUserGroupRequestBody,
            CreateAccessPolicyRequestBody,
            UpdateAccessPolicyRequestBody,
            ListAccessPoliciesRequestBody,
            CreateStorageQuotaRequestBody,
            // RESPONSES
            FileGroup,
            UserGroup,
            FilezUser,
            AccessPolicy,
            StorageQuota,

        )
    ),
)]
pub struct FilezApiDoc;

#[derive(Serialize, Deserialize, ToSchema, Clone, Eq, PartialEq, Debug)]
pub enum SortDirection {
    Ascending,
    Descending,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ApiResponse<T> {
    pub message: String,
    pub status: ApiResponseStatus,
    pub data: Option<T>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct EmptyApiResponse;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum ApiResponseStatus {
    Success,
    Error(String),
}
