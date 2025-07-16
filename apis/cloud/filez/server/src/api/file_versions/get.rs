use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_versions::{FileVersion, FileVersionsQuery},
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
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
    path = "/api/file_versions/get",
    request_body = GetFileVersionsRequestBody,
    description = "Get file versions from the server",
    responses(
        (status = 200, description = "Got file versions from the server", body = ApiResponse<GetFileVersionsResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn get_file_versions(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetFileVersionsRequestBody>,
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

    let file_ids: Vec<Uuid> = request_body.versions.iter().map(|v| v.file_id).collect();

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
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
        FileVersion::get_many(&db, &request_body.versions).await?,
        "Database operation to get file versions",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Got File Versions".to_string(),
            data: Some(GetFileVersionsResponseBody {
                versions: file_versions,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFileVersionsRequestBody {
    pub versions: Vec<FileVersionsQuery>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFileVersionsResponseBody {
    pub versions: Vec<FileVersion>,
}
