use mows_common_rust::{get_current_config_cloned, reqwest::new_reqwest_client};
use serde_json::{json, Value};
use tracing::{debug, instrument};

use crate::{config::config, kube_fix::KubePektinDbEntry, Error};

#[instrument(skip(vault_token))]
pub async fn handle_plain(vault_token: &str, db_entries: &Vec<KubePektinDbEntry>) -> Result<(), Error> {
    let client = new_reqwest_client().await?;
    let config = get_current_config_cloned!(config());

    let records: Vec<Value> = db_entries
        .iter()
        .map(|entry| entry.convert_to_pektin_entry())
        .collect();

    let body = json!({
        "client_username": config.pektin_username,
        "client_token": vault_token,
        "records": records
    });

    let res = client
        .post(format!("{}/set", config.pektin_api_endpoint))
        .header("content-type", "application/json")
        .body(serde_json::to_string(&body).unwrap())
        .send()
        .await?;

    if !res.status().is_success() {
        let res_text = res.text().await?;
        debug!("Failed to set records: {}", res_text);
        return Err(Error::GenericError(format!(
            "Failed to set records: {}",
            res_text
        )));
    }

    Ok(())
}
