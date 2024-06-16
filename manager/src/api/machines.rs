use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::{
    config::Machine,
    get_current_config_cloned,
    types::Success,
    utils::{AppError, CONFIG},
};

#[utoipa::path(
    post,
    path = "/api/machines/create",
    request_body = MachineCreationReqBody,
    responses(
        (status = 200, description = "Created machines", body = Success),
        (status = 500, description = "Failed to create machines", body = String)
    )
)]
pub async fn create_machines(
    Json(machine_creation_config): Json<MachineCreationReqBody>,
) -> Result<Json<Success>, AppError> {
    for _ in 0..3 {
        let machine = Machine::new(&machine_creation_config).await?;
        let mut config_locked = CONFIG.write().await;
        config_locked.machines.insert(machine.id.clone(), machine);
    }

    Ok(Json(Success {
        message: "Machines created".to_string(),
    }))
}

#[utoipa::path(
    post,
    path = "/api/machines/signal",
    request_body = MachineSignalReqBody,
    responses(
        (status = 200, description = "Sent signal", body = Success),
        (status = 500, description = "Failed to send signal", body = String)
    )
)]
pub async fn signal_machine(
    Json(machine_signal): Json<MachineSignalReqBody>,
) -> Result<Json<Success>, AppError> {
    let config = CONFIG.read().await;
    let machine = config
        .machines
        .get(&machine_signal.machine_id)
        .ok_or(anyhow::Error::msg("Machine not found"))?;
    machine.send_signal(machine_signal.signal).await?;

    Ok(Json(Success {
        message: "Success".to_string(),
    }))
}

#[utoipa::path(
    delete,
    path = "/api/machines/delete",
    request_body=MachineDeleteReqBody,
    responses(
        (status = 200, description = "Machine deleted", body = Success),
        (status = 500, description = "Failed to delete machines", body = String)
    )
)]
pub async fn delete_machine(
    Json(machine_delete): Json<MachineDeleteReqBody>,
) -> Result<Json<Success>, AppError> {
    let config = get_current_config_cloned!();
    let machine = config
        .machines
        .get(&machine_delete.machine_id)
        .ok_or(anyhow::Error::msg("Machine not found"))?;
    machine.delete().await?;

    Ok(Json(Success {
        message: "Machine deleted".to_string(),
    }))
}

#[utoipa::path(
    post,
    path = "/api/machines/info",
    request_body=MachineInfoReqBody,
    responses(
        (status = 200, description = "Got machine info", body = MachineInfoResBody),
        (status = 500, description = "Failed to get info", body = String)
    )
)]
pub async fn get_machine_info(
    Json(machine_info_json): Json<MachineInfoReqBody>,
) -> Result<Json<MachineInfoResBody>, AppError> {
    let config = CONFIG.read().await;
    let machine = config
        .machines
        .get(&machine_info_json.machine_id)
        .ok_or(anyhow::Error::msg("Machine not found"))?;
    let machine_infos = machine.get_infos().await?;

    Ok(Json(MachineInfoResBody { machine_infos }))
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct MachineInfoResBody {
    pub machine_infos: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct MachineInfoReqBody {
    pub machine_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct MachineDeleteReqBody {
    pub machine_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct MachineSignalReqBody {
    pub signal: MachineSignal,
    pub machine_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub enum MachineSignal {
    Start,
    Reboot,
    Shutdown,
    Reset,
    ForceOff,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub enum MachineCreationReqBody {
    LocalQemu(LocalQemuConfig),
    Local(Vec<String>),
    ExternalHetzner(ExternalHetznerConfig),
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema, Default)]
pub struct LocalQemuConfig {
    /**
     * Memory in GB
     */
    pub memory: u8,
    pub cpus: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ExternalHetznerConfig {
    pub server_type: String,
}
