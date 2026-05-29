//! Chat-side app projection. Same shape as filez's MowsApp
//! (post-migration-00005) so a future cross-service sync can
//! transfer rows without translation.

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{impl_typed_uuid, schema};

impl_typed_uuid!(MowsAppId);

#[derive(Serialize, Deserialize, Queryable, Selectable, Insertable, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::apps)]
#[diesel(check_for_backend(Pg))]
pub struct MowsApp {
    pub id: MowsAppId,
    pub name: String,
    pub description: Option<String>,
    pub origins: Option<Vec<String>>,
    pub trusted: bool,
    pub app_type: i16,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub idp_id: Uuid,
    pub external_client_id: Option<String>,
}
