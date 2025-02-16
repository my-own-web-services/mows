use serde_json::Value;
use std::collections::HashMap;

pub async fn get_fake_app_config() -> HashMap<String, Value> {
    let mut cluster_variables = HashMap::new();

    cluster_variables.insert(
        "domain".to_string(),
        Value::String("vindelicorum.eu".to_string()),
    );
    cluster_variables.insert(
        "legacy_ip".to_string(),
        Value::String("116.203.53.54".to_string()),
    );

    cluster_variables
}
