use filez_client::types::JobType;

#[derive(Debug, thiserror::Error)]
pub enum ImageError {
    #[error("The given job type is not supported by this app.")]
    UnsupportedJobType(JobType),
}
