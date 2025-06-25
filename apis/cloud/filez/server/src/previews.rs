use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum BuiltInPreviews {
    #[serde(rename = "BuiltInPreviewsImage")]
    Image(BuiltInPreviewsImage),
    #[serde(rename = "BuiltInPreviewsText")]
    Text(BuiltInPreviewsText),
    #[serde(rename = "BuiltInPreviewsVideo")]
    Video(BuiltInPreviewsVideo),
    #[serde(rename = "BuiltInPreviewsMusic")]
    Music(BuiltInPreviewsMusic),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct BuiltInPreviewsImage {
    pub resolutions: Vec<BuiltInPreviewsImageVariant>,
    pub dominant_color: Option<String>, // e.g., "#FFFFFF"
    pub width: u32,                     // original width
    pub height: u32,                    // original height
    pub image_type: BuiltInPreviewsImageType,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub enum BuiltInPreviewsImageType {
    Jpeg,
    Png,
    Webp,
    Avif,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct BuiltInPreviewsImageVariant {
    pub width: u32,
    pub height: u32,
    pub path: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct BuiltInPreviewsText {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct BuiltInPreviewsVideo {
    pub dominant_color: Option<String>,
    pub width: u32,                    // original width
    pub height: u32,                   // original height
    pub duration: u64,                 // duration in milliseconds
    pub dash_manifest: Option<String>, // the dash manifest content
    pub thumbnail_still: Option<ThumbnailStill>,
    pub scrub_thumbnails: Option<Vec<ScrubThumbnail>>,
    pub thumbnail_video: Option<BuiltInPreviewsVideoThumbnailVideo>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ThumbnailStill {
    pub resolution: Vec<BuiltInPreviewsImageVariant>,
    pub image_type: BuiltInPreviewsImageType,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct BuiltInPreviewsVideoThumbnailVideo {}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct ScrubThumbnail {
    pub time: u64, // time in milliseconds
    pub resolution: Vec<BuiltInPreviewsImageVariant>,
    pub image_type: BuiltInPreviewsImageType,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug)]
pub struct BuiltInPreviewsMusic {}
