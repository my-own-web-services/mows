use crate::{
    config::routing_config::{HttpMiddleware, HttpRouter, HttpService, RoutingConfig},
    utils::get_host_from_uri_or_header,
};
use dashmap::DashMap;
use http::Request;
use hyper::body::Incoming;
use std::{
    hash::{DefaultHasher, Hash, Hasher},
    net::{IpAddr, SocketAddr},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};
use tokio::sync::RwLock;
use tracing::trace;

/// Cache entry containing the routing decision result
/// Wrapped in Arc to avoid expensive cloning on cache hits
#[derive(Clone, Debug)]
pub struct RoutingCacheEntry {
    pub router: Arc<HttpRouter>,
    pub service: Option<Arc<HttpService>>,
    pub middlewares: Arc<Vec<HttpMiddleware>>,
}

/// Routing cache that stores routing decisions based on request properties
/// Uses DashMap for lock-free concurrent access
pub struct RoutingCache {
    version: Arc<RwLock<Option<u64>>>,
    cache: Arc<DashMap<u64, RoutingCacheEntry>>,
    hits: AtomicU64,
    misses: AtomicU64,
}

impl RoutingCache {
    /// Creates a new routing cache
    pub fn new() -> Self {
        RoutingCache {
            version: Arc::new(RwLock::new(None)),
            cache: Arc::new(DashMap::new()),
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
        }
    }

    /// Checks if the cache is valid for the current config version
    /// Clears the cache if the version has changed
    /// This uses a read lock first to avoid write lock contention
    pub async fn check_version(&self, config: Arc<RwLock<RoutingConfig>>) {
        let current_version = config.read().await.version;

        // Fast path: check with read lock first
        {
            let version = self.version.read().await;
            if *version == current_version {
                return;
            }
        }

        // Slow path: version changed, acquire write lock
        let mut version = self.version.write().await;

        // Double-check after acquiring write lock (another thread may have updated it)
        if *version != current_version {
            let old_size = self.cache.len();
            let old_version = *version;
            let hits = self.hits.load(Ordering::Relaxed);
            let misses = self.misses.load(Ordering::Relaxed);

            self.cache.clear();
            *version = current_version;

            trace!(
                old_version = ?old_version,
                new_version = ?current_version,
                cache_size = old_size,
                hits = hits,
                misses = misses,
                "Routing cache invalidated due to config version change"
            );

            // Reset statistics on version change
            self.hits.store(0, Ordering::Relaxed);
            self.misses.store(0, Ordering::Relaxed);
        }
    }

    /// Attempts to retrieve a cached routing decision
    /// This is lock-free and highly concurrent
    pub fn get(
        &self,
        req: &Request<Incoming>,
        entrypoint_name: &str,
        client_addr: SocketAddr,
    ) -> Option<RoutingCacheEntry> {
        let key = compute_cache_key(req, entrypoint_name, client_addr);

        if let Some(entry) = self.cache.get(&key) {
            let hits = self.hits.fetch_add(1, Ordering::Relaxed) + 1;
            trace!(
                key = key,
                hits = hits,
                cache_size = self.cache.len(),
                "Routing cache hit"
            );
            Some(entry.clone())
        } else {
            let misses = self.misses.fetch_add(1, Ordering::Relaxed) + 1;
            trace!(
                key = key,
                misses = misses,
                cache_size = self.cache.len(),
                "Routing cache miss"
            );
            None
        }
    }

    /// Stores a routing decision in the cache
    /// This is lock-free and highly concurrent
    pub fn insert(
        &self,
        req: &Request<Incoming>,
        entrypoint_name: &str,
        client_addr: SocketAddr,
        entry: RoutingCacheEntry,
    ) {
        let key = compute_cache_key(req, entrypoint_name, client_addr);
        self.cache.insert(key, entry);

        trace!(
            key = key,
            cache_size = self.cache.len(),
            "Routing decision cached"
        );
    }

    /// Returns cache statistics
    pub fn stats(&self) -> (u64, u64, usize) {
        (
            self.hits.load(Ordering::Relaxed),
            self.misses.load(Ordering::Relaxed),
            self.cache.len(),
        )
    }
}

impl Default for RoutingCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Computes a cache key based on request properties that affect routing
///
/// The key is based on:
/// - Entrypoint name
/// - Host (from URI or Host header)
/// - Request path (without query string for better hit rate)
/// - HTTP method
/// - Client IP address
fn compute_cache_key(
    req: &Request<Incoming>,
    entrypoint_name: &str,
    client_addr: SocketAddr,
) -> u64 {
    let mut hasher = DefaultHasher::new();

    // Hash entrypoint name
    entrypoint_name.hash(&mut hasher);

    // Hash host (most routing rules use Host)
    if let Ok(host) = get_host_from_uri_or_header(req) {
        host.hash(&mut hasher);
    }

    // Hash path without query (most routing rules use PathPrefix or Path)
    // We exclude query string to improve cache hit rate since query params
    // are less commonly used for routing decisions
    req.uri().path().hash(&mut hasher);

    // Hash HTTP method
    req.method().hash(&mut hasher);

    // Hash client IP (for ClientIP-based rules)
    let client_ip: IpAddr = client_addr.ip();
    match client_ip {
        IpAddr::V4(ip) => ip.octets().hash(&mut hasher),
        IpAddr::V6(ip) => ip.octets().hash(&mut hasher),
    }

    hasher.finish()
}
