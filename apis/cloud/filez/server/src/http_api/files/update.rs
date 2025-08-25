use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::{FilezFile, FilezFileId, UpdateFileChangeset},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/files/update",
    request_body = UpdateFileRequestBody,
    description = "Update a file entry in the database, NOT the content of the file itself.",
    responses(
        (
            status = 200,
            description = "Updated a file on the server",
            body = ApiResponse<UpdateFileResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_file(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&vec![request_body.file_id.into()]),
            AccessPolicyAction::FilezFilesUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let updated_file = with_timing!(
        FilezFile::update_one(&database, request_body.file_id, request_body.changeset).await?,
        "Database operation to update file",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Updated File".to_string(),
            data: Some(UpdateFileResponseBody { updated_file }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileRequestBody {
    pub file_id: FilezFileId,
    pub changeset: UpdateFileChangeset,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileResponseBody {
    pub updated_file: FilezFile,
}
