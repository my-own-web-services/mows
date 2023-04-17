// take the tt_id from the clues and get meta information from omdb

use anyhow::bail;

use crate::{config::CONFIG, metadata_types::OmdbMetadata};

pub async fn request(tt_id: &str) -> anyhow::Result<OmdbMetadata> {
    let config = &CONFIG;
    let api_key = &config.external.omdb.api_key;
    check_api_key(&api_key)?;
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

pub fn check_api_key(api_key: &str) -> anyhow::Result<()> {
    if api_key.len() != 8 {
        bail!("OMDB API keys are 8 characters long. Please check your config file.");
    }

    Ok(())
}
