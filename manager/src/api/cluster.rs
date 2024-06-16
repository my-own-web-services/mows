use crate::{config::Cluster, types::Success, utils::AppError};
use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[utoipa::path(
    post,
    path = "/api/cluster/create",
    request_body = ClusterCreationConfig,
    responses(
        (status = 200, description = "Created cluster", body = Success),
        (status = 500, description = "Failed to create cluster", body = String)
    )
)]
pub async fn create_cluster(
    Json(_cluster_creation_config): Json<ClusterCreationConfig>,
) -> Result<Json<Success>, AppError> {
    Cluster::new().await?;

    Ok(Json(Success {
        message: "Cluster created".to_string(),
    }))
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ClusterCreationConfig {}
