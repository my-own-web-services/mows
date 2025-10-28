use crate::validation::Json;
use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        files::FilezFile,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::validate_optional_mime_type,
    with_timing,
};
use anyhow::Context;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension};
use chrono::NaiveDateTime;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use std::str::FromStr;
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/files/create",
    request_body = CreateFileRequestBody,
    description = "Create a new file entry in the database",
    responses(
        (
            status = 200,
            description = "Created a file on the server",
            body = ApiResponse<CreateFileResponseBody>
        ),
        (
            status = 500,
            description = "Internal Server Error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_file(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateFileRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            None,
            AccessPolicyAction::FilezFilesCreate,
        )
        .await?
        .verify_allow_type_level()?,
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

    let db_created_file = with_timing!(
        FilezFile::create_one(
            &database,
            &authentication_information.requesting_user.unwrap(),
            &mime_type,
            &request_body.file_name,
        )
        .await
        .context("Failed to create file in the database")?,
        "Database operation to create a new file",
        timing
    );

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Created File".to_string(),
            data: Some(CreateFileResponseBody {
                created_file: db_created_file,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateFileRequestBody {
    #[validate(custom = validate_optional_mime_type)]
    pub mime_type: Option<String>,
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    pub file_name: String,
    pub time_created: Option<NaiveDateTime>,
    pub time_modified: Option<NaiveDateTime>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct CreateFileResponseBody {
    pub created_file: FilezFile,
}
