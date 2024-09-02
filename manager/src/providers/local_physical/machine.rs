use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    config::{Machine, SshAccess},
    machines::MachineType,
};

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct LocalMachineProviderPhysicalConfig {
    pub mac_address: String,
}

pub struct LocalMachineProviderPhysical;

impl LocalMachineProviderPhysical {
    pub async fn new(
        cc: &LocalMachineProviderPhysicalConfig,
        machine_name: &str,
    ) -> anyhow::Result<Machine> {
        let ssh = SshAccess::new(Some(machine_name.to_string()), None).await?;

        let machine = Machine {
            id: machine_name.to_string(),
            machine_type: MachineType::LocalPhysical,
            install: None,
            mac: Some(cc.mac_address.clone()),
            ssh,
            public_ip: None,
            public_legacy_ip: None,
        };

        Ok(machine)
    }
}
