#[derive(Debug, thiserror::Error)]

pub enum FilezErrors {
    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),
    #[error("Deadpool error {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
}
