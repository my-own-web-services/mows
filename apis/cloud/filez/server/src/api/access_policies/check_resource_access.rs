use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{check::AuthEvaluation, AccessPolicy},
        apps::MowsApp,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/access_policies/check",
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
    Json(request_body): Json<CheckResourceAccessRequestBody>,
) -> Result<Json<ApiResponse<CheckResourceAccessResponseBody>>, FilezError> {
    let requesting_user = with_timing!(
        FilezUser::get_from_external(&db, &external_user, &request_headers).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    let auth_result = with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &request_body.resource_type,
            request_body.resource_ids.as_deref(),
            &request_body.action,
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
    pub resource_ids: Option<Vec<Uuid>>,
    pub resource_type: String,
    pub action: String,
    pub requesting_app_origin: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CheckResourceAccessResponseBody {
    pub auth_evaluations: Vec<AuthEvaluation>,
}
