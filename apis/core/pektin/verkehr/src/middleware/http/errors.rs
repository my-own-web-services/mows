use super::MiddlewareError;
use crate::config::routing_config::Errors;
use http::Response;
use http_body_util::{BodyExt, combinators::BoxBody, Full};
use hyper::body::Bytes;

pub async fn handle_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    arg: Errors,
) -> Result<(), MiddlewareError> {
    let status_code = res.status().as_u16();

    // Check if this status code should trigger error handling
    for status_pattern in &arg.status {
        if matches_status_pattern(status_code, status_pattern) {
            // Fetch the error page from the error service
            // The service field can be:
            // 1. A full URL (http://... or https://...)
            // 2. A service name (requires service resolution at a higher level - we'll add it as a header for now)

            if arg.service.starts_with("http://") || arg.service.starts_with("https://") {
                // Make request to error service
                let mut error_url = arg.service.clone();

                // Add query parameters if specified
                if let Some(query_param) = &arg.query {
                    let status_info = format!("{}={}", query_param, status_code);
                    error_url = if error_url.contains('?') {
                        format!("{}&{}", error_url, status_info)
                    } else {
                        format!("{}?{}", error_url, status_info)
                    };
                }

                // Fetch error page from service
                match reqwest::get(&error_url).await {
                    Ok(error_response) => {
                        // Replace response status with original error status
                        *res.status_mut() = http::StatusCode::from_u16(status_code).unwrap();

                        // Copy headers from error service response
                        for (key, value) in error_response.headers().iter() {
                            res.headers_mut().insert(key.clone(), value.clone());
                        }

                        // Replace body with error service response body
                        if let Ok(error_body) = error_response.bytes().await {
                            *res.body_mut() = Full::new(error_body)
                                .map_err(|never| match never {})
                                .boxed();
                        }
                    }
                    Err(_) => {
                        // If error service is unavailable, just add header and keep original response
                        res.headers_mut().insert(
                            "X-Error-Handler-Failed",
                            format!("service={}", arg.service).parse().unwrap(),
                        );
                    }
                }
            } else {
                // Service name without URL - mark it for service resolution at higher level
                res.headers_mut().insert(
                    "X-Error-Handler",
                    format!("service={}", arg.service).parse().unwrap(),
                );
            }

            break;
        }
    }

    Ok(())
}

fn matches_status_pattern(status_code: u16, pattern: &str) -> bool {
    // Parse patterns like "404", "500-599", "404,500-502"
    for part in pattern.split(',') {
        let part = part.trim();

        if part.contains('-') {
            // Range pattern
            let range: Vec<&str> = part.split('-').collect();
            if range.len() == 2 {
                if let (Ok(start), Ok(end)) = (range[0].parse::<u16>(), range[1].parse::<u16>()) {
                    if status_code >= start && status_code <= end {
                        return true;
                    }
                }
            }
        } else {
            // Single status code
            if let Ok(code) = part.parse::<u16>() {
                if status_code == code {
                    return true;
                }
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware::http::handle_middleware_outgoing;
    use crate::config::routing_config::HttpMiddleware;
    use http::Response;
    use http_body_util::{BodyExt, Full};
    use hyper::body::Bytes;

    #[tokio::test]
    async fn test_errors_single_status() {
        let mut response = Response::builder()
            .status(404)
            .body(
                Full::new(Bytes::from("Not Found"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::Errors(Errors {
            status: vec!["404".to_string()],
            service: "error-service".to_string(),
            query: None,
        })];

        handle_middleware_outgoing(&mut response, middleware)
            .await
            .unwrap();

        assert_eq!(
            response.headers().get("X-Error-Handler").unwrap(),
            "service=error-service"
        );
    }

    #[tokio::test]
    async fn test_errors_range_status() {
        let mut response = Response::builder()
            .status(503)
            .body(
                Full::new(Bytes::from("Service Unavailable"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::Errors(Errors {
            status: vec!["500-599".to_string()],
            service: "error-service".to_string(),
            query: None,
        })];

        handle_middleware_outgoing(&mut response, middleware)
            .await
            .unwrap();

        assert_eq!(
            response.headers().get("X-Error-Handler").unwrap(),
            "service=error-service"
        );
    }

    #[tokio::test]
    async fn test_errors_multiple_patterns() {
        let mut response = Response::builder()
            .status(418)
            .body(
                Full::new(Bytes::from("I'm a teapot"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::Errors(Errors {
            status: vec!["404,418,500-599".to_string()],
            service: "error-service".to_string(),
            query: None,
        })];

        handle_middleware_outgoing(&mut response, middleware)
            .await
            .unwrap();

        assert_eq!(
            response.headers().get("X-Error-Handler").unwrap(),
            "service=error-service"
        );
    }

    #[tokio::test]
    async fn test_errors_no_match() {
        let mut response = Response::builder()
            .status(200)
            .body(
                Full::new(Bytes::from("OK"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::Errors(Errors {
            status: vec!["404,500-599".to_string()],
            service: "error-service".to_string(),
            query: None,
        })];

        handle_middleware_outgoing(&mut response, middleware)
            .await
            .unwrap();

        assert!(response.headers().get("X-Error-Handler").is_none());
    }

    #[test]
    fn test_matches_status_pattern() {
        assert!(matches_status_pattern(404, "404"));
        assert!(matches_status_pattern(500, "500-599"));
        assert!(matches_status_pattern(550, "500-599"));
        assert!(matches_status_pattern(404, "404,500-599"));
        assert!(!matches_status_pattern(200, "404,500-599"));
        assert!(!matches_status_pattern(450, "500-599"));
    }
}
