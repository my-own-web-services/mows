use ipnet::IpNet;
use schemars::JsonSchema;
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;

use crate::config::rules::parse::{
    http::{parse_http_routing_rule, ParsedHttpRoutingRule},
    tcp::{parse_tcp_routing_rule, ParsedTcpRoutingRule},
};

#[derive(Deserialize, Serialize, Debug, Clone, Default, JsonSchema)]
pub struct RoutingConfig {
    pub version: Option<u64>,
    pub http: Option<HttpConfig>,
    pub tcp: Option<TcpConfig>,
    pub udp: Option<UdpConfig>,
}

impl RoutingConfig {
    /// Merges another RoutingConfig into this one
    /// If there are conflicts, the other config takes precedence
    pub fn merge(&mut self, other: RoutingConfig) {
        // Update version to the maximum
        if let Some(other_version) = other.version {
            self.version = Some(self.version.unwrap_or(0).max(other_version));
        }

        // Merge HTTP config
        if let Some(other_http) = other.http {
            match &mut self.http {
                Some(http) => http.merge(other_http),
                None => self.http = Some(other_http),
            }
        }

        // Merge TCP config
        if let Some(other_tcp) = other.tcp {
            match &mut self.tcp {
                Some(tcp) => tcp.merge(other_tcp),
                None => self.tcp = Some(other_tcp),
            }
        }

        // Merge UDP config
        if let Some(other_udp) = other.udp {
            match &mut self.udp {
                Some(udp) => udp.merge(other_udp),
                None => self.udp = Some(other_udp),
            }
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct CertResolverConfig {
    pub resolver_type: Option<String>,
    pub fallback_domain: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct HttpConfig {
    pub entrypoints: Option<HashMap<String, Entrypoint>>,
    pub routers: Option<HashMap<String, HttpRouter>>,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    #[schemars(with = "Option<HashMap<String, HttpMiddleware>>")]
    pub middlewares: Option<HashMap<String, HttpMiddleware>>,
    pub services: Option<HashMap<String, HttpService>>,
}

impl HttpConfig {
    fn merge(&mut self, other: HttpConfig) {
        merge_hashmap(&mut self.entrypoints, other.entrypoints);
        merge_hashmap(&mut self.routers, other.routers);
        merge_hashmap(&mut self.middlewares, other.middlewares);
        merge_hashmap(&mut self.services, other.services);
    }
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct TcpConfig {
    pub entrypoints: Option<HashMap<String, Entrypoint>>,
    pub routers: Option<HashMap<String, TcpRouter>>,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    #[schemars(with = "Option<HashMap<String, TcpMiddleware>>")]
    pub middlewares: Option<HashMap<String, TcpMiddleware>>,
    pub services: Option<HashMap<String, TcpService>>,
}

impl TcpConfig {
    fn merge(&mut self, other: TcpConfig) {
        merge_hashmap(&mut self.entrypoints, other.entrypoints);
        merge_hashmap(&mut self.routers, other.routers);
        merge_hashmap(&mut self.middlewares, other.middlewares);
        merge_hashmap(&mut self.services, other.services);
    }
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct UdpConfig {
    pub entrypoints: Option<HashMap<String, Entrypoint>>,
    pub routers: Option<HashMap<String, UdpRouter>>,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    #[schemars(with = "Option<HashMap<String, UdpMiddleware>>")]
    pub middlewares: Option<HashMap<String, UdpMiddleware>>,
    pub services: Option<HashMap<String, HttpService>>,
}

impl UdpConfig {
    fn merge(&mut self, other: UdpConfig) {
        merge_hashmap(&mut self.entrypoints, other.entrypoints);
        merge_hashmap(&mut self.routers, other.routers);
        merge_hashmap(&mut self.middlewares, other.middlewares);
        merge_hashmap(&mut self.services, other.services);
    }
}

/// Helper function to merge two optional HashMaps
/// If there are duplicate keys, the value from `other` takes precedence
fn merge_hashmap<K, V>(target: &mut Option<HashMap<K, V>>, other: Option<HashMap<K, V>>)
where
    K: std::hash::Hash + Eq,
{
    if let Some(other_map) = other {
        match target {
            Some(target_map) => {
                target_map.extend(other_map);
            }
            None => {
                *target = Some(other_map);
            }
        }
    }
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Entrypoint {
    pub address: String,
    pub cert_resolver: Option<CertResolverConfig>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct TcpRouter {
    #[serde(deserialize_with = "tcp_routing_rule_from_string")]
    pub rule: ParsedTcpRoutingRule,
    pub entrypoints: Vec<String>,
    pub middlewares: Option<Vec<String>>,
    pub service: String,
    pub priority: Option<i32>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct UdpRouter {
    pub entrypoints: Vec<String>,
    pub middlewares: Option<Vec<String>>,
    pub service: String,
    pub priority: Option<i32>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct HttpRouter {
    #[serde(deserialize_with = "http_routing_rule_from_string")]
    pub rule: ParsedHttpRoutingRule,
    pub entrypoints: Vec<String>,
    pub middlewares: Option<Vec<String>>,
    pub service: String,
    pub priority: Option<i32>,
}

fn http_routing_rule_from_string<'de, D>(deserializer: D) -> Result<ParsedHttpRoutingRule, D::Error>
where
    D: Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    parse_http_routing_rule(&s).map_err(serde::de::Error::custom)
}

fn tcp_routing_rule_from_string<'de, D>(deserializer: D) -> Result<ParsedTcpRoutingRule, D::Error>
where
    D: Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    parse_tcp_routing_rule(&s).map_err(serde::de::Error::custom)
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub enum TcpMiddleware {}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub enum UdpMiddleware {}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum HttpMiddleware {
    AddPrefix(AddPrefix),
    BasicAuth(BasicAuth),
    Buffering(Buffering),
    Chain(Chain),
    CircuitBreaker(CircuitBreaker),
    Compress(Compress),
    ContentType(ContentType),
    Cors(Cors),
    DigestAuth(DigestAuth),
    Errors(Errors),
    ForwardAuth(ForwardAuth),
    Headers(Headers),
    IpWhiteList(IpWhiteList),
    InFlightReq(InFlightReq),
    PassTLSClientCert(PassTLSClientCert),
    RateLimit(RateLimit),
    RedirectScheme(RedirectScheme),
    RedirectRegex(RedirectRegex),
    ReplacePath(ReplacePath),
    ReplacePathRegex(ReplacePathRegex),
    Retry(Retry),
    StripPrefix(StripPrefix),
    StripPrefixRegex(StripPrefixRegex),
}

// Adds a Path Prefix                            Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct AddPrefix {
    pub prefix: String,
}

// Adds Basic Authentication                     Security, Authentication
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct BasicAuth {
    pub users: Vec<String>,
    pub users_file: Option<String>,
    pub realm: Option<String>,
    // the header field is used to forward the name of the authenticated user to the service NOT to choose a different auth header field
    pub header_field: Option<String>,
    // the custom auth field is provided to chose something else than the Authorization header field
    // using this is non compliant with RFC 7235
    // but this is easy to implement and your decission whether or not to use it
    // see: https://github.com/traefik/traefik/issues/7612
    pub custom_auth_field: Option<String>,
    pub remove_header: Option<bool>,
}

// Buffers the request/response                  Request Lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Buffering {
    pub max_request_body_bytes: Option<u64>,
    pub mem_request_body_bytes: Option<u64>,
    pub max_response_body_bytes: Option<u64>,
    pub mem_response_body_bytes: Option<u64>,
    pub retry_expression: Option<RetryExpression>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct RetryExpression {
    //TODO
}

// Combines multiple pieces of middleware        Misc
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct Chain {
    pub middlewares: Vec<String>,
}

// Prevents calling unhealthy services           Request Lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct CircuitBreaker {
    pub expression: String,
}

// Compresses the response                       Content Modifier
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Compress {
    pub excluded_content_types: Option<Vec<String>>,
    pub min_response_body_bytes: Option<u64>, //default 1024
    pub direction: Option<MiddlewareDirection>,
}
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum MiddlewareDirection {
    Outgoing,
    Incoming,
}

// Handles Content-Type auto-detection           Misc
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ContentType {
    pub auto_detect: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Cors {
    pub methods: String,
    pub origin: String,
    pub age: String,
    pub headers: String,
}

// Adds Digest Authentication                    Security, Authentication
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct DigestAuth {
    pub users: Vec<String>,
    pub users_file: Option<String>,
    pub realm: Option<String>,
    pub header_field: Option<String>,
    pub remove_header: Option<bool>,
}

// Defines custom error pages                    Request Lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct Errors {
    /*
    You can define either a status code as a number (500), as multiple comma-separated numbers (500,502), as ranges by separating two codes with a dash (500-599), or a combination of the two (404,418,500-599).
    */
    pub status: Vec<String>,
    pub service: String,
    pub query: Option<String>,
}

// Delegates Authentication                      Security, Authentication
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ForwardAuth {
    pub address: String,
    pub trust_forward_header: Option<bool>,
    pub auth_response_headers: Option<Vec<String>>,
    pub auth_response_headers_regex: Option<String>,
    pub auth_request_headers: Option<Vec<String>>,
    pub tls: Option<ForwardAuthTls>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ForwardAuthTls {
    pub ca: String,
    pub cert: String,
    pub key: String,
    pub insecure_skip_verify: Option<bool>,
}

// Adds / Updates headers                        Security

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Headers {
    pub fields: HashMap<String, String>,
    pub direction: Option<MiddlewareDirection>,
}

// Limits the allowed client IPs                 Security, Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct IpWhiteList {
    pub source_range: Vec<String>,
    pub ip_strategy: Option<IpStrategy>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct IpStrategy {
    pub depth: Option<u8>,
    pub excluded_ips: Option<Vec<String>>,
}

// Limits the number of simultaneous connections Security, Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct InFlightReq {
    pub amount: u64,
    pub source_criterion: Option<SourceCriterion>,
}

// Adds Client Certificates in a Header          Security
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct PassTLSClientCert {
    pub pem: String,
    pub info: Option<String>,
}

// Limits the call frequency                     Security, Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct RateLimit {
    pub average: Option<u64>,
    pub period: Option<String>,
    pub burst: Option<u64>,
    pub source_criterion: Option<SourceCriterion>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct SourceCriterion {
    pub ip_strategy: Option<IpStrategy>,
    pub excluded_ips: Option<Vec<IpNet>>,
    pub request_header_name: Option<String>,
    pub request_host: Option<bool>,
}

// Redirects based on scheme                     Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct RedirectScheme {
    pub scheme: String,
    pub permanent: Option<bool>,
    pub port: Option<u16>,
}

// Redirects based on regex                      Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct RedirectRegex {
    pub regex: String,
    pub replacement: String,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct ReplacePath {
    pub path: String,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct ReplacePathRegex {
    pub regex: String,
    pub replacement: String,
}

// Automatically retries in case of error        Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Retry {
    pub attempts: u64,
    pub initial_interval: String,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct StripPrefix {
    pub prefix: String,
    pub force_slash: Option<bool>,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct StripPrefixRegex {
    pub regex: String,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct HttpService {
    pub loadbalancer: Option<HttpLoadbalancer>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct HttpLoadbalancer {
    pub servers: Vec<HttpServiceServer>,
    pub pass_host_header: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct HttpServiceServer {
    pub url: String,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct TcpService {
    pub loadbalancer: Option<TcpLoadbalancer>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct TcpLoadbalancer {
    pub servers: Vec<TcpServiceServer>,
}

#[derive(Deserialize, Serialize, Debug, Clone, JsonSchema)]
pub struct TcpServiceServer {
    pub name: Option<String>,
    pub address: String,
}
