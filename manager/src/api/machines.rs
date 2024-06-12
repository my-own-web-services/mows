use axum::Json;

use crate::{
    config::Machine,
    machines::MachineCreationConfig,
    types::Success,
    utils::{AppError, CONFIG},
};

#[utoipa::path(
    post,
    path = "/api/machines/create",
    request_body = MachineCreationConfig,
    responses(
        (status = 200, description = "Created machines", body = [Success]),
        (status = 500, description = "Failed to create machines", body = [String])
    )
)]
pub async fn create_machines(
    Json(machine_creation_config): Json<MachineCreationConfig>,
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
    delete,
    path = "/api/machines/deleteall",
    responses(
        (status = 200, description = "Deleted machines", body = [Success]),
        (status = 500, description = "Failed to create machines", body = [String])
    )
)]
pub async fn delete_all_machines() -> Result<Json<Success>, AppError> {
    Machine::delete_all_mows_machines().await?;

    Ok(Json(Success {
        message: "Machines deleted".to_string(),
    }))
}
