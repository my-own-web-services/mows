use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        file_versions::{FileVersion, FileVersionIdentifier},
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
    path = "/api/file_versions/get",
    request_body = GetFileVersionsRequestBody,
    description = "Get file versions from the server",
    responses(
        (status = 200, description = "Got file versions from the server", body = ApiResponse<GetFileVersionsResponseBody>),
        (status = 400, description = "Bad Request", body = ApiResponse<EmptyApiResponse>),
        (status = 401, description = "Unauthorized", body = ApiResponse<EmptyApiResponse>),
        (status = 403, description = "Forbidden", body = ApiResponse<EmptyApiResponse>),
        (status = 404, description = "Not Found", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal Server Error", body = ApiResponse<EmptyApiResponse>)
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_file_versions(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetFileVersionsRequestBody>,
) -> Result<impl IntoResponse, FilezError> {
    let file_ids: Vec<Uuid> = request_body
        .versions
        .iter()
        .map(|v| v.file_id.into())
        .collect();

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

    let file_versions = with_timing!(
        FileVersion::get_many(&database, &request_body.versions).await?,
        "Database operation to get file versions",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success {},
            message: "Got File Versions".to_string(),
            data: Some(GetFileVersionsResponseBody {
                versions: file_versions,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetFileVersionsRequestBody {
    pub versions: Vec<FileVersionIdentifier>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct GetFileVersionsResponseBody {
    pub versions: Vec<FileVersion>,
}
