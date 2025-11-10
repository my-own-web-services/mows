use super::{ok_or_internal_error, MiddlewareError};
use crate::config::routing_config::ForwardAuth;
use http::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};

pub async fn handle_incoming(req: &mut Request<Incoming>, arg: ForwardAuth) -> Result<(), MiddlewareError> {
    // Build auth request
    let mut auth_req = reqwest::Client::new()
        .get(&arg.address)
        .build()
        .map_err(|_| MiddlewareError::Default {
            res: Response::builder()
                .status(500)
                .body(
                    Full::new(Bytes::from("Failed to build auth request"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        })?;

    // Forward specified headers from original request
    if let Some(auth_request_headers) = &arg.auth_request_headers {
        for header_name in auth_request_headers {
            if let Some(header_value) = req.headers().get(header_name) {
                auth_req.headers_mut().insert(
                    ok_or_internal_error!(http::header::HeaderName::from_bytes(header_name.as_bytes())),
                    header_value.clone(),
                );
            }
        }
    }

    // Make auth request
    let client = reqwest::Client::new();
    let auth_response = client.execute(auth_req).await.map_err(|_| MiddlewareError::Default {
        res: Response::builder()
            .status(500)
            .body(
                Full::new(Bytes::from("Auth service unavailable"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap(),
    })?;

    // Check auth response status
    if !auth_response.status().is_success() {
        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .body(
                    Full::new(Bytes::from("Authentication failed"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    }

    // Copy response headers to request
    if let Some(auth_response_headers) = &arg.auth_response_headers {
        for header_name in auth_response_headers {
            if let Some(header_value) = auth_response.headers().get(header_name) {
                req.headers_mut().insert(
                    ok_or_internal_error!(http::header::HeaderName::from_bytes(header_name.as_bytes())),
                    header_value.clone(),
                );
            }
        }
    }

    // Or copy headers matching regex
    if let Some(regex_pattern) = &arg.auth_response_headers_regex {
        let re = regex::Regex::new(regex_pattern).map_err(|_| MiddlewareError::Default {
            res: Response::builder()
                .status(500)
                .body(
                    Full::new(Bytes::from("Invalid regex pattern"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        })?;

        for (header_name, header_value) in auth_response.headers().iter() {
            if re.is_match(header_name.as_str()) {
                req.headers_mut().insert(header_name.clone(), header_value.clone());
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: ForwardAuth requires actual HTTP requests to external services,
    // so comprehensive testing would require a mock auth server.
    // Here we just verify the basic structure compiles.

    #[test]
    fn test_forward_auth_config() {
        let config = ForwardAuth {
            address: "http://auth.example.com".to_string(),
            trust_forward_header: Some(true),
            auth_response_headers: Some(vec!["X-User".to_string()]),
            auth_response_headers_regex: None,
            auth_request_headers: Some(vec!["Authorization".to_string()]),
            tls: None,
        };

        assert_eq!(config.address, "http://auth.example.com");
    }
}
