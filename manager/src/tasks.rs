use std::time::Duration;

use anyhow::Context;
use tracing::{debug, error, info, trace};

use crate::{
    config::{Cluster, ClusterInstallState, MachineInstallState},
    get_current_config_cloned, some_or_bail, write_config,
};

pub async fn start_background_tasks() -> anyhow::Result<()> {
    info!("Starting background tasks");

    // these are separated for easier debugging
    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = update_machine_install_state().await {
                trace!("Could not update machine install state: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = apply_environment().await {
                trace!("Failed to apply environment: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = get_cluster_kubeconfig().await {
                trace!("Could not get cluster config: {:?}", e);
            };
        }
    });

    tokio::spawn(async {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            if let Err(e) = install_cluster_basics().await {
                error!("Could not install cluster basics: {:?}", e);
            };
        }
    });

    // Kubectl proxy
    tokio::spawn(async {
        let mut proxy_running_for_cluster: Option<String> = None;
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;

            if let Some(cluster_id) = &proxy_running_for_cluster {
                // the proxy is running... check if the cluster still exists else stop the proxy and allow the next iteration to start a new proxy
                let cfg1 = get_current_config_cloned!();
                if cfg1.clusters.get(&cluster_id.clone()).is_none() {
                    if let Err(e) = Cluster::stop_kubectl_proxy().await {
                        error!("Could not stop cluster proxy: {:?}", e);
                    }
                    proxy_running_for_cluster = None;
                } else {
                    continue;
                }
            };

            match start_cluster_proxy().await {
                Ok(cluster_id) => {
                    proxy_running_for_cluster = cluster_id;
                }
                Err(e) => {
                    error!("Could not start cluster proxy: {:?}", e);
                }
            };
        }
    });

    // Vault proxy
    tokio::spawn(async {
        let mut proxy_running_for_cluster: Option<String> = None;
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;

            if let Some(cluster_id) = &proxy_running_for_cluster {
                // the proxy is running... check if the cluster still exists else stop the proxy and allow the next iteration to start a new proxy
                let cfg1 = get_current_config_cloned!();
                if cfg1.clusters.get(&cluster_id.clone()).is_none() {
                    if let Err(e) = Cluster::stop_vault_proxy().await {
                        error!("Could not stop cluster proxy: {:?}", e);
                    }
                    proxy_running_for_cluster = None;
                }
            };

            match start_vault_proxy().await {
                Ok(cluster_id) => {
                    proxy_running_for_cluster = cluster_id;
                }
                Err(e) => {
                    trace!("Could not start vault proxy: {:?}", e);
                }
            };
        }
    });

    Ok(())
}

#[tracing::instrument]
pub async fn update_machine_install_state() -> anyhow::Result<()> {
    let cfg1 = get_current_config_cloned!();

    for machine in cfg1.machines.values() {
        if let Some(install) = &machine.install {
            if install.state == Some(MachineInstallState::Requested) {
                debug!("Checking Machine {} install state", machine.id);
                match machine.poll_install_state().await {
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
            let kubeconfig = cluster.get_kubeconfig_from_node().await.context(format!(
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
            cluster.install_core_cloud_system().await?;
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
            info!("Starting kubectl proxy for cluster {}", cluster.id);
            Cluster::start_kubectl_proxy().await?;
            info!("Started kubectl proxy for cluster {}", cluster.id);
            return Ok(Some(cluster.id.clone()));
        }
    }
    Ok(None)
}

pub async fn start_vault_proxy() -> anyhow::Result<Option<String>> {
    let cfg1 = get_current_config_cloned!();

    for cluster in cfg1.clusters.values() {
        if cluster.kubeconfig.is_some() {
            trace!("Starting vault proxy for cluster {}", cluster.id);
            Cluster::start_vault_proxy().await?;
            trace!("Started vault proxy for cluster {}", cluster.id);
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
