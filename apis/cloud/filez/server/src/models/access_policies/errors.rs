#[derive(Debug, thiserror::Error)]
pub enum AccessPolicyError {
    #[error("Access policy not found: {0}")]
    NotFound(String),
    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),
    #[error("Deadpool connection error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[error("Unsupported resource type: {0}")]
    ResourceAuthInfoError(String),
    #[error("Auth evaluation error: {0}")]
    AuthEvaluationError(String),
    #[error("UserGroup Error: {0}")]
    UserGroupError(#[from] crate::models::user_groups::errors::UserGroupError),
}
