use filez_apps_backend_images::config::config;
use filez_apps_backend_images::handle_job;
use filez_client::client::{ApiClient, AuthMethod};
use filez_client::types::PickupJobRequestBody;
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
    utils::generate_id,
};
use tracing::{error, info};

#[tokio::main]
async fn main() {
    let config = get_current_config_cloned!(config());
    let _common_config = get_current_config_cloned!(common_config(true));
    init_observability().await;

    let runtime_instance_id = generate_id(20);

    let filez_client = ApiClient::new(
        config.filez_server_url.to_string(),
        Some(AuthMethod::ServiceAccountTokenDefaultPath),
        None,
        Some(runtime_instance_id.clone()),
    );

    loop {
        match filez_client.pickup_job(PickupJobRequestBody {}).await {
            Ok(job_response) => match job_response.data.job {
                Some(job) => {
                    info!("Picked up job: {:?}", job);
                    match handle_job(job, &filez_client).await {
                        Ok(_) => {
                            info!("Job completed successfully.");
                        }
                        Err(e) => {
                            error!("Error handling job: {}", e);
                        }
                    }
                }
                None => {
                    info!("No job available at this time.");
                }
            },
            Err(e) => {
                error!("Error picking up job: {}", e);
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(
            config.no_work_wait_seconds,
        ))
        .await;
    }
}
