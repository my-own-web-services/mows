use crate::repository::RepositoryError;

#[derive(Debug, thiserror::Error)]
pub enum PackageManagerErrors {
    #[error("Database error: {0}")]
    DatabaseError(#[from] diesel::result::Error),
    #[error("Deadpool error {0}")]
    DeadpoolError(#[from] deadpool_diesel::PoolError),
    #[error("Interact error {0}")]
    InteractError(#[from] deadpool_diesel::InteractError),
    #[error("Repository error {0}")]
    RepositoryError(#[from] RepositoryError),
}
