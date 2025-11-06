use super::{ok_or_internal_error, MiddlewareError};
use crate::routing_config::StripPrefixRegex;
use http::{header::HeaderName, HeaderValue, Request, Uri};
use hyper::body::Incoming;
use regex::Regex;
use std::str::FromStr;

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: StripPrefixRegex,
) -> Result<(), MiddlewareError> {
    let regex = ok_or_internal_error!(Regex::from_str(&arg.regex));
    let uri_string = req.uri().to_string();
    let path = req.uri().path().to_string();

    if let Some(captures) = regex.captures(&path) {
        let new_path = regex.replace(&path, "");
        let new_uri_string = uri_string.replace(&path, &new_path);
        let new_uri = ok_or_internal_error!(Uri::from_str(&new_uri_string));

        *req.uri_mut() = new_uri;
        req.headers_mut().insert(
            ok_or_internal_error!(HeaderName::from_str("X-Forwarded-Prefix")),
            ok_or_internal_error!(HeaderValue::from_str(&captures[0])),
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware_http::handle_middleware_incoming;
    use crate::routing_config::HttpMiddleware;
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
        regex: String,
    ) -> Result<Response<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::StripPrefixRegex(StripPrefixRegex { regex });

        let _ = handle_middleware_incoming(&mut req, vec![middleware]).await;

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
    async fn test_strip_prefix_regex_integration_version() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = "^/v[0-9]+".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                async move { test_service(req, regex).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/v1/api/users", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /api/users"),
            "Expected URI: /api/users, got {}",
            response_text
        );
        assert!(
            response_text.contains("X-Forwarded-Prefix: /v1"),
            "Expected X-Forwarded-Prefix: /v1, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_strip_prefix_regex_integration_date_pattern() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = r"^/[0-9]{4}-[0-9]{2}-[0-9]{2}".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                async move { test_service(req, regex).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/2024-01-15/api/users", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /api/users"),
            "Expected URI: /api/users, got {}",
            response_text
        );
        assert!(
            response_text.contains("X-Forwarded-Prefix: /2024-01-15"),
            "Expected X-Forwarded-Prefix: /2024-01-15, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_strip_prefix_regex_integration_no_match() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = "^/v[0-9]+".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                async move { test_service(req, regex).await }
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
            !response_text.contains("X-Forwarded-Prefix: /v"),
            "Header should not be set"
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_strip_prefix_regex_integration_tenant_pattern() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = r"^/tenant-[0-9]+".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                async move { test_service(req, regex).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/tenant-123/api/users", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /api/users"),
            "Expected URI: /api/users, got {}",
            response_text
        );
        assert!(
            response_text.contains("X-Forwarded-Prefix: /tenant-123"),
            "Expected X-Forwarded-Prefix: /tenant-123, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_strip_prefix_regex_integration_with_query() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = "^/v[0-9]+".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                async move { test_service(req, regex).await }
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
}
