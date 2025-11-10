use super::MiddlewareError;
use crate::config::routing_config::RateLimit;
use http::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

// Global rate limiter state
lazy_static::lazy_static! {
    static ref RATE_LIMITERS: Arc<Mutex<HashMap<String, RateLimiterState>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Clone)]
struct RateLimiterState {
    tokens: f64,
    last_refill: Instant,
    max_tokens: f64,
    refill_rate: f64, // tokens per second
}

impl RateLimiterState {
    fn new(burst: u64, average: u64) -> Self {
        RateLimiterState {
            tokens: burst as f64,
            last_refill: Instant::now(),
            max_tokens: burst as f64,
            refill_rate: average as f64,
        }
    }

    fn try_consume(&mut self) -> bool {
        // Refill tokens based on elapsed time
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();

        // Add tokens based on refill rate
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.max_tokens);
        self.last_refill = now;

        // Try to consume one token
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

pub fn handle_incoming(req: &mut Request<Incoming>, arg: RateLimit) -> Result<(), MiddlewareError> {
    let average = arg.average.unwrap_or(1); // 1 request per second default
    let burst = arg.burst.unwrap_or(1);

    // Get source identifier (IP address or custom header)
    let source = get_source_identifier(req, &arg);

    // Get or create rate limiter for this source
    let mut limiters = RATE_LIMITERS.lock().unwrap();
    let limiter = limiters
        .entry(source)
        .or_insert_with(|| RateLimiterState::new(burst, average));

    // Try to consume a token
    if !limiter.try_consume() {
        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(StatusCode::TOO_MANY_REQUESTS) // 429
                .header("Retry-After", "1")
                .body(
                    Full::new(Bytes::from("Too Many Requests"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    }

    Ok(())
}

fn get_source_identifier(req: &Request<Incoming>, arg: &RateLimit) -> String {
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

    // Fallback to a default identifier
    "unknown".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::http::handle_middleware_incoming;
    use crate::config::routing_config::{HttpMiddleware, SourceCriterion};
    use http::{Request, Response as HttpResponse};
    use http_body_util::{BodyExt, Full};
    use hyper::body::Incoming;
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_rate_limit(
        mut req: Request<Incoming>,
        average: Option<u64>,
        burst: Option<u64>,
        source_criterion: Option<SourceCriterion>,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::RateLimit(RateLimit {
            average,
            period: None,
            burst,
            source_criterion,
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
    async fn test_rate_limit_allows_within_burst() {
        // Clear rate limiters before test
        RATE_LIMITERS.lock().unwrap().clear();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            for _ in 0..3 {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service = service_fn(move |req| async move {
                    test_service_rate_limit(req, Some(10), Some(3), None).await
                });

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

        // First 3 requests should succeed (within burst)
        for i in 0..3 {
            let response = client
                .get(format!("http://{}/test", addr))
                .header("X-Real-IP", "192.168.1.100")
                .send()
                .await
                .unwrap();

            assert_eq!(response.status(), 200, "Request {} should succeed", i + 1);
        }

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_rate_limit_blocks_over_burst() {
        // Clear rate limiters before test
        RATE_LIMITERS.lock().unwrap().clear();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            for _ in 0..5 {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service = service_fn(move |req| async move {
                    test_service_rate_limit(req, Some(1), Some(2), None).await
                });

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

        // First 2 requests should succeed
        for _ in 0..2 {
            let response = client
                .get(format!("http://{}/test", addr))
                .header("X-Real-IP", "192.168.1.101")
                .send()
                .await
                .unwrap();

            assert_eq!(response.status(), 200);
        }

        // Third request should be rate limited
        let response = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.101")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 429);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_rate_limit_different_ips() {
        // Clear rate limiters before test
        RATE_LIMITERS.lock().unwrap().clear();

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let server_handle = tokio::spawn(async move {
            for _ in 0..4 {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service = service_fn(move |req| async move {
                    test_service_rate_limit(req, Some(1), Some(1), None).await
                });

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

        // Different IPs should have independent rate limits
        let response1 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.102")
            .send()
            .await
            .unwrap();
        assert_eq!(response1.status(), 200);

        let response2 = client
            .get(format!("http://{}/test", addr))
            .header("X-Real-IP", "192.168.1.103")
            .send()
            .await
            .unwrap();
        assert_eq!(response2.status(), 200);

        server_handle.abort();
    }
}
