#[derive(Debug, thiserror::Error)]
pub enum MowsAppError {
    #[error("App with origin {0} not found")]
    AppNotFound(String),
    #[error("Failed to parse app origin url: {0}")]
    AppOriginParseError(#[from] url::ParseError),
    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),
    #[error("Deadpool connection error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
}
