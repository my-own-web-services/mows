//! Upstream consumer registry.
//!
//! Phase 7 ships with a hand-list of upstreams populated from
//! env vars. When the cluster grows past ~5 consumers a real
//! service registry (e.g. discovered via the operator) replaces
//! this; the rest of the BFF doesn't care because the only thing
//! it needs is `(consumer_key, base_url)` pairs.

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
    pub fn from_config(cfg: &crate::config::AuthzAdminConfig) -> Self {
        let mut upstreams = Vec::new();
        if !cfg.realtime_base_url.is_empty() {
            upstreams.push(Upstream {
                key: "realtime",
                base_url: cfg.realtime_base_url.trim_end_matches('/').to_string(),
            });
        }
        if !cfg.filez_base_url.is_empty() {
            upstreams.push(Upstream {
                key: "filez",
                base_url: cfg.filez_base_url.trim_end_matches('/').to_string(),
            });
        }
        Self { upstreams }
    }
}
