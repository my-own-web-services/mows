use std::collections::HashMap;

use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        files::FilezFile,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/files/meta/get",
    request_body = GetFilesMetaRequestBody,
    responses(
        (status = 200, description = "Gets the metadata for any number of files", body = ApiResponse<GetFileMetaResBody>),
    )
)]
pub async fn get_files_metadata(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<GetFilesMetaRequestBody>,
) -> Result<Json<ApiResponse<GetFileMetaResBody>>, FilezError> {
    let requesting_user = with_timing!(
        db.get_user_by_external_id(&external_user.user_id).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        MowsApp::get_from_headers(&db, &request_headers).await?,
        "Database operation to get app from headers",
        timing
    );

    with_timing!(
        db.check_resources_access_control(
            &requesting_user.id,
            &requesting_app.id,
            requesting_app.trusted,
            &serde_variant::to_variant_name(&AccessPolicyResourceType::File).unwrap(),
            &req_body.file_ids,
            &serde_variant::to_variant_name(&AccessPolicyAction::FilesMetaGet).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let files_meta_result = with_timing!(
        db.get_files_metadata(&req_body.file_ids).await?,
        "Database operation to get files metadata",
        timing
    );

    let file_tags = with_timing!(
        db.get_files_tags(&req_body.file_ids).await?,
        "Database operation to get files tags",
        timing
    );

    let mut files_meta: HashMap<Uuid, FileMeta> = HashMap::new();

    for requested_file_id in &req_body.file_ids {
        let file_meta = files_meta_result
            .get(requested_file_id)
            .cloned()
            .map(|file| {
                let tags = file_tags
                    .get(requested_file_id)
                    .cloned()
                    .unwrap_or_default();
                FileMeta { file, tags }
            });

        if let Some(meta) = file_meta {
            files_meta.insert(*requested_file_id, meta);
        } else {
            return Err(FilezError::GenericError(anyhow::anyhow!(
                "File with ID {} not found or access denied",
                requested_file_id
            )));
        }
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Got Files metadata".to_string(),
        data: Some(GetFileMetaResBody { files_meta }),
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFilesMetaRequestBody {
    pub file_ids: Vec<Uuid>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct GetFileMetaResBody {
    pub files_meta: HashMap<Uuid, FileMeta>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct FileMeta {
    pub file: FilezFile,
    pub tags: HashMap<String, String>,
}
