use crate::{
    errors::FilezError,
    models::File,
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    validation::validate_file_name,
    with_timing,
};
use anyhow::Context;
use axum::{
    extract::{Request, State},
    http::HeaderMap,
    Extension, Json,
};
use chrono::NaiveDateTime;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use utoipa::ToSchema;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/files/create",
    request_body(content_type = "application/octet-stream"),
    responses(
        (status = 200, description = "Created a file on the server", body = ApiResponse<CreateFileResponseBody>),
    )
)]
pub async fn create_file(
    external_user: IntrospectedUser,
    headers: HeaderMap,
    State(ServerState {
        db,
        storage_locations,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    request: Request,
) -> Result<Json<ApiResponse<CreateFileResponseBody>>, FilezError> {
    let requesting_user = with_timing!(
        db.get_user_by_external_id(&external_user.user_id).await?,
        "Database operation to get user by external ID",
        timing
    );

    let file_size = headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .ok_or_else(|| {
            FilezError::ParseError("Missing or invalid content-length header".to_string())
        })?;

    let meta_body: CreateFileRequestBody =
        serde_json::from_str(&headers.get("x-filez-metadata").unwrap().to_str().unwrap())
            .context("Failed to parse x-filez-metadata header")?;

    let mime_type =
        match meta_body.mime_type {
            Some(mime) => Mime::from_str(&mime)?,
            None => mime_guess::from_path(&meta_body.file_name).first().ok_or(
                FilezError::ParseError("Failed to determine MIME type from file name".to_string()),
            )?,
        };

    validate_file_name(&meta_body.file_name)
        .await
        .map_err(|e| FilezError::ParseError(format!("Invalid file name: {}", e)))?;

    // Check if the file size is within the allowed limits
    let user_used_storage = with_timing!(
        db.get_user_used_storage(&requesting_user.id).await?,
        "Database operation to get user used storage",
        timing
    );

    if &user_used_storage + file_size > requesting_user.storage_limit {
        return Err(FilezError::GenericError(anyhow::anyhow!(
            "User storage limit exceeded: {} bytes used, {} bytes limit",
            user_used_storage,
            requesting_user.storage_limit
        )));
    }

    // Create a new file entry in the database
    let new_file = File::new(
        &requesting_user,
        &mime_type,
        &meta_body.file_name,
        file_size,
        meta_body.sha256_digest.clone(),
    );

    let db_created_file = with_timing!(
        db.create_file(&new_file)
            .await
            .context("Failed to create file in the database")?,
        "Database operation to create a new file",
        timing
    );

    match db_created_file
        .create_file(storage_locations, request, timing, meta_body.sha256_digest)
        .await
    {
        Ok(_) => Ok(Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Created File".to_string(),
            data: Some(CreateFileResponseBody {
                file_id: db_created_file.id.to_string(),
            }),
        })),
        Err(e) => Ok(Json(ApiResponse {
            status: ApiResponseStatus::Error,
            message: format!("Failed to create file content: {}", e),
            data: Some(CreateFileResponseBody {
                file_id: db_created_file.id.to_string(),
            }),
        })),
    }
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileRequestBody {
    pub mime_type: Option<String>,
    pub file_name: String,
    pub time_created: Option<NaiveDateTime>,
    pub time_modified: Option<NaiveDateTime>,
    pub sha256_digest: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileResponseBody {
    pub file_id: String,
}
