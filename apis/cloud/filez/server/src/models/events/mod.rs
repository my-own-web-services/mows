use diesel::{
    deserialize::FromSqlRow,
    expression::AsExpression,
    pg::Pg,
    prelude::{Insertable, Queryable, *},
    sql_types::SmallInt,
    Selectable,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use tracing::error;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    database::Database,
    impl_typed_uuid,
    models::{apps::MowsAppId, users::FilezUserId},
    schema,
    utils::{get_current_timestamp, InvalidEnumType},
};

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    DbEnum,
    Serialize,
    Deserialize,
    ToSchema,
    AsExpression,
    FromSqlRow,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum FilezEventActionType {
    FileCreated = 0,
    FileUpdated = 1,
    FileDeleted = 2,
}

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    DbEnum,
    Serialize,
    Deserialize,
    ToSchema,
    AsExpression,
    FromSqlRow,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum FilezEventResourceType {
    File = 0,
    FileGroup = 1,
    User = 2,
    UserGroup = 3,
    Tag = 4,
    AccessPolicy = 5,
    StorageLocation = 6,
    StorageQuota = 7,
    KeyAccess = 8,
    App = 9,
    Job = 10,
    FileVersion = 11,
}

#[derive(Clone, Debug, Serialize, Deserialize, ToSchema, AsJsonb)]
pub enum EventResult {
    Ok,
    Error { code: String, message: String },
}

impl_typed_uuid!(FilezEventId);

#[derive(
    Queryable,
    Selectable,
    Clone,
    Insertable,
    Debug,
    QueryableByName,
    Serialize,
    Deserialize,
    ToSchema,
)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = schema::events)]
pub struct FilezEvent {
    pub id: FilezEventId,
    pub created_time: chrono::NaiveDateTime,
    pub event_type: FilezEventActionType,
    pub user_id: Option<FilezUserId>,
    pub resource_ids: Option<Vec<Uuid>>,
    pub resource_type: Option<FilezEventResourceType>,
    pub app_id: Option<MowsAppId>,
    pub result: Option<EventResult>,
}

impl FilezEvent {
    #[tracing::instrument(level = "trace")]
    pub fn new(
        event_type: FilezEventActionType,
        user_id: Option<FilezUserId>,
        resource_ids: Option<Vec<Uuid>>,
        resource_type: Option<FilezEventResourceType>,
        app_id: Option<MowsAppId>,
        result: Option<EventResult>,
    ) -> Self {
        Self {
            id: FilezEventId::new(),
            created_time: get_current_timestamp(),
            event_type,
            user_id,
            resource_ids,
            resource_type,
            app_id,
            result,
        }
    }

    /// The event is created in the background, so that no additional time is added to the request.
    /// If the creation fails the error is logged, but not returned to the user.
    #[tracing::instrument(skip(database), level = "trace")]
    pub async fn create_event(
        database: &Database,
        event_type: FilezEventActionType,
        user_id: Option<FilezUserId>,
        resource_ids: Option<Vec<Uuid>>,
        resource_type: Option<FilezEventResourceType>,
        app_id: Option<MowsAppId>,
        result: Option<EventResult>,
    ) -> Result<(), crate::errors::FilezError> {
        let event = Self::new(
            event_type,
            user_id,
            resource_ids,
            resource_type,
            app_id,
            result,
        );

        let connection = database.get_connection().await;

        tokio::spawn(async move {
            if let Ok(mut conn) = connection {
                diesel::insert_into(schema::events::table)
                    .values(&event)
                    .execute(&mut conn)
                    .await
                    .map_err(|e| {
                        error!("Failed to create event: {}", e);
                    })
                    .ok();
            } else {
                error!("Failed to get database connection for event creation");
            }
        });

        Ok(())
    }
}
