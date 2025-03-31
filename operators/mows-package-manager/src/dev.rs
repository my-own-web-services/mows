use mows_common::constants::MowsConstants;
use mows_common::s;
use serde_json::Value;
use std::collections::HashMap;

pub async fn get_fake_cluster_config() -> HashMap<String, Value> {
    let mut cluster_variables = HashMap::new();

    cluster_variables.insert(s!("domain"), Value::String(s!("vindelicorum.eu")));
    cluster_variables.insert(s!("legacy_ip"), Value::String(s!("116.203.53.54")));

    cluster_variables.insert(
        s!("constants"),
        serde_json::to_value(MowsConstants::default()).unwrap(),
    );

    cluster_variables
}
