use std::str::FromStr;

use crate::{
    errors::FilezError,
    http_api::authentication_middleware::AuthenticatedUserAndApp,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::{FileMetadata, FilezFile},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::validate_file_name,
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/files/update",
    request_body = UpdateFileRequestBody,
    description = "Update a file entry in the database",
    responses(
        (status = 200, description = "Updated a file on the server", body = ApiResponse<UpdateFileResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_file(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::File,
            Some(&vec![request_body.file_id]),
            AccessPolicyAction::FilezFilesUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let mut file = with_timing!(
        FilezFile::get_by_id(&database, request_body.file_id).await?,
        "Database operation to get file by ID",
        timing
    );

    if let Some(file_name) = &request_body.file_name {
        validate_file_name(file_name)?;
        file.name = file_name.clone();
    };

    if let Some(metadata) = &request_body.metadata {
        file.metadata = metadata.clone();
    };

    if let Some(mime_type) = &request_body.mime_type {
        let parsed_mime_type = mime_guess::Mime::from_str(mime_type)?;
        file.mime_type = parsed_mime_type.to_string();
    };

    let db_updated_file = with_timing!(
        file.update(&database).await?,
        "Database operation to update file",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Updated File".to_string(),
            data: Some(UpdateFileResponseBody {
                file: db_updated_file,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileRequestBody {
    pub file_id: Uuid,
    pub file_name: Option<String>,
    pub metadata: Option<FileMetadata>,
    pub mime_type: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileResponseBody {
    pub file: FilezFile,
}
