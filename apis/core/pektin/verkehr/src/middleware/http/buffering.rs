use super::MiddlewareError;
use crate::routing_config::Buffering;
use http::{Request, Response};
use http_body_util::{BodyExt, combinators::BoxBody, Full};
use hyper::body::{Bytes, Incoming};

pub async fn handle_incoming(_req: &mut Request<Incoming>, _arg: Buffering) -> Result<(), MiddlewareError> {
    // Note: Request buffering for incoming requests is complex because:
    // 1. Incoming body type is tied to the actual HTTP connection and can't be reconstructed
    // 2. We would need to read the entire body, check the size, then somehow make it
    //    available again to downstream handlers
    // 3. This typically requires integration at a higher level in the HTTP stack
    //
    // In a production implementation, this would be handled by:
    // - Using a custom body type that wraps Incoming and enforces limits
    // - Integrating with the connection handler to buffer before middleware processing
    //
    // For now, this is a pass-through that documents the configuration exists
    Ok(())
}

pub async fn handle_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    arg: Buffering,
) -> Result<(), MiddlewareError> {
    let max_response_body_bytes = arg.max_response_body_bytes.unwrap_or(u64::MAX);

    // Collect the entire response body
    let body = std::mem::replace(res.body_mut(), Full::new(Bytes::new()).map_err(|never| match never {}).boxed());
    let body_bytes = body.collect().await.unwrap().to_bytes(); // Infallible

    // Check size limit
    if body_bytes.len() as u64 > max_response_body_bytes {
        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(500)
                .body(
                    Full::new(Bytes::from("Response body too large"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    }

    // Replace body with buffered version
    *res.body_mut() = Full::new(body_bytes).map_err(|never| match never {}).boxed();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware_http::handle_middleware_outgoing;
    use crate::routing_config::HttpMiddleware;
    use http::Response;
    use http_body_util::{BodyExt, Full};
    use hyper::body::Bytes;

    #[tokio::test]
    async fn test_buffering_response_within_limit() {
        let mut response = Response::builder()
            .status(200)
            .body(
                Full::new(Bytes::from("small body"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::Buffering(Buffering {
            max_request_body_bytes: None,
            mem_request_body_bytes: None,
            max_response_body_bytes: Some(1024),
            mem_response_body_bytes: None,
            retry_expression: None,
        })];

        let result = handle_middleware_outgoing(&mut response, middleware).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_buffering_response_exceeds_limit() {
        let large_body = "x".repeat(2000);
        let mut response = Response::builder()
            .status(200)
            .body(
                Full::new(Bytes::from(large_body))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::Buffering(Buffering {
            max_request_body_bytes: None,
            mem_request_body_bytes: None,
            max_response_body_bytes: Some(100),
            mem_response_body_bytes: None,
            retry_expression: None,
        })];

        let result = handle_middleware_outgoing(&mut response, middleware).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_buffering_no_limit() {
        let mut response = Response::builder()
            .status(200)
            .body(
                Full::new(Bytes::from("any size body"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::Buffering(Buffering {
            max_request_body_bytes: None,
            mem_request_body_bytes: None,
            max_response_body_bytes: None,
            mem_response_body_bytes: None,
            retry_expression: None,
        })];

        let result = handle_middleware_outgoing(&mut response, middleware).await;
        assert!(result.is_ok());
    }
}
