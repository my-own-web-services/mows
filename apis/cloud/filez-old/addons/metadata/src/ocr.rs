use crate::metadata_types::OcrResult;
use filez_common::server::file::FilezFile;
use rusty_tesseract::{Args, Image};
use std::{collections::HashMap, path::PathBuf};

pub async fn get_ocr(file: &FilezFile, file_source_path: &PathBuf) -> Option<OcrResult> {
    // is file a pdf that has ocr emebeded? -> extract ocr
    // is file a pdf that does not have ocr emebeded? -> run ocr
    // is file a image -> run ocr
    // TODO: is file a video -> run ocr on frames

    let valid_image_types = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/tiff",
        "image/webp",
        "image/avif",
    ];

    let tesseract_args = Args {
        lang: "deu".to_string(),
        dpi: Some(150),
        psm: Some(3),
        oem: Some(3),
        config_variables: HashMap::new(),
    };

    if file.mime_type.as_str() == "application/pdf" {
        println!("pdf not implemented yet");
        None
    } else if valid_image_types.contains(&file.mime_type.as_str()) {
        // run ocr on image
        match Image::from_path(file_source_path) {
            Ok(img) => match rusty_tesseract::image_to_boxes(&img, &tesseract_args) {
                Ok(boxes_res) => {
                    dbg!(&boxes_res);

                    Some(OcrResult {
                        boxes: boxes_res.output,
                    })
                }
                Err(e) => {
                    println!("Error running ocr: {:?}", e);
                    None
                }
            },
            Err(e) => {
                println!("Error opening image: {:?}", e);
                None
            }
        }
    } else {
        None
    }
}
