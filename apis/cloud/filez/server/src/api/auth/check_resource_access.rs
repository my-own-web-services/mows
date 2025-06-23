use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    auth::check::AuthEvaluation,
    errors::FilezErrors,
    types::{ApiResponse, ApiResponseStatus, AppState},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/auth/check",
    request_body = CheckResourceAccessRequestBody,
    responses(
        (status = 200, description = "Checks if the requested resources are available to this user", body = ApiResponse<CheckResourceAccessResponseBody>),
    )
)]
pub async fn check_resource_access(
    external_user: IntrospectedUser,
    headers: HeaderMap,
    State(AppState { db, .. }): State<AppState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<CheckResourceAccessRequestBody>,
) -> Result<Json<ApiResponse<CheckResourceAccessResponseBody>>, FilezErrors> {
    let requesting_user = with_timing!(
        db.get_user_by_external_id(&external_user.user_id).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = match req_body.requesting_app_origin {
        Some(origin) => with_timing!(
            db.get_app_by_origin(&origin).await?,
            "Database operation to get app by origin",
            timing
        ),
        None => with_timing!(
            db.get_app_from_headers(&headers).await?,
            "Database operation to get app by external ID",
            timing
        ),
    };

    let auth_result = with_timing!(
        db.check_resources_access_control(
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &req_body.resource_type,
            &req_body.resource_ids,
            &req_body.action,
        )
        .await?,
        "Database operation to check resources access control",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Auth results retrieved".to_string(),
        data: Some(CheckResourceAccessResponseBody {
            auth_evaluations: auth_result.evaluations,
        }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CheckResourceAccessRequestBody {
    pub resource_ids: Vec<Uuid>,
    pub resource_type: String,
    pub action: String,
    pub requesting_app_origin: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}
