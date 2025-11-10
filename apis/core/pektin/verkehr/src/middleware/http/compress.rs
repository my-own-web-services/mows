use crate::config::routing_config::{Compress, MiddlewareDirection};
use super::{MiddlewareError, ok_or_internal_error};
use http::{header::HeaderName, HeaderValue, Response};
use http_body_util::{combinators::BoxBody, BodyExt, Full};
use hyper::body::Bytes;
use std::str::FromStr;
use flate2::{write::GzEncoder, Compression};
use tracing::{debug, error};

pub async fn handle_outgoing(
    res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    arg: Compress,
) -> Result<(), MiddlewareError> {
    // Check if this middleware should apply to outgoing direction
    if let Some(direction) = &arg.direction {
        if *direction == MiddlewareDirection::Incoming {
            return Ok(());
        }
    }

    // Get the content type to check if it should be excluded
    let content_type = res
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // Check if content type is excluded
    if let Some(excluded_types) = &arg.excluded_content_types {
        for excluded in excluded_types {
            if content_type.contains(excluded) {
                debug!("Skipping compression for excluded content-type: {}", content_type);
                return Ok(());
            }
        }
    }

    // Collect the body to check size and compress
    let body = std::mem::replace(res.body_mut(), Full::new(Bytes::new()).map_err(|never| match never {}).boxed());
    let body_bytes = body.collect().await.unwrap().to_bytes(); // Infallible

    // Check minimum size
    let min_size = arg.min_response_body_bytes.unwrap_or(1024);
    if body_bytes.len() < min_size as usize {
        debug!("Response body too small for compression: {} < {}", body_bytes.len(), min_size);
        *res.body_mut() = Full::new(body_bytes).map_err(|never| match never {}).boxed();
        return Ok(());
    }

    // Compress using gzip
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    if let Err(e) = std::io::Write::write_all(&mut encoder, &body_bytes) {
        error!("Failed to compress response: {}", e);
        *res.body_mut() = Full::new(body_bytes).map_err(|never| match never {}).boxed();
        return Ok(());
    }

    let compressed = ok_or_internal_error!(encoder.finish());

    debug!("Compressed response from {} to {} bytes", body_bytes.len(), compressed.len());

    // Update headers
    res.headers_mut().insert(
        ok_or_internal_error!(HeaderName::from_str("content-encoding")),
        ok_or_internal_error!(HeaderValue::from_str("gzip")),
    );
    res.headers_mut().remove("content-length");

    // Set the compressed body
    *res.body_mut() = Full::new(Bytes::from(compressed)).map_err(|never| match never {}).boxed();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::read::GzDecoder;
    use http::{Response, StatusCode};
    use http_body_util::{BodyExt, Full};
    use hyper::body::Bytes;
    use std::io::Read;

    // Helper function to create a test response
    fn create_test_response(body: &str, content_type: Option<&str>) -> Response<BoxBody<Bytes, std::convert::Infallible>> {
        let mut builder = Response::builder().status(StatusCode::OK);

        if let Some(ct) = content_type {
            builder = builder.header("content-type", ct);
        }

        builder
            .body(Full::new(Bytes::from(body.to_string())).map_err(|never| match never {}).boxed())
            .unwrap()
    }

    // Helper function to decompress gzip data
    fn decompress_gzip(data: &[u8]) -> Result<Vec<u8>, std::io::Error> {
        let mut decoder = GzDecoder::new(data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed)?;
        Ok(decompressed)
    }

    #[tokio::test]
    async fn test_compress_large_response() {
        // Create a response with a body larger than the default minimum (1024 bytes)
        let large_body = "x".repeat(2000);
        let mut response = create_test_response(&large_body, Some("text/html"));

        let config = Compress {
            excluded_content_types: None,
            min_response_body_bytes: None,
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Check that Content-Encoding header is set
        assert_eq!(
            response.headers().get("content-encoding").unwrap(),
            "gzip"
        );

        // Check that content-length was removed
        assert!(response.headers().get("content-length").is_none());

        // Verify the body is actually compressed
        let body_bytes = response.body_mut().collect().await.unwrap().to_bytes();
        let decompressed = decompress_gzip(&body_bytes).unwrap();
        assert_eq!(String::from_utf8(decompressed).unwrap(), large_body);

        // Verify compression actually reduced size
        assert!(body_bytes.len() < large_body.len());
    }

    #[tokio::test]
    async fn test_compress_small_response_not_compressed() {
        // Create a response with a body smaller than the default minimum (1024 bytes)
        let small_body = "x".repeat(500);
        let mut response = create_test_response(&small_body, Some("text/html"));

        let config = Compress {
            excluded_content_types: None,
            min_response_body_bytes: None,
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Check that Content-Encoding header is NOT set
        assert!(response.headers().get("content-encoding").is_none());

        // Verify the body is unchanged
        let body_bytes = response.body_mut().collect().await.unwrap().to_bytes();
        assert_eq!(String::from_utf8(body_bytes.to_vec()).unwrap(), small_body);
    }

    #[tokio::test]
    async fn test_compress_excluded_content_type() {
        // Create a response with an excluded content type
        let large_body = "x".repeat(2000);
        let mut response = create_test_response(&large_body, Some("image/png"));

        let config = Compress {
            excluded_content_types: Some(vec!["image/".to_string()]),
            min_response_body_bytes: None,
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Check that Content-Encoding header is NOT set
        assert!(response.headers().get("content-encoding").is_none());

        // Verify the body is unchanged
        let body_bytes = response.body_mut().collect().await.unwrap().to_bytes();
        assert_eq!(String::from_utf8(body_bytes.to_vec()).unwrap(), large_body);
    }

    #[tokio::test]
    async fn test_compress_custom_min_size() {
        // Create a response that's 1500 bytes
        let body = "x".repeat(1500);
        let mut response = create_test_response(&body, Some("text/plain"));

        // Set minimum to 2000 bytes
        let config = Compress {
            excluded_content_types: None,
            min_response_body_bytes: Some(2000),
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Should not be compressed because it's below the custom minimum
        assert!(response.headers().get("content-encoding").is_none());

        let body_bytes = response.body_mut().collect().await.unwrap().to_bytes();
        assert_eq!(String::from_utf8(body_bytes.to_vec()).unwrap(), body);
    }

    #[tokio::test]
    async fn test_compress_respects_incoming_direction() {
        // Create a large response
        let large_body = "x".repeat(2000);
        let mut response = create_test_response(&large_body, Some("text/html"));

        // Set direction to Incoming (should not compress responses)
        let config = Compress {
            excluded_content_types: None,
            min_response_body_bytes: None,
            direction: Some(MiddlewareDirection::Incoming),
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Should not be compressed because direction is Incoming
        assert!(response.headers().get("content-encoding").is_none());
    }

    #[tokio::test]
    async fn test_compress_multiple_excluded_types() {
        let large_body = "x".repeat(2000);

        // Test multiple content types
        let test_cases = vec![
            ("image/jpeg", true),  // should be excluded
            ("video/mp4", true),   // should be excluded
            ("application/zip", true),  // should be excluded
            ("text/html", false),  // should be compressed
        ];

        for (content_type, should_exclude) in test_cases {
            let mut response = create_test_response(&large_body, Some(content_type));

            let config = Compress {
                excluded_content_types: Some(vec![
                    "image/".to_string(),
                    "video/".to_string(),
                    "application/zip".to_string(),
                ]),
                min_response_body_bytes: None,
                direction: None,
            };

            let result = handle_outgoing(&mut response, config).await;
            assert!(result.is_ok());

            if should_exclude {
                assert!(
                    response.headers().get("content-encoding").is_none(),
                    "Content type {} should be excluded but was compressed",
                    content_type
                );
            } else {
                assert_eq!(
                    response.headers().get("content-encoding").unwrap(),
                    "gzip",
                    "Content type {} should be compressed but wasn't",
                    content_type
                );
            }
        }
    }

    #[tokio::test]
    async fn test_compress_json_response() {
        // Create a JSON response that's large enough to compress
        let json_body = serde_json::json!({
            "data": vec!["item"; 200],
            "status": "success",
            "message": "This is a large JSON response that should be compressed"
        }).to_string();

        let mut response = create_test_response(&json_body, Some("application/json"));

        let config = Compress {
            excluded_content_types: None,
            min_response_body_bytes: Some(100),
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Should be compressed
        assert_eq!(
            response.headers().get("content-encoding").unwrap(),
            "gzip"
        );

        // Verify decompression works and produces original JSON
        let body_bytes = response.body_mut().collect().await.unwrap().to_bytes();
        let decompressed = decompress_gzip(&body_bytes).unwrap();
        assert_eq!(String::from_utf8(decompressed).unwrap(), json_body);
    }

    #[tokio::test]
    async fn test_compress_without_content_type() {
        // Create a response without a content-type header
        let large_body = "x".repeat(2000);
        let mut response = create_test_response(&large_body, None);

        let config = Compress {
            excluded_content_types: Some(vec!["image/".to_string()]),
            min_response_body_bytes: None,
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Should be compressed (no content-type means no exclusion match)
        assert_eq!(
            response.headers().get("content-encoding").unwrap(),
            "gzip"
        );
    }

    #[tokio::test]
    async fn test_compress_exact_min_size() {
        // Create a response exactly at the minimum size
        let body = "x".repeat(1024);
        let mut response = create_test_response(&body, Some("text/plain"));

        let config = Compress {
            excluded_content_types: None,
            min_response_body_bytes: Some(1024),
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Should be compressed (min_size is inclusive - >= 1024 bytes will be compressed)
        assert_eq!(
            response.headers().get("content-encoding").unwrap(),
            "gzip"
        );
    }

    #[tokio::test]
    async fn test_compress_one_byte_over_min() {
        // Create a response one byte over the minimum size
        let body = "x".repeat(1025);
        let mut response = create_test_response(&body, Some("text/plain"));

        let config = Compress {
            excluded_content_types: None,
            min_response_body_bytes: Some(1024),
            direction: None,
        };

        let result = handle_outgoing(&mut response, config).await;
        assert!(result.is_ok());

        // Should be compressed (one byte over the minimum)
        assert_eq!(
            response.headers().get("content-encoding").unwrap(),
            "gzip"
        );
    }

    // Integration tests with actual HTTP server
    mod integration {
        use super::*;
        use hyper::service::service_fn;
        use hyper::server::conn::http1;
        use hyper_util::rt::TokioIo;
        use tokio::net::TcpListener;
        use std::convert::Infallible;

        // Helper function to create a simple HTTP service with compression middleware
        async fn test_service(
            _req: hyper::Request<hyper::body::Incoming>,
            middleware_config: Compress,
        ) -> Result<hyper::Response<BoxBody<Bytes, Infallible>>, Infallible> {
            // Create a large response
            let body = "x".repeat(2000);
            let mut response = Response::builder()
                .status(200)
                .header("content-type", "text/html")
                .body(Full::new(Bytes::from(body)).map_err(|never| match never {}).boxed())
                .unwrap();

            // Apply compression middleware
            let _ = handle_outgoing(&mut response, middleware_config).await;

            Ok(response)
        }

        #[tokio::test]
        async fn test_http_request_with_compression() {
            // Start a test HTTP server
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = listener.local_addr().unwrap();

            let middleware_config = Compress {
                excluded_content_types: None,
                min_response_body_bytes: Some(100),
                direction: None,
            };

            // Spawn server
            let server_handle = tokio::spawn(async move {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service = service_fn(move |req| {
                    let config = middleware_config.clone();
                    async move { test_service(req, config).await }
                });

                http1::Builder::new()
                    .serve_connection(io, service)
                    .await
                    .ok();
            });

            // Give server time to start
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            // Make HTTP request
            let client = reqwest::Client::new();
            let response = client
                .get(format!("http://{}", addr))
                .send()
                .await
                .unwrap();

            // Verify response has compression header
            assert_eq!(
                response.headers().get("content-encoding").unwrap(),
                "gzip"
            );

            // Verify body can be decompressed
            let body_bytes = response.bytes().await.unwrap();
            let decompressed = decompress_gzip(&body_bytes).unwrap();
            assert_eq!(String::from_utf8(decompressed).unwrap(), "x".repeat(2000));

            // Clean up
            server_handle.abort();
        }

        #[tokio::test]
        async fn test_http_request_without_compression_small_body() {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = listener.local_addr().unwrap();

            let middleware_config = Compress {
                excluded_content_types: None,
                min_response_body_bytes: Some(5000), // Set high threshold
                direction: None,
            };

            let server_handle = tokio::spawn(async move {
                let (stream, _) = listener.accept().await.unwrap();
                let io = TokioIo::new(stream);

                let service = service_fn(move |req| {
                    let config = middleware_config.clone();
                    async move { test_service(req, config).await }
                });

                http1::Builder::new()
                    .serve_connection(io, service)
                    .await
                    .ok();
            });

            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            let client = reqwest::Client::new();
            let response = client
                .get(format!("http://{}", addr))
                .send()
                .await
                .unwrap();

            // Verify response does NOT have compression header
            assert!(response.headers().get("content-encoding").is_none());

            // Verify body is uncompressed
            let body_text = response.text().await.unwrap();
            assert_eq!(body_text, "x".repeat(2000));

            server_handle.abort();
        }

        #[tokio::test]
        async fn test_http_multiple_requests_with_compression() {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            let addr = listener.local_addr().unwrap();

            let middleware_config = Compress {
                excluded_content_types: None,
                min_response_body_bytes: Some(100),
                direction: None,
            };

            // Spawn server that handles multiple connections
            let server_handle = tokio::spawn(async move {
                for _ in 0..3 {
                    if let Ok((stream, _)) = listener.accept().await {
                        let io = TokioIo::new(stream);
                        let config = middleware_config.clone();

                        let service = service_fn(move |req| {
                            let config = config.clone();
                            async move { test_service(req, config).await }
                        });

                        tokio::spawn(async move {
                            http1::Builder::new()
                                .serve_connection(io, service)
                                .await
                                .ok();
                        });
                    }
                }
            });

            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            // Make multiple requests
            let client = reqwest::Client::new();
            for _ in 0..3 {
                let response = client
                    .get(format!("http://{}", addr))
                    .send()
                    .await
                    .unwrap();

                // Each response should be compressed
                assert_eq!(
                    response.headers().get("content-encoding").unwrap(),
                    "gzip"
                );

                let body_bytes = response.bytes().await.unwrap();
                let decompressed = decompress_gzip(&body_bytes).unwrap();
                assert_eq!(String::from_utf8(decompressed).unwrap(), "x".repeat(2000));
            }

            server_handle.abort();
        }
    }
}
