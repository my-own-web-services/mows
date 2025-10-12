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
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/tags/get",
    description = "Get the tags for the specified resources, resources must be of the same type per query.",
    request_body = GetTagsRequestBody,
    responses(
        (
            status = 200,
            description = "Got the tags for the specified resources",
            body = ApiResponse<GetTagsResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<GetTagsResponseBody>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn get_tags(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetTagsRequestBody>,
) -> Result<Json<ApiResponse<GetTagsResponseBody>>, FilezError> {
    with_timing!(
        // If a user is allowed to get a resource, they are allowed to get its tags
        AccessPolicy::check(
            &database,
            &authentication_information,
            request_body
                .tag_resource_type
                .to_access_policy_resource_type(),
            Some(&request_body.resource_ids),
            request_body.tag_resource_type.to_access_policy_get_action()
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let resource_tags = with_timing!(
        TagMember::get_tags(
            &database,
            &request_body.resource_ids,
            request_body.tag_resource_type
        )
        .await?,
        "Database operation to get tags",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Tags retrieved successfully".to_string(),
        data: Some(GetTagsResponseBody { resource_tags }),
    }))
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct GetTagsRequestBody {
    pub tag_resource_type: TagResourceType,
    pub resource_ids: Vec<Uuid>,
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct GetTagsResponseBody {
    pub resource_tags: HashMap<Uuid, HashMap<String, String>>,
}
