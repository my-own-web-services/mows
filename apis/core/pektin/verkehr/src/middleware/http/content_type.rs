use super::MiddlewareError;
use crate::routing_config::ContentType;
use http::Response;
use http_body_util::combinators::BoxBody;
use hyper::body::Bytes;

pub async fn handle_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    arg: ContentType,
) -> Result<(), MiddlewareError> {
    // If autoDetect is false, remove X-Content-Type-Options header
    // to allow browser content type sniffing
    if let Some(auto_detect) = arg.auto_detect {
        if !auto_detect {
            // Disable content type auto-detection by setting nosniff
            res.headers_mut()
                .insert("X-Content-Type-Options", "nosniff".parse().unwrap());
        } else {
            // Enable auto-detection by removing the header if it exists
            res.headers_mut().remove("X-Content-Type-Options");
        }
    }

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
    async fn test_content_type_auto_detect_false() {
        let mut response = Response::builder()
            .status(200)
            .body(
                Full::new(Bytes::from("test"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::ContentType(ContentType {
            auto_detect: Some(false),
        })];

        handle_middleware_outgoing(&mut response, middleware)
            .await
            .unwrap();

        assert_eq!(
            response.headers().get("X-Content-Type-Options").unwrap(),
            "nosniff"
        );
    }

    #[tokio::test]
    async fn test_content_type_auto_detect_true() {
        let mut response = Response::builder()
            .status(200)
            .header("X-Content-Type-Options", "nosniff")
            .body(
                Full::new(Bytes::from("test"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::ContentType(ContentType {
            auto_detect: Some(true),
        })];

        handle_middleware_outgoing(&mut response, middleware)
            .await
            .unwrap();

        assert!(response.headers().get("X-Content-Type-Options").is_none());
    }

    #[tokio::test]
    async fn test_content_type_no_config() {
        let mut response = Response::builder()
            .status(200)
            .body(
                Full::new(Bytes::from("test"))
                    .map_err(|never| match never {})
                    .boxed(),
            )
            .unwrap();

        let middleware = vec![HttpMiddleware::ContentType(ContentType {
            auto_detect: None,
        })];

        handle_middleware_outgoing(&mut response, middleware)
            .await
            .unwrap();

        // Should not modify headers if auto_detect is None
        assert!(response.headers().get("X-Content-Type-Options").is_none());
    }
}
