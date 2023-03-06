use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use crate::external::providers::omdb::OmdbMetadata;

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
