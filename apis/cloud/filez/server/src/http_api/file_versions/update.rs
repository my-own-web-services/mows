use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{
            FileVersion, FileVersionId, FileVersionQuadIdentifier, UpdateFileVersionChangeset,
        },
        storage_quotas::StorageQuota,
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
    State(ServerState {
        database,
        storage_location_providers,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileVersionsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    // Get the file version based on the selector
    let file_version = with_timing!(
        match &request_body.selector {
            UpdateFileVersionSelector::FileVersionId(id) => {
                FileVersion::get_by_id(&database, id).await?
            }
            UpdateFileVersionSelector::FileVersionQuadIdentifier(quad_id) => {
                FileVersion::get_one_by_identifier(
                    &database,
                    &quad_id.file_id,
                    Some(quad_id.file_revision_index),
                    &quad_id.app_id,
                    &Some(quad_id.app_path.clone()),
                )
                .await?
            }
        },
        "Database operation to get file version",
        timing
    );

    let file_ids: Vec<Uuid> = vec![file_version.file_id.into()];

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

    let existing_content_bytes = if let Some(new_file_version_content_size_bytes) =
        request_body.changeset.new_file_version_content_size_bytes
    {
        let additional_requested_bytes: i64 =
            new_file_version_content_size_bytes - file_version.content_size_bytes;

        if additional_requested_bytes > 0 {
            with_timing!(
                StorageQuota::check_quota(
                    &database,
                    &authentication_information
                        .requesting_user
                        .unwrap()
                        .id
                        .into(),
                    &file_version.storage_quota_id,
                    additional_requested_bytes.try_into()?
                )
                .await?,
                "Database operation to check storage quota for additional bytes",
                timing
            );
            None
        } else if additional_requested_bytes < 0 {
            file_version
                .truncate_content(
                    &storage_location_providers,
                    &database,
                    &timing,
                    new_file_version_content_size_bytes.try_into()?,
                )
                .await?;
            Some(new_file_version_content_size_bytes)
        } else {
            None
        }
    } else {
        None
    };

    let updated_file_version = with_timing!(
        FileVersion::update_one(
            &database,
            &file_version.id,
            &request_body.changeset,
            existing_content_bytes
        )
        .await?,
        "Database operation to update file version",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Updated File Version".to_string(),
            data: Some(UpdateFileVersionsResponseBody {
                updated_file_version,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileVersionsRequestBody {
    pub selector: UpdateFileVersionSelector,
    pub changeset: UpdateFileVersionChangeset,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub enum UpdateFileVersionSelector {
    FileVersionId(FileVersionId),
    FileVersionQuadIdentifier(FileVersionQuadIdentifier),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct UpdateFileVersionsResponseBody {
    pub updated_file_version: FileVersion,
}
