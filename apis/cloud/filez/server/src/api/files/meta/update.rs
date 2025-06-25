use std::collections::HashMap;

use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    apps::FilezApp,
    errors::FilezError,
    models::{AccessPolicyAction, AccessPolicyResourceType},
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/files/meta/update",
    request_body = UpdateFilesMetaRequestBody,
    responses(
        (status = 200, description = "Updates the metadata for any number of files", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_files_metadata(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(req_body): Json<UpdateFilesMetaRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    let requesting_user = with_timing!(
        db.get_user_by_external_id(&external_user.user_id).await?,
        "Database operation to get user by external ID",
        timing
    );

    let requesting_app = with_timing!(
        FilezApp::get_app_from_headers(&request_headers).await?,
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
            &serde_variant::to_variant_name(&AccessPolicyAction::FilesMetaUpdate).unwrap(),
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    match req_body.files_meta {
        UpdateFilesMetaType::Tags(tags_meta) => {
            with_timing!(
                db.update_files_tags(
                    &req_body.file_ids,
                    &tags_meta.tags,
                    &tags_meta.method,
                    &requesting_user.id,
                )
                .await?,
                "Database operation to update files tags",
                timing
            );
        }
    };

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Updated Files metadata".to_string(),
        data: None,
    }))
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFilesMetaRequestBody {
    pub file_ids: Vec<Uuid>,
    pub files_meta: UpdateFilesMetaType,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum UpdateFilesMetaType {
    Tags(UpdateFilesMetaTypeTags),
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub struct UpdateFilesMetaTypeTags {
    pub tags: HashMap<String, String>,
    pub method: UpdateFilesMetaTypeTagsMethod,
}

#[derive(Serialize, Deserialize, ToSchema, Clone)]
pub enum UpdateFilesMetaTypeTagsMethod {
    Add,
    Remove,
    Set,
}
