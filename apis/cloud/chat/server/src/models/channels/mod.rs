//! Channel + message models.

pub mod messages;

use diesel::{pg::Pg, prelude::*, Selectable};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    database::Database, errors::ChatError, impl_typed_uuid,
    models::users::ChatUserId, schema, utils::get_current_timestamp,
};

impl_typed_uuid!(ChannelId);

#[derive(Serialize, Deserialize, Queryable, Selectable, Insertable, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::channels)]
#[diesel(check_for_backend(Pg))]
pub struct Channel {
    pub id: ChannelId,
    pub owner_id: ChatUserId,
    pub name: String,
    pub topic: Option<String>,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl Channel {
    pub fn new(owner_id: ChatUserId, name: impl Into<String>, topic: Option<String>) -> Self {
        let now = get_current_timestamp();
        Self {
            id: ChannelId::new(),
            owner_id,
            name: name.into(),
            topic,
            created_time: now,
            modified_time: now,
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn insert(self, database: &Database) -> Result<Channel, ChatError> {
        let mut connection = database.get_connection().await?;
        let created = diesel::insert_into(schema::channels::table)
            .values(&self)
            .returning(Channel::as_select())
            .get_result::<Channel>(&mut connection)
            .await?;
        Ok(created)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_by_ids(
        database: &Database,
        ids: &[ChannelId],
    ) -> Result<Vec<Channel>, ChatError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::channels::table
            .filter(schema::channels::id.eq_any(ids))
            .select(Channel::as_select())
            .load::<Channel>(&mut connection)
            .await?;
        Ok(rows)
    }
}
