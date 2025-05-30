use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::db::Db;

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

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub user: zitadel::axum::introspection::IntrospectionState,
}
