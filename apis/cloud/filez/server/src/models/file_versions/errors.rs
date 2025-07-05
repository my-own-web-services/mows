#[derive(Debug, thiserror::Error)]
pub enum FileVersionError {
    #[error("File version not found: {0}")]
    NotFound(String),
    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),
    #[error("Deadpool connection error: {0}")]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[error(transparent)]
    StorageLocationError(#[from] crate::models::storage_locations::errors::StorageLocationError),
    #[error("File Error: {0}")]
    FileError(#[from] crate::models::files::errors::FilezFileError),
}
