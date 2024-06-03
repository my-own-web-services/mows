use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(TS)]
#[ts(export, export_to = "../../clients/ts/src/apiTypes/")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Image {
    pub result: Option<ProcessedImage>,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub error: Option<String>,
    pub rescan: Option<bool>,
}

#[derive(TS)]
#[ts(export, export_to = "../../clients/ts/src/apiTypes/")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedImage {
    pub width: u32,
    pub height: u32,
    pub resolutions: Vec<u32>,
    pub dzi: Option<Dzi>,
}

#[derive(TS)]
#[ts(export, export_to = "../../clients/ts/src/apiTypes/")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dzi {
    pub tile_size: u32,
    pub tile_overlap: u32,
    pub format: String,
    pub levels: u32,
}
