//! `utoipa-axum` router composition for chat-server.

use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{http_api::health, state::AppState, types::ChatApiDoc};

pub fn build_api_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::with_openapi(<ChatApiDoc as utoipa::OpenApi>::openapi())
        .routes(routes!(health::health))
}
