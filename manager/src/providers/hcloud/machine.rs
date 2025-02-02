use std::net::{Ipv4Addr, Ipv6Addr};

use anyhow::{bail, Context};
use hcloud::{
    apis::{
        configuration::Configuration,
        primary_ips_api::{list_primary_ips, ListPrimaryIpsParams},
        servers_api::{
            list_servers, request_console_for_server, CreateServerParams, DeleteServerParams,
            ListServersParams, RequestConsoleForServerParams,
        },
        ssh_keys_api::CreateSshKeyParams,
    },
    models::{CreateServerRequest, CreateServerRequestPublicNet, CreateSshKeyRequest},
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{debug, info, trace};
use utoipa::ToSchema;

use crate::{
    config::{Machine, SshAccess},
    machines::{MachineStatus, VncWebsocket},
    some_or_bail,
};

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, PartialEq)]
pub struct ExternalProviderMachineHcloud {}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ExternalMachineProviderHcloudConfig {
    pub server_type: String,
    pub location: String,
}

const HCLOUD_API_TOKEN_ENV_NAME: &str = "HCLOUD_API_TOKEN";

#[derive(Debug, Error)]
pub enum HcloudError {
    #[error("Server to be deleted not found at hcloud")]
    ServerToBeDeletedNotFoundAtHcloud,
    #[error("{0}")]
    GenericHcloudError(#[from] anyhow::Error),
}

impl ExternalProviderMachineHcloud {
    pub async fn new(
        hc: &ExternalMachineProviderHcloudConfig,
        machine_name: &str,
    ) -> anyhow::Result<Machine> {
        debug!("Creating VM on Hetzner Cloud");

        let mut configuration = Configuration::new();
        configuration.bearer_access_token = std::env::var(HCLOUD_API_TOKEN_ENV_NAME).ok();

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
        .await
        .context("Failed to list primary IPs. Make sure HCLOUD_PRIMARY_IP_NAME is set correctly")?
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
        .await.context(
            "Failed to list primary legacy IPs. Make sure HCLOUD_PRIMARY_LEGACY_IP_NAME is set correctly",
        )?
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
        .await
        .context("Failed to create SSH key on Hetzner Cloud.")?;

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

        let res = hcloud::apis::servers_api::create_server(&configuration, create_server_params)
            .await
            .context("Failed to create VM on Hetzner Cloud.")?;

        ssh_config.remote_hostname = Some(
            some_or_bail!(
                res.server.public_net.ipv4.clone(),
                "No IP address present in create_server response"
            )
            .ip
            .to_string(),
        );

        Ok(Machine {
            id: machine_name.to_string(),
            machine_type: crate::machines::MachineType::ExternalHcloud,
            install: None,
            mac: None,
            ssh: ssh_config,
            public_ip: res
                .server
                .public_net
                .ipv6
                .map(|ip| ip.ip.to_string().parse::<Ipv6Addr>().ok())
                .flatten(),

            public_legacy_ip: res
                .server
                .public_net
                .ipv4
                .map(|ip| ip.ip.to_string().parse::<Ipv4Addr>().ok())
                .flatten(),
        })
    }

    async fn get_hcloud_id_from_mows_id(
        mows_id: &str,
        configuration: &Configuration,
    ) -> anyhow::Result<i64> {
        trace!("Getting Hetzner Cloud ID from MOWS ID");

        let hcloud_id = list_servers(
            &configuration,
            ListServersParams {
                name: Some(mows_id.to_string()),
                ..Default::default()
            },
        )
        .await
        .context("Failed to list servers.")?
        .servers
        .first()
        .map(|s| s.id.clone())
        .ok_or_else(|| anyhow::anyhow!("Server not found at hcloud"))?;

        Ok(hcloud_id)
    }

    pub async fn get_vnc_websocket(mows_id: &str) -> anyhow::Result<VncWebsocket> {
        trace!("Getting VNC websocket URL on Hetzner Cloud");

        let mut configuration = Configuration::new();
        configuration.bearer_access_token = std::env::var(HCLOUD_API_TOKEN_ENV_NAME).ok();

        let hcloud_id = Self::get_hcloud_id_from_mows_id(mows_id, &configuration)
            .await
            .context("Failed to get Hetzner Cloud ID from MOWS ID")?;

        let res = request_console_for_server(
            &configuration,
            RequestConsoleForServerParams { id: hcloud_id },
        )
        .await
        .context("Failed to request console for server.")?;

        Ok(VncWebsocket {
            url: res.wss_url,
            password: res.password,
        })
    }

    pub async fn get_status(mows_id: &str) -> anyhow::Result<MachineStatus> {
        trace!("Getting VM status on Hetzner Cloud");

        let mut configuration = Configuration::new();
        configuration.bearer_access_token = std::env::var(HCLOUD_API_TOKEN_ENV_NAME).ok();

        let hcloud_status = list_servers(
            &configuration,
            ListServersParams {
                name: Some(mows_id.to_string()),
                ..Default::default()
            },
        )
        .await
        .map_err(|e| HcloudError::GenericHcloudError(e.into()))?
        .servers
        .first()
        .map(|s| s.status.clone())
        .ok_or_else(|| anyhow::anyhow!("Server not found at hcloud"))?;

        let machine_status = match hcloud_status {
            hcloud::models::server::Status::Deleting => MachineStatus::Running,
            hcloud::models::server::Status::Initializing => MachineStatus::Stopped,
            hcloud::models::server::Status::Migrating => MachineStatus::Unknown,
            hcloud::models::server::Status::Off => MachineStatus::Stopped,
            hcloud::models::server::Status::Running => MachineStatus::Running,
            hcloud::models::server::Status::Starting => MachineStatus::Stopped,
            hcloud::models::server::Status::Stopping => MachineStatus::Running,
            hcloud::models::server::Status::Unknown => MachineStatus::Unknown,
            _ => MachineStatus::Unknown,
        };

        Ok(machine_status)
    }

    pub async fn delete(mows_id: &str) -> Result<(), HcloudError> {
        info!("Deleting VM on Hetzner Cloud");

        let mut configuration = Configuration::new();
        configuration.bearer_access_token = std::env::var(HCLOUD_API_TOKEN_ENV_NAME).ok();

        let hcloud_id = list_servers(
            &configuration,
            ListServersParams {
                name: Some(mows_id.to_string()),
                ..Default::default()
            },
        )
        .await
        .map_err(|e| HcloudError::GenericHcloudError(e.into()))?
        .servers
        .first()
        .map(|s| s.id.clone())
        .ok_or_else(|| HcloudError::ServerToBeDeletedNotFoundAtHcloud)?;

        hcloud::apis::servers_api::delete_server(
            &configuration,
            DeleteServerParams {
                id: hcloud_id,
                ..Default::default()
            },
        )
        .await
        .context("Failed to run delete_server api call")?;

        Ok(())
    }
}
