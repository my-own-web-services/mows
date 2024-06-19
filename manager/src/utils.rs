use anyhow::Context;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use tokio::process::Command;
use tracing::debug;

use crate::{
    config::{ClusterInstallState, MachineInstall, MachineInstallState},
    get_current_config_cloned, some_or_bail, write_config,
};

pub fn generate_id(length: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut rng = rand::thread_rng();

    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            *CHARSET.get(idx).unwrap() as char
        })
        .collect()
}

pub struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {}", self.0),
        )
            .into_response()
    }
}

// This enables using `?` on functions that return `Result<_, anyhow::Error>` to turn them into
// `Result<_, AppError>`. That way you don't need to do that manually.
impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

pub async fn update_machine_install_state() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    for machine in cfg1.machines.values() {
        debug!("Checking install state for machine {}", machine.id);
        if machine.poll_install_state(&cfg1.clusters).await.is_err() {
            continue;
        }
        debug!("Machine {} is installed", machine.id);
        let mut config_locked2 = write_config!();
        let machine = some_or_bail!(
            config_locked2.machines.get_mut(&machine.id),
            "Machine not found"
        );
        let primary = machine.install.as_ref().unwrap().primary;
        *machine.install.as_mut().unwrap() = MachineInstall {
            state: Some(MachineInstallState::Installed),
            boot_config: None,
            primary,
        };
    }
    Ok(())
}

pub async fn get_cluster_config() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    for cluster in cfg1.clusters.values() {
        if cluster.kubeconfig.is_none() {
            debug!("Getting kubeconfig for cluster {}", cluster.id);
            let kubeconfig = cluster.get_kubeconfig().await.context(format!(
                "Failed to get kubeconfig for cluster {}",
                cluster.id
            ))?;
            debug!("Got kubeconfig for cluster {}", cluster.id);

            let mut config_locked2 = write_config!();
            let cluster = some_or_bail!(
                config_locked2.clusters.get_mut(&cluster.id),
                "Cluster not found"
            );
            cluster.kubeconfig = Some(kubeconfig);
            cluster.install_state = Some(ClusterInstallState::Kubernetes);

            drop(config_locked2);

            let cfg3 = get_current_config_cloned!();

            cfg3.apply_environment()
                .await
                .context("Failed to apply environment after getting kubeconfig for cluster")?;
        }
    }

    Ok(())
}

pub async fn install_cluster_basics() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    for cluster in cfg1.clusters.values() {
        if cluster.kubeconfig.is_some()
            && cluster.install_state == Some(ClusterInstallState::Kubernetes)
        {
            debug!("Installing basics for cluster {}", cluster.id);
            cluster.install_basics().await?;
            debug!("Installed basics for cluster {}", cluster.id);

            let mut config_locked2 = write_config!();
            let cluster = some_or_bail!(
                config_locked2.clusters.get_mut(&cluster.id),
                "Cluster not found"
            );
            cluster.install_state = Some(ClusterInstallState::Basics);
        }
    }

    Ok(())
}

pub struct Arp {
    pub ip: String,
    pub hwtype: String,
    pub mac: String,
}

pub async fn get_connected_machines_arp() -> anyhow::Result<Vec<Arp>> {
    let output = Command::new("arp").output().await?;
    let output = String::from_utf8(output.stdout)?;

    let lines: Vec<&str> = output.lines().skip(1).collect();

    let mut arp_lines = vec![];

    for line in lines {
        let arp_line: Vec<&str> = line.split_whitespace().collect();

        arp_lines.push(Arp {
            ip: some_or_bail!(arp_line.first(), "Could not get ip from arp").to_string(),
            hwtype: some_or_bail!(arp_line.get(1), "Could not get hwtype from arp").to_string(),
            mac: some_or_bail!(arp_line.get(2), "Could not get mac from arp").to_string(),
        });
    }

    Ok(arp_lines)
}

pub async fn get_current_ip_from_mac(mac: &str) -> anyhow::Result<String> {
    let online_machines = get_connected_machines_arp().await.context(
        "Could not get connected machines from arp table while trying to get ip from mac address",
    )?;

    let arp_machine = some_or_bail!(
        online_machines.into_iter().find(|arp| arp.mac == mac),
        "Machine not found while trying to get ip from mac address"
    );

    Ok(arp_machine.ip)
}
