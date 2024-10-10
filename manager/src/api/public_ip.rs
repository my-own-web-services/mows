use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::{
    public_ip::create_public_ip_handler,
    types::{ApiResponse, ApiResponseStatus},
    utils::generate_id,
    write_config,
};

#[utoipa::path(
    post,
    path = "/api/public_ip/create",
    responses(
        (status = 200, description = "Created public static ip address", body = ApiResponse),
    )
)]
pub async fn create_public_ip(
    Json(public_ip_creation_config): Json<PublicIpCreationConfig>,
) -> Json<ApiResponse<()>> {
    let id = generate_id(8);
    let public_ip_config =
        match create_public_ip_handler(public_ip_creation_config.creation_type).await {
            Ok(config) => config,
            Err(e) => {
                tracing::error!("Failed to create ip address: {:?}", e);
                return Json(ApiResponse {
                    message: format!("Failed to create ip address: {:?}", e),
                    status: ApiResponseStatus::Error,
                    data: None,
                });
            }
        };

    let mut write_config = write_config!();

    let cluster = match write_config
        .clusters
        .get_mut(&public_ip_creation_config.cluster_id)
    {
        Some(cluster) => cluster,
        None => {
            return Json(ApiResponse {
                message: "Cluster not found".to_string(),
                status: ApiResponseStatus::Error,
                data: None,
            });
        }
    };

    cluster.public_ip_config.insert(id, public_ip_config);

    Json(ApiResponse {
        message: "Created ip address".to_string(),
        status: ApiResponseStatus::Success,
        data: None,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct PublicIpCreationConfig {
    pub cluster_id: String,
    pub creation_type: PublicIpCreationConfigType,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub enum PublicIpCreationConfigType {
    MachineProxy(String, String),
}
