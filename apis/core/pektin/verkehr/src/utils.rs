use anyhow::bail;
use http::Request;
use hyper::body::Incoming;
use hyper::upgrade::Upgraded;
use hyper_util::rt::TokioIo;
use rustls::pki_types::{CertificateDer, PrivateKeyDer};
use rustls::sign::CertifiedKey;
use std::io::BufReader;
use tokio::net::TcpStream;

pub fn host_addr(uri: &http::Uri) -> Option<String> {
    uri.authority().map(|auth| auth.to_string())
}

pub fn de_absolute_name(name: &str) -> String {
    if name.ends_with('.') {
        name[0..name.len() - 1].to_string()
    } else {
        name.to_string()
    }
}

pub fn strings_to_certified_key(cert: &str, key: &str) -> anyhow::Result<CertifiedKey> {
    let mut reader = BufReader::new(cert.as_bytes());

    let certs: Vec<CertificateDer> = rustls_pemfile::certs(&mut reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| anyhow::anyhow!("could not parse certificate: {}", e))?;

    let mut reader = BufReader::new(key.as_bytes());

    let keys: Vec<PrivateKeyDer> = rustls_pemfile::pkcs8_private_keys(&mut reader)
        .map(|k| k.map(PrivateKeyDer::Pkcs8))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| anyhow::anyhow!("failed to load private key"))?;

    if keys.len() != 1 {
        bail!("expected a single private key")
    }

    let signing_key = rustls::crypto::ring::sign::any_supported_type(&keys[0])
        .map_err(|_| anyhow::anyhow!("no supported key type found"))?;

    Ok(CertifiedKey::new(certs, signing_key))
}

// Create a TCP connection to host:port, build a tunnel between the connection and
// the upgraded connection
pub async fn tunnel(upgraded: Upgraded, addr: String) -> std::io::Result<()> {
    // Connect to remote server
    let mut server = TcpStream::connect(addr).await?;

    // Wrap upgraded in TokioIo for compatibility with tokio's AsyncRead/AsyncWrite
    let mut upgraded_io = TokioIo::new(upgraded);

    // Proxying data
    let (from_client, from_server) =
        tokio::io::copy_bidirectional(&mut upgraded_io, &mut server).await?;

    // Log when done
    tracing::debug!(
        from_client = %from_client,
        from_server = %from_server,
        "tunnel closed"
    );

    Ok(())
}

#[macro_export]
macro_rules! some_or_bail {
    ( $option:expr, $message:expr ) => {{
        if let Some(val) = $option {
            val
        } else {
            anyhow::bail!($message)
        }
    }};
}

pub fn parse_addr(listen_addr: &str) -> anyhow::Result<String> {
    let c = listen_addr.matches(':').count();
    #[allow(clippy::comparison_chain)]
    if c > 1 {
        //IPv6
        Ok(listen_addr.to_string())
    } else if c == 1 {
        //IPv4
        let s = match listen_addr.split_once(':') {
            Some(s) => s,
            None => {
                bail!("invalid address: {}", listen_addr);
            }
        };
        if s.0.is_empty() {
            Ok(format!("[::]:{}", s.1))
        } else {
            Ok(listen_addr.to_string())
        }
    } else {
        bail!("invalid address: {}", listen_addr);
    }
}

// this is needed for http1
pub fn get_host_from_uri_or_header(req: &Request<Incoming>) -> anyhow::Result<String> {
    match req.uri().host() {
        Some(host) => Ok(host.to_string()),
        None => {
            let host_header = match req.headers().get("host") {
                Some(h) => h,
                None => bail!("no host header"),
            };

            let hh_str = match host_header.to_str() {
                Ok(h) => h,
                Err(_) => bail!("invalid host header"),
            };
            Ok(hh_str.to_string())
        }
    }
}
