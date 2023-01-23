use std::collections::HashMap;

use serde_json::Value;

use crate::{
    metadata_types::{self, Clues},
    some_or_bail,
    types::FilezFile,
};

pub async fn get_clues(
    file: &FilezFile,
    exifdata: &Option<HashMap<String, Value>>,
) -> anyhow::Result<Option<Clues>> {
    let mime_prefix = some_or_bail!(file.mime_type.split('/').next(), "Invalid mime type");

    if mime_prefix == "video" {
        let tt_id = get_tt_id(&file.name);
        let clues = Clues::Video(metadata_types::VideoClues { tt_id });

        return Ok(Some(clues));
    }

    Ok(None)
}

fn get_tt_id(string: &str) -> Option<String> {
    if let Some(start_index) = string.find("tt") {
        let end_index =
            get_index_of_first_of_tokens(&string[start_index..], vec![".", "_", "-", " "]);
        match end_index {
            Some(ei) => {
                let maybe_id = string[start_index..start_index + ei]
                    .to_string()
                    .replace("tt", "");
                if maybe_id.parse::<i32>().is_ok() {
                    Some(maybe_id)
                } else {
                    None
                }
            }
            None => None,
        }
    } else {
        None
    }
}

fn get_index_of_first_of_tokens(string: &str, to_find: Vec<&str>) -> Option<usize> {
    let mut index = None;

    for token in to_find {
        if let Some(i) = string.find(token) {
            if index.is_none() || i < index.unwrap() {
                index = Some(i);
            }
        }
    }

    index
}
