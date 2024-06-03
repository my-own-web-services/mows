use anyhow::bail;

use crate::api_types::{CreateGroupRequest, CreateGroupResponse, GroupType};

pub async fn create_file_group(address: &str, group_name: &str) -> anyhow::Result<String> {
    let create_group_request = CreateGroupRequest {
        name: Some(group_name.to_string()),
        group_type: GroupType::File,
    };
    let body = serde_json::to_string(&create_group_request)?;
    let res = reqwest::Client::new()
        .post(format!("{}/api/create_group/", address))
        .body(body)
        .send()
        .await?;

    let text = res.text().await?;

    let response: CreateGroupResponse = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => bail!(
            "Failed to parse response to CreateGroupResponse: {} got text: {}",
            e,
            text
        ),
    };

    Ok(response.group_id)
}
