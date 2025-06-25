use diesel_as_jsonb::AsJsonb;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, AsJsonb)]
pub struct StorageLocation {
    /// app_id -> provider_id
    pub locations: HashMap<Uuid, Uuid>,
}

impl StorageLocation {
    pub fn default() -> Self {
        let mut locations = HashMap::new();
        locations.insert(Uuid::default(), Uuid::default());

        Self { locations }
    }
}
