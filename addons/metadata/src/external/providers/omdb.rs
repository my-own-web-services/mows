// take the tt_id from the clues and get meta information from omdb

use crate::{config::CONFIG, metadata_types::OmdbMetadata};

pub async fn request(tt_id: &str) -> anyhow::Result<OmdbMetadata> {
    let config = &CONFIG;
    let url = format!(
        "https://www.omdbapi.com/?i=tt{}&apikey={}",
        tt_id, config.external.omdb.api_key
    );
    let response = reqwest::get(&url).await?;

    let text = &response.text().await?;

    dbg!(&text);

    let omdb_metadata: OmdbMetadata = serde_json::from_str(text)?;

    Ok(omdb_metadata)
}
