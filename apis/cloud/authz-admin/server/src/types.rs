use serde::{Deserialize, Serialize};
use utoipa::{OpenApi, ToSchema};

/// Standard envelope shared across MOWS services. authz-admin uses
/// the same shape as realtime / filez so frontend code that lives
/// in `@my-own-web-services/react-components` can keep one parser.
#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ApiResponse<T> {
    pub status: ApiResponseStatus,
    pub message: String,
    pub data: Option<T>,
}

/// Matches realtime-server's wire shape: `Success` serialises to
/// the bare string `"Success"`; `Error("...")` serialises to
/// `{"Error": "..."}`. Keeping the shape identical means the
/// `@my-own-web-services/react-components` envelope parser
/// doesn't need a per-service branch.
#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub enum ApiResponseStatus {
    Success,
    Error(String),
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "authz-admin",
        description = "Cross-service authorization admin BFF (Phase 7). Aggregates `/api/access_policies/*` surfaces across consumer services (realtime, filez, ...) so a single operator UI can answer 'who can see what + why' without per-service tabs."
    ),
)]
pub struct AuthzAdminApiDoc;
