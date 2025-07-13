use std::collections::HashMap;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
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
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

#[utoipa::path(
    post,
    path = "/api/files/get",
    description = "Get files from the server",
    responses(
        (status = 200, description = "Got files from the server", body = ApiResponse<GetFilesResponseBody>),
    )
)]
pub async fn get_files(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetFilesRequestBody>,
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

    with_timing!(
        AccessPolicy::check(
            &db,
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            Some(&request_body.file_ids),
            &serde_variant::to_variant_name(&AccessPolicyAction::FilezFilesGet).unwrap(),
        )
        .await?
        .verify()?,
        "Checking access policy for user and app",
        timing
    );

    let files = with_timing!(
        FilezFile::get_many_by_id(&db, &request_body.file_ids).await?,
        "Database operation to get file by ID",
        timing
    );

    Ok((
        StatusCode::OK,
        Json(ApiResponse {
            status: ApiResponseStatus::Success,
            message: "Got Files".to_string(),
            data: Some(GetFilesResponseBody { files }),
        }),
    ))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFilesRequestBody {
    pub file_ids: Vec<Uuid>,
}
#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFilesResponseBody {
    pub files: HashMap<Uuid, FilezFile>,
}
