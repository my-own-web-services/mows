use crate::{
    auth_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::FilezFile,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    validation::validate_file_name,
    with_timing,
};
use anyhow::Context;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use chrono::NaiveDateTime;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/files/create",
    request_body = CreateFileRequestBody,
    description = "Create a new file entry in the database",
    responses(
        (status = 200, description = "Created a file on the server", body = ApiResponse<CreateFileResponseBody>),
    )
)]
pub async fn create_file(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateFileRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::File,
            None,
            AccessPolicyAction::FilezFilesCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let mime_type = match request_body.mime_type {
        Some(mime) => Mime::from_str(&mime)?,
        None => mime_guess::from_path(&request_body.file_name)
            .first()
            .ok_or(FilezError::ParseError(
                "Failed to determine MIME type from file name".to_string(),
            ))?,
    };

    validate_file_name(&request_body.file_name)?;

    // Create a new file entry in the database
    let new_file = FilezFile::new(&requesting_user, &mime_type, &request_body.file_name);

    let db_created_file = with_timing!(
        new_file
            .create(&database)
            .await
            .context("Failed to create file in the database")?,
        "Database operation to create a new file",
        timing
    );

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Created File".to_string(),
            data: Some(CreateFileResponseBody {
                created_file: db_created_file,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileRequestBody {
    pub mime_type: Option<String>,
    pub file_name: String,
    pub time_created: Option<NaiveDateTime>,
    pub time_modified: Option<NaiveDateTime>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileResponseBody {
    pub created_file: FilezFile,
}
