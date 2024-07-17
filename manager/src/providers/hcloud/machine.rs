use anyhow::bail;
use hcloud::{
    apis::{
        configuration::Configuration, servers_api::CreateServerParams,
        ssh_keys_api::CreateSshKeyParams,
    },
    models::{CreateServerRequest, CreateSshKeyRequest},
};
use serde::{Deserialize, Serialize};
use tracing::debug;
use utoipa::ToSchema;

use crate::{
    config::{Machine, SshAccess},
    some_or_bail,
};

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct ExternalProviderMachineHcloud {}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ExternalMachineProviderHcloudConfig {
    pub server_type: String,
    pub location: String,
}

impl ExternalProviderMachineHcloud {
    pub async fn new(
        hc: &ExternalMachineProviderHcloudConfig,
        machine_name: &str,
    ) -> anyhow::Result<Machine> {
        debug!("Creating VM on Hetzner Cloud");

        let mut configuration = Configuration::new();
        configuration.bearer_access_token = std::env::var("HCLOUD_API_TOKEN").ok();

        let mut ssh_config = SshAccess::new(None, Some("root")).await?;

        hcloud::apis::ssh_keys_api::create_ssh_key(
            &configuration,
            CreateSshKeyParams {
                create_ssh_key_request: Some(CreateSshKeyRequest {
                    name: machine_name.to_string(),
                    public_key: ssh_config.ssh_public_key.clone(),
                    ..Default::default()
                }),
            },
        )
        .await?;

        let create_server_params = CreateServerParams {
            create_server_request: Some(CreateServerRequest {
                server_type: hc.server_type.to_string(),
                location: Some(hc.location.clone()),
                ssh_keys: Some(vec![machine_name.to_string()]),
                name: machine_name.to_string(),
                image: "ubuntu-24.04".to_string(),
                ..Default::default()
            }),
        };

        let res =
            match hcloud::apis::servers_api::create_server(&configuration, create_server_params)
                .await
            {
                Ok(res) => res,
                Err(e) => {
                    bail!("Failed to create VM on Hetzner Cloud: {}", e);
                }
            };

        ssh_config.remote_hostname = Some(
            some_or_bail!(res.server.public_net.ipv4, "No IP address")
                .ip
                .to_string(),
        );

        debug!("Created VM on Hetzner Cloud");
        Ok(Machine {
            id: machine_name.to_string(),
            machine_type: crate::machines::MachineType::ExternalHcloud,
            install: None,
            mac: None,
            ssh: ssh_config,
        })
    }

    pub fn delete_vm(&self) {
        println!("Deleting VM on Hetzner Cloud");
    }
}
