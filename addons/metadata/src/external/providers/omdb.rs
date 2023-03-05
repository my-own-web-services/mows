// take the tt_id from the clues and get meta information from omdb

use serde::{Deserialize, Serialize};

pub async fn request(tt_id: &str) -> anyhow::Result<OmdbMetadata> {
    Ok(OmdbMetadata {})
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OmdbMetadata {}
