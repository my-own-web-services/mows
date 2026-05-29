//! Tiny shared helpers. Kept minimal — anything that grows real
//! logic moves to its own module.

pub fn get_current_timestamp() -> chrono::NaiveDateTime {
    chrono::Utc::now().naive_utc()
}

/// Error shape `diesel-enum`'s `DbEnum` macro hands to its
/// `error_fn`. Lets every chat `DbEnum` declaration use the same
/// hook so an unknown SMALLINT in a column surfaces as a typed
/// error instead of a panic at decode time.
#[derive(Debug, thiserror::Error)]
#[error("invalid enum type: {msg}")]
pub struct InvalidEnumType {
    pub msg: String,
}

impl InvalidEnumType {
    pub fn invalid_type_log(msg: String) -> Self {
        InvalidEnumType { msg }
    }
}
