use std::fmt::{Debug, Formatter};
#[derive(Debug, thiserror::Error)]
pub enum ControllerError {
    #[error("SerializationError: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("Kube Error: {0}")]
    KubeError(#[from] kube::Error),
    #[error("Finalizer Error: {0}")]
    FinalizerError(#[from] Box<kube::runtime::finalizer::Error<ControllerError>>),
    #[error("Missing resource name: {0}")]
    MissingResourceName(String),
    #[error("Storage Error: {0}")]
    StorageError(#[from] crate::storage::errors::StorageError),
    #[error("MowsApp Error: {0}")]
    MowsAppError(#[from] crate::models::apps::errors::MowsAppError),
    #[error("Storage Location Error: {0}")]
    StorageLocationError(#[from] crate::models::storage_locations::errors::StorageLocationError),
}
pub type Result<T, E = ControllerError> = std::result::Result<T, E>;

impl ControllerError {
    pub fn metric_label(&self) -> String {
        format!("{self:?}").to_lowercase()
    }
}

struct TypedDebugWrapper<'a, T: ?Sized>(&'a T);

impl<T: Debug> Debug for TypedDebugWrapper<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> core::fmt::Result {
        write!(f, "{}::{:?}", core::any::type_name::<T>(), self.0)
    }
}

trait TypedDebug: Debug {
    fn typed_debug(&self) -> TypedDebugWrapper<'_, Self> {
        TypedDebugWrapper(self)
    }
}

impl<T: ?Sized + Debug> TypedDebug for T {}

pub fn get_error_type(e: &ControllerError) -> String {
    let reason = format!("{:?}", e.typed_debug());
    let reason = reason.split_at(reason.find('(').unwrap_or(0)).0;
    reason.to_string()
}
