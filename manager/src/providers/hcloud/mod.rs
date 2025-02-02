use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
pub mod machine;

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct ExternalProviderConfigHcloud {
    pub api_token: String,
}
