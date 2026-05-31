use utoipa_axum::{router::OpenApiRouter, routes};

use crate::{
    http_api::{audit_log, by_resource, explain, health, upstreams},
    state::AppState,
    types::AuthzAdminApiDoc,
};

pub fn build_api_router() -> OpenApiRouter<AppState> {
    OpenApiRouter::with_openapi(<AuthzAdminApiDoc as utoipa::OpenApi>::openapi())
        .routes(routes!(health::health))
        .routes(routes!(upstreams::list_upstreams))
        .routes(routes!(explain::forward_explain))
        .routes(routes!(by_resource::forward_by_resource))
        .routes(routes!(audit_log::forward_audit_log))
}
