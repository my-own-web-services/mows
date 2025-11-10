use super::{ok_or_internal_error, MiddlewareError};
use crate::config::routing_config::StripPrefix;
use http::{header::HeaderName, HeaderValue, Request, Uri};
use hyper::body::Incoming;
use std::str::FromStr;

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: StripPrefix,
) -> Result<(), MiddlewareError> {
    let prefix = arg.prefix;
    let uri_string = req.uri().to_string();
    let path = req.uri().path().to_string();

    if path.starts_with(&prefix) {
        let new_path = path.replace(&prefix, "");
        let new_uri_string = uri_string.replace(&path, &new_path);
        let new_uri = ok_or_internal_error!(Uri::from_str(&new_uri_string));

        *req.uri_mut() = new_uri;
        req.headers_mut().insert(
            ok_or_internal_error!(HeaderName::from_str("X-Forwarded-Prefix")),
            ok_or_internal_error!(HeaderValue::from_str(&path.replace(&new_path, ""))),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::http::handle_middleware_incoming;
    use crate::config::routing_config::HttpMiddleware;
    use http::{Request, Response, StatusCode};
    use http_body_util::Full;
    use hyper::body::{Bytes, Incoming};
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service(
        mut req: Request<Incoming>,
        prefix: String,
    ) -> Result<Response<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::StripPrefix(StripPrefix {
            prefix,
            force_slash: None,
        });

        let _ = handle_middleware_incoming(&mut req, vec![middleware]).await;

        // Return both the modified URI and the X-Forwarded-Prefix header
        let uri = req.uri().to_string();
        let forwarded_prefix = req
            .headers()
            .get("X-Forwarded-Prefix")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let response_body = format!("URI: {} | X-Forwarded-Prefix: {}", uri, forwarded_prefix);
        Ok(Response::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from(response_body)))
            .unwrap())
    }

    #[tokio::test]
    async fn test_strip_prefix_integration_simple() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let prefix = "/api/v1".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let prefix = prefix.clone();
                async move { test_service(req, prefix).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/api/v1/users", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /users"),
            "Expected URI: /users, got {}",
            response_text
        );
        assert!(
            response_text.contains("X-Forwarded-Prefix: /api/v1"),
            "Expected X-Forwarded-Prefix: /api/v1, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_strip_prefix_integration_with_query() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let prefix = "/v2".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let prefix = prefix.clone();
                async move { test_service(req, prefix).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/v2/api/users?id=123", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /api/users?id=123"),
            "Expected URI: /api/users?id=123, got {}",
            response_text
        );
        assert!(
            response_text.contains("X-Forwarded-Prefix: /v2"),
            "Expected X-Forwarded-Prefix: /v2, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_strip_prefix_integration_no_match() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let prefix = "/v1".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let prefix = prefix.clone();
                async move { test_service(req, prefix).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/api/users", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        // Path should remain unchanged
        assert!(
            response_text.contains("URI: /api/users"),
            "Expected URI: /api/users, got {}",
            response_text
        );
        // Header should not be set
        assert!(
            response_text.contains("X-Forwarded-Prefix: "),
            "Header should be empty, got {}",
            response_text
        );
        assert!(
            !response_text.contains("X-Forwarded-Prefix: /v1"),
            "Header should not be set"
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_strip_prefix_integration_nested_path() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let prefix = "/app/api".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let prefix = prefix.clone();
                async move { test_service(req, prefix).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/app/api/v1/users/123", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /v1/users/123"),
            "Expected URI: /v1/users/123, got {}",
            response_text
        );
        assert!(
            response_text.contains("X-Forwarded-Prefix: /app/api"),
            "Expected X-Forwarded-Prefix: /app/api, got {}",
            response_text
        );

        server_handle.abort();
    }
}
