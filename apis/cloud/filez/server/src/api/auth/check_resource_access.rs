use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    auth::check::AuthEvaluation,
    errors::FilezError,
    models::apps::MowsApp,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
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
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<CheckResourceAccessRequestBody>,
) -> Result<Json<ApiResponse<CheckResourceAccessResponseBody>>, FilezError> {
    let requesting_user = with_timing!(
        db.get_user_by_external_id(&external_user.user_id).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

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
