use super::{ok_or_internal_error, MiddlewareError};
use crate::config::routing_config::RedirectScheme;
use http::{Request, Response, StatusCode, Uri};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use std::str::FromStr;

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: RedirectScheme,
) -> Result<(), MiddlewareError> {
    let uri = req.uri();
    let scheme = &arg.scheme;

    // Get host from the Host header if not present in URI
    let host_with_port = if let Some(authority) = uri.authority() {
        authority.as_str().to_string()
    } else if let Some(host_header) = req.headers().get("host") {
        ok_or_internal_error!(host_header.to_str()).to_string()
    } else {
        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(500)
                .body(
                    Full::new(Bytes::from("No host found"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    };

    // Extract just the hostname without port
    let host = host_with_port.split(':').next().unwrap_or(&host_with_port).to_string();

    // Build authority with optional port
    let authority_str = if let Some(port) = arg.port {
        // Don't include default ports
        if (port == 80 && scheme == "http") || (port == 443 && scheme == "https") {
            host
        } else {
            format!("{}:{}", host, port)
        }
    } else {
        host
    };

    let authority = ok_or_internal_error!(http::uri::Authority::from_str(&authority_str));
    let new_scheme = ok_or_internal_error!(http::uri::Scheme::from_str(scheme));

    // Build new URI with scheme, authority, path, and query
    let path_and_query = uri.path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let new_uri_string = format!("{}://{}{}", new_scheme, authority, path_and_query);
    let new_uri = ok_or_internal_error!(Uri::from_str(&new_uri_string));
    let location = new_uri.to_string();

    // Determine status code (301 for permanent, 302 for temporary)
    let status = if arg.permanent.unwrap_or(false) {
        StatusCode::MOVED_PERMANENTLY // 301
    } else {
        StatusCode::FOUND // 302
    };

    return Err(MiddlewareError::Default {
        res: Response::builder()
            .status(status)
            .header("Location", location)
            .body(
                Full::new(Bytes::from("Redirecting..."))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::http::handle_middleware_incoming;
    use crate::config::routing_config::HttpMiddleware;
    use http::{Request, Response as HttpResponse};
    use http_body_util::Full;
    use hyper::body::Incoming;
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_redirect_scheme(
        mut req: Request<Incoming>,
        scheme: String,
        permanent: Option<bool>,
        port: Option<u16>,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::RedirectScheme(RedirectScheme {
            scheme,
            permanent,
            port,
        });

        match handle_middleware_incoming(&mut req, vec![middleware]).await {
            Ok(_) => {
                // Should not reach here with redirect
                Ok(HttpResponse::builder()
                    .status(StatusCode::OK)
                    .body(Full::new(Bytes::from("No redirect")))
                    .unwrap())
            }
            Err(MiddlewareError::Default { res }) => {
                let (parts, body) = res.into_parts();
                let body_bytes = body.collect().await.unwrap().to_bytes();
                Ok(HttpResponse::from_parts(parts, Full::new(body_bytes)))
            }
        }
    }

    #[tokio::test]
    async fn test_redirect_scheme_http_to_https() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| async move {
                test_service_redirect_scheme(req, "https".to_string(), None, None).await
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();

        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 302); // Temporary redirect
        let location = response.headers().get("location").unwrap().to_str().unwrap();
        assert!(location.starts_with("https://"), "Expected https://, got {}", location);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_redirect_scheme_permanent() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| async move {
                test_service_redirect_scheme(req, "https".to_string(), Some(true), None).await
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();

        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 301); // Permanent redirect

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_redirect_scheme_with_custom_port() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| async move {
                test_service_redirect_scheme(req, "https".to_string(), None, Some(8443)).await
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();

        let response = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 302);
        let location = response.headers().get("location").unwrap().to_str().unwrap();
        assert!(location.contains(":8443"), "Expected :8443 in location, got {}", location);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_redirect_scheme_preserves_path_and_query() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| async move {
                test_service_redirect_scheme(req, "https".to_string(), None, None).await
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap();

        let response = client
            .get(format!("http://{}/api/users?id=123", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 302);
        let location = response.headers().get("location").unwrap().to_str().unwrap();
        assert!(location.contains("/api/users?id=123"), "Expected path and query preserved, got {}", location);

        server_handle.abort();
    }
}
