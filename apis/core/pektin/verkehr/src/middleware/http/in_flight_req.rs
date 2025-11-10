// InFlightReq middleware limits the number of simultaneous requests
//
// IMPORTANT: This middleware increments a counter when a request enters,
// and stores the source key in request extensions. The counter MUST be
// decremented when the request completes by calling `decrement_counter()`.
//
// Example usage in a request handler:
// ```
// match handle_middleware_incoming(&mut req, middlewares).await {
//     Ok(_) => {
//         // Process request...
//         let response = handle_request(req).await;
//
//         // Cleanup: decrement counter
//         if let Some(source_key) = get_source_key(&req) {
//             decrement_counter(&source_key);
//         }
//
//         response
//     }
//     Err(e) => Err(e)
// }
// ```

use super::MiddlewareError;
use crate::config::routing_config::InFlightReq;
use http::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// Global in-flight request counter
lazy_static::lazy_static! {
    static ref IN_FLIGHT_COUNTERS: Arc<Mutex<HashMap<String, u64>>> = Arc::new(Mutex::new(HashMap::new()));
}

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: InFlightReq,
) -> Result<(), MiddlewareError> {
    let amount = arg.amount;

    // Get source identifier
    let source = get_source_identifier(req, &arg);

    // Check and increment counter
    let mut counters = IN_FLIGHT_COUNTERS.lock().unwrap();
    let current = counters.entry(source.clone()).or_insert(0);

    if *current >= amount {
        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(StatusCode::SERVICE_UNAVAILABLE) // 503
                .body(
                    Full::new(Bytes::from("Too many simultaneous connections"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    }

    *current += 1;

    // Store the source identifier in request extensions for cleanup
    // The caller should call decrement_counter() after the request completes
    req.extensions_mut().insert(InFlightSourceKey(source));

    Ok(())
}

// Extension key to store the source identifier for cleanup
#[derive(Clone, Debug)]
pub struct InFlightSourceKey(pub String);

// Get the source key from a request for cleanup
#[allow(dead_code)] // Public API for request handlers
pub fn get_source_key(req: &Request<Incoming>) -> Option<String> {
    req.extensions()
        .get::<InFlightSourceKey>()
        .map(|k| k.0.clone())
}

fn get_source_identifier(req: &Request<Incoming>, arg: &InFlightReq) -> String {
    if let Some(source_criterion) = &arg.source_criterion {
        // Check for custom header
        if let Some(header_name) = &source_criterion.request_header_name {
            if let Some(header_value) = req.headers().get(header_name) {
                if let Ok(value_str) = header_value.to_str() {
                    return value_str.to_string();
                }
            }
        }

        // Check for request host
        if source_criterion.request_host.unwrap_or(false) {
            if let Some(host) = req.headers().get("host") {
                if let Ok(host_str) = host.to_str() {
                    return host_str.to_string();
                }
            }
        }

        // Use IP strategy if configured
        if let Some(ip_strategy) = &source_criterion.ip_strategy {
            if let Some(depth) = ip_strategy.depth {
                if let Some(xff_header) = req.headers().get("X-Forwarded-For") {
                    if let Ok(xff_str) = xff_header.to_str() {
                        let ips: Vec<&str> = xff_str.split(',').map(|s| s.trim()).collect();
                        if !ips.is_empty() && depth > 0 {
                            let index = if (depth as usize) <= ips.len() {
                                ips.len() - (depth as usize)
                            } else {
                                0
                            };
                            return ips[index].to_string();
                        }
                    }
                }
            }
        }
    }

    // Default: try to get IP from X-Real-IP or X-Forwarded-For
    if let Some(real_ip) = req.headers().get("X-Real-IP") {
        if let Ok(ip_str) = real_ip.to_str() {
            return ip_str.to_string();
        }
    }

    if let Some(xff) = req.headers().get("X-Forwarded-For") {
        if let Ok(xff_str) = xff.to_str() {
            if let Some(first_ip) = xff_str.split(',').next() {
                return first_ip.trim().to_string();
            }
        }
    }

    "unknown".to_string()
}

// Helper to decrement counter (called when request completes)
#[allow(dead_code)] // Public API for request handlers
pub fn decrement_counter(source: &str) {
    let mut counters = IN_FLIGHT_COUNTERS.lock().unwrap();
    if let Some(count) = counters.get_mut(source) {
        if *count > 0 {
            *count -= 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::http::handle_middleware_incoming;
    use crate::config::routing_config::HttpMiddleware;
    use http::{Request, Response as HttpResponse};
    use http_body_util::{BodyExt, Full};
    use hyper::body::Incoming;
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_in_flight(
        mut req: Request<Incoming>,
        amount: u64,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::InFlightReq(InFlightReq {
            amount,
            source_criterion: None,
        });

        match handle_middleware_incoming(&mut req, vec![middleware]).await {
            Ok(_) => Ok(HttpResponse::builder()
                .status(StatusCode::OK)
                .body(Full::new(Bytes::from("OK")))
                .unwrap()),
            Err(MiddlewareError::Default { res }) => {
                let (parts, body) = res.into_parts();
                let body_bytes = body.collect().await.unwrap().to_bytes();
                Ok(HttpResponse::from_parts(parts, Full::new(body_bytes)))
            }
        }
    }

    #[tokio::test]
    async fn test_in_flight_req_within_limit() {
        // Clear counters before test
        IN_FLIGHT_COUNTERS.lock().unwrap().clear();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            for _ in 0..2 {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service =
                    service_fn(move |req| async move { test_service_in_flight(req, 5).await });

                tokio::spawn(async move {
                    http1::Builder::new()
                        .serve_connection(io, service)
                        .await
                        .ok();
                });
            }
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();

        // Both requests should succeed (within limit of 5)
        let response1 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.200")
            .send()
            .await
            .unwrap();
        assert_eq!(response1.status(), 200);

        let response2 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.200")
            .send()
            .await
            .unwrap();
        assert_eq!(response2.status(), 200);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_in_flight_req_exceeds_limit() {
        // Clear counters before test
        IN_FLIGHT_COUNTERS.lock().unwrap().clear();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            for _ in 0..3 {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service =
                    service_fn(move |req| async move { test_service_in_flight(req, 1).await });

                tokio::spawn(async move {
                    http1::Builder::new()
                        .serve_connection(io, service)
                        .await
                        .ok();
                });
            }
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();

        // First request should succeed
        let response1 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.201")
            .send()
            .await
            .unwrap();
        assert_eq!(response1.status(), 200);

        // Second request should be rejected (exceeds limit of 1)
        let response2 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.201")
            .send()
            .await
            .unwrap();
        assert_eq!(response2.status(), 503);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_in_flight_req_different_ips() {
        // Clear counters before test
        IN_FLIGHT_COUNTERS.lock().unwrap().clear();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            for _ in 0..2 {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service =
                    service_fn(move |req| async move { test_service_in_flight(req, 1).await });

                tokio::spawn(async move {
                    http1::Builder::new()
                        .serve_connection(io, service)
                        .await
                        .ok();
                });
            }
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();

        // Different IPs should have independent limits
        let response1 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.202")
            .send()
            .await
            .unwrap();
        assert_eq!(response1.status(), 200);

        let response2 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.203")
            .send()
            .await
            .unwrap();
        assert_eq!(response2.status(), 200);

        server_handle.abort();
    }
}
