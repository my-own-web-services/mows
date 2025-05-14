use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

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
