use std::collections::HashMap;

use crate::{
    api_types::{AppDataType, CreateFileRequest, CreateFileResponse, SetAppDataRequest},
    some_or_bail,
    types::{FilezClientAppDataFile, IntermediaryFile},
};
use anyhow::bail;
use reqwest::Body;
use tokio_util::codec::{BytesCodec, FramedRead};

use super::set_app_data::set_app_data;

pub async fn create_file(
    address: &str,
    local_file: &IntermediaryFile,
    client_name: &str,
    group_id: &str,
) -> anyhow::Result<()> {
    let path = some_or_bail!(&local_file.real_path, "real_path is None");
    let file = tokio::fs::File::open(path).await?;
    let stream = FramedRead::new(file, BytesCodec::new());

    let create_file_request = CreateFileRequest {
        name: local_file.name.clone(),
        mime_type: local_file.mime_type.clone(),
        storage_name: None,
        groups: Some(vec![group_id.to_string()]),
    };

    let res = reqwest::Client::new()
        .post(format!("{}/create_file/", address))
        .header("request", serde_json::to_string(&create_file_request)?)
        .body(Body::wrap_stream(stream))
        .send()
        .await?;

    if !res.status().is_success() {
        bail!("Failed to create file: {}", res.text().await?)
    }

    let res_text = res.text().await?;

    let cfr = serde_json::from_str::<CreateFileResponse>(&res_text)?;

    let mut filez_client_app_data: HashMap<String, FilezClientAppDataFile> = HashMap::new();

    let app_data_file = FilezClientAppDataFile {
        modified: local_file.modified,
        created: local_file.created,
        path: local_file.path.clone(),
        id: local_file.client_id.clone(),
    };

    filez_client_app_data.insert(client_name.to_string(), app_data_file);

    let app_data_req = SetAppDataRequest {
        app_data_type: AppDataType::File,
        id: cfr.id,
        app_name: "filezClients".to_string(),
        app_data: serde_json::to_value(filez_client_app_data)?,
    };

    set_app_data(address, &app_data_req).await?;
    //TODO revert the whole operation if setting the metadata fails
    Ok(())
}
