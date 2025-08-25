use std::ops::Deref;

use axum::{
    extract::{FromRequest, Request},
    response::IntoResponse,
};
use mime_guess::get_mime_extensions_str;
use serde::Serialize;

use crate::errors::FilezError;

#[tracing::instrument(level = "trace")]
pub fn validate_optional_mime_type(
    maybe_mime_type: &Option<String>,
) -> Result<(), serde_valid::validation::Error> {
    match maybe_mime_type {
        Some(mime_type) => {
            validate_mime_type(mime_type)?;
            Ok(())
        }
        None => Ok(()),
    }
}

#[tracing::instrument(level = "trace")]
pub fn validate_mime_type(mime_type: &str) -> Result<(), serde_valid::validation::Error> {
    if mime_type.is_empty() {
        return Err(serde_valid::validation::Error::Custom(
            "MIME type cannot be empty".to_string(),
        ));
    }
    if !mime_type.contains('/') {
        return Err(serde_valid::validation::Error::Custom(
            "MIME type must contain a '/'".to_string(),
        ));
    }
    if mime_type.starts_with('/') || mime_type.ends_with('/') {
        return Err(serde_valid::validation::Error::Custom(
            "MIME type cannot start or end with '/'".to_string(),
        ));
    }
    if mime_type.contains(' ') {
        return Err(serde_valid::validation::Error::Custom(
            "MIME type cannot contain spaces".to_string(),
        ));
    }
    if mime_type.contains('\n') || mime_type.contains('\r') {
        return Err(serde_valid::validation::Error::Custom(
            "MIME type cannot contain newlines".to_string(),
        ));
    }
    if mime_type.chars().any(|c| !c.is_ascii() || c.is_control()) {
        return Err(serde_valid::validation::Error::Custom(
            "MIME type must be a valid ASCII string".to_string(),
        ));
    }

    get_mime_extensions_str(mime_type)
        .ok_or_else(|| serde_valid::validation::Error::Custom("Invalid MIME type".to_string()))?;

    Ok(())
}

// Code from: https://github.com/ya7010/axum_serde_valid
pub struct Json<T>(pub T);

impl<T> Deref for Json<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> From<T> for Json<T> {
    fn from(data: T) -> Self {
        Json(data)
    }
}

impl<T, S> FromRequest<S> for Json<T>
where
    T: serde::de::DeserializeOwned + serde_valid::Validate + 'static,
    S: Send + Sync,
{
    type Rejection = FilezError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let data: T = axum::Json::from_request(req, state).await?.0;

        data.validate()?;

        Ok(Json(data))
    }
}

impl<T> IntoResponse for Json<T>
where
    T: Serialize,
{
    fn into_response(self) -> axum::response::Response {
        axum::Json(self.0).into_response()
    }
}
