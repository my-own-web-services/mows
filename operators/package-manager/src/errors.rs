use crate::repository::RenderError;

#[derive(Debug, thiserror::Error)]
pub enum PackageManagerErrors {
    #[error("Repository error {0}")]
    RepositoryError(#[from] RenderError),
}
