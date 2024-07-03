use anyhow::bail;
use axum::{extract::Path, Json};

use crate::{
    config::{MachineInstallState, PixiecoreBootConfig},
    utils::AppError,
    write_config,
};

#[utoipa::path(
    get,
    path = "/v1/boot/{mac_addr}",
    params(
        ("mac_addr" = String, Path, description = "Mac address of the machine to get boot config for")
    ),
    responses(
        (status = 200, description = "Sending boot config to pixieboot server", body = PixiecoreBootConfig),
        (status = 500, description = "Failed to get config for mac address", body = String)
    )
)]
pub async fn get_boot_config_by_mac(
    Path(mac_addr): Path<String>,
) -> Result<Json<PixiecoreBootConfig>, AppError> {
    Ok(Json(get_boot_config(mac_addr).await?))
}

pub async fn get_boot_config(mac_addr: String) -> Result<PixiecoreBootConfig, anyhow::Error> {
    let mut config = write_config!();

    for machine in config.machines.values_mut() {
        if let Some(mac) = &machine.mac {
            if mac == &mac_addr {
                if let Some(install) = &mut machine.install {
                    install.state = Some(MachineInstallState::Requested);
                    if let Some(boot_config) = &install.boot_config {
                        return Ok(boot_config.clone());
                    }
                }
            }
        }
    }

    bail!("No machine found with mac address: {}", mac_addr)
}
