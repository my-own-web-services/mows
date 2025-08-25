use crate::{models::jobs::FilezJob, state::ServerState};
use tracing::error;

#[tracing::instrument(level = "trace", skip(server_state))]
pub fn run_background_tasks(server_state: &ServerState) {
    let database = server_state.database.clone();
    tokio::spawn(async move {
        loop {
            if let Err(e) = FilezJob::release_jobs(&database, 10).await {
                error!("Error releasing jobs: {}", e);
            }
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        }
    });
}
