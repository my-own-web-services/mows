use super::MiddlewareError;
use crate::routing_config::CircuitBreaker;
use http::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

lazy_static::lazy_static! {
    static ref CIRCUIT_BREAKERS: Arc<Mutex<HashMap<String, CircuitBreakerState>>> = Arc::new(Mutex::new(HashMap::new()));
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
enum CircuitState {
    Closed,   // Normal operation
    Open,     // Blocking requests
    HalfOpen, // Testing if service recovered
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
struct CircuitBreakerConfig {
    failure_threshold: u32,
    recovery_timeout: Duration,
}

impl CircuitBreakerConfig {
    fn from_expression(expression: &str) -> Self {
        // Parse simple expressions:
        // "FailureCount >= 10" -> threshold of 10
        // "FailureRatio > 0.5" -> not supported yet, use default
        // "NetworkErrorRatio() > 0.30" -> Traefik CEL expression, use default
        // Default: 5 failures, 30 second recovery

        let mut failure_threshold = 5;
        let mut recovery_timeout = Duration::from_secs(30);

        // Try to parse "FailureCount >= N" pattern
        if let Some(count_expr) = expression.strip_prefix("FailureCount") {
            if let Some(number_part) = count_expr.split_whitespace().last() {
                if let Ok(n) = number_part.parse::<u32>() {
                    failure_threshold = n;
                }
            }
        }

        // Try to parse recovery timeout if present (e.g., "RecoveryTimeout = 60s")
        if expression.contains("RecoveryTimeout") {
            for part in expression.split(';') {
                if part.contains("RecoveryTimeout") {
                    if let Some(duration_str) = part.split('=').last() {
                        let duration_str = duration_str.trim();
                        if let Some(secs_str) = duration_str.strip_suffix('s') {
                            if let Ok(secs) = secs_str.trim().parse::<u64>() {
                                recovery_timeout = Duration::from_secs(secs);
                            }
                        }
                    }
                }
            }
        }

        CircuitBreakerConfig {
            failure_threshold,
            recovery_timeout,
        }
    }
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
struct CircuitBreakerState {
    state: CircuitState,
    failures: u32,
    last_failure_time: Option<Instant>,
    open_until: Option<Instant>,
    config: CircuitBreakerConfig,
}

#[allow(dead_code)]
impl CircuitBreakerState {
    fn new(config: CircuitBreakerConfig) -> Self {
        CircuitBreakerState {
            state: CircuitState::Closed,
            failures: 0,
            last_failure_time: None,
            open_until: None,
            config,
        }
    }

    fn should_allow_request(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open => {
                // Check if enough time has passed to try again
                if let Some(open_until) = self.open_until {
                    if Instant::now() >= open_until {
                        self.state = CircuitState::HalfOpen;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitState::HalfOpen => true,
        }
    }

    fn record_success(&mut self) {
        self.failures = 0;
        self.state = CircuitState::Closed;
        self.open_until = None;
    }

    fn record_failure(&mut self) {
        self.failures += 1;
        self.last_failure_time = Some(Instant::now());

        // Use configured threshold
        if self.failures >= self.config.failure_threshold {
            self.state = CircuitState::Open;
            self.open_until = Some(Instant::now() + self.config.recovery_timeout);
        }
    }
}

pub fn handle_incoming(
    req: &mut Request<Incoming>,
    arg: CircuitBreaker,
) -> Result<(), MiddlewareError> {
    // Parse the expression to get circuit breaker configuration
    let config = CircuitBreakerConfig::from_expression(&arg.expression);

    // Use host header as the service key
    let service_key = if let Some(host) = req.headers().get("host") {
        host.to_str().unwrap_or("default").to_string()
    } else {
        "default".to_string()
    };

    let mut breakers = CIRCUIT_BREAKERS.lock().unwrap();
    let breaker = breakers
        .entry(service_key)
        .or_insert_with(|| CircuitBreakerState::new(config));

    if !breaker.should_allow_request() {
        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(StatusCode::SERVICE_UNAVAILABLE)
                .body(
                    Full::new(Bytes::from("Circuit breaker is open"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    }

    Ok(())
}

// Helper functions to record outcomes (called after request completes)
#[allow(dead_code)] // Public API for request handlers
pub fn record_success(service_key: &str) {
    let mut breakers = CIRCUIT_BREAKERS.lock().unwrap();
    // If breaker doesn't exist, create with default config
    let default_config = CircuitBreakerConfig::from_expression("");
    let breaker = breakers
        .entry(service_key.to_string())
        .or_insert_with(|| CircuitBreakerState::new(default_config));
    breaker.record_success();
}

#[allow(dead_code)] // Public API for request handlers
pub fn record_failure(service_key: &str) {
    let mut breakers = CIRCUIT_BREAKERS.lock().unwrap();
    // If breaker doesn't exist, create with default config
    let default_config = CircuitBreakerConfig::from_expression("");
    let breaker = breakers
        .entry(service_key.to_string())
        .or_insert_with(|| CircuitBreakerState::new(default_config));
    breaker.record_failure();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware_http::handle_middleware_incoming;
    use crate::routing_config::HttpMiddleware;
    use http::{Request, Response as HttpResponse};
    use http_body_util::{BodyExt, Full};
    use hyper::body::Incoming;
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_circuit_breaker(
        mut req: Request<Incoming>,
        expression: String,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::CircuitBreaker(CircuitBreaker { expression });

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
    async fn test_circuit_breaker_closed_state() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        // Clear state for this specific host after binding
        let host_key = addr.to_string();
        CIRCUIT_BREAKERS.lock().unwrap().remove(&host_key);

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| async move {
                test_service_circuit_breaker(req, "test-expression".to_string()).await
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

        // Should succeed when circuit is closed
        assert_eq!(response.status(), 200);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_failures() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        // Clear state for this specific host after binding
        let host_key = addr.to_string();
        CIRCUIT_BREAKERS.lock().unwrap().remove(&host_key);

        let server_handle = tokio::spawn(async move {
            loop {
                let (stream, _) = match listener.accept().await {
                    Ok(conn) => conn,
                    Err(_) => break,
                };
                let io = TokioIo::new(stream);

                tokio::spawn(async move {
                    let service = service_fn(move |req: Request<Incoming>| async move {
                        test_service_circuit_breaker(req, "test-expression".to_string()).await
                    });

                    http1::Builder::new()
                        .serve_connection(io, service)
                        .await
                        .ok();
                });
            }
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();

        // First request - creates the circuit breaker entry
        let response1 = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        // First request should succeed (circuit is closed initially)
        assert_eq!(response1.status(), 200);

        // Wait a moment for the request to fully complete
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        // Record 5 failures for the known host
        for _ in 0..5 {
            record_failure(&host_key);
        }

        // Verify the circuit is now open
        {
            let breakers = CIRCUIT_BREAKERS.lock().unwrap();
            let breaker = breakers.get(&host_key).expect("Breaker should exist");
            assert_eq!(breaker.failures, 5);
        }

        // Second request - circuit should now be open
        let response2 = client
            .get(format!("http://{}/test", addr))
            .send()
            .await
            .unwrap();

        // Should return 503 when circuit is open
        assert_eq!(response2.status(), 503);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_circuit_breaker_records_success() {
        let service_key = "test-host-success";

        // Clear state for this specific key
        CIRCUIT_BREAKERS.lock().unwrap().remove(service_key);

        // Record a few failures first
        record_failure(service_key);
        record_failure(service_key);

        // Then record success
        record_success(service_key);

        // Check that failures were reset
        let breakers = CIRCUIT_BREAKERS.lock().unwrap();
        let breaker = breakers.get(service_key).unwrap();
        assert_eq!(breaker.failures, 0);
    }
}
