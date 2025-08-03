use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/apps/list",
    request_body = ListAppsRequestBody,
    description = "List apps from the server",
    responses(
        (status = 200, description = "Listed apps from the server", body = ApiResponse<ListAppsResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn list_apps(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(_request_body): Json<ListAppsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::App,
            None,
            AccessPolicyAction::FilezAppsList,
        )
        .await?
        .verify()?,
        "Checking access policy for user and app",
        timing
    );

    let apps = with_timing!(
        MowsApp::list(&database).await?,
        "Database operation to list apps",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Listed Apps".to_string(),
            data: Some(ListAppsResponseBody { apps }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListAppsRequestBody {}
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct ListAppsResponseBody {
    pub apps: Vec<MowsApp>,
}
