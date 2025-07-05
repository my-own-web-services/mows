use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::api::files::{
    create::{CreateFileRequestBody, CreateFileResponseBody},
    versions::create::{CreateFileVersionRequestBody, CreateFileVersionResponseBody},
};

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "filez-server", description = "MOWS Filez API"),
    ),
    components(
        schemas(
            CreateFileRequestBody,
            CreateFileResponseBody,
            CreateFileVersionRequestBody,
            CreateFileVersionResponseBody,
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
