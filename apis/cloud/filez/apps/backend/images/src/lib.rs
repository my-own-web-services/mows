use filez_client::types::{FilezJob, JobType};

use crate::errors::ImageError;

pub mod config;
pub mod errors;

pub async fn handle_job(job: FilezJob) -> Result<(), ImageError> {
    match job.execution_information.job_type {
        JobType::CreatePreview(create_preview_infos) => {
            todo!();
        }
        _ => {
            return Err(ImageError::UnsupportedJobType(
                job.execution_information.job_type,
            ));
        }
    }
}
