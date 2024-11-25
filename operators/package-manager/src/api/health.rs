pub mod health {
    use axum::Json;
    use serde::{Deserialize, Serialize};
    use utoipa::ToSchema;
    use utoipa_axum::{router::OpenApiRouter, routes};

    use crate::types::{ApiResponse, ApiResponseStatus};

    pub fn router() -> OpenApiRouter {
        OpenApiRouter::new().routes(routes!(get_health))
    }

    #[utoipa::path(
        get,
        path = "",
        responses(
            (status = 200, description = "Got health", body = ApiResponse<HealthResBody>),
        )
    )]
    async fn get_health() -> Json<ApiResponse<HealthResBody>> {
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Package Manager is healthy".to_string(),
            data: Some(HealthResBody {}),
        })
    }

    #[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
    pub struct HealthResBody {}
}
