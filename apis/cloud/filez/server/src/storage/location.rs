use diesel_as_jsonb::AsJsonb;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, AsJsonb)]
pub struct FileStorage {
    /// app_id -> provider_id
    pub locations: HashMap<String, String>,
}
