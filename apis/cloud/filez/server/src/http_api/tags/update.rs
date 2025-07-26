use std::collections::HashMap;

use axum::{extract::State, Extension, Json};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    http_api::authentication_middleware::AuthenticatedUserAndApp,
    errors::FilezError,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction, AccessPolicyResourceType},
        tag_members::{TagMember, TagResourceType},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/tags/update",
    request_body = UpdateTagsRequestBody,
    responses(
        (status = 200, description = "Updated the tags", body = ApiResponse<EmptyApiResponse>),
        (status = 500, description = "Internal server error", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn update_tags(
    Extension(AuthenticatedUserAndApp {
        requesting_user,
        requesting_app,
    }): Extension<AuthenticatedUserAndApp>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateTagsRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    let access_policy_type = match request_body.resource_type {
        TagResourceType::User => AccessPolicyResourceType::User,
        TagResourceType::UserGroup => AccessPolicyResourceType::UserGroup,
        TagResourceType::File => AccessPolicyResourceType::File,
        TagResourceType::FileGroup => AccessPolicyResourceType::FileGroup,
        TagResourceType::FileVersion => AccessPolicyResourceType::File,
        TagResourceType::StorageLocation => AccessPolicyResourceType::StorageLocation,
        TagResourceType::AccessPolicy => AccessPolicyResourceType::AccessPolicy,
        TagResourceType::StorageQuota => AccessPolicyResourceType::StorageQuota,
    };

    with_timing!(
        AccessPolicy::check(
            &database,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            access_policy_type,
            Some(&request_body.resource_ids),
            AccessPolicyAction::TagsUpdate,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    with_timing!(
        TagMember::update_tags(
            &database,
            &requesting_user.id,
            &request_body.resource_ids,
            request_body.resource_type,
            request_body.update_tags
        )
        .await?,
        "Database operation to update tags",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Tags updated successfully".to_string(),
        data: None,
    }))
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct UpdateTagsRequestBody {
    pub resource_type: TagResourceType,
    pub resource_ids: Vec<Uuid>,
    pub update_tags: UpdateTagsMethod,
}

#[derive(Deserialize, Serialize, ToSchema)]
pub enum UpdateTagsMethod {
    Add(HashMap<String, String>),
    Remove(HashMap<String, String>),
    Set(HashMap<String, String>),
    Clear,
}
