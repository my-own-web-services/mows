use crate::config::routing_config::{Headers, MiddlewareDirection};
use super::{MiddlewareError, ok_or_internal_error};
use http::{header::HeaderName, HeaderValue, Request, Response};
use http_body_util::combinators::BoxBody;
use hyper::body::{Bytes, Incoming};
use std::str::FromStr;

pub fn handle_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    arg: Headers,
) -> Result<(), MiddlewareError> {
    if arg.direction.is_none()
        || arg.direction.is_some()
            && arg.direction.unwrap() == MiddlewareDirection::Outgoing
    {
        for header in &arg.fields {
            res.headers_mut().insert(
                ok_or_internal_error!(HeaderName::from_str(header.0)),
                ok_or_internal_error!(HeaderValue::from_str(header.1)),
            );
        }
    }
    Ok(())
}

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: Headers,
) -> Result<(), MiddlewareError> {
    if arg.direction.is_some() && (arg.direction.unwrap() == MiddlewareDirection::Incoming)
    {
        for header in &arg.fields {
            req.headers_mut().insert(
                ok_or_internal_error!(HeaderName::from_str(header.0)),
                ok_or_internal_error!(HeaderValue::from_str(header.1)),
            );
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use http::{Response, StatusCode};
    use http_body_util::{BodyExt, Full};
    use hyper::body::Bytes;
    use std::collections::HashMap;

    fn create_test_response() -> Response<BoxBody<Bytes, std::convert::Infallible>> {
        Response::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from("test")).map_err(|never| match never {}).boxed())
            .unwrap()
    }

    #[test]
    fn test_headers_outgoing_default_direction() {
        let mut response = create_test_response();
        let mut fields = HashMap::new();
        fields.insert("X-Custom-Header".to_string(), "custom-value".to_string());
        fields.insert("X-Another-Header".to_string(), "another-value".to_string());

        let config = Headers {
            fields,
            direction: None, // Default should apply to outgoing
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        assert_eq!(
            response.headers().get("X-Custom-Header").unwrap(),
            "custom-value"
        );
        assert_eq!(
            response.headers().get("X-Another-Header").unwrap(),
            "another-value"
        );
    }

    #[test]
    fn test_headers_outgoing_explicit_direction() {
        let mut response = create_test_response();
        let mut fields = HashMap::new();
        fields.insert("X-Response-Header".to_string(), "response-value".to_string());

        let config = Headers {
            fields,
            direction: Some(MiddlewareDirection::Outgoing),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        assert_eq!(
            response.headers().get("X-Response-Header").unwrap(),
            "response-value"
        );
    }

    #[test]
    fn test_headers_outgoing_wrong_direction() {
        let mut response = create_test_response();
        let mut fields = HashMap::new();
        fields.insert("X-Request-Header".to_string(), "request-value".to_string());

        let config = Headers {
            fields,
            direction: Some(MiddlewareDirection::Incoming),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        // Header should NOT be added because direction is Incoming
        assert!(response.headers().get("X-Request-Header").is_none());
    }

    #[test]
    fn test_headers_multiple_headers_outgoing() {
        let mut response = create_test_response();
        let mut fields = HashMap::new();
        fields.insert("X-Header-1".to_string(), "value1".to_string());
        fields.insert("X-Header-2".to_string(), "value2".to_string());
        fields.insert("X-Header-3".to_string(), "value3".to_string());

        let config = Headers {
            fields,
            direction: Some(MiddlewareDirection::Outgoing),
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        assert_eq!(response.headers().get("X-Header-1").unwrap(), "value1");
        assert_eq!(response.headers().get("X-Header-2").unwrap(), "value2");
        assert_eq!(response.headers().get("X-Header-3").unwrap(), "value3");
    }

    #[test]
    fn test_headers_preserves_existing_headers() {
        let mut response = Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", "application/json")
            .body(Full::new(Bytes::from("test")).map_err(|never| match never {}).boxed())
            .unwrap();

        let mut fields = HashMap::new();
        fields.insert("X-Custom-Header".to_string(), "custom-value".to_string());

        let config = Headers {
            fields,
            direction: None,
        };

        let result = handle_outgoing(&mut response, config);
        assert!(result.is_ok());

        // Existing header should be preserved
        assert_eq!(response.headers().get("Content-Type").unwrap(), "application/json");
        // New header should be added
        assert_eq!(
            response.headers().get("X-Custom-Header").unwrap(),
            "custom-value"
        );
    }

    // Note: Incoming direction tests require hyper::body::Incoming which cannot be easily
    // created in unit tests. These should be tested via integration tests with actual HTTP requests.

    // Integration tests for incoming direction
    use crate::config::routing_config::HttpMiddleware;
    use crate::middleware::http::handle_middleware_incoming;
    use hyper::service::service_fn;
    use hyper::server::conn::http1;
    use hyper_util::rt::TokioIo;
    use tokio::net::TcpListener;
    use http::{Request, Response as HttpResponse};
    use hyper::body::Incoming;
    use std::convert::Infallible;

    async fn test_service_incoming(
        mut req: Request<Incoming>,
        fields: std::collections::HashMap<String, String>,
        direction: Option<MiddlewareDirection>,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::Headers(Headers {
            fields,
            direction,
        });

        let _ = handle_middleware_incoming(&mut req, vec![middleware]).await;

        // Return headers from the request in the response body
        let mut headers_str = String::new();
        for (key, value) in req.headers().iter() {
            if key.as_str().starts_with("x-") || key.as_str().starts_with("X-") {
                headers_str.push_str(&format!("{}: {}\n", key, value.to_str().unwrap_or("")));
            }
        }

        Ok(HttpResponse::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from(headers_str)))
            .unwrap())
    }

    #[tokio::test]
    async fn test_headers_incoming_integration_with_direction() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let mut fields = HashMap::new();
        fields.insert("X-Custom-Header".to_string(), "custom-value".to_string());
        fields.insert("X-Another-Header".to_string(), "another-value".to_string());

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let fields = fields.clone();
                async move {
                    test_service_incoming(req, fields, Some(MiddlewareDirection::Incoming)).await
                }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(response_text.contains("x-custom-header: custom-value") || response_text.contains("X-Custom-Header: custom-value"),
                "Expected header not found, got: {}", response_text);
        assert!(response_text.contains("x-another-header: another-value") || response_text.contains("X-Another-Header: another-value"),
                "Expected header not found, got: {}", response_text);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_headers_incoming_integration_wrong_direction() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let mut fields = HashMap::new();
        fields.insert("X-Should-Not-Appear".to_string(), "test-value".to_string());

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let fields = fields.clone();
                async move {
                    test_service_incoming(req, fields, Some(MiddlewareDirection::Outgoing)).await
                }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        // Header should NOT be added because direction is Outgoing
        assert!(!response_text.contains("X-Should-Not-Appear"),
                "Header should not be present with wrong direction, got: {}", response_text);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_headers_incoming_integration_multiple_headers() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let mut fields = HashMap::new();
        fields.insert("X-Header-1".to_string(), "value1".to_string());
        fields.insert("X-Header-2".to_string(), "value2".to_string());
        fields.insert("X-Header-3".to_string(), "value3".to_string());

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let fields = fields.clone();
                async move {
                    test_service_incoming(req, fields, Some(MiddlewareDirection::Incoming)).await
                }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(response_text.contains("value1"), "Expected value1 in headers, got: {}", response_text);
        assert!(response_text.contains("value2"), "Expected value2 in headers, got: {}", response_text);
        assert!(response_text.contains("value3"), "Expected value3 in headers, got: {}", response_text);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_headers_incoming_integration_no_direction() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let mut fields = HashMap::new();
        fields.insert("X-No-Direction-Header".to_string(), "test-value".to_string());

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let fields = fields.clone();
                async move {
                    test_service_incoming(req, fields, None).await
                }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        // Header should NOT be added for incoming when direction is None (defaults to outgoing)
        assert!(!response_text.contains("X-No-Direction-Header"),
                "Header should not be present without explicit incoming direction, got: {}", response_text);

        server_handle.abort();
    }
}
