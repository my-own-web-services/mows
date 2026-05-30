//! Channel events — append-only log per channel.
//!
//! Each row carries an opaque JSONB `payload` plus an optional
//! `event_kind` tag. The realtime API doesn't interpret either
//! field; the channel is a pub/sub primitive that consumers
//! layer use cases onto:
//!
//!   * chat messages: `event_kind = "chat.message"`,
//!     `payload = {"body": "hi"}`
//!   * WebRTC signaling: `event_kind = "webrtc.offer"`,
//!     `payload = <SDP/ICE>`
//!   * presence pings, build events, sensor readings, …

use diesel::{pg::Pg, prelude::*, Selectable};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use utoipa::ToSchema;

use crate::{
    database::Database, errors::RealtimeError, impl_typed_uuid,
    models::{channels::ChannelId, users::UserId},
    schema,
    utils::get_current_timestamp,
};

impl_typed_uuid!(ChannelEventId);

#[derive(Serialize, Deserialize, Queryable, Selectable, Insertable, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::channel_events)]
#[diesel(check_for_backend(Pg))]
pub struct ChannelEvent {
    pub id: ChannelEventId,
    pub channel_id: ChannelId,
    pub author_id: UserId,
    /// Optional caller-supplied tag (`"chat.message"`,
    /// `"webrtc.offer"`, …). When `Some`, consumers can filter
    /// the event stream by tag without parsing payload.
    pub event_kind: Option<String>,
    /// Opaque JSON payload. The realtime API stores + replays it
    /// verbatim; the consuming app defines its shape.
    #[schema(value_type = serde_json::Value)]
    pub payload: JsonValue,
    pub sent_at: chrono::NaiveDateTime,
}

impl ChannelEvent {
    pub fn new(
        channel_id: ChannelId,
        author_id: UserId,
        event_kind: Option<String>,
        payload: JsonValue,
    ) -> Self {
        Self {
            id: ChannelEventId::new(),
            channel_id,
            author_id,
            event_kind,
            payload,
            sent_at: get_current_timestamp(),
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn insert(self, database: &Database) -> Result<ChannelEvent, RealtimeError> {
        let mut connection = database.get_connection().await?;
        let created = diesel::insert_into(schema::channel_events::table)
            .values(&self)
            .returning(ChannelEvent::as_select())
            .get_result::<ChannelEvent>(&mut connection)
            .await?;
        Ok(created)
    }

    /// Most-recent-first page of events in `channel_id`. When
    /// `event_kind_filter` is `Some`, only events with a matching
    /// tag are returned — the partial index on
    /// `(channel_id, event_kind, sent_at)` keeps that path cheap.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_recent(
        database: &Database,
        channel_id: ChannelId,
        event_kind_filter: Option<&str>,
        limit: i64,
    ) -> Result<Vec<ChannelEvent>, RealtimeError> {
        let mut connection = database.get_connection().await?;
        let base = schema::channel_events::table
            .filter(schema::channel_events::channel_id.eq(channel_id))
            .order_by(schema::channel_events::sent_at.desc())
            .then_order_by(schema::channel_events::id.desc())
            .limit(limit);
        let rows = match event_kind_filter {
            Some(kind) => {
                base.filter(schema::channel_events::event_kind.eq(kind))
                    .select(ChannelEvent::as_select())
                    .load::<ChannelEvent>(&mut connection)
                    .await?
            }
            None => {
                base.select(ChannelEvent::as_select())
                    .load::<ChannelEvent>(&mut connection)
                    .await?
            }
        };
        Ok(rows)
    }
}
