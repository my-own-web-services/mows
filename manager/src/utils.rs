use std::sync::Arc;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use tokio::sync::Mutex;

use crate::{
    config::{Config, InstallState},
    some_or_bail,
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

pub async fn update_machine_install_state(
    config_handle: &Arc<Mutex<Config>>,
) -> anyhow::Result<()> {
    let config_locked1 = config_handle.lock().await;
    let cfg1 = config_locked1.clone();
    drop(config_locked1);

    for machine in cfg1.machines.values() {
        if machine.poll_install_state(&cfg1.clusters).await.is_ok() {
            let mut config_locked2 = config_handle.lock().await;
            let machine = some_or_bail!(
                config_locked2.machines.get_mut(&machine.id),
                "Machine not found"
            );
            machine.install.as_mut().unwrap().state = Some(InstallState::Installed);
            drop(config_locked2);
        }
    }

    Ok(())
}

pub async fn update_cluster_config(config_handle: &Arc<Mutex<Config>>) -> anyhow::Result<()> {
    let config_locked1 = config_handle.lock().await;
    let cfg1 = config_locked1.clone();
    drop(config_locked1);

    for cluster in cfg1.clusters.values() {
        let kubeconfig = cluster.get_kubeconfig(&cfg1).await?;
        let mut config_locked2 = config_handle.lock().await;
        let cluster = some_or_bail!(
            config_locked2.clusters.get_mut(&cluster.id),
            "Cluster not found"
        );
        cluster.kubeconfig = Some(kubeconfig);
    }

    Ok(())
}
