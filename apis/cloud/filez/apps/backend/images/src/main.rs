use filez_apps_backend_images::config::config;
use filez_apps_backend_images::handle_job;
use filez_server_client::client::{ApiClient, AuthMethod};
use filez_server_client::types::{
    JobStatus, JobStatusDetails, JobStatusDetailsCompleted, JobStatusDetailsFailed,
    PickupJobRequestBody, UpdateJobStatusRequestBody,
};
use mows_common_rust::{
    get_current_config_cloned, observability::init_observability, utils::generate_id,
};
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let config = get_current_config_cloned!(config());
    init_observability().await;

    let runtime_instance_id = generate_id(20);

    let filez_server_client = ApiClient::new(
        config.filez_server_url.to_string(),
        Some(AuthMethod::ServiceAccountTokenDefaultPath),
        None,
        Some(runtime_instance_id.clone()),
    )?;

    loop {
        match filez_server_client
            .pickup_job(PickupJobRequestBody {})
            .await
        {
            Ok(job_response) => match job_response.data.job {
                Some(job) => {
                    info!("Picked up job: {:?}", job);
                    let _ = match handle_job(job, &filez_server_client).await {
                        Ok(_) => {
                            info!("Job completed successfully.");
                            filez_server_client
                                .update_job_status(UpdateJobStatusRequestBody {
                                    new_status: JobStatus::Completed,
                                    new_job_status_details: Some(JobStatusDetails::Completed(
                                        JobStatusDetailsCompleted {
                                            message: "Job completed successfully.".to_string(),
                                        },
                                    )),
                                })
                                .await
                                .map_err(|e| error!("Failed to update job status: {:?}", e))
                        }
                        Err(e) => {
                            error!("Error handling job: {:?}", e);
                            filez_server_client
                                .update_job_status(UpdateJobStatusRequestBody {
                                    new_status: JobStatus::Failed,
                                    new_job_status_details: Some(JobStatusDetails::Failed(
                                        JobStatusDetailsFailed {
                                            message: e.to_string(),
                                            error: Some(e.to_string()),
                                        },
                                    )),
                                })
                                .await
                                .map_err(|e| {
                                    error!("Failed to update job status: {:?}", e);
                                })
                        }
                    };
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
