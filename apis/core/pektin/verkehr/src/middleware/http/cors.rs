use crate::routing_config::Cors;
use super::{MiddlewareError, ok_or_internal_error};
use http::{header::HeaderName, HeaderValue, Response};
use http_body_util::combinators::BoxBody;
use hyper::body::Bytes;
use std::str::FromStr;

pub fn handle_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    arg: Cors,
) -> Result<(), MiddlewareError> {
    res.headers_mut().insert(
        ok_or_internal_error!(HeaderName::from_str("Access-Control-Allow-Origin")),
        ok_or_internal_error!(HeaderValue::from_str(&arg.origin)),
    );
    res.headers_mut().insert(
        ok_or_internal_error!(HeaderName::from_str("Access-Control-Allow-Methods")),
        ok_or_internal_error!(HeaderValue::from_str(&arg.methods)),
    );
    res.headers_mut().insert(
        ok_or_internal_error!(HeaderName::from_str("Access-Control-Max-Age")),
        ok_or_internal_error!(HeaderValue::from_str(&arg.age)),
    );
    res.headers_mut().insert(
        ok_or_internal_error!(HeaderName::from_str("Access-Control-Allow-Headers")),
        ok_or_internal_error!(HeaderValue::from_str(&arg.headers)),
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use http::{Response, StatusCode};
    use http_body_util::{BodyExt, Full};
    use hyper::body::Bytes;

    fn create_test_response() -> Response<BoxBody<Bytes, std::convert::Infallible>> {
        Response::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from("test")).map_err(|never| match never {}).boxed())
            .unwrap()
    }

    #[test]
    fn test_cors_all_headers() {
        let mut response = create_test_response();
        let config = Cors {
            origin: "*".to_string(),
            methods: "GET,POST,PUT,DELETE".to_string(),
            age: "3600".to_string(),
            headers: "Content-Type,Authorization".to_string(),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        assert_eq!(
            response.headers().get("Access-Control-Allow-Origin").unwrap(),
            "*"
        );
        assert_eq!(
            response.headers().get("Access-Control-Allow-Methods").unwrap(),
            "GET,POST,PUT,DELETE"
        );
        assert_eq!(
            response.headers().get("Access-Control-Max-Age").unwrap(),
            "3600"
        );
        assert_eq!(
            response.headers().get("Access-Control-Allow-Headers").unwrap(),
            "Content-Type,Authorization"
        );
    }

    #[test]
    fn test_cors_specific_origin() {
        let mut response = create_test_response();
        let config = Cors {
            origin: "https://example.com".to_string(),
            methods: "GET,POST".to_string(),
            age: "7200".to_string(),
            headers: "*".to_string(),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        assert_eq!(
            response.headers().get("Access-Control-Allow-Origin").unwrap(),
            "https://example.com"
        );
    }

    #[test]
    fn test_cors_minimal_methods() {
        let mut response = create_test_response();
        let config = Cors {
            origin: "*".to_string(),
            methods: "GET".to_string(),
            age: "0".to_string(),
            headers: "".to_string(),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        assert_eq!(
            response.headers().get("Access-Control-Allow-Methods").unwrap(),
            "GET"
        );
    }

    #[test]
    fn test_cors_multiple_origins_wildcard() {
        let mut response = create_test_response();
        let config = Cors {
            origin: "*".to_string(),
            methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS".to_string(),
            age: "86400".to_string(),
            headers: "Content-Type,Authorization,X-Requested-With".to_string(),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        // All CORS headers should be present
        assert!(response.headers().contains_key("Access-Control-Allow-Origin"));
        assert!(response.headers().contains_key("Access-Control-Allow-Methods"));
        assert!(response.headers().contains_key("Access-Control-Max-Age"));
        assert!(response.headers().contains_key("Access-Control-Allow-Headers"));
    }

    #[test]
    fn test_cors_preserves_existing_headers() {
        let mut response = Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .header("X-Custom-Header", "custom-value")
            .body(Full::new(Bytes::from("test")).map_err(|never| match never {}).boxed())
            .unwrap();

        let config = Cors {
            origin: "*".to_string(),
            methods: "GET".to_string(),
            age: "3600".to_string(),
            headers: "Content-Type".to_string(),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        // Existing headers should be preserved
        assert_eq!(response.headers().get("Content-Type").unwrap(), "application/json");
        assert_eq!(response.headers().get("X-Custom-Header").unwrap(), "custom-value");

        // CORS headers should be added
        assert_eq!(
            response.headers().get("Access-Control-Allow-Origin").unwrap(),
            "*"
        );
    }
}
