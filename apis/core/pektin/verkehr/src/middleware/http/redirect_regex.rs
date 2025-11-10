use super::{ok_or_internal_error, MiddlewareError};
use crate::config::routing_config::RedirectRegex;
use http::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use regex::Regex;
use std::str::FromStr;

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: RedirectRegex,
) -> Result<(), MiddlewareError> {
    let regex = ok_or_internal_error!(Regex::from_str(&arg.regex));
    let uri = req.uri();

    // Build full URI string including scheme and host
    let full_uri = if uri.scheme().is_some() && uri.authority().is_some() {
        uri.to_string()
    } else {
        // Construct from Host header
        let host = if let Some(host_header) = req.headers().get("host") {
            ok_or_internal_error!(host_header.to_str()).to_string()
        } else {
            return Ok(()); // No host, can't redirect
        };

        let scheme = uri.scheme().map(|s| s.as_str()).unwrap_or("http");
        let path_and_query = uri.path_and_query()
            .map(|pq| pq.as_str())
            .unwrap_or("/");

        format!("{}://{}{}", scheme, host, path_and_query)
    };

    // Check if the URI matches the regex
    if regex.is_match(&full_uri) {
        // Apply the replacement
        let new_location = regex.replace(&full_uri, &arg.replacement).to_string();

        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(StatusCode::FOUND) // 302 temporary redirect
                .header("Location", new_location)
                .body(
                    Full::new(Bytes::from("Redirecting..."))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    }

    Ok(())
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

    async fn test_service_redirect_regex(
        mut req: Request<Incoming>,
        regex: String,
        replacement: String,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::RedirectRegex(RedirectRegex {
            regex,
            replacement,
        });

        match handle_middleware_incoming(&mut req, vec![middleware]).await {
            Ok(_) => {
                // No redirect, pass through
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
    async fn test_redirect_regex_old_to_new() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = r"^http://([^/]+)/old/(.*)$".to_string();
        let replacement = "http://$1/new/$2".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_redirect_regex(req, regex, replacement).await }
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
            .get(format!("http://{}/old/page", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 302);
        let location = response.headers().get("location").unwrap().to_str().unwrap();
        assert!(
            location.contains("/new/page"),
            "Expected /new/page in location, got {}",
            location
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_redirect_regex_with_capture_groups() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        // Redirect /docs/v1/page to /v1/documentation/page
        let regex = r"^http://([^/]+)/docs/(v[0-9]+)/(.*)$".to_string();
        let replacement = "http://$1/$2/documentation/$3".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_redirect_regex(req, regex, replacement).await }
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
            .get(format!("http://{}/docs/v2/intro", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 302);
        let location = response.headers().get("location").unwrap().to_str().unwrap();
        assert!(
            location.contains("/v2/documentation/intro"),
            "Expected /v2/documentation/intro, got {}",
            location
        );

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_redirect_regex_no_match() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = r"^http://([^/]+)/old/(.*)$".to_string();
        let replacement = "http://$1/new/$2".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_redirect_regex(req, regex, replacement).await }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();
        let response = client
            .get(format!("http://{}/other/page", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        let response_text = response.text().await.unwrap();
        assert_eq!(response_text, "No redirect");

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_redirect_regex_preserves_query_string() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let regex = r"^http://([^/]+)/api/old(.*)$".to_string();
        let replacement = "http://$1/api/new$2".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let regex = regex.clone();
                let replacement = replacement.clone();
                async move { test_service_redirect_regex(req, regex, replacement).await }
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
            .get(format!("http://{}/api/old?id=123&name=test", addr))
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 302);
        let location = response.headers().get("location").unwrap().to_str().unwrap();
        assert!(
            location.contains("/api/new?id=123&name=test"),
            "Expected query string preserved, got {}",
            location
        );

        server_handle.abort();
    }
}
