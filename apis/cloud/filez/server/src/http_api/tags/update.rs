use std::collections::HashMap;

use crate::validation::Json;
use axum::{extract::State, Extension};
use serde::{Deserialize, Serialize};
use serde_valid::Validate;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    errors::FilezError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{AccessPolicy, AccessPolicyAction},
        tag_members::{TagMember, TagResourceType},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/tags/update",
    description = "Update the tags for the specified resources, resources must be of the same type per query. The same operation is applied to all resources in the list.",
    request_body = UpdateTagsRequestBody,
    responses(
        (
            status = 200,
            description = "Updated the tags",
            body = ApiResponse<EmptyApiResponse>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn update_tags(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<UpdateTagsRequestBody>,
) -> Result<Json<ApiResponse<EmptyApiResponse>>, FilezError> {
    with_timing!(
        AccessPolicy::check(
            &database,
            &authentication_information,
            request_body
                .tag_resource_type
                .to_access_policy_resource_type(),
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
            &authentication_information
                .requesting_user
                .unwrap()
                .id
                .into(),
            &request_body.resource_ids,
            request_body.tag_resource_type,
            request_body.update_tags
        )
        .await?,
        "Database operation to update tags",
        timing
    );
    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Tags updated successfully".to_string(),
        data: None,
    }))
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct UpdateTagsRequestBody {
    pub tag_resource_type: TagResourceType,
    pub resource_ids: Vec<Uuid>,
    pub update_tags: UpdateTagsMethod,
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub enum UpdateTagsMethod {
    Add(HashMap<String, String>),
    Remove(HashMap<String, String>),
    Set(HashMap<String, String>),
    Clear,
}
