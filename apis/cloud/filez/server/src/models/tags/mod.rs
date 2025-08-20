use crate::impl_typed_uuid;
use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable, QueryableByName},
    Selectable,
};

impl_typed_uuid!(TagId);

#[derive(Queryable, Selectable, Clone, Insertable, Debug, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::tags)]
pub struct FilezTag {
    pub id: TagId,
    pub key: String,
    pub value: String,
}

impl FilezTag {
    pub fn new(key: &str, value: &str) -> Self {
        Self {
            id: TagId::new(),
            key: key.to_string(),
            value: value.to_string(),
        }
    }
}
