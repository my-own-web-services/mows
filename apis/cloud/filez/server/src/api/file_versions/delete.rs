use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        file_versions::{FileVersion, FileVersionsQuery},
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
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
    path = "/api/file_versions/delete",
    request_body = DeleteFileVersionsRequestBody,
    description = "Delete file versions in the database",
    responses(
        (status = 200, description = "Deleted file versions on the server", body = ApiResponse<DeleteFileVersionsResponseBody>),
    )
)]
pub async fn delete_file_versions(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState {
        db,
        storage_location_providers,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<DeleteFileVersionsRequestBody>,
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
            AccessPolicyAction::FilezFilesVersionsDelete,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    FileVersion::delete_many(
        &storage_location_providers,
        &db,
        &request_body.versions,
        &timing,
    )
    .await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Deleted File Versions".to_string(),
            data: Some(DeleteFileVersionsResponseBody {
                versions: request_body.versions,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct DeleteFileVersionsRequestBody {
    pub versions: Vec<FileVersionsQuery>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct DeleteFileVersionsResponseBody {
    pub versions: Vec<FileVersionsQuery>,
}
