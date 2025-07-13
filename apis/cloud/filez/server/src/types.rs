use crate::{
    api::{
        access_policies::{
            create::CreateAccessPolicyRequestBody, list::ListAccessPoliciesRequestBody,
            update::UpdateAccessPolicyRequestBody,
        },
        file_groups::create::CreateFileGroupRequestBody,
        files::{
            create::{CreateFileRequestBody, CreateFileResponseBody},
            versions::create::{CreateFileVersionRequestBody, CreateFileVersionResponseBody},
        },
        storage_quotas::create::CreateStorageQuotaRequestBody,
        user_groups::create::CreateUserGroupRequestBody,
    },
    models::{
        access_policies::AccessPolicy, file_groups::FileGroup, storage_quotas::StorageQuota,
        user_groups::UserGroup, users::FilezUser,
    },
};
use serde::{Deserialize, Serialize};
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
pub struct ApiDoc;

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
    Error,
}
