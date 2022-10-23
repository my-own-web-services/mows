use std::collections::HashMap;

use crate::{
    api_types::{AppDataType, SetAppDataRequest, UpdateFileRequest},
    some_or_bail,
    types::{FilezClientAppDataFile, IntermediaryFile},
};
use anyhow::bail;
use reqwest::Body;
use tokio_util::codec::{BytesCodec, FramedRead};

use super::set_app_data::set_app_data;

pub async fn update_file(
    address: &str,
    intermediary_file: &IntermediaryFile,
    file_id: &str,
) -> anyhow::Result<()> {
    let path = some_or_bail!(&intermediary_file.real_path, "real_path is None");
    let file = tokio::fs::File::open(path).await?;
    let stream = FramedRead::new(file, BytesCodec::new());

    let create_file_request = UpdateFileRequest {
        file_id: file_id.to_string(),
        modified: intermediary_file.modified,
    };

    let res = reqwest::Client::new()
        .post(format!("{}/update_file/", address))
        .header("request", serde_json::to_string(&create_file_request)?)
        .body(Body::wrap_stream(stream))
        .send()
        .await?;

    if !res.status().is_success() {
        bail!("Failed to create file: {}", res.text().await?)
    }

    Ok(())
}
