use axum::{extract::State, Extension, Json};
use mows_auth_core::ResourceTypeRegistry;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    errors::RealtimeError,
    http_api::authentication::middleware::AuthenticationInformation,
    models::{
        access_policies::{
            check::{engine_resource_registry, subject_from_realtime},
            store::RealtimePolicyStore, AccessPolicyAction, AccessPolicyResourceType,
        },
        channels::{Channel, ChannelId},
    },
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
};

#[derive(Serialize, Deserialize, ToSchema, Debug)]
pub struct ListChannelsResponse {
    pub channels: Vec<Channel>,
}

#[utoipa::path(
    post,
    path = "/api/channels/list",
    description = "List every channel the caller has ChannelsList access to. Backed by mows_auth_core::list_visible_resource_ids.",
    responses(
        (status = 200, description = "Channels", body = ApiResponse<ListChannelsResponse>),
    )
)]
pub async fn list_channels(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthenticationInformation>,
) -> Result<Json<ApiResponse<ListChannelsResponse>>, RealtimeError> {
    let registry = engine_resource_registry();
    let resource_auth_info = registry
        .lookup(AccessPolicyResourceType::Channel as u32)
        .ok_or_else(|| {
            RealtimeError::AuthCoreError(mows_auth_core::AuthError::Evaluation(
                "Channel resource type missing from registry — bootstrap miswire?"
                    .to_string(),
            ))
        })?;
    let subject =
        subject_from_realtime(auth.requesting_user.as_ref(), &auth.requesting_user_groups);
    let app_view = mows_auth_core::AppView {
        id: auth.context_app.id.0,
        trusted: auth.context_app.trusted,
    };
    let store = RealtimePolicyStore::new(&state.database);

    let visible_ids = mows_auth_core::list_visible_resource_ids(
        &store,
        resource_auth_info,
        &subject,
        app_view,
        AccessPolicyAction::ChannelsList as u32,
    )
    .await?;

    let channel_ids: Vec<ChannelId> = visible_ids.into_iter().map(ChannelId).collect();
    let channels = if channel_ids.is_empty() {
        vec![]
    } else {
        Channel::get_by_ids(&state.database, &channel_ids).await?
    };

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: format!("{} channel(s)", channels.len()),
        data: Some(ListChannelsResponse { channels }),
    }))
}
