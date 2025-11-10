use crate::config::routing_config::HttpMiddleware;
use http::{Request, Response};
use http_body_util::combinators::BoxBody;
use hyper::body::{Bytes, Incoming};
use std::fmt;

// Re-export submodules
mod add_prefix;
mod basic_auth;
mod buffering;
mod chain;
mod circuit_breaker;
mod compress;
mod content_type;
mod cors;
mod digest_auth;
mod errors;
mod forward_auth;
mod headers;
mod in_flight_req;
mod ip_whitelist;
mod pass_tls_client_cert;
mod rate_limit;
mod redirect_regex;
mod redirect_scheme;
mod replace_path;
mod replace_path_regex;
mod retry;
mod strip_prefix;
mod strip_prefix_regex;

/// Checks if any middleware requires buffering the response body
pub fn requires_body_buffering(middlewares: &[HttpMiddleware]) -> bool {
    middlewares.iter().any(|m| match m {
        HttpMiddleware::Compress(_) => true,
        HttpMiddleware::Buffering(_) => true,
        HttpMiddleware::Errors(_) => true,
        _ => false,
    })
}

// Public interface
pub async fn handle_middleware_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    middlewares_to_use: Vec<HttpMiddleware>,
) -> anyhow::Result<&Response<BoxBody<Bytes, std::convert::Infallible>>, MiddlewareError> {
    if middlewares_to_use.is_empty() {
        return Ok(res);
    }
    for middleware in middlewares_to_use {
        inner_handle_middleware_outgoing(res, middleware).await?;
    }

    Ok(res)
}

pub async fn handle_middleware_incoming(
    req: &mut Request<Incoming>,
    middlewares_to_use: Vec<HttpMiddleware>,
) -> anyhow::Result<&Request<Incoming>, MiddlewareError> {
    if middlewares_to_use.is_empty() {
        return Ok(req);
    }
    for middleware in middlewares_to_use {
        inner_handle_middleware_incoming(req, middleware).await?;
    }

    Ok(req)
}

#[derive(Debug)]
pub enum MiddlewareError {
    Default {
        res: Response<BoxBody<Bytes, std::convert::Infallible>>,
    },
}

impl fmt::Display for MiddlewareError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Oh no, something bad went down")
    }
}

// Shared utility macros
#[allow(unused_macros)]
macro_rules! some_or_internal_error {
    ( $option:expr ) => {{
        if let Some(val) = $option {
            val
        } else {
            return Err($crate::middleware::http::MiddlewareError::Default {
                res: http::Response::builder()
                    .status(500)
                    .body({
                        use http_body_util::BodyExt;
                        http_body_util::Full::new(hyper::body::Bytes::from("Internal Server Error"))
                            .map_err(|never| match never {})
                            .boxed()
                    })
                    .unwrap(),
            });
        }
    }};
}

macro_rules! ok_or_internal_error {
    ( $result:expr ) => {{
        if let Ok(val) = $result {
            val
        } else {
            return Err($crate::middleware::http::MiddlewareError::Default {
                res: http::Response::builder()
                    .status(500)
                    .body({
                        use http_body_util::BodyExt;
                        http_body_util::Full::new(hyper::body::Bytes::from("Internal Server Error"))
                            .map_err(|never| match never {})
                            .boxed()
                    })
                    .unwrap(),
            });
        }
    }};
}

macro_rules! true_or_internal_error {
    ( $bool:expr ) => {{
        if !$bool {
            return Err($crate::middleware::http::MiddlewareError::Default {
                res: http::Response::builder()
                    .status(500)
                    .body({
                        use http_body_util::BodyExt;
                        http_body_util::Full::new(hyper::body::Bytes::from("Internal Server Error"))
                            .map_err(|never| match never {})
                            .boxed()
                    })
                    .unwrap(),
            });
        }
    }};
}

// Make macros available to submodules
pub(crate) use ok_or_internal_error;
pub(crate) use true_or_internal_error;

