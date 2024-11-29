use std::collections::HashMap;

pub async fn get_cluster_variables() -> HashMap<String, String> {
    let mut cluster_variables = HashMap::new();

    cluster_variables.insert(
        "MOWS_PRIMARY_CLUSTER_DOMAIN".to_string(),
        "vindelicorum.eu".to_string(),
    );
    cluster_variables.insert(
        "MOWS_PRIMARY_CLUSTER_LEGACY_IP".to_string(),
        "116.203.53.54".to_string(),
    );

    cluster_variables
}
