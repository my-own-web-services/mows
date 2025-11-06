use super::{ok_or_internal_error, MiddlewareError};
use crate::routing_config::ReplacePath;
use http::{Request, Uri};
use hyper::body::Incoming;
use std::str::FromStr;

pub fn handle_incoming(req: &mut Request<Incoming>, arg: ReplacePath) -> Result<(), MiddlewareError> {
    let new_path = arg.path;
    let uri = req.uri();
    let uri_string = uri.to_string();
    let old_path = uri.path().to_string();

    // Replace path while preserving query string if present
    let new_uri_string = uri_string.replace(&old_path, &new_path);
    let new_uri = ok_or_internal_error!(Uri::from_str(&new_uri_string));

    *req.uri_mut() = new_uri;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware_http::handle_middleware_incoming;
    use crate::routing_config::HttpMiddleware;
    use http::{Request, Response as HttpResponse, StatusCode};
    use http_body_util::Full;
    use hyper::body::{Bytes, Incoming};
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_replace_path(
        mut req: Request<Incoming>,
        path: String,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::ReplacePath(ReplacePath { path });

        let _ = handle_middleware_incoming(&mut req, vec![middleware]).await;

        let uri = req.uri().to_string();
        Ok(HttpResponse::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from(format!("URI: {}", uri))))
            .unwrap())
    }

    #[tokio::test]
    async fn test_replace_path_simple() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let new_path = "/new/path".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let path = new_path.clone();
                async move { test_service_replace_path(req, path).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/old/path", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /new/path"),
            "Expected URI: /new/path, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_replace_path_with_query() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let new_path = "/api/v2/users".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let path = new_path.clone();
                async move { test_service_replace_path(req, path).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/old/path?id=123&name=test", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /api/v2/users?id=123&name=test"),
            "Expected URI with query preserved, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_replace_path_root_to_specific() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let new_path = "/health".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let path = new_path.clone();
                async move { test_service_replace_path(req, path).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("URI: /health"),
            "Expected URI: /health, got {}",
            response_text
        );

        server_handle.abort();
    }
}
