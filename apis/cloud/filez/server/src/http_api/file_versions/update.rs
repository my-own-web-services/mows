use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{FileVersion, FileVersionId, UpdateFileVersionChangeset},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/file_versions/update",
    request_body = UpdateFileVersionsRequestBody,
    description = "Updates a file version in the database",
    responses(
        (
            status = 200,
            description = "Updated the file version on the server",
            body = ApiResponse<UpdateFileVersionsResponseBody>
        ),
        (
            status = 400,
            description = "Bad Request",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 401,
            description = "Unauthorized",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 403,
            description = "Forbidden",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 404,
            description = "Not Found",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal Server Error",
            body = ApiResponse<EmptyApiResponse>
        )
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_file_version(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileVersionsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let file_versions = with_timing!(
        FileVersion::get_many_by_file_version_id(&database, &vec![request_body.file_version_id])
            .await?,
        "Database operation to get file versions",
        timing
    );

    let file_ids: Vec<Uuid> = file_versions.iter().map(|v| v.file_id.into()).collect();

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&file_ids),
            AccessPolicyAction::FilezFilesVersionsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let updated_file_version = with_timing!(
        FileVersion::update_one(
            &database,
            &request_body.file_version_id,
            &request_body.changeset,
        )
        .await?,
        "Database operation to update file versions",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Updated File Versions".to_string(),
            data: Some(UpdateFileVersionsResponseBody {
                updated_file_version,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileVersionsRequestBody {
    pub file_version_id: FileVersionId,
    pub changeset: UpdateFileVersionChangeset,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileVersionsResponseBody {
    pub updated_file_version: FileVersion,
}
