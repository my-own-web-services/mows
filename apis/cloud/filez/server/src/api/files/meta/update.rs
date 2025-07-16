use std::collections::HashMap;

use axum::{extract::State, http::HeaderMap, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use zitadel::axum::introspection::IntrospectedUser;

use crate::{
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        apps::MowsApp,
        files::FilezFile,
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    put,
    path = "/api/files/meta/update",
    request_body = UpdateFilesMetaRequestBody,
    responses(
        (status = 200, description = "Updates the metadata for any number of files", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_files_metadata(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateFilesMetaRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
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
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            AccessPolicyResourceType::File,
            Some(&request_body.file_ids),
            AccessPolicyAction::FilezFilesMetaUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    match request_body.files_meta {
        UpdateFilesMetaType::Tags(tags_meta) => {
            with_timing!(
                FilezFile::update_tags(
                    &db,
                    &request_body.file_ids,
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
