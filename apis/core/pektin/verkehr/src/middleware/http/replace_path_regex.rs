use super::{ok_or_internal_error, MiddlewareError};
use crate::config::routing_config::ReplacePathRegex;
use http::{Request, Uri};
use hyper::body::Incoming;
use regex::Regex;
use std::str::FromStr;

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: ReplacePathRegex,
) -> Result<(), MiddlewareError> {
    let regex = ok_or_internal_error!(Regex::from_str(&arg.regex));
    let uri = req.uri();
    let uri_string = uri.to_string();
    let path = uri.path().to_string();

    // Replace path using regex
    let new_path = regex.replace(&path, &arg.replacement).to_string();

    // Build new URI
    let new_uri_string = uri_string.replace(&path, &new_path);
    let new_uri = ok_or_internal_error!(Uri::from_str(&new_uri_string));

    *req.uri_mut() = new_uri;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::http::handle_middleware_incoming;
    use crate::config::routing_config::HttpMiddleware;
    use http::{Request, Response as HttpResponse, StatusCode};
    use http_body_util::Full;
    use hyper::body::{Bytes, Incoming};
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_replace_path_regex(
        mut req: Request<Incoming>,
        regex: String,
        replacement: String,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::ReplacePathRegex(ReplacePathRegex {
            regex,
            replacement,
        });

        let _ = handle_middleware_incoming(&mut req, vec![middleware]).await;

        let uri = req.uri().to_string();
        Ok(HttpResponse::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from(format!("URI: {}", uri))))
            .unwrap())
    }

    #[tokio::test]
    async fn test_replace_path_regex_version_removal() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = r"^/v[0-9]+".to_string();
        let replacement = "".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_replace_path_regex(req, regex, replacement).await }
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

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_replace_path_regex_with_capture_groups() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        // Swap user ID and action: /users/123/edit -> /edit/users/123
        let regex = r"^/users/([0-9]+)/([a-z]+)$".to_string();
        let replacement = "/$2/users/$1".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_replace_path_regex(req, regex, replacement).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/users/123/edit", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /edit/users/123"),
            "Expected URI: /edit/users/123, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_replace_path_regex_date_to_param() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        // Convert date in path to query parameter: /2024-01-15/report -> /report?date=2024-01-15
        let regex = r"^/([0-9]{4}-[0-9]{2}-[0-9]{2})/(.+)$".to_string();
        let replacement = "/$2".to_string(); // Note: Can't add query params with regex alone

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_replace_path_regex(req, regex, replacement).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/2024-01-15/report", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /report"),
            "Expected URI: /report, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_replace_path_regex_with_query_preserved() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = r"^/old/path".to_string();
        let replacement = "/new/path".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_replace_path_regex(req, regex, replacement).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/old/path?id=123", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /new/path?id=123"),
            "Expected URI: /new/path?id=123, got {}",
            response_text
        );

        server_handle.abort();
    }
}
