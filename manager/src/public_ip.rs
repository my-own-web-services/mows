use crate::{
    api::public_ip::{PublicIpCreationConfig, PublicIpCreationConfigType},
    config::PublicIpConfig,
    get_current_config_cloned, some_or_bail,
};

pub async fn create_public_ip(
    creation_config: PublicIpCreationConfigType,
) -> anyhow::Result<PublicIpConfig> {
    match creation_config {
        PublicIpCreationConfigType::MachineProxy(id) => create_public_id_from_machine(&id).await,
    }
}

pub async fn create_public_id_from_machine(machine_id: &str) -> anyhow::Result<PublicIpConfig> {
    let config = get_current_config_cloned!();

    let machine = some_or_bail!(config.machines.iter().find(|m| m.1.id == machine_id), "");

    todo!()
}
