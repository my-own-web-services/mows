//! Channel messages — append-only log per channel.

use diesel::{pg::Pg, prelude::*, Selectable};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    database::Database, errors::ChatError, impl_typed_uuid,
    models::{channels::ChannelId, users::FilezUserId},
    schema,
    utils::get_current_timestamp,
};

impl_typed_uuid!(ChannelMessageId);

#[derive(Serialize, Deserialize, Queryable, Selectable, Insertable, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::channel_messages)]
#[diesel(check_for_backend(Pg))]
pub struct ChannelMessage {
    pub id: ChannelMessageId,
    pub channel_id: ChannelId,
    pub author_id: FilezUserId,
    pub body: String,
    pub sent_at: chrono::NaiveDateTime,
}

impl ChannelMessage {
    pub fn new(channel_id: ChannelId, author_id: FilezUserId, body: impl Into<String>) -> Self {
        Self {
            id: ChannelMessageId::new(),
            channel_id,
            author_id,
            body: body.into(),
            sent_at: get_current_timestamp(),
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn insert(self, database: &Database) -> Result<ChannelMessage, ChatError> {
        let mut connection = database.get_connection().await?;
        let created = diesel::insert_into(schema::channel_messages::table)
            .values(&self)
            .returning(ChannelMessage::as_select())
            .get_result::<ChannelMessage>(&mut connection)
            .await?;
        Ok(created)
    }

    /// Most-recent-first page of messages in `channel_id`. Returns
    /// at most `limit` rows. Keyset cursor (filez Phase-3 style) is
    /// follow-up work; v1 uses LIMIT/OFFSET via the secondary index.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_recent(
        database: &Database,
        channel_id: ChannelId,
        limit: i64,
    ) -> Result<Vec<ChannelMessage>, ChatError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::channel_messages::table
            .filter(schema::channel_messages::channel_id.eq(channel_id))
            .order_by(schema::channel_messages::sent_at.desc())
            .then_order_by(schema::channel_messages::id.desc())
            .limit(limit)
            .select(ChannelMessage::as_select())
            .load::<ChannelMessage>(&mut connection)
            .await?;
        Ok(rows)
    }
}
