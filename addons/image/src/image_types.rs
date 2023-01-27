use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessedImage {
    pub width: u32,
    pub height: u32,
    pub resolutions: Vec<u32>,
}
