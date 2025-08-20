use std::collections::HashMap;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::{FilezFile, FilezFileId},
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
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_files(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetFilesRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let file_ids: Vec<Uuid> = request_body
        .file_ids
        .clone()
        .into_iter()
        .map(|id| id.into())
        .collect();

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&file_ids),
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
            status: ApiResponseStatus::Success {},
            message: "Got Files".to_string(),
            data: Some(GetFilesResponseBody { files }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetFilesRequestBody {
    pub file_ids: Vec<FilezFileId>,
}
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetFilesResponseBody {
    pub files: HashMap<FilezFileId, FilezFile>,
}
