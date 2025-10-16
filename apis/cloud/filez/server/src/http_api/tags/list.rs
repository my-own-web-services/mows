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
        tag_members::{TagMember, TagResourceType},
    },
    state::ServerState,
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse, SortDirection},
    with_timing,
};

#[utoipa::path(
    post,
    path = "/api/tags/list",
    description = "List tags across resources with pagination and filtering",
    request_body = ListTagsRequestBody,
    responses(
        (
            status = 200,
            description = "Tags listed successfully",
            body = ApiResponse<ListTagsResponseBody>
        ),
        (
            status = 500,
            description = "Internal server error",
            body = ApiResponse<EmptyApiResponse>
        ),
    )
)]
#[tracing::instrument(skip(database, timing), level = "trace")]
pub async fn list_tags(
    Extension(authentication_information): Extension<AuthenticationInformation>,
    State(ServerState { database, .. }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    Json(request_body): Json<ListTagsRequestBody>,
) -> Result<Json<ApiResponse<ListTagsResponseBody>>, FilezError> {
    let (tags, total_count) = with_timing!(
        TagMember::list_tags_with_access(
            &database,
            authentication_information.requesting_user.as_ref(),
            &authentication_information.requesting_app,
            request_body.search.as_ref(),
            request_body.resource_type.unwrap_or(TagResourceType::File),
            request_body.from_index,
            request_body.limit,
            request_body.sort_by,
            request_body.sort_order,
        )
        .await?,
        "Database operation to list tags",
        timing
    );

    let _list_results = ListTagsResponseBody {
        tags,
        total_count,
    };

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success {},
        message: "Tags listed successfully".to_string(),
        data: Some(_list_results),
    }))
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct ListTagsRequestBody {
    pub search: Option<ListTagsSearch>,
    pub resource_type: Option<TagResourceType>,
    pub from_index: Option<u64>,
    pub limit: Option<u64>,
    pub sort_by: Option<ListTagsSortBy>,
    pub sort_order: Option<SortDirection>,
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct ListTagsSearch {
    pub plain_string: Option<String>,
    pub tag_key: Option<String>,
    pub tag_value: Option<String>,
    pub search_context: Option<ListTagsSearchContext>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct ListTagsSearchContext {
    /// The resource IDs that are currently selected in the UI, this could be used in the future to prioritize tags that are already in use by similar resources
    pub resource_ids: Vec<Uuid>,
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct ListTagsResponseBody {
    pub tags: Vec<ListTagResult>,
    pub total_count: u64,
}

#[derive(Deserialize, Serialize, ToSchema, Debug, Validate)]
pub struct ListTagResult {
    pub tag_key: String,
    pub tag_value: String,
    pub resource_type: TagResourceType,
    pub usage_count: u64,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub enum ListTagsSortBy {
    TagKey,
    TagValue,
    UsageCount,
    CreatedTime,
    ModifiedTime,
}
