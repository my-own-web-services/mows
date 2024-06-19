use axum::{
    extract::{
        ws::{Message, WebSocket},
        WebSocketUpgrade,
    },
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::spawn;
use tracing::error;
use utoipa::ToSchema;

use crate::{
    config::{config, Machine},
    get_current_config_cloned,
    types::Success,
    utils::AppError,
    write_config,
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
    spawn(async move {
        if let Err(e) = create_machine(machine_creation_config).await {
            error!("Failed to create machine: {:?}", e);
        }
    });

    Ok(Json(Success {
        message: "Machines created".to_string(),
    }))
}

pub async fn create_machine(machine_creation_config: MachineCreationReqBody) -> anyhow::Result<()> {
    for _ in 0..3 {
        let machine = Machine::new(&machine_creation_config).await?;
        let mut config_locked = write_config!();
        config_locked.machines.insert(machine.id.clone(), machine);
    }
    Ok(())
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
    let config = config().read().await;
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
    let config = config().read().await;
    let machine = config
        .machines
        .get(&machine_info_json.machine_id)
        .ok_or(anyhow::Error::msg("Machine not found"))?;
    let machine_infos = machine.get_infos().await?;

    Ok(Json(MachineInfoResBody { machine_infos }))
}

// machine status with socket
#[utoipa::path(get, path = "/api/machines/status")]
pub async fn get_machine_status(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_get_machine_status(socket))
}

pub async fn handle_get_machine_status(mut socket: WebSocket) {
    'outer: loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        let config = config().read().await.clone();

        for machine in config.machines.values() {
            let infos = machine.get_status().await.unwrap();

            let status = MachineStatus {
                id: machine.id.clone(),
                status: infos,
            };

            let message = Message::Text(serde_json::to_string(&status).unwrap());
            match socket.send(message).await {
                Ok(_) => continue,
                Err(e) => {
                    error!("Failed to send message: {:?}", e);
                    break 'outer;
                }
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct MachineStatus {
    pub id: String,
    pub status: String,
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
