//! Wire-shape response envelopes shared by every chat HTTP handler.
//!
//! Matches `filez-server`'s envelope exactly so a future
//! `mows-service-core` extraction can hoist both into one place.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "chat", description = "MOWS Chat API"),
    ),
    info(
        title = env!("CARGO_PKG_NAME"),
        description = "Realtime chat service — second consumer of mows-auth-core",
        version = env!("CARGO_PKG_VERSION"),
    ),
    components(
        schemas(
            EmptyApiResponse,
            ApiResponseStatus,
        ),
    ),
)]
pub struct ChatApiDoc;

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
