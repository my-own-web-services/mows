use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub exifdata: Option<HashMap<String, Value>>,
    pub clues: Option<Clues>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Clues {
    Video(VideoClues),
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoClues {
    /** The IMDB ID of the video
     without the "tt" prefix
    */
    pub tt_id: Option<String>,
}
