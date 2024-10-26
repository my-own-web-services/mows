use actix_web::{
    error::{ErrorBadRequest, JsonPayloadError},
    HttpRequest, HttpResponse,
};
use serde::Serialize;
use serde_json::json;
use thiserror::Error;

use crate::types::ResponseType;

/// Creates an error response with a message for each item in the request that the response is for.
///
/// The messages that are [`None`] will have a response type of [`ResponseType::Ignored`], all
/// others a type of [`ResponseType::Error`].
pub fn err(
    toplevel_message: impl Serialize,
    messages: Vec<Option<impl Serialize>>,
) -> HttpResponse {
    let messages: Vec<_> = messages
        .into_iter()
        .map(|msg| match msg {
            Some(m) => response(ResponseType::Error, json!(m)),
            None => response(
                ResponseType::Ignored,
                json!("ignored because another part of the request caused an error"),
            ),
        })
        .collect();
    HttpResponse::BadRequest().json(response_with_data(
        ResponseType::Error,
        toplevel_message,
        messages,
    ))
}

/// Creates an authentication error response.
pub fn auth_err(message: impl Serialize) -> HttpResponse {
    HttpResponse::Unauthorized().json(response_with_data(
        ResponseType::Error,
        message,
        json!(null),
    ))
}

/// Creates an internal server error response.
pub fn internal_err(message: impl Serialize) -> HttpResponse {
    HttpResponse::InternalServerError().json(response_with_data(
        ResponseType::Error,
        message,
        json!(null),
    ))
}

/// Creates a success response with a message for each item in the request that the response is
/// for.
pub fn success(toplevel_message: impl Serialize, messages: Vec<impl Serialize>) -> HttpResponse {
    let messages: Vec<_> = messages
        .into_iter()
        .map(|msg| response(ResponseType::Success, msg))
        .collect();
    HttpResponse::Ok().json(response_with_data(
        ResponseType::Success,
        toplevel_message,
        messages,
    ))
}

/// Creates a (partial) success response with a custom response type, message, and data for each
/// item in the request that the response is for.
pub fn partial_success_with_data(
    toplevel_response_type: ResponseType,
    toplevel_message: impl Serialize,
    response_type_and_messages_and_data: Vec<(ResponseType, impl Serialize, impl Serialize)>,
) -> HttpResponse {
    let messages: Vec<_> = response_type_and_messages_and_data
        .into_iter()
        .map(|(rtype, msg, data)| response_with_data(rtype, msg, data))
        .collect();
    HttpResponse::Ok().json(response_with_data(
        toplevel_response_type,
        toplevel_message,
        messages,
    ))
}

/// Creates a success response containig only a toplevel message and data value.
pub fn success_with_toplevel_data(message: impl Serialize, data: impl Serialize) -> HttpResponse {
    HttpResponse::Ok().json(response_with_data(ResponseType::Success, message, data))
}

pub fn json_error_handler(err: JsonPayloadError, _: &HttpRequest) -> actix_web::error::Error {
    let err_msg = match err {
        JsonPayloadError::ContentType => "Content type error: must be 'application/json'".into(),
        _ => err.to_string(),
    };
    let err_content = json!(response_with_data(
        ResponseType::Error,
        err_msg,
        json!(null),
    ));
    ErrorBadRequest(serde_json::to_string_pretty(&err_content).expect("Could not serialize error"))
}

#[derive(Debug, Error)]
pub enum PektinApiError {
    #[error("{0}")]
    CommonError(#[from] pektin_common::PektinCommonError),
    #[error("{0}")]
    DbPool(#[from] pektin_common::deadpool_redis::PoolError),
    #[error("Could not (de)serialize JSON")]
    Json(#[from] serde_json::Error),
    #[error("I/O error")]
    IoError(#[from] std::io::Error),
    // TODO: change this to a manual From impl, also this is not really Vault-specific
    #[error("Error contacting Vault: {0}")]
    Vault(#[from] reqwest::Error),
    #[error("Invalid Base64")]
    Base64(#[from] data_encoding::DecodeError),
    #[error("Could not parse the signature received from Vault")]
    InvalidSigFromVault,
    #[error("Error signaling the pektin-api token rotation to Vault")]
    ApiTokenRotation,
    #[error("No SOA record found for this zone")]
    NoSoaRecord,
    #[error("Db key has invalid format")]
    InvalidDbKey,
    #[error("The queried domain name is invalid")]
    InvalidDomainName,
    #[error("Invalid username or password")]
    InvalidCredentials,
    #[error("Error while hashing")]
    CouldNotHash,

    // FIXME/TODO: differentiate between vault and ribston errors
    #[error("Failed to query Ribston")]
    Ribston,
    #[error("Failed to get combined password")]
    GetCombinedPassword,
    #[error("Failed to get ribston policy")]
    GetRibstonPolicy,
}
pub type PektinApiResult<T> = Result<T, PektinApiError>;

pub fn response(rtype: ResponseType, msg: impl Serialize) -> impl Serialize {
    json!({
        "type": rtype,
        "message": msg,
    })
}

pub fn response_with_data(
    rtype: ResponseType,
    msg: impl Serialize,
    data: impl Serialize,
) -> impl Serialize {
    json!({
        "type": rtype,
        "message": msg,
        "data": data,
    })
}
