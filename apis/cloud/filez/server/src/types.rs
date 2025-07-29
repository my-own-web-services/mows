use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::models::files::FileMetadata;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "filez", description = "MOWS Filez API"),
    ),
    components(
        schemas(
            FileMetadata,
            EmptyApiResponse,
            SortDirection,
            ApiResponseStatus,
        ),
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
pub struct EmptyApiResponse {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum ApiResponseStatus {
    Success,
    Error(String),
}
