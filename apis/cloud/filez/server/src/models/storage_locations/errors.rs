use crate::storage::errors::StorageError;

#[derive(Debug, thiserror::Error)]
pub enum StorageLocationError {
    #[error("Storage location not found: {0}")]
    NotFound(String),
    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),
    #[error("Deadpool connection error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[error(transparent)]
    StorageError(#[from] StorageError),
}
