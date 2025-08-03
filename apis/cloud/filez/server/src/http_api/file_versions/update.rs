use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{FileVersion, FileVersionIdentifier, FileVersionMetadata},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[utoipa::path(
    post,
    path = "/api/file_versions/update",
    request_body = UpdateFileVersionsRequestBody,
    description = "Update file versions in the database",
    responses(
        (status = 200, description = "Updated file versions on the server", body = ApiResponse<UpdateFileVersionsResponseBody>),
        (status = 400, description = "Bad Request", body = ApiResponse<EmptyApiResponse>),
        (status = 401, description = "Unauthorized", body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Forbidden", body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "Not Found", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal Server Error", body = ApiResponse<EmptyApiResponse>)
    )
)]
pub async fn update_file_versions(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFileVersionsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let file_ids: Vec<Uuid> = request_body
        .versions
        .iter()
        .map(|v| v.identifier.file_id)
        .collect();

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

    let updated_versions = with_timing!(
        FileVersion::update_many(&database, &request_body.versions).await?,
        "Database operation to update file versions",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Updated File Versions".to_string(),
            data: Some(UpdateFileVersionsResponseBody {
                versions: updated_versions,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileVersionsRequestBody {
    pub versions: Vec<UpdateFileVersion>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileVersionsResponseBody {
    pub versions: Vec<FileVersion>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFileVersion {
    pub identifier: FileVersionIdentifier,
    pub new_metadata: Option<FileVersionMetadata>,
    #[schema(max_length = 64, min_length = 64, pattern = "^[a-f0-9]{64}$")]
    pub new_content_expected_sha256_digest: Option<String>,
}
