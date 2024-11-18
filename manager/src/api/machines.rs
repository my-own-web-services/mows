use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, WebSocketUpgrade,
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
    dev_mode_disabled, get_current_config_cloned,
    machines::{MachineStatus, MachineType, VncWebsocket},
    providers::{
        hcloud::machine::ExternalMachineProviderHcloudConfig,
        local_physical::machine::LocalMachineProviderPhysicalConfig,
        qemu::machine::{LocalMachineProviderQemu, LocalMachineProviderQemuConfig},
    },
    types::{ApiResponse, ApiResponseStatus, EmptyApiResponse},
    write_config,
};

#[utoipa::path(
    post,
    path = "/api/machines/create",
    request_body = MachineCreationReqBody,
    responses(
        (status = 200, description = "Created machines", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn create_machines(
    Json(machine_creation_config): Json<MachineCreationReqBody>,
) -> Json<ApiResponse<()>> {
    spawn(async move {
        for machine_creation_req in machine_creation_config.machines {
            let machine = match Machine::new(&machine_creation_req).await {
                Ok(machine) => machine,
                Err(e) => {
                    error!("Failed to create machine: {:?}", e);
                    continue;
                }
            };
            let mut config_locked = write_config!();
            config_locked.machines.insert(machine.id.clone(), machine);
        }
    });

    Json(ApiResponse {
        message: "Started machine creation".to_string(),
        status: ApiResponseStatus::Success,
        data: None,
    })
}

#[utoipa::path(
    post,
    path = "/api/machines/signal",
    request_body = MachineSignalReqBody,
    responses(
        (status = 200, description = "Sent signal", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn signal_machine(
    Json(machine_signal): Json<MachineSignalReqBody>,
) -> Json<ApiResponse<()>> {
    let config = config().read().await;
    let machine = match config
        .machines
        .get(&machine_signal.machine_id)
        .ok_or(anyhow::Error::msg("Machine not found"))
    {
        Ok(machine) => machine,
        Err(e) => {
            return Json(ApiResponse {
                message: format!("Failed to send signal: {}", e),
                status: ApiResponseStatus::Error,
                data: None,
            })
        }
    };
    if let Err(e) = machine.send_signal(machine_signal.signal).await {
        return Json(ApiResponse {
            message: format!("Failed to send signal: {}", e),
            status: ApiResponseStatus::Error,
            data: None,
        });
    }

    Json(ApiResponse {
        message: "Sent signal".to_string(),
        status: ApiResponseStatus::Success,
        data: None,
    })
}

#[utoipa::path(
    delete,
    path = "/api/machines/delete",
    request_body=MachineDeleteReqBody,
    responses(
        (status = 200, description = "Machine deleted", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn delete_machine(
    Json(machine_delete): Json<MachineDeleteReqBody>,
) -> Json<ApiResponse<()>> {
    let config = get_current_config_cloned!();
    let machine = match config.machines.get(&machine_delete.machine_id) {
        Some(machine) => machine,
        None => {
            return Json(ApiResponse {
                message: "Machine not found".to_string(),
                status: ApiResponseStatus::Error,
                data: None,
            })
        }
    };
    if let Err(e) = machine.delete().await {
        return Json(ApiResponse {
            message: format!("Failed to delete machine: {}", e),
            status: ApiResponseStatus::Error,
            data: None,
        });
    }

    Json(ApiResponse {
        message: "Machine deleted".to_string(),
        status: ApiResponseStatus::Success,
        data: None,
    })
}

#[utoipa::path(
    delete,
    path = "/api/dev/machines/delete_all",
    responses(
        (status = 200, description = "Machines deleted", body = ApiResponse<EmptyApiResponse>),
    )
)]
pub async fn dev_delete_all_machines() -> Json<ApiResponse<()>> {
    dev_mode_disabled!();

    if let Err(e) = LocalMachineProviderQemu::dev_delete_all().await {
        return Json(ApiResponse {
            message: format!("Failed to delete machines: {}", e),
            status: ApiResponseStatus::Error,
            data: None,
        });
    }

    let config = get_current_config_cloned!();

    let machine_vec: Vec<(&String, &Machine)> = config
        .machines
        .iter()
        .filter(|(_, machine)| match machine.machine_type {
            MachineType::LocalQemu => true,
            _ => false,
        })
        .collect();
    let mut config = write_config!();

    for (id, _) in machine_vec {
        config.machines.remove(id);
    }

    config.clusters.clear();

    Json(ApiResponse {
        message: "Machines deleted".to_string(),
        status: ApiResponseStatus::Success,
        data: None,
    })
}

#[utoipa::path(
    post,
    path = "/api/machines/info",
    request_body=MachineInfoReqBody,
    responses(
        (status = 200, description = "Got machine info", body =  ApiResponse<MachineInfoResBody>),
    )
)]
pub async fn get_machine_info(
    Json(machine_info_json): Json<MachineInfoReqBody>,
) -> Json<ApiResponse<MachineInfoResBody>> {
    let config = get_current_config_cloned!();
    let machine = match config.machines.get(&machine_info_json.machine_id) {
        Some(machine) => machine,
        None => {
            return Json(ApiResponse {
                message: "Machine not found".to_string(),
                status: ApiResponseStatus::Error,
                data: None,
            })
        }
    };
    let machine_infos = match machine.get_infos().await {
        Ok(infos) => infos,
        Err(e) => {
            return Json(ApiResponse {
                message: format!("Failed to get machine info: {}", e),
                status: ApiResponseStatus::Error,
                data: None,
            })
        }
    };

    Json(ApiResponse {
        message: "Got machine info".to_string(),
        status: ApiResponseStatus::Success,
        data: Some(MachineInfoResBody { machine_infos }),
    })
}

#[
    utoipa::path(
        get, 
        path = "/api/machines/vnc_websocket/:id",
        responses(
            (status = 200, description = "Got the websocket information", body =  ApiResponse<VncWebsocket>),
        )
    )    
]
pub async fn get_vnc_websocket(Path(id): Path<String>) -> impl IntoResponse {
    let config = get_current_config_cloned!();
    let machine = match config.machines.get(&id) {
        Some(machine) => machine,
        None => {
            return Json(ApiResponse {
                message: "Machine not found".to_string(),
                status: ApiResponseStatus::Error,
                data: None,
            })
        }
    };

    let vnc_websocket = match machine.get_vnc_websocket().await {
        Ok(vnc_websocket) => vnc_websocket,
        Err(e) => {
            return Json(ApiResponse {
                message: format!("Failed to get VNC websocket: {}", e),
                status: ApiResponseStatus::Error,
                data: None,
            })
        }
    };

    Json(ApiResponse {
        message: "Got VNC websocket".to_string(),
        status: ApiResponseStatus::Success,
        data: Some(vnc_websocket),
    })
}

// machine status with socket
#[utoipa::path(get, path = "/api/machines/status")]
pub async fn get_machine_status(ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_get_machine_status(socket))
}

pub async fn handle_get_machine_status(mut socket: WebSocket) {
    'outer: loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        let config = get_current_config_cloned!();

        for machine in config.machines.values() {
            let status = machine.get_status().await.unwrap_or(MachineStatus::Unknown);

            let status = MachineStatusResBody {
                id: machine.id.clone(),
                status,
            };

            let message = Message::Text(serde_json::to_string(&status).unwrap());
            match socket.send(message).await {
                Ok(_) => continue,
                Err(_e) => {
                    //error!("Failed to send message: {:?}", e);
                    break 'outer;
                }
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct MachineStatusResBody {
    pub id: String,
    pub status: MachineStatus,
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
pub struct MachineCreationReqBody {
    pub machines: Vec<MachineCreationReqType>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub enum MachineCreationReqType {
    LocalQemu(LocalMachineProviderQemuConfig),
    LocalPhysical(LocalMachineProviderPhysicalConfig),
    ExternalHcloud(ExternalMachineProviderHcloudConfig),
}
