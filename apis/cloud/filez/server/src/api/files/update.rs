use std::str::FromStr;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        files::{FileMetadata, FilezFile},
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    validation::validate_file_name,
    with_timing,
};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/files/update",
    request_body = UpdateFileRequestBody,
    description = "Update a file entry in the database",
    responses(
        (status = 200, description = "Updated a file on the server", body = ApiResponse<UpdateFileResponseBody>),
    )
)]
pub async fn update_file(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
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

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            Some(&vec![request_body.file_id]),
            &serde_variant::to_variant_name(&AccessPolicyAction::FilezFilesUpdate).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let mut file = with_timing!(
        FilezFile::get_by_id(&db, request_body.file_id).await?,
        "Database operation to get file by ID",
        timing
    );

    if let Some(file_name) = &request_body.file_name {
        validate_file_name(file_name)
            .await
            .map_err(|e| FilezError::ParseError(format!("Invalid file name: {}", e)))?;
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
        file.update(&db).await?,
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
