use super::MiddlewareError;
use crate::routing_config::IpWhiteList;
use http::{Request, Response, StatusCode};
use http_body_util::{BodyExt, Full};
use hyper::body::{Bytes, Incoming};
use ipnet::IpNet;
use std::net::IpAddr;
use std::str::FromStr;

pub fn handle_incoming(req: &mut Request<Incoming>, arg: IpWhiteList) -> Result<(), MiddlewareError> {
    // Get the client IP address from the connection or X-Forwarded-For header
    let client_ip = get_client_ip(req, &arg);

    if let Some(ip) = client_ip {
        // Parse source ranges
        let mut allowed_ranges: Vec<IpNet> = Vec::new();
        for range_str in &arg.source_range {
            if let Ok(range) = IpNet::from_str(range_str) {
                allowed_ranges.push(range);
            } else if let Ok(ip_addr) = IpAddr::from_str(range_str) {
                // Single IP address, convert to /32 or /128 network
                let network = match ip_addr {
                    IpAddr::V4(v4) => IpNet::from(ipnet::Ipv4Net::new(v4, 32).unwrap()),
                    IpAddr::V6(v6) => IpNet::from(ipnet::Ipv6Net::new(v6, 128).unwrap()),
                };
                allowed_ranges.push(network);
            }
        }

        // Check if IP is in any of the allowed ranges
        let is_allowed = allowed_ranges.iter().any(|range| range.contains(&ip));

        if !is_allowed {
            return Err(MiddlewareError::Default {
                res: Response::builder()
                    .status(StatusCode::FORBIDDEN)
                    .body(
                        Full::new(Bytes::from("Forbidden"))
                            .map_err(|never| match never {})
                            .boxed(),
                    )
                    .unwrap(),
            });
        }
    } else {
        // Could not determine client IP, deny by default
        return Err(MiddlewareError::Default {
            res: Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(
                    Full::new(Bytes::from("Forbidden"))
                        .map_err(|never| match never {})
                        .boxed(),
                )
                .unwrap(),
        });
    }

    Ok(())
}

fn get_client_ip(req: &Request<Incoming>, arg: &IpWhiteList) -> Option<IpAddr> {
    // Check X-Forwarded-For header if ip_strategy is configured
    if let Some(ip_strategy) = &arg.ip_strategy {
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
                        if let Ok(ip) = IpAddr::from_str(ips[index]) {
                            // Check excluded IPs
                            if let Some(excluded) = &ip_strategy.excluded_ips {
                                let is_excluded = excluded.iter().any(|e| {
                                    if let Ok(excluded_ip) = IpAddr::from_str(e) {
                                        excluded_ip == ip
                                    } else {
                                        false
                                    }
                                });
                                if is_excluded {
                                    return None;
                                }
                            }
                            return Some(ip);
                        }
                    }
                }
            }
        }
    }

    // Try X-Real-IP header as fallback
    if let Some(real_ip_header) = req.headers().get("X-Real-IP") {
        if let Ok(ip_str) = real_ip_header.to_str() {
            if let Ok(ip) = IpAddr::from_str(ip_str) {
                return Some(ip);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware_http::handle_middleware_incoming;
    use crate::routing_config::{HttpMiddleware, IpStrategy};
    use http::{Request, Response as HttpResponse};
    use http_body_util::{BodyExt, Full};
    use hyper::body::Incoming;
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_ip_whitelist(
        mut req: Request<Incoming>,
        source_range: Vec<String>,
        ip_strategy: Option<IpStrategy>,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::IpWhiteList(IpWhiteList {
            source_range,
            ip_strategy,
        });

        match handle_middleware_incoming(&mut req, vec![middleware]).await {
            Ok(_) => Ok(HttpResponse::builder()
                .status(StatusCode::OK)
                .body(Full::new(Bytes::from("Allowed")))
                .unwrap()),
            Err(MiddlewareError::Default { res }) => {
                let (parts, body) = res.into_parts();
                let body_bytes = body.collect().await.unwrap().to_bytes();
                Ok(HttpResponse::from_parts(parts, Full::new(body_bytes)))
            }
        }
    }

    #[tokio::test]
    async fn test_ip_whitelist_allowed() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let source_range = vec!["127.0.0.1".to_string()];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let source_range = source_range.clone();
                async move {
                    test_service_ip_whitelist(
                        req,
                        source_range,
                        Some(IpStrategy {
                            depth: Some(1),
                            excluded_ips: None,
                        }),
                    )
                    .await
                }
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
            .header("X-Forwarded-For", "127.0.0.1")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);
        let response_text = response.text().await.unwrap();
        assert_eq!(response_text, "Allowed");

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_ip_whitelist_forbidden() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let source_range = vec!["192.168.1.0/24".to_string()];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let source_range = source_range.clone();
                async move { test_service_ip_whitelist(req, source_range, None).await }
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
            .header("X-Forwarded-For", "10.0.0.1")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 403);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_ip_whitelist_cidr_range() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let source_range = vec!["192.168.1.0/24".to_string()];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let source_range = source_range.clone();
                async move {
                    test_service_ip_whitelist(
                        req,
                        source_range,
                        Some(IpStrategy {
                            depth: Some(1),
                            excluded_ips: None,
                        }),
                    )
                    .await
                }
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
            .header("X-Forwarded-For", "192.168.1.50")
            .send()
            .await
            .unwrap();

        assert_eq!(response.status(), 200);

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_ip_whitelist_multiple_ranges() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let source_range = vec![
            "192.168.1.0/24".to_string(),
            "10.0.0.0/8".to_string(),
            "127.0.0.1".to_string(),
        ];

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let source_range = source_range.clone();
                async move {
                    test_service_ip_whitelist(
                        req,
                        source_range,
                        Some(IpStrategy {
                            depth: Some(1),
                            excluded_ips: None,
                        }),
                    )
                    .await
                }
            });

            http1::Builder::new()
                .serve_connection(io, service)
                .await
                .ok();
        });

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let client = reqwest::Client::new();

        // Test IP in 10.0.0.0/8 range
        let response = client
            .get(format!("http://{}/test", addr))
            .header("X-Forwarded-For", "10.5.10.20")
            .send()
            .await
            .unwrap();
        assert_eq!(response.status(), 200);

        server_handle.abort();
    }
}