async fn inner_handle_middleware_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    middleware: HttpMiddleware,
) -> anyhow::Result<&Response<BoxBody<Bytes, std::convert::Infallible>>, MiddlewareError> {
    match middleware {
        HttpMiddleware::AddPrefix(_) => {}
        HttpMiddleware::BasicAuth(_) => {}
        HttpMiddleware::Buffering(arg) => buffering::handle_outgoing(res, arg).await?,
        HttpMiddleware::Chain(arg) => chain::handle_outgoing(res, arg).await?,
        HttpMiddleware::CircuitBreaker(_) => {}
        HttpMiddleware::Compress(arg) => compress::handle_outgoing(res, arg).await?,
        HttpMiddleware::ContentType(arg) => content_type::handle_outgoing(res, arg).await?,
        HttpMiddleware::Cors(arg) => cors::handle_outgoing(res, arg)?,
        HttpMiddleware::DigestAuth(_) => {}
        HttpMiddleware::Errors(arg) => errors::handle_outgoing(res, arg).await?,
        HttpMiddleware::ForwardAuth(_) => {}
        HttpMiddleware::Headers(arg) => headers::handle_outgoing(res, arg)?,
        HttpMiddleware::IpWhiteList(_) => {}
        HttpMiddleware::InFlightReq(_) => {}
        HttpMiddleware::PassTLSClientCert(_) => {}
        HttpMiddleware::RateLimit(_) => {}
        HttpMiddleware::RedirectScheme(_) => {}
        HttpMiddleware::RedirectRegex(_) => {}
        HttpMiddleware::ReplacePath(_) => {}
        HttpMiddleware::ReplacePathRegex(_) => {}
        HttpMiddleware::Retry(arg) => retry::handle_outgoing(res, arg).await?,
        HttpMiddleware::StripPrefix(_) => {}
        HttpMiddleware::StripPrefixRegex(_) => {}
    }
    Ok(res)
}

async fn inner_handle_middleware_incoming(
    req: &mut Request<Incoming>,
    middleware: HttpMiddleware,
) -> anyhow::Result<&Request<Incoming>, MiddlewareError> {
    match middleware {
        HttpMiddleware::AddPrefix(arg) => add_prefix::handle_incoming(req, arg)?,
        HttpMiddleware::BasicAuth(arg) => basic_auth::handle_incoming(req, arg)?,
        HttpMiddleware::Buffering(arg) => buffering::handle_incoming(req, arg).await?,
        HttpMiddleware::Chain(arg) => chain::handle_incoming(req, arg)?,
        HttpMiddleware::CircuitBreaker(arg) => circuit_breaker::handle_incoming(req, arg)?,
        HttpMiddleware::Compress(_arg) => {
            // Not relevant incoming
        }
        HttpMiddleware::ContentType(_) => {}
        HttpMiddleware::Cors(_) => {
            // Cors is only relevant outgoing
        }
        HttpMiddleware::DigestAuth(arg) => digest_auth::handle_incoming(req, arg)?,
        HttpMiddleware::Errors(_) => {}
        HttpMiddleware::ForwardAuth(arg) => forward_auth::handle_incoming(req, arg).await?,
        HttpMiddleware::Headers(arg) => headers::handle_incoming(req, arg)?,
        HttpMiddleware::IpWhiteList(arg) => ip_whitelist::handle_incoming(req, arg)?,
        HttpMiddleware::InFlightReq(arg) => in_flight_req::handle_incoming(req, arg)?,
        HttpMiddleware::PassTLSClientCert(arg) => pass_tls_client_cert::handle_incoming(req, arg)?,
        HttpMiddleware::RateLimit(arg) => rate_limit::handle_incoming(req, arg)?,
        HttpMiddleware::RedirectScheme(arg) => redirect_scheme::handle_incoming(req, arg)?,
        HttpMiddleware::RedirectRegex(arg) => redirect_regex::handle_incoming(req, arg)?,
        HttpMiddleware::ReplacePath(arg) => replace_path::handle_incoming(req, arg)?,
        HttpMiddleware::ReplacePathRegex(arg) => replace_path_regex::handle_incoming(req, arg)?,
        HttpMiddleware::Retry(arg) => retry::handle_incoming(req, arg)?,
        HttpMiddleware::StripPrefix(arg) => strip_prefix::handle_incoming(req, arg)?,
        HttpMiddleware::StripPrefixRegex(arg) => strip_prefix_regex::handle_incoming(req, arg)?,
    }
    Ok(req)
}
