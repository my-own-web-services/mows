use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::api::files::create::CreateFileRequestBody;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "filez-server", description = "MOWS Filez API"),
    ),
    components(
        schemas(
            CreateFileRequestBody,
        )
    ),
)]
pub struct ApiDoc;

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum SortOrder {
    Ascending,
    Descending,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ApiResponse<T> {
    pub message: String,
    pub status: ApiResponseStatus,
    pub data: Option<T>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct EmptyApiResponse;

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum ApiResponseStatus {
    Success,
    Error,
}
