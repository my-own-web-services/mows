use anyhow::{bail, Ok};
use serde_json::Value;
use std::{collections::HashMap, process::Command};

pub async fn get_metadata_exiftool(path: &str) -> anyhow::Result<HashMap<String, Value>> {
    let output = Command::new("./Image-ExifTool-12.55/exiftool")
        .arg(path)
        .arg("-json")
        .arg("-stay_open")
        .output()?;

    let parsed: Vec<HashMap<String, Value>> =
        serde_json::from_str(&String::from_utf8_lossy(&output.stdout))?;

    let mut map = parsed[0].clone();

    match map.get("Error") {
        Some(e) => bail!("{}", e),
        None => {
            let rm = vec!["FilePermissions", "Directory", "SourceFile", "FileName"];
            for k in rm {
                map.remove(k);
            }
            Ok(map)
        }
    }
}
