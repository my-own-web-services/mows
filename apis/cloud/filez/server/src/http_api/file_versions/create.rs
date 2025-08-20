use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{FileVersion, FileVersionMetadata},
        files::FilezFileId,
        storage_quotas::{StorageQuota, StorageQuotaId},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::validate_sha256_digest,
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/file_versions/create",
    request_body = CreateFileVersionRequestBody,
    description = "Create a new file version entry in the database",
    responses(
        (status = 201, description = "Created a file version on the server", body = ApiResponse<CreateFileVersionResponseBody>),
        (status = 400, description = "Bad Request", body = ApiResponse<EmptyApiResponse>),
        (status = 401, description = "Unauthorized", body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Forbidden", body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "Not Found", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal Server Error", body = ApiResponse<EmptyApiResponse>)
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn create_file_version(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateFileVersionRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    if let Some(expected_sha256_digest) = &request_body.content_expected_sha256_digest {
        validate_sha256_digest(&expected_sha256_digest)?;
    }

    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            AccessPolicyResourceType::File,
            Some(&vec![request_body.file_id.into()]),
            AccessPolicyAction::FilezFilesVersionsCreate,
        )
        .await?
        .verify_allow_type_level()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        StorageQuota::check_quota(
            &database,
            &authentication_information
                .requesting_user
                .unwrap()
                .id
                .into(),
            &request_body.storage_quota_id,
            request_body.size.into()
        )
        .await?,
        "Database operation to check storage quota",
        timing
    );

    let db_created_file_version = with_timing!(
        FileVersion::create(
            &database,
            request_body.file_id,
            request_body.version,
            authentication_information.requesting_app.id,
            request_body.app_path,
            request_body.mime_type,
            request_body.metadata,
            request_body.size.into(),
            request_body.storage_quota_id,
            request_body.content_expected_sha256_digest
        )
        .await?,
        "Database operation to create file version",
        timing
    );

    Ok((
        StatusCode::CREATED,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Created File Version".to_string(),
            data: Some(CreateFileVersionResponseBody {
                version: db_created_file_version,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct CreateFileVersionRequestBody {
    /// The ID of the file to create a version for.
    pub file_id: FilezFileId,
    pub version: Option<u32>,
    pub app_path: Option<String>,
    pub mime_type: String,
    pub metadata: FileVersionMetadata,
    pub size: u64,
    pub storage_quota_id: StorageQuotaId,
    /// Optional SHA256 digest of the file content as a lowercase hexadecimal string.
    /// Once the content is fully uploaded it automatically gets validated against this digest.
    /// After successful validation, the versions content_valid field is set to true.
    #[schema(max_length = 64, min_length = 64, pattern = "^[a-f0-9]{64}$")]
    pub content_expected_sha256_digest: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct CreateFileVersionResponseBody {
    pub version: FileVersion,
}
