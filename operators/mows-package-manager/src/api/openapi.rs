//! Route registration and OpenAPI doc for the mows-package-manager HTTP API.
//!
//! Extracted from `src/bin/server.rs` so that the same `OpenApiRouter`
//! graph drives both the live server and the build-time OpenAPI dump
//! (`src/bin/openapi_dump.rs`). Layers / middleware do not contribute to
//! the OpenAPI document.

use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

#[derive(utoipa::OpenApi)]
#[openapi(
    tags(
        (name = "mows-package-manager", description = "MOWS Package Manager API"),
    )
)]
pub struct ApiDoc;

pub fn build_api_router() -> OpenApiRouter {
    OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(crate::api::health::get_health))
        .routes(routes!(crate::api::repository::render_repositories))
}
