use crate::{
    api_types::{AppDataType, SetAppDataRequest, UpdateFileRequest, UpdateFileResponse},
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
    client_name: &str,
    file_id: &str,
) -> anyhow::Result<()> {
    let path = some_or_bail!(&intermediary_file.real_path, "real_path is None");
    let file = tokio::fs::File::open(path).await?;
    let stream = FramedRead::new(file, BytesCodec::new());

    let create_file_request = UpdateFileRequest {
        file_id: file_id.to_string(),
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
    /*
        let res_text = res.text().await?;

        let cfr = serde_json::from_str::<UpdateFileResponse>(&res_text)?;
    */
    let app_data = FilezClientAppDataFile {
        modified: intermediary_file.modified,
        created: intermediary_file.created,
        path: intermediary_file.path.clone(),
        id: intermediary_file.client_id.clone(),
        encrypted: false,
    };

    let app_data_req = SetAppDataRequest {
        app_data_type: AppDataType::File,
        id: file_id.to_string(),
        app_name: client_name.to_string(),
        app_data: serde_json::to_value(app_data)?,
    };

    set_app_data(address, &app_data_req).await?;
    //TODO revert the whole operation if setting the metadata fails
    Ok(())
}
