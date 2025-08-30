use std::collections::HashMap;

use crate::validation::Json;
use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::{MowsApp, MowsAppId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/apps/get",
    request_body = GetAppsRequestBody,
    description = "Get apps from the server",
    responses(
        (
            status = 200,
            description = "Got apps from the server",
            body = ApiResponse<GetAppsResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_apps(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetAppsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::MowsApp,
            Some(
                &request_body
                    .app_ids
                    .clone()
                    .into_iter()
                    .map(|id| id.into())
                    .collect::<Vec<_>>()
            ),
            AccessPolicyAction::FilezAppsGet,
        )
        .await?
        .verify()?,
        "Checking access policy for user and app",
        timing
    );

    let apps = with_timing!(
        MowsApp::get_many_by_id(&database, &request_body.app_ids).await?,
        "Database operation to get app by ID",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Got Apps".to_string(),
            data: Some(GetAppsResponseBody { apps }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetAppsRequestBody {
    pub app_ids: Vec<MowsAppId>,
}
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetAppsResponseBody {
    pub apps: HashMap<MowsAppId, MowsApp>,
}
