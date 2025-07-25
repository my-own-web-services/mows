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
        tag_members::{TagMember, TagResourceType},
        users::FilezUser,
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/tags/get",
    request_body = GetTagsRequestBody,
    responses(
        (status = 200, description = "Got the tags for the specified resources", body = ApiResponse<GetTagsResponseBody>),
        (status = 500, description = "Internal server error", body = ApiResponse<GetTagsResponseBody>),
    )
)]
pub async fn get_tags(
    external_user: IntrospectedUser,
    request_headers: HeaderMap,
    State(ServerState { db, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<GetTagsRequestBody>,
) -> Result<Json<ApiResponse<GetTagsResponseBody>>, FilezError> {
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
            &db,
            &requesting_user,
            &requesting_app.id,
            requesting_app.trusted,
            access_policy_type,
            Some(&request_body.resource_ids),
            AccessPolicyAction::TagsGet,
        )
        .await?
        .verify()?,
        "Database operation to check access control",
        timing
    );

    let resource_tags = with_timing!(
        TagMember::get_tags(&db, &request_body.resource_ids, request_body.resource_type).await?,
        "Database operation to get tags",
        timing
    );

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Tags retrieved successfully".to_string(),
        data: Some(GetTagsResponseBody { resource_tags }),
    }))
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct GetTagsRequestBody {
    pub resource_type: TagResourceType,
    pub resource_ids: Vec<Uuid>,
}

#[derive(Deserialize, Serialize, ToSchema)]
pub struct GetTagsResponseBody {
    pub resource_tags: HashMap<Uuid, HashMap<String, String>>,
}
