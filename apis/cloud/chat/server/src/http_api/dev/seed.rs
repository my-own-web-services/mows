//! `POST /api/dev/seed` — idempotent fixture loader for the chat MVP.
//!
//! Creates two well-known users (Alice, Bob) and returns their
//! UUIDs so a client can hand them straight to the X-Chat-User-Id
//! header. Returns 503 if `config.enable_dev = false`.

use axum::{extract::State, Json};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use mows_common_rust::get_current_config_cloned;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    config::config,
    errors::ChatError,
    models::users::{ChatUser, ChatUserId},
    schema,
    state::AppState,
    types::{ApiResponse, ApiResponseStatus},
    utils::get_current_timestamp,
};

const ALICE_ID: Uuid = Uuid::from_u128(0xa11ce000_0000_0000_0000_000000000001_u128);
const BOB_ID: Uuid = Uuid::from_u128(0xb0b00000_0000_0000_0000_000000000001_u128);
const ZITADEL_IDP_ID: Uuid =
    Uuid::from_u128(0x7a17ade1_0000_0000_0000_000000000001_u128);

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct DevSeedResponse {
    pub alice_id: Uuid,
    pub bob_id: Uuid,
}

#[utoipa::path(
    post,
    path = "/api/dev/seed",
    description = "Dev only: ensure the Alice + Bob test users exist. Returns their UUIDs.",
    responses(
        (status = 200, description = "Seeded", body = ApiResponse<DevSeedResponse>),
        (status = 503, description = "Dev mode disabled", body = ApiResponse<DevSeedResponse>)
    )
)]
pub async fn dev_seed(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<DevSeedResponse>>, ChatError> {
    let config = get_current_config_cloned!(config());
    if !config.enable_dev {
        return Err(ChatError::Forbidden(
            "dev endpoints disabled (set ENABLE_DEV=true to enable)".to_string(),
        ));
    }

    let mut connection = state.database.get_connection().await?;
    for (id, name) in [(ALICE_ID, "Alice"), (BOB_ID, "Bob")] {
        let exists: Option<ChatUser> = schema::users::table
            .filter(schema::users::id.eq(ChatUserId(id)))
            .select(ChatUser::as_select())
            .first::<ChatUser>(&mut connection)
            .await
            .optional()?;
        if exists.is_some() {
            continue;
        }
        let now = get_current_timestamp();
        let user = ChatUser {
            id: ChatUserId(id),
            external_user_id: None,
            display_name: name.to_string(),
            created_time: now,
            modified_time: now,
            deleted: false,
            user_type: 0,
            idp_id: ZITADEL_IDP_ID,
        };
        diesel::insert_into(schema::users::table)
            .values(&user)
            .execute(&mut connection)
            .await?;
    }

    Ok(Json(ApiResponse {
        status: ApiResponseStatus::Success,
        message: "Alice + Bob ready".to_string(),
        data: Some(DevSeedResponse {
            alice_id: ALICE_ID,
            bob_id: BOB_ID,
        }),
    }))
}
