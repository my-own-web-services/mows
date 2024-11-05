use std::{
    net::{Ipv4Addr, Ipv6Addr},
    str::FromStr,
};

use anyhow::bail;
use hcloud::{
    apis::{
        configuration::Configuration,
        primary_ips_api::{list_primary_ips, ListPrimaryIpsParams},
        servers_api::CreateServerParams,
        ssh_keys_api::CreateSshKeyParams,
    },
    models::{primary_ip, CreateServerRequest, CreateServerRequestPublicNet, CreateSshKeyRequest},
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

        let primary_ip_id = list_primary_ips(
            &configuration,
            ListPrimaryIpsParams {
                name: Some(
                    std::env::var("HCLOUD_PRIMARY_IP_NAME")
                        .map_err(|_| anyhow::anyhow!("HCLOUD_PRIMARY_IP_NAME not set"))?,
                ),
                ..Default::default()
            },
        )
        .await?
        .primary_ips
        .first()
        .map(|ip| ip.id.clone())
        .ok_or_else(|| anyhow::anyhow!("No primary IP found"))?;

        let primary_legacy_ip_id = list_primary_ips(
            &configuration,
            ListPrimaryIpsParams {
                name: Some(
                    std::env::var("HCLOUD_PRIMARY_LEGACY_IP_NAME")
                        .map_err(|_| anyhow::anyhow!("HCLOUD_PRIMARY_LEGACY_IP_NAME not set"))?,
                ),
                ..Default::default()
            },
        )
        .await?
        .primary_ips
        .first()
        .map(|ip| ip.id.clone())
        .ok_or_else(|| anyhow::anyhow!("No primary legacy IP found"))?;

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
                public_net: Some(Box::new(CreateServerRequestPublicNet {
                    enable_ipv6: Some(true),
                    enable_ipv4: Some(true),
                    ipv6: Some(Some(primary_ip_id.try_into().map_err(|e| {
                        anyhow::anyhow!("Failed to convert primary IP ID to u32: {}", e)
                    })?)),
                    ipv4: Some(Some(primary_legacy_ip_id.try_into().map_err(|e| {
                        anyhow::anyhow!("Failed to convert primary IP ID to u32: {}", e)
                    })?)),
                })),
                ..Default::default()
            }),
        };

        /*

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
            some_or_bail!(res.server.public_net.ipv4.clone(), "No IP address")
                .ip
                .to_string(),
        );*/

        let _ =
            hcloud::apis::servers_api::create_server(&configuration, create_server_params).await;

        ssh_config.remote_hostname = Some("116.203.53.54".to_string());

        debug!("Created VM on Hetzner Cloud");

        // TODO: Fix this https://github.com/HenningHolmDE/hcloud-rust/tree/master

        Ok(Machine {
            id: machine_name.to_string(),
            machine_type: crate::machines::MachineType::ExternalHcloud,
            install: None,
            mac: None,
            ssh: ssh_config,
            public_ip: None, /*res
                             .server
                             .public_net
                             .ipv6
                             .map(|ip| ip.ip.to_string().parse::<Ipv6Addr>().ok())
                             .flatten()*/

            public_legacy_ip: Some(Ipv4Addr::from_str("116.203.53.54")?), /* res
                                                                          .server
                                                                          .public_net
                                                                          .ipv4
                                                                          .map(|ip| ip.ip.to_string().parse::<Ipv4Addr>().ok())
                                                                          .flatten()*/
        })
    }

    pub fn delete_vm(&self) {
        println!("Deleting VM on Hetzner Cloud");
    }
}
