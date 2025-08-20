use anyhow::bail;
use axum::http::HeaderValue;
use serde::{
    de::{self, Deserializer, Visitor},
    Deserialize,
};
use std::fmt;
use std::str::FromStr;
use tokio::signal::{self};
use url::Url;
use utoipa::ToSchema;

use crate::errors::FilezError;

pub fn get_current_timestamp() -> chrono::NaiveDateTime {
    chrono::Utc::now().naive_utc()
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

#[derive(Debug, thiserror::Error)]
#[error("Invalid enum type: {msg}")]
pub struct InvalidEnumType {
    pub msg: String,
}

impl InvalidEnumType {
    pub fn invalid_type_log(msg: String) -> Self {
        InvalidEnumType { msg }
    }
}

pub struct Range {
    pub start: u64,
    pub end: Option<u64>,
    pub length: Option<u64>,
}

pub fn parse_range(range: &str) -> anyhow::Result<Range> {
    let parts = range.split('=').collect::<Vec<_>>();
    if parts.len() != 2 {
        bail!("Invalid range");
    }
    let range_type = parts
        .first()
        .ok_or_else(|| anyhow::anyhow!("No range type"))?;
    let range = parts.get(1).ok_or_else(|| anyhow::anyhow!("No range"))?;
    if range_type != &"bytes" {
        bail!("Invalid range type");
    }
    let range_parts = range.split('-').collect::<Vec<_>>();

    if range_parts.len() != 2 {
        bail!("Invalid range");
    }
    let start = range_parts
        .first()
        .ok_or_else(|| anyhow::anyhow!("Invalid range byte start"))?
        .parse::<u64>()?;
    let end = range_parts
        .get(1)
        .ok_or_else(|| anyhow::anyhow!("Invalid range byte end"))?
        .parse::<u64>()
        .ok();
    Ok(Range {
        start,
        end,
        length: end.map(|e| e - start + 1),
    })
}

pub async fn is_dev_origin(config: &crate::config::FilezServerConfig, origin: &Url) -> Option<Url> {
    if config.enable_dev {
        for dev_origin_url in config.dev_allow_origins.iter() {
            if dev_origin_url == origin {
                return Some(dev_origin_url.clone());
            }
        }
    }
    return None;
}

#[tracing::instrument(level = "trace")]
pub fn safe_parse_mime_type(
    file_mime_type: &str,
    file_version_mime_type: &str,
    app_path: &Option<String>,
) -> Result<HeaderValue, FilezError> {
    let mime_type_to_use = match app_path {
        Some(_) => file_version_mime_type,
        None => {
            if file_mime_type != file_version_mime_type {
                return Err(FilezError::GenericError(anyhow::anyhow!(
                    "File and file version MIME types do not match while file version app_path is None: {} != {}",
                    file_mime_type,
                    file_version_mime_type
                )));
            } else {
                file_mime_type
            }
        }
    };

    let unsafe_mime_types = vec!["text/javascript", "text/css", "text/html"];

    Ok(if unsafe_mime_types.contains(&mime_type_to_use) {
        HeaderValue::from_static("text/plain")
    } else {
        mime_type_to_use.parse::<HeaderValue>().unwrap()
    })
}

/// A "fake" Option type that can be deserialized from a URL path.
/// It treats the literal string "null" as `None` and any other value
/// as `Some(T)`, attempting to parse it using `FromStr`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ToSchema)]
pub enum OptionalPath<T> {
    Some(T),
    None,
}

// Helper visitor for the deserializer
struct FakeOptionVisitor<T> {
    _marker: std::marker::PhantomData<T>,
}

impl<'de, T> Visitor<'de> for FakeOptionVisitor<T>
where
    T: FromStr,
    <T as FromStr>::Err: fmt::Display,
{
    type Value = OptionalPath<T>;

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter
            .write_str("a string literal 'null' or a value that can be parsed into the inner type")
    }

    // This is the core logic. It's called when Serde encounters a string.
    fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
    where
        E: de::Error,
    {
        if value.eq_ignore_ascii_case("null") {
            Ok(OptionalPath::None)
        } else {
            // Attempt to parse the string into the inner type T
            T::from_str(value)
                .map(OptionalPath::Some)
                .map_err(|e| de::Error::custom(format!("failed to parse '{}': {}", value, e)))
        }
    }
}

// The custom Deserialize implementation
impl<'de, T> Deserialize<'de> for OptionalPath<T>
where
    T: FromStr,
    <T as FromStr>::Err: fmt::Display,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        // We tell Serde to expect a string and use our visitor to handle it.
        deserializer.deserialize_str(FakeOptionVisitor {
            _marker: std::marker::PhantomData,
        })
    }
}

// Optional: Implement `Into<Option<T>>` for easy conversion to a standard `Option`.
impl<T> From<OptionalPath<T>> for Option<T> {
    fn from(fake_option: OptionalPath<T>) -> Self {
        match fake_option {
            OptionalPath::Some(value) => Some(value),
            OptionalPath::None => None,
        }
    }
}
