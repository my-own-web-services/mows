use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PektinConfig {
    pub services: PCServices,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PCServices {
    pub zertificat: PCZertificatService,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PCZertificatService {
    pub acme_email: String,
    pub acme_endpoint: String,
    pub use_pebble: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MaybeVaultCert {
    pub domain: String,
    pub cert: Option<Value>,
    pub key: Option<Value>,
    pub info: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VaultCert {
    pub domain: String,
    pub cert: String,
    pub key: String,
    pub info: VaultCertInfo,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct VaultCertInfo {
    pub created: i64,
}
