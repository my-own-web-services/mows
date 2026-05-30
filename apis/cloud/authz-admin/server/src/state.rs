use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    /// HTTP client used for every upstream call. Shared
    /// connection pool — never construct a per-request client.
    pub http: reqwest::Client,
    /// The configured upstream registry, resolved once at boot
    /// and never reloaded (config is read-only at runtime, same
    /// as realtime-server / filez-server).
    pub upstreams: Arc<crate::upstream::Registry>,
}

impl AppState {
    pub fn new(upstreams: crate::upstream::Registry) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .user_agent(concat!(
                "authz-admin-server/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .map_err(|e| anyhow::anyhow!("building reqwest client: {e}"))?;
        Ok(Self {
            http,
            upstreams: Arc::new(upstreams),
        })
    }
}
