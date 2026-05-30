//! Upstream consumer registry.
//!
//! Phase 7 ships with a hand-list of upstreams populated from
//! env vars. When the cluster grows past ~5 consumers a real
//! service registry (e.g. discovered via the operator) replaces
//! this; the rest of the BFF doesn't care because the only thing
//! it needs is `(consumer_key, base_url)` pairs.

use std::net::IpAddr;

use anyhow::{bail, Context};
use url::{Host, Url};

#[derive(Clone, Debug)]
pub struct Upstream {
    /// Stable short identifier used in API responses
    /// (`"realtime"`, `"filez"`). Frontend keys per-consumer
    /// sections on this string.
    pub key: &'static str,
    pub base_url: String,
}

#[derive(Debug, Default)]
pub struct Registry {
    pub upstreams: Vec<Upstream>,
}

impl Registry {
    /// Build a registry from the loaded config. **Fallible** so
    /// the boot path can refuse malformed / dangerous URLs
    /// loudly — see `validate_upstream_url` for the policy.
    /// (review-3 R3 / SEC-3)
    pub fn from_config(cfg: &crate::config::AuthzAdminConfig) -> anyhow::Result<Self> {
        let mut upstreams = Vec::new();
        for (key, raw) in [
            ("realtime", &cfg.realtime_base_url),
            ("filez", &cfg.filez_base_url),
        ] {
            if raw.is_empty() {
                continue;
            }
            let trimmed = raw.trim_end_matches('/');
            validate_upstream_url(key, trimmed)
                .with_context(|| format!("rejecting upstream {key} base URL"))?;
            upstreams.push(Upstream {
                key,
                base_url: trimmed.to_string(),
            });
        }
        Ok(Self { upstreams })
    }
}

/// Refuse to register an upstream whose URL points somewhere the
/// BFF must never be tricked into proxying to. The whitelist is
/// scheme + host shaped:
///
///   * scheme must be `http` or `https`
///   * host must be one of:
///       - a hostname (a name we trust the operator routed
///         deliberately — `realtime-server`, `filez-server`,
///         a k8s service DNS name, etc.)
///       - a loopback literal (`127.0.0.1`, `::1`, `localhost`)
///       - an RFC1918 / unique-local IP (typical k8s service IP
///         ranges, e.g. `10.0.0.0/8`)
///
/// **Explicitly refused**: link-local addresses (`169.254.0.0/16`
/// / `fe80::/10`) — that range includes the cloud-provider
/// metadata service (`169.254.169.254`) which would let an
/// operator typo turn the BFF into an IAM-credential exfiltrator
/// via SSRF. See review-3 R3 / SEC-3.
pub fn validate_upstream_url(key: &str, url: &str) -> anyhow::Result<()> {
    let parsed = Url::parse(url)
        .with_context(|| format!("upstream {key}: {url:?} is not a valid URL"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        bail!(
            "upstream {key}: scheme {:?} not permitted (must be http or https)",
            parsed.scheme()
        );
    }
    // Use `Url::host()` rather than `host_str() + parse::<IpAddr>`
    // because `host_str()` returns the bracketed form for IPv6
    // literals (`[fe80::1]`) which doesn't round-trip through
    // `IpAddr::from_str`. `Host` is already typed.
    let host = parsed
        .host()
        .with_context(|| format!("upstream {key}: missing host in {url:?}"))?;
    // Hostnames (non-IP) are accepted on trust; the operator
    // chose to point us at a named service. The IP-literal path
    // is the dangerous one because that's where typo'd metadata
    // URLs land.
    let ip = match host {
        Host::Domain(_) => return Ok(()),
        Host::Ipv4(v4) => IpAddr::V4(v4),
        Host::Ipv6(v6) => IpAddr::V6(v6),
    };
    if ip.is_loopback() {
        return Ok(());
    }
    if is_link_local(&ip) {
        bail!(
            "upstream {key}: refuses link-local IP {ip} — this range \
             includes cloud metadata services (169.254.169.254) and \
             must never be a proxy target. If this is a legitimate \
             use case, route through a named service instead."
        );
    }
    // Other IP literals (RFC1918, ULA, public) are accepted —
    // k8s service IPs live in 10.0.0.0/8 and need to pass.
    Ok(())
}

fn is_link_local(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_link_local(),
        // `Ipv6Addr::is_unicast_link_local` is unstable as of
        // 1.79; check the fe80::/10 prefix by hand.
        IpAddr::V6(v6) => {
            let seg = v6.segments();
            (seg[0] & 0xffc0) == 0xfe80
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_loopback_and_hostnames_and_rfc1918() {
        validate_upstream_url("realtime", "http://127.0.0.1:8765").unwrap();
        validate_upstream_url("realtime", "https://realtime-server").unwrap();
        validate_upstream_url("realtime", "http://10.0.0.7:8080").unwrap();
        validate_upstream_url("realtime", "http://[::1]:8765").unwrap();
        validate_upstream_url("realtime", "http://localhost").unwrap();
    }

    #[test]
    fn refuses_aws_metadata_address() {
        let err = validate_upstream_url("realtime", "http://169.254.169.254/")
            .unwrap_err()
            .to_string();
        assert!(err.contains("link-local"), "got: {err}");
    }

    #[test]
    fn refuses_link_local_ipv6() {
        let err = validate_upstream_url("realtime", "http://[fe80::1]:8080")
            .unwrap_err()
            .to_string();
        assert!(err.contains("link-local"), "got: {err}");
    }

    #[test]
    fn refuses_non_http_schemes() {
        assert!(validate_upstream_url("x", "file:///etc/passwd").is_err());
        assert!(validate_upstream_url("x", "ftp://example.com").is_err());
    }
}
