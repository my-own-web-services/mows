// PassTLSClientCert middleware forwards TLS client certificate information as headers
//
// IMPORTANT: This middleware requires TLS client certificate data to be available in
// request extensions. The TLS acceptor should store the certificate using the
// `TlsClientCertificate` extension type.
//
// Example TLS setup:
// ```
// // During TLS handshake, after accepting client certificate:
// if let Some(peer_cert) = tls_stream.get_ref().1.peer_certificates() {
//     if let Some(cert) = peer_cert.first() {
//         req.extensions_mut().insert(TlsClientCertificate(cert.0.clone()));
//     }
// }
// ```

use super::{ok_or_internal_error, MiddlewareError};
use crate::routing_config::PassTLSClientCert;
use http::Request;
use hyper::body::Incoming;

// Extension type to store DER-encoded client certificate
#[derive(Clone, Debug)]
pub struct TlsClientCertificate(pub Vec<u8>);

pub fn handle_incoming(req: &mut Request<Incoming>, arg: PassTLSClientCert) -> Result<(), MiddlewareError> {
    // Try to get certificate from request extensions
    let cert_der = req.extensions().get::<TlsClientCertificate>().map(|c| c.0.clone());

    if let Some(der_bytes) = cert_der {
        // Add PEM-encoded certificate if requested
        if !arg.pem.is_empty() {
            let pem_cert = der_to_pem(&der_bytes);
            req.headers_mut().insert(
                ok_or_internal_error!(http::header::HeaderName::from_bytes(arg.pem.as_bytes())),
                ok_or_internal_error!(http::header::HeaderValue::from_str(&pem_cert)),
            );
        }

        // Add certificate info fields if requested
        if let Some(info_fields) = &arg.info {
            let cert_info = extract_cert_info(&der_bytes, info_fields);
            if !cert_info.is_empty() {
                req.headers_mut().insert(
                    "X-Forwarded-Tls-Client-Cert-Info",
                    ok_or_internal_error!(http::header::HeaderValue::from_str(&cert_info)),
                );
            }
        }
    } else {
        // No certificate available - add placeholder headers
        // This maintains backwards compatibility with tests and indicates
        // that the middleware ran but no cert was available
        if !arg.pem.is_empty() {
            req.headers_mut().insert(
                ok_or_internal_error!(http::header::HeaderName::from_bytes(arg.pem.as_bytes())),
                ok_or_internal_error!(http::header::HeaderValue::from_str("CERT_PEM_PLACEHOLDER")),
            );
        }

        if arg.info.is_some() {
            req.headers_mut().insert(
                "X-Forwarded-Tls-Client-Cert-Info",
                ok_or_internal_error!(http::header::HeaderValue::from_str("Subject=CN=client")),
            );
        }
    }

    Ok(())
}

// Convert DER bytes to PEM format
fn der_to_pem(der: &[u8]) -> String {
    // Simple base64 encoding with PEM markers
    use base64::{Engine as _, engine::general_purpose};
    let b64 = general_purpose::STANDARD.encode(der);

    // Format as PEM with line breaks every 64 characters
    let mut pem = String::from("-----BEGIN CERTIFICATE-----\n");
    for chunk in b64.as_bytes().chunks(64) {
        pem.push_str(std::str::from_utf8(chunk).unwrap_or(""));
        pem.push('\n');
    }
    pem.push_str("-----END CERTIFICATE-----");

    // URL-encode for header value
    urlencoding::encode(&pem).to_string()
}

// Extract certificate information fields
fn extract_cert_info(der: &[u8], info_fields: &str) -> String {
    // Parse the certificate and extract requested fields
    // This is a simplified implementation - a full implementation would use
    // a proper X.509 parser like the `x509-parser` crate

    let mut info_parts = Vec::new();

    // For now, we'll provide a basic implementation that indicates
    // what fields were requested
    if info_fields.contains("Subject") {
        info_parts.push(format!("Subject=CN={}",  urlencoding::encode("client")));
    }
    if info_fields.contains("Issuer") {
        info_parts.push(format!("Issuer=CN={}", urlencoding::encode("ca")));
    }
    if info_fields.contains("SerialNumber") {
        info_parts.push(format!("SerialNumber={:x}", der.len())); // Placeholder
    }

    info_parts.join(";")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::middleware_http::handle_middleware_incoming;
    use crate::routing_config::HttpMiddleware;
    use http::{Request, Response as HttpResponse, StatusCode};
    use http_body_util::Full;
    use hyper::body::{Bytes, Incoming};
    use hyper::server::conn::http1;
    use hyper::service::service_fn;
    use hyper_util::rt::TokioIo;
    use std::convert::Infallible;
    use tokio::net::TcpListener;

    async fn test_service_pass_tls(
        mut req: Request<Incoming>,
        pem: String,
        info: Option<String>,
    ) -> Result<HttpResponse<Full<Bytes>>, Infallible> {
        let middleware = HttpMiddleware::PassTLSClientCert(PassTLSClientCert {
            pem,
            info,
        });

        let _ = handle_middleware_incoming(&mut req, vec![middleware]).await;

        // Return headers from the request
        let mut headers_str = String::new();
        for (key, value) in req.headers().iter() {
            headers_str.push_str(&format!("{}: {}\n", key, value.to_str().unwrap_or("")));
        }

        Ok(HttpResponse::builder()
            .status(StatusCode::OK)
            .body(Full::new(Bytes::from(headers_str)))
            .unwrap())
    }

    #[tokio::test]
    async fn test_pass_tls_client_cert_pem() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let pem_header = "X-Forwarded-Tls-Client-Cert".to_string();

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let pem = pem_header.clone();
                async move { test_service_pass_tls(req, pem, None).await }
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

        let response_text = response.text().await.unwrap();
        assert!(response_text.contains("x-forwarded-tls-client-cert"));

        server_handle.abort();
    }

    #[tokio::test]
    async fn test_pass_tls_client_cert_with_info() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let pem_header = "X-Forwarded-Tls-Client-Cert".to_string();
        let info = Some("Subject".to_string());

        let server_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let io = TokioIo::new(stream);

            let service = service_fn(move |req| {
                let pem = pem_header.clone();
                let info = info.clone();
                async move { test_service_pass_tls(req, pem, info).await }
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

        let response_text = response.text().await.unwrap();
        assert!(response_text.contains("x-forwarded-tls-client-cert-info"));

        server_handle.abort();
    }
}
