// Retry middleware enables automatic retrying of failed requests
//
// IMPORTANT: Retry logic must be implemented at the service invocation level
// because the middleware layer cannot re-execute requests. This middleware stores
// the retry configuration in request extensions for use by the request handler.
//
// Example usage in a request handler:
// ```
// let retry_config = req.extensions().get::<RetryConfig>();
// let mut attempt = 0;
// loop {
//     match forward_to_backend(&req).await {
//         Ok(response) if should_retry_response(attempt, retry_config, &response) => {
//             attempt += 1;
//             tokio::time::sleep(calculate_backoff(attempt)).await;
//             continue;
//         }
//         result => break result,
//     }
// }
// ```

use super::MiddlewareError;
use crate::routing_config::Retry;
use http::{Request, Response};
use http_body_util::combinators::BoxBody;
use hyper::body::{Bytes, Incoming};
use std::time::Duration;

// Extension type to store retry configuration
#[derive(Clone, Debug)]
#[allow(dead_code)] // Public API for request handlers
pub struct RetryConfig {
    pub max_attempts: u64,
    pub initial_interval: Duration,
}

impl From<Retry> for RetryConfig {
    fn from(r: Retry) -> Self {
        // Parse initial_interval string (e.g., "100ms", "1s")
        let interval = parse_duration(&r.initial_interval).unwrap_or(Duration::from_millis(100));

        RetryConfig {
            max_attempts: r.attempts,
            initial_interval: interval,
        }
    }
}

// Parse duration string like "100ms" or "1s"
fn parse_duration(s: &str) -> Option<Duration> {
    if let Some(ms_str) = s.strip_suffix("ms") {
        ms_str.parse::<u64>().ok().map(Duration::from_millis)
    } else if let Some(s_str) = s.strip_suffix('s') {
        s_str.parse::<u64>().ok().map(Duration::from_secs)
    } else {
        // Try parsing as milliseconds if no suffix
        s.parse::<u64>().ok().map(Duration::from_millis)
    }
}

pub fn handle_incoming(req: &mut Request<Incoming>, arg: Retry) -> Result<(), MiddlewareError> {
    // Store retry configuration in request extensions for use by service caller
    let config = RetryConfig::from(arg);
    req.extensions_mut().insert(config);
    Ok(())
}

pub async fn handle_outgoing(
    _res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    _arg: Retry,
) -> Result<(), MiddlewareError> {
    // Retry is primarily an incoming/request-level concern
    Ok(())
}

// Check if a response should trigger a retry
#[allow(dead_code)] // Public API for request handlers
pub fn should_retry_response(
    attempt: u64,
    config: &RetryConfig,
    response_status: Option<u16>,
) -> bool {
    if attempt >= config.max_attempts {
        return false;
    }

    // Retry on 5xx errors and network failures
    if let Some(status) = response_status {
        status >= 500 && status < 600
    } else {
        // Network failure
        true
    }
}

// Calculate exponential backoff delay
#[allow(dead_code)] // Public API for request handlers
pub fn calculate_backoff(attempt: u64, config: &RetryConfig) -> Duration {
    // Exponential backoff: initial_interval * 2^attempt
    // Cap at 30 seconds
    let backoff_ms = config.initial_interval.as_millis() * (1 << attempt.min(5));
    Duration::from_millis(backoff_ms.min(30000) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> RetryConfig {
        RetryConfig {
            max_attempts: 3,
            initial_interval: Duration::from_millis(100),
        }
    }

    #[test]
    fn test_should_retry_on_500() {
        let config = test_config();
        assert!(should_retry_response(1, &config, Some(500)));
        assert!(should_retry_response(1, &config, Some(503)));
    }

    #[test]
    fn test_should_not_retry_on_4xx() {
        let config = test_config();
        assert!(!should_retry_response(1, &config, Some(404)));
        assert!(!should_retry_response(1, &config, Some(400)));
    }

    #[test]
    fn test_should_not_retry_on_2xx() {
        let config = test_config();
        assert!(!should_retry_response(1, &config, Some(200)));
        assert!(!should_retry_response(1, &config, Some(201)));
    }

    #[test]
    fn test_should_not_retry_after_max_attempts() {
        let config = test_config();
        assert!(!should_retry_response(3, &config, Some(500)));
        assert!(!should_retry_response(5, &config, Some(503)));
    }

    #[test]
    fn test_should_retry_on_network_failure() {
        let config = test_config();
        assert!(should_retry_response(1, &config, None));
    }
}
