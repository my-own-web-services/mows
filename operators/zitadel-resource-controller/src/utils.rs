use crate::ControllerError;
use std::fmt::{Debug, Formatter};

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_error_type_generic_error() {
        let err = ControllerError::GenericError("something went wrong".to_string());
        let result = get_error_type(&err);
        assert!(
            result.contains("GenericError"),
            "Expected 'GenericError' in '{}', got '{}'",
            stringify!(ControllerError::GenericError),
            result
        );
        // Should NOT contain the inner message (truncated at the opening paren)
        assert!(
            !result.contains("something went wrong"),
            "Should not contain inner error message, got '{}'",
            result
        );
    }

    #[test]
    fn test_get_error_type_tonic_status_error() {
        let err = ControllerError::TonicStatusError(tonic::Status::not_found("resource missing"));
        let result = get_error_type(&err);
        assert!(
            result.contains("TonicStatusError"),
            "Expected 'TonicStatusError' in result, got '{}'",
            result
        );
    }

    #[test]
    fn test_get_error_type_serialization_error() {
        let serde_err = serde_json::from_str::<String>("not valid json").unwrap_err();
        let err = ControllerError::SerializationError(serde_err);
        let result = get_error_type(&err);
        assert!(
            result.contains("SerializationError"),
            "Expected 'SerializationError' in result, got '{}'",
            result
        );
    }
}
