use std::collections::HashMap;

use crate::{
    errors::FilezError,
    http_api::authentication_middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::FilezFile,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/files/get",
    description = "Get files from the server",
    responses(
        (status = 200, description = "Got files from the server", body = ApiResponse<GetFilesResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_files(
    Extension(AuthenticationInformation {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetFilesRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
                AccessPolicy::check(
            &database,
            requesting_user.as_ref(),
            &requesting_app,
            AccessPolicyResourceType::File,
            Some(&request_body.file_ids),
            AccessPolicyAction::FilezFilesGet,
        )
        .await?
        .verify()?,
        "Checking access policy for user and app",
        timing
    );

    let files = with_timing!(
        FilezFile::get_many_by_id(&database, &request_body.file_ids).await?,
        "Database operation to get file by ID",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Got Files".to_string(),
            data: Some(GetFilesResponseBody { files }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFilesRequestBody {
    pub file_ids: Vec<Uuid>,
}
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFilesResponseBody {
    pub files: HashMap<Uuid, FilezFile>,
}
