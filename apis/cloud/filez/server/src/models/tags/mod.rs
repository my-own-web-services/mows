pub mod errors;

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    Selectable,
};
use uuid::Uuid;

use crate::utils::get_uuid;

#[derive(Queryable, Selectable, Clone, Insertable, Debug, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::tags)]
pub struct Tag {
    pub id: Uuid,
    pub key: String,
    pub value: String,
}

impl Tag {
    pub fn new(key: &str, value: &str) -> Self {
        Self {
            id: get_uuid(),
            key: key.to_string(),
            value: value.to_string(),
        }
    }
}
