//! Shared axum state for realtime-server.

use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::{
    database::Database,
    errors::RealtimeError,
    models::{
        apps::{MowsApp, MowsAppId},
        users::UserId,
    },
    realtime::ChannelBroadcastRegistry,
    schema,
    utils::get_current_timestamp,
};

/// Deterministic UUID for the chat MowsApp row. Mnemonic prefix
/// `c4a7` (CHAT) so it's spottable in raw rows. Idempotently
/// bootstrapped at first boot; production deployments can
/// re-INSERT explicitly via the Picker flow if a second app needs
/// to act on chat resources.
pub const REALTIME_APP_ID: Uuid =
    Uuid::from_u128(0xc4a70000_0000_0000_0000_000000000001_u128);

/// Zitadel IdP sentinel (same uuid the engine + filez use).
const ZITADEL_IDP_ID: Uuid =
    Uuid::from_u128(0x7a17ade1_0000_0000_0000_000000000001_u128);

#[derive(Clone, Debug)]
pub struct AppState {
    pub database: Database,
    pub context_app: MowsApp,
    pub broadcast: ChannelBroadcastRegistry,
}

impl AppState {
    /// Build the runtime state. On first boot also inserts the
    /// chat MowsApp row if it doesn't exist — every
    /// access_policies row references `context_app_ids` so the
    /// app row has to exist before any policy can be created.
    pub async fn new(db_url: &str) -> Result<Self, RealtimeError> {
        let database = Database::new(db_url).await;
        let context_app = bootstrap_realtime_app(&database).await?;
        Ok(Self {
            database,
            context_app,
            broadcast: ChannelBroadcastRegistry::new(),
        })
    }
}

/// Ensure the chat MowsApp row exists; return it. Idempotent and
/// race-safe under horizontal scaling (review A7): we use
/// `INSERT ... ON CONFLICT DO NOTHING` so two instances starting
/// against the same DB don't race on a UNIQUE violation. The
/// follow-up SELECT covers the conflict-skipped path.
async fn bootstrap_realtime_app(database: &Database) -> Result<MowsApp, RealtimeError> {
    let mut connection = database.get_connection().await?;
    let now = get_current_timestamp();
    let app = MowsApp {
        id: MowsAppId(REALTIME_APP_ID),
        name: "chat".to_string(),
        description: Some("MOWS chat service".to_string()),
        origins: None,
        // `trusted = true` because the chat service IS the app —
        // every chat request originates from this single app row.
        // The trusted flag changes when a future round opens chat
        // up to third-party clients (separate app rows, untrusted
        // by default; the engine evaluates `app.trusted` plus the
        // explicit `context_app_ids` filter on each policy). For
        // chat v1 with one server-owned app row, trusted is the
        // honest setting.
        trusted: true,
        app_type: 0,
        created_time: now,
        modified_time: now,
        idp_id: ZITADEL_IDP_ID,
        external_client_id: None,
    };
    // Idempotent INSERT. `on_conflict(id).do_nothing()` skips
    // re-insertion if the row exists. We then SELECT
    // unconditionally — the row is guaranteed to exist after this
    // block whether we wrote it or someone else did.
    diesel::insert_into(schema::apps::table)
        .values(&app)
        .on_conflict(schema::apps::id)
        .do_nothing()
        .execute(&mut connection)
        .await?;
    schema::apps::table
        .filter(schema::apps::id.eq(MowsAppId(REALTIME_APP_ID)))
        .select(MowsApp::as_select())
        .first::<MowsApp>(&mut connection)
        .await
        .map_err(RealtimeError::from)
}

/// Convenience for handlers / tests that need a [`UserId`]
/// from a UUID.
pub fn user_id(uuid: Uuid) -> UserId {
    UserId(uuid)
}
