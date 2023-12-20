use filez_common::server::file::FilezFile;

use crate::config::CONFIG;

pub fn get_resolutions(width: u32, height: u32) -> Vec<u32> {
    let config = &CONFIG;
    let mut resolutions = vec![];
    for resolution in config.image.target_resolutions.iter() {
        if resolution < &width && resolution < &height {
            resolutions.push(*resolution);
        }
    }
    //resolutions.push(if height > width { height } else { width });
    resolutions
}

pub fn is_raw(file: &FilezFile) -> bool {
    let raw_formats = [
        "x-sony-arw",
        "x-canon-cr2",
        "x-canon-crw",
        "x-kodak-dcr",
        "x-adobe-dng",
        "x-epson-erf",
        "x-kodak-k25",
        "x-kodak-kdc",
        "x-minolta-mrw",
        "x-nikon-nef",
        "x-olympus-orf",
        "x-pentax-pef",
        "x-fuji-raf",
        "x-panasonic-raw",
        "x-sony-sr2",
        "x-sony-srf",
        "x-sigma-x3f",
    ];

    let mime_type_second_half = file.mime_type.split('/').nth(1).unwrap();

    if raw_formats.contains(&mime_type_second_half) {
        return true;
    }
    false
}
