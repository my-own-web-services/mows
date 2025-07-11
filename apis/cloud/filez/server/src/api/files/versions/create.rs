use crate::{
    errors::FilezError,
    models::{
        apps::MowsApp,
        file_versions::{FileVersion, FileVersionMetadata},
        files::FilezFile,
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
use bigdecimal::BigDecimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/files/versions/create",
    request_body = CreateFileVersionRequestBody,
    description = "Create a new file version entry in the database",
    responses(
        (status = 201, description = "Created a file version on the server", body = ApiResponse<CreateFileVersionResponseBody> ),
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

    let file = with_timing!(
        FilezFile::get_by_id(&db, request_body.file_id).await?,
        "Database operation to get file by ID",
        timing
    );

    if file.owner_id != requesting_user.id {
        return Err(FilezError::Unauthorized(
            "You are not the owner of this file".to_string(),
        ));
    }

    let db_created_file_version = with_timing!(
        FileVersion::create(
            &db,
            request_body.file_id,
            Some(requesting_app.id),
            request_body.app_path,
            request_body.metadata,
            request_body.size,
            request_body.storage_id,
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
                version: db_created_file_version.version,
            }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileVersionRequestBody {
    pub file_id: Uuid,
    pub app_path: Option<String>,
    pub metadata: FileVersionMetadata,
    #[schema(value_type=i64)]
    pub size: BigDecimal,
    pub storage_id: Uuid,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct CreateFileVersionResponseBody {
    pub version: i32,
}
