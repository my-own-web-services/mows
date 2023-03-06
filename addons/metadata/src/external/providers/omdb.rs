// take the tt_id from the clues and get meta information from omdb

use crate::config::CONFIG;
use serde::{Deserialize, Serialize};

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

// This is an idea of the metadata that omdb returns but as it varies
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct OmdbMetadata {
    pub actors: String,
    pub awards: String,
    pub box_office: String,
    pub country: String,
    #[serde(rename = "DVD")]
    pub dvd: String,
    pub director: String,
    pub genre: String,
    pub language: String,
    pub metascore: String,
    pub plot: String,
    pub poster: String,
    pub production: String,
    pub rated: String,
    pub ratings: Vec<Rating>,
    pub released: String,
    pub response: String,
    pub runtime: String,
    pub title: String,
    #[serde(rename = "Type")]
    pub type_: String,
    pub website: String,
    pub writer: String,
    pub year: String,
    #[serde(rename = "imdbID")]
    pub imdb_id: String,
    #[serde(rename = "imdbRating")]
    pub imdb_rating: String,
    #[serde(rename = "imdbVotes")]
    pub imdb_votes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Rating {
    pub source: String,
    pub value: String,
}
