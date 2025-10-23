use crate::{models::jobs::FilezJob, state::ServerState};
use tracing::{error, info, trace, warn};

/// Retry interval in seconds for introspection URI discovery when it fails
const INTROSPECTION_DISCOVERY_RETRY_SECONDS: u64 = 5;

const JOB_TIMEOUT_SECONDS: u64 = 60 * 60;

#[tracing::instrument(level = "trace", skip(server_state))]
pub fn run_background_tasks(server_state: &ServerState) {
    // Job release task
    let database = server_state.database.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = FilezJob::release_jobs(&database, JOB_TIMEOUT_SECONDS).await {
                error!("Error releasing jobs: {}", e);
            }
            tokio::time::sleep(std::time::Duration::from_secs(JOB_TIMEOUT_SECONDS)).await;
        }
    });

    // Introspection URI discovery task
    let introspection_state = server_state.introspection_state.clone();
    tokio::spawn(async move {
        // Initial delay to allow server to start
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;

        loop {
            // Check if introspection_uri is already set
            let is_already_set = {
                let config = introspection_state.config.read().await;
                config.introspection_uri.is_some()
            };

            // If already discovered, exit the task
            if is_already_set {
                trace!("Introspection URI already discovered, stopping discovery task");
                break;
            }

            info!("Introspection URI not set, attempting discovery...");
            match introspection_state.get_introspection_uri().await {
                Ok(uri) => {
                    info!("Successfully discovered introspection URI: {:?}", uri);
                    // Exit the loop after successful discovery
                    break;
                }
                Err(e) => {
                    warn!(
                        "Failed to discover introspection URI: {}. Will retry in {} seconds.",
                        e, INTROSPECTION_DISCOVERY_RETRY_SECONDS
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(
                        INTROSPECTION_DISCOVERY_RETRY_SECONDS,
                    ))
                    .await;
                }
            }
        }
    });
}
