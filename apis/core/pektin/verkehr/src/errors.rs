use std::fmt::{Debug, Formatter};

#[derive(Debug, thiserror::Error)]
pub enum VerkehrError {
    #[error("Kubernetes controller is missing resource name")]
    ControllerMissingResourceName(String),
    #[error("Kube Error: {0}")]
    ControllerKubeError(#[from] kube::Error),

    #[error("Finalizer Error: {0}")]
    ControllerFinalizerError(#[from] Box<kube::runtime::finalizer::Error<VerkehrError>>),

    #[error("Config conversion error: {0}")]
    ControllerConfigConversionError(String),
}

impl VerkehrError {
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

pub fn get_error_type(e: &VerkehrError) -> String {
    let reason = format!("{:?}", e.typed_debug());
    let reason = reason.split_at(reason.find('(').unwrap_or(0)).0;
    reason.to_string()
}
