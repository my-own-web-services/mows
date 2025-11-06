use crate::{
    routing_config::{HttpMiddleware, HttpService, RoutingConfig},
    some_or_bail,
};
use http::{header::HeaderName, Request};
use hyper::body::Incoming;
use std::{collections::HashMap, net::SocketAddr, str::FromStr, sync::Arc};
use tokio::sync::RwLock;

pub struct RoutingCache {
    pub version: u64,
    pub cache: HashMap<String, (Option<HttpService>, Vec<HttpMiddleware>)>,
}

impl RoutingCache {
    pub fn new(&self, routing_config: RoutingConfig) -> anyhow::Result<Arc<RwLock<RoutingCache>>> {
        Ok(Arc::new(RwLock::new(RoutingCache {
            version: some_or_bail!(routing_config.version, "Missing version in routing config"),
            cache: HashMap::new(),
        })))
    }

    pub async fn get(&mut self, _req: &Request<Incoming>, config: Arc<RwLock<RoutingConfig>>) {
        if let Some(version) = config.read().await.version {
            if self.version != version {
                self.cache.clear()
            } else {
            }
        }
    }
}

pub fn get_hash_key(_req: &Request<Incoming>, _client_addr: SocketAddr) {
    let _hashed_headers: Vec<HeaderName> = vec![HeaderName::from_str("Host").unwrap()];
    let _relevant_headers: Vec<_> = _req
        .headers()
        .iter()
        .filter(|h| _hashed_headers.contains(h.0))
        .collect();
}
