#[derive(Debug, thiserror::Error)]
pub enum FileGroupError {
    #[error("File group not found: {0}")]
    NotFound(String),
    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),
    #[error("Deadpool connection error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[error("AccessPolicy Error: {0}")]
    AccessPolicyError(#[from] crate::models::access_policies::errors::AccessPolicyError),
}
