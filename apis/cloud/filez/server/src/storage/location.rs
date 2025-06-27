use diesel_as_jsonb::AsJsonb;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, AsJsonb)]
pub struct StorageLocation {
    /// app_id -> provider_id
    pub locations: HashMap<String, String>,
}

impl StorageLocation {
    pub fn default() -> Self {
        let mut locations = HashMap::new();
        locations.insert("app_default".to_string(), "default_provider".to_string());

        Self { locations }
    }
}
