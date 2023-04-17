use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub exifdata: Option<HashMap<String, Value>>,
    pub clues: Option<Clues>,
    pub external: Option<External>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Clues {
    Video(VideoClues),
    Music(MusicClues),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MusicClues {
    // https://de.wikipedia.org/wiki/International_Standard_Recording_Code
    pub isrc: Option<String>,
    // https://de.wikipedia.org/wiki/Universal_Product_Code
    pub upc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoClues {
    /** The IMDB ID of the video
     without the "tt" prefix
    */
    pub tt_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct External {
    pub omdb: Option<OmdbMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct OmdbMetadata {
    pub actors: String,
    pub awards: String,
    pub box_office: Option<String>,
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
