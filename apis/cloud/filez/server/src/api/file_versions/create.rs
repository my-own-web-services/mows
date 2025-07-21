use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_versions::{FileVersion, FileVersionMetadata},
        storage_quotas::StorageQuota,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    validation::validate_sha256_digest,
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
pub async fn create_file_version(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<CreateFileVersionRequestBody>,
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

    if let Some(expected_sha256_digest) = &request_body.content_expected_sha256_digest {
        validate_sha256_digest(&expected_sha256_digest)?;
    }

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::File,
            Some(&vec![request_body.file_id]),
            AccessPolicyAction::FilezFilesVersionsCreate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        StorageQuota::check_quota(
            &db,
            &requesting_user.id,
            &request_body.storage_quota_id,
            request_body.size.into()
        )
        .await?,
        "Database operation to check storage quota",
        timing
    );

    let db_created_file_version = with_timing!(
        FileVersion::create(
            &db,
            request_body.file_id,
            requesting_app.id,
            request_body.app_path,
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
            status: ApiResponseStatus::Success,
            message: "Created File Version".to_string(),
            data: Some(CreateFileVersionResponseBody {
                version: db_created_file_version,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileVersionRequestBody {
    pub file_id: Uuid,
    pub app_path: Option<String>,
    pub metadata: FileVersionMetadata,
    pub size: i64,
    pub storage_quota_id: Uuid,
    pub content_expected_sha256_digest: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileVersionResponseBody {
    pub version: FileVersion,
}
