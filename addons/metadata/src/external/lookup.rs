use crate::{
    config::CONFIG,
    metadata_types::{External, Metadata},
};

use super::providers::omdb;

pub async fn external_lookup(metadata: &Metadata) -> anyhow::Result<External> {
    let config = &CONFIG;
    let mut external = External { omdb: None };

    if let Some(clues) = &metadata.clues {
        match clues {
            crate::metadata_types::Clues::Video(video_clues) => {
                dbg!(&video_clues);
                if let Some(tt_id) = &video_clues.tt_id {
                    if config.external.omdb.enabled {
                        external.omdb = Some(omdb::request(tt_id).await?);
                    }
                }
            }
            crate::metadata_types::Clues::Music(music_clues) => {}
        }
    }

    Ok(external)
}
