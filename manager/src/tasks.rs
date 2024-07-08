use anyhow::Context;
use tracing::{debug, info, trace};

use crate::{
    config::{Cluster, ClusterInstallState, MachineInstallState},
    get_current_config_cloned, some_or_bail, write_config,
};

#[tracing::instrument]
pub async fn update_machine_install_state() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    for machine in cfg1.machines.values() {
        if let Some(install) = &machine.install {
            if install.state == Some(MachineInstallState::Requested) {
                debug!("Checking Machine {} install state", machine.id);
                match machine.poll_install_state(&cfg1.clusters).await {
                    Ok(_) => (),
                    Err(e) => {
                        trace!("Machine not installed yet: {:?}", e);
                        continue;
                    }
                }

                info!("Machine {} is installed", machine.id);
                let mut config_locked2 = write_config!();
                let machine = some_or_bail!(
                    config_locked2.machines.get_mut(&machine.id),
                    "Machine not found"
                );

                machine.install.as_mut().unwrap().boot_config = None;

                machine.install.as_mut().unwrap().state = Some(MachineInstallState::Installed);
            }
        }
    }
    Ok(())
}
#[tracing::instrument]
pub async fn get_cluster_kubeconfig() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    for cluster in cfg1.clusters.values() {
        if cluster.kubeconfig.is_none() {
            debug!("Getting kubeconfig for cluster {}", cluster.id);
            let kubeconfig = cluster.get_kubeconfig().await.context(format!(
                "Failed to get kubeconfig for cluster {}",
                cluster.id
            ))?;
            info!("Got kubeconfig for cluster {}", cluster.id);

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
#[tracing::instrument]
pub async fn install_cluster_basics() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    for cluster in cfg1.clusters.values() {
        if cluster.kubeconfig.is_some()
            && cluster.install_state == Some(ClusterInstallState::Kubernetes)
        {
            info!("Installing basics for cluster {}", cluster.id);
            cluster.install_basics().await?;
            info!("Installed basics for cluster {}", cluster.id);

            let mut config_locked2 = write_config!();
            let cluster = some_or_bail!(
                config_locked2.clusters.get_mut(&cluster.id),
                "Cluster not found"
            );
            cluster.install_state = Some(ClusterInstallState::BasicsConfigured);
        }
    }

    Ok(())
}

pub async fn start_cluster_proxy() -> anyhow::Result<Option<String>> {
    let cfg1 = get_current_config_cloned!();

    for cluster in cfg1.clusters.values() {
        if cluster.kubeconfig.is_some() {
            info!("Starting proxy for cluster {}", cluster.id);
            Cluster::start_proxy().await?;
            info!("Started proxy for cluster {}", cluster.id);
            return Ok(Some(cluster.id.clone()));
        }
    }
    Ok(None)
}

pub async fn apply_environment() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    cfg1.apply_environment()
        .await
        .context("Failed to apply environment")?;

    Ok(())
}
