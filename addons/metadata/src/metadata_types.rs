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
    pub actors: Option<String>,
    pub awards: Option<String>,
    pub box_office: Option<String>,
    pub country: Option<String>,
    #[serde(rename = "DVD")]
    pub dvd: Option<String>,
    pub director: Option<String>,
    pub genre: Option<String>,
    pub language: Option<String>,
    pub metascore: Option<String>,
    pub plot: Option<String>,
    pub poster: Option<String>,
    pub production: Option<String>,
    pub rated: Option<String>,
    pub ratings: Option<Vec<Rating>>,
    pub released: Option<String>,
    pub response: Option<String>,
    pub runtime: Option<String>,
    pub title: Option<String>,
    #[serde(rename = "Type")]
    pub type_: Option<String>,
    pub website: Option<String>,
    pub writer: Option<String>,
    pub year: Option<String>,
    #[serde(rename = "imdbID")]
    pub imdb_id: Option<String>,
    #[serde(rename = "imdbRating")]
    pub imdb_rating: Option<String>,
    #[serde(rename = "imdbVotes")]
    pub imdb_votes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct Rating {
    pub source: Option<String>,
    pub value: Option<String>,
}
