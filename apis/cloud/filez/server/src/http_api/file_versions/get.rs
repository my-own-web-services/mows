use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{FileVersion, FileVersionId},
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
    path = "/api/file_versions/get",
    request_body = GetFileVersionsRequestBody,
    description = "Get file versions from the server",
    responses(
        (
            status = 200,
            description = "Got file versions from the server",
            body = ApiResponse<GetFileVersionsResponseBody>
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
pub async fn get_file_versions(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetFileVersionsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let file_versions = with_timing!(
        FileVersion::get_many_by_file_version_id(&database, &request_body.file_version_ids).await?,
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
            AccessPolicyAction::FilezFilesVersionsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Got File Versions".to_string(),
            data: Some(GetFileVersionsResponseBody {
                file_versions: file_versions,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetFileVersionsRequestBody {
    pub file_version_ids: Vec<FileVersionId>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct GetFileVersionsResponseBody {
    pub file_versions: Vec<FileVersion>,
}
