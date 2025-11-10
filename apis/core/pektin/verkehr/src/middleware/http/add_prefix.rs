use super::{ok_or_internal_error, MiddlewareError};
use crate::config::routing_config::AddPrefix;
use http::{Request, Uri};
use hyper::body::Incoming;
use std::str::FromStr;

pub fn handle_incoming(req: &mut Request<Incoming>, arg: AddPrefix) -> Result<(), MiddlewareError> {
    let prefix = arg.prefix;
    let uri_string = req.uri().to_string();
    let path = req.uri().path().to_string();

    let new_path = format!("{}{}", prefix, path);
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
    use http::{Request, Response, StatusCode};
    use http_body_util::Full;
    use hyper::body::{Bytes, Incoming};
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    // Helper function to create a service that applies the middleware
    async fn test_service(
        mut req: Request<Incoming>,
        prefix: String,
    ) -> Result<Response<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::AddPrefix(AddPrefix { prefix });

        // Apply middleware
        let _ = handle_middleware_incoming(&mut req, vec![middleware]).await;

        // Return the modified URI in the response body
        let uri = req.uri().to_string();
        Ok(Response::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from(uri)))
            .unwrap())
    }

    #[tokio::test]
    async fn test_add_prefix_integration_simple() {
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
        assert!(
            response_text.contains("/v1/api/users"),
            "Expected /v1/api/users, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_add_prefix_integration_with_query() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let prefix = "/api/v2".to_string();

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
            .get(format!("http://{}/users?id=123", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("/api/v2/users?id=123"),
            "Expected /api/v2/users?id=123, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_add_prefix_integration_root_path() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let prefix = "/service".to_string();

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
            .get(format!("http://{}/", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("/service/"),
            "Expected /service/, got {}",
            response_text
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_add_prefix_integration_nested_path() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let prefix = "/app".to_string();

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
            .get(format!("http://{}/api/v1/users/123", addr))
            .send()
            .await
            .unwrap();

        let response_text = response.text().await.unwrap();
        assert!(
            response_text.contains("/app/api/v1/users/123"),
            "Expected /app/api/v1/users/123, got {}",
            response_text
        );

        server_handle.abort();
    }
}
