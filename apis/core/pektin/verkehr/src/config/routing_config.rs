use anyhow::bail;
use ipnet::IpNet;
use serde::{Deserialize, Deserializer, Serialize};
use std::{
    collections::HashMap,
    time::{SystemTime, UNIX_EPOCH},
};
#[path = "rules/parse/http.rs"]
mod parse_http_rule;
#[path = "rules/parse/tcp.rs"]
mod parse_tcp_rule;
use crate::{
    config::VerkehrConfig, docker_labels::get_config_from_docker_labels,
    file_provider::load_file_config, some_or_bail,
};
pub use parse_http_rule::{
    parse_http_routing_rule, HttpRoutingFunction, HttpRoutingRule, ParsedHttpRoutingRule,
};
pub use parse_tcp_rule::{
    parse_tcp_routing_rule, ParsedTcpRoutingRule, TcpRoutingFunction, TcpRoutingRule,
};

pub async fn load_routing_config(verkehr_config: &VerkehrConfig) -> anyhow::Result<RoutingConfig> {
    let mut routing_configs: Vec<RoutingConfig> = Vec::new();

    if let Some(file_provider) = &verkehr_config.providers.file {
        if let Some(file) = &file_provider.file {
            match load_file_config(file) {
                Ok(lfc) => routing_configs.push(lfc),
                Err(e) => bail!("could not load file config: {}", e),
            }
        }
        if let Some(directory) = &file_provider.directory {
            // get file list from directory recursively
            match get_files_from_directory(directory, &mut Vec::new()) {
                Ok(files) => {
                    for file in files {
                        match load_file_config(&file) {
                            Ok(loaded_file_config) => routing_configs.push(loaded_file_config),
                            Err(e) => bail!("could not load file config: {}", e),
                        }
                    }
                }
                Err(e) => {
                    bail!("could not load file config: {}", e);
                }
            }
        }
    }
    if let Some(docker_config) = &verkehr_config.providers.docker {
        if let Some(enabled) = docker_config.enabled {
            if enabled {
                let docker_label_config = get_config_from_docker_labels().await;
                match docker_label_config {
                    Ok(dlc) => {
                        for config in dlc {
                            routing_configs.push(config);
                        }
                    }
                    Err(e) => {
                        bail!("Error while loading docker label config: {}", e);
                    }
                }
            }
        }
    }
    match merge_routing_configs(routing_configs) {
        Ok(merged_config) => {
            let arc = merged_config;
            Ok(arc)
        }
        Err(e) => {
            bail!("Error while merging routing configs: {}", e);
        }
    }
}

// get file list from directory recursively
pub fn get_files_from_directory(
    directory: &str,
    file_list: &mut Vec<String>,
) -> anyhow::Result<Vec<String>> {
    let paths = std::fs::read_dir(directory)?;
    for path in paths {
        let path = path?.path();
        let path_str = some_or_bail!(path.to_str(), "Could not convert path to string");
        if path.is_dir() {
            let sub_files = get_files_from_directory(path_str, file_list)?;
            for sub_file in sub_files {
                file_list.push(sub_file);
            }
        } else {
            file_list.push(path_str.to_string());
        }
    }
    Ok(file_list.clone())
}

// merge config without conflicts or fail
pub fn merge_routing_configs(routing_configs: Vec<RoutingConfig>) -> anyhow::Result<RoutingConfig> {
    let time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // TODO this works but is ugly

    let mut merged_config = RoutingConfig {
        version: Some(time),
        http: None,
        tcp: None,
        udp: None,
    };

    for config in routing_configs {
        if let Some(http) = config.http {
            if let Some(merged_http) = &mut merged_config.http {
                if let Some(entrypoints) = http.entrypoints {
                    for (key, value) in entrypoints {
                        if merged_http.entrypoints.is_none() {
                            merged_http.entrypoints = Some(HashMap::new());
                        }
                        merged_http.entrypoints.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(routers) = http.routers {
                    for (key, value) in routers {
                        if merged_http.routers.is_none() {
                            merged_http.routers = Some(HashMap::new());
                        }
                        merged_http.routers.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(middlewares) = http.middlewares {
                    for (key, value) in middlewares {
                        if merged_http.middlewares.is_none() {
                            merged_http.middlewares = Some(HashMap::new());
                        }
                        merged_http.middlewares.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(services) = http.services {
                    for (key, value) in services {
                        if merged_http.services.is_none() {
                            merged_http.services = Some(HashMap::new());
                        }
                        merged_http.services.as_mut().unwrap().insert(key, value);
                    }
                }
            } else {
                merged_config.http = Some(http);
            }
        }
        if let Some(tcp) = config.tcp {
            if let Some(merged_tcp) = &mut merged_config.tcp {
                if let Some(entrypoints) = tcp.entrypoints {
                    for (key, value) in entrypoints {
                        if merged_tcp.entrypoints.is_none() {
                            merged_tcp.entrypoints = Some(HashMap::new());
                        }
                        merged_tcp.entrypoints.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(routers) = tcp.routers {
                    for (key, value) in routers {
                        if merged_tcp.routers.is_none() {
                            merged_tcp.routers = Some(HashMap::new());
                        }
                        merged_tcp.routers.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(middlewares) = tcp.middlewares {
                    for (key, value) in middlewares {
                        if merged_tcp.middlewares.is_none() {
                            merged_tcp.middlewares = Some(HashMap::new());
                        }
                        merged_tcp.middlewares.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(services) = tcp.services {
                    for (key, value) in services {
                        if merged_tcp.services.is_none() {
                            merged_tcp.services = Some(HashMap::new());
                        }
                        merged_tcp.services.as_mut().unwrap().insert(key, value);
                    }
                }
            } else {
                merged_config.tcp = Some(tcp);
            }
        }
        if let Some(udp) = config.udp {
            if let Some(merged_udp) = &mut merged_config.udp {
                if let Some(entrypoints) = udp.entrypoints {
                    for (key, value) in entrypoints {
                        if merged_udp.entrypoints.is_none() {
                            merged_udp.entrypoints = Some(HashMap::new());
                        }
                        merged_udp.entrypoints.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(routers) = udp.routers {
                    for (key, value) in routers {
                        if merged_udp.routers.is_none() {
                            merged_udp.routers = Some(HashMap::new());
                        }
                        merged_udp.routers.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(middlewares) = udp.middlewares {
                    for (key, value) in middlewares {
                        if merged_udp.middlewares.is_none() {
                            merged_udp.middlewares = Some(HashMap::new());
                        }
                        merged_udp.middlewares.as_mut().unwrap().insert(key, value);
                    }
                }
                if let Some(services) = udp.services {
                    for (key, value) in services {
                        if merged_udp.services.is_none() {
                            merged_udp.services = Some(HashMap::new());
                        }
                        merged_udp.services.as_mut().unwrap().insert(key, value);
                    }
                }
            } else {
                merged_config.udp = Some(udp);
            }
        }
    }

    Ok(merged_config)
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RoutingConfig {
    pub version: Option<u64>,
    pub http: Option<HttpConfig>,
    pub tcp: Option<TcpConfig>,
    pub udp: Option<UdpConfig>,
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CertResolverConfig {
    pub resolver_type: Option<String>,
    pub fallback_domain: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct HttpConfig {
    pub entrypoints: Option<HashMap<String, Entrypoint>>,
    pub routers: Option<HashMap<String, HttpRouter>>,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    pub middlewares: Option<HashMap<String, HttpMiddleware>>,
    pub services: Option<HashMap<String, HttpService>>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct TcpConfig {
    pub entrypoints: Option<HashMap<String, Entrypoint>>,
    pub routers: Option<HashMap<String, TcpRouter>>,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    pub middlewares: Option<HashMap<String, TcpMiddleware>>,
    pub services: Option<HashMap<String, TcpService>>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UdpConfig {
    pub entrypoints: Option<HashMap<String, Entrypoint>>,
    pub routers: Option<HashMap<String, UdpRouter>>,
    #[serde(with = "serde_yaml::with::singleton_map_recursive", default)]
    pub middlewares: Option<HashMap<String, UdpMiddleware>>,
    pub services: Option<HashMap<String, HttpService>>,
}

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Entrypoint {
    pub address: String,
    pub cert_resolver: Option<CertResolverConfig>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TcpRouter {
    #[serde(deserialize_with = "tcp_routing_rule_from_string")]
    pub rule: ParsedTcpRoutingRule,
    pub entrypoints: Vec<String>,
    pub middlewares: Option<Vec<String>>,
    pub service: String,
    pub priority: Option<i32>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UdpRouter {
    pub entrypoints: Vec<String>,
    pub middlewares: Option<Vec<String>>,
    pub service: String,
    pub priority: Option<i32>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
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

#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum TcpMiddleware {}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub enum UdpMiddleware {}

#[derive(Deserialize, Serialize, Debug, Clone)]
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
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AddPrefix {
    pub prefix: String,
}

// Adds Basic Authentication                     Security, Authentication
#[derive(Deserialize, Serialize, Debug, Clone)]
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
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Buffering {
    pub max_request_body_bytes: Option<u64>,
    pub mem_request_body_bytes: Option<u64>,
    pub max_response_body_bytes: Option<u64>,
    pub mem_response_body_bytes: Option<u64>,
    pub retry_expression: Option<RetryExpression>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RetryExpression {
    //TODO
}

// Combines multiple pieces of middleware        Misc
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Chain {
    pub middlewares: Vec<String>,
}

// Prevents calling unhealthy services           Request Lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct CircuitBreaker {
    pub expression: String,
}

// Compresses the response                       Content Modifier
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Compress {
    pub excluded_content_types: Option<Vec<String>>,
    pub min_response_body_bytes: Option<u64>, //default 1024
    pub direction: Option<MiddlewareDirection>,
}
#[derive(Deserialize, Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MiddlewareDirection {
    Outgoing,
    Incoming,
}

// Handles Content-Type auto-detection           Misc
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ContentType {
    pub auto_detect: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Cors {
    pub methods: String,
    pub origin: String,
    pub age: String,
    pub headers: String,
}

// Adds Digest Authentication                    Security, Authentication
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DigestAuth {
    pub users: Vec<String>,
    pub users_file: Option<String>,
    pub realm: Option<String>,
    pub header_field: Option<String>,
    pub remove_header: Option<bool>,
}

// Defines custom error pages                    Request Lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Errors {
    /*
    You can define either a status code as a number (500), as multiple comma-separated numbers (500,502), as ranges by separating two codes with a dash (500-599), or a combination of the two (404,418,500-599).
    */
    pub status: Vec<String>,
    pub service: String,
    pub query: Option<String>,
}

// Delegates Authentication                      Security, Authentication
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ForwardAuth {
    pub address: String,
    pub trust_forward_header: Option<bool>,
    pub auth_response_headers: Option<Vec<String>>,
    pub auth_response_headers_regex: Option<String>,
    pub auth_request_headers: Option<Vec<String>>,
    pub tls: Option<ForwardAuthTls>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ForwardAuthTls {
    pub ca: String,
    pub cert: String,
    pub key: String,
    pub insecure_skip_verify: Option<bool>,
}

// Adds / Updates headers                        Security

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Headers {
    pub fields: HashMap<String, String>,
    pub direction: Option<MiddlewareDirection>,
}

// Limits the allowed client IPs                 Security, Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct IpWhiteList {
    pub source_range: Vec<String>,
    pub ip_strategy: Option<IpStrategy>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct IpStrategy {
    pub depth: Option<u8>,
    pub excluded_ips: Option<Vec<String>>,
}

// Limits the number of simultaneous connections Security, Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct InFlightReq {
    pub amount: u64,
    pub source_criterion: Option<SourceCriterion>,
}

// Adds Client Certificates in a Header          Security
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PassTLSClientCert {
    pub pem: String,
    pub info: Option<String>,
}

// Limits the call frequency                     Security, Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RateLimit {
    pub average: Option<u64>,
    pub period: Option<String>,
    pub burst: Option<u64>,
    pub source_criterion: Option<SourceCriterion>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct SourceCriterion {
    pub ip_strategy: Option<IpStrategy>,
    pub excluded_ips: Option<Vec<IpNet>>,
    pub request_header_name: Option<String>,
    pub request_host: Option<bool>,
}

// Redirects based on scheme                     Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RedirectScheme {
    pub scheme: String,
    pub permanent: Option<bool>,
    pub port: Option<u16>,
}

// Redirects based on regex                      Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct RedirectRegex {
    pub regex: String,
    pub replacement: String,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ReplacePath {
    pub path: String,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ReplacePathRegex {
    pub regex: String,
    pub replacement: String,
}

// Automatically retries in case of error        Request lifecycle
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Retry {
    pub attempts: u64,
    pub initial_interval: String,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StripPrefix {
    pub prefix: String,
    pub force_slash: Option<bool>,
}

// Changes the path of the request               Path Modifier
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct StripPrefixRegex {
    pub regex: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct HttpService {
    pub loadbalancer: Option<HttpLoadbalancer>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct HttpLoadbalancer {
    pub servers: Vec<HttpServiceServer>,
    pub passhostheader: Option<bool>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct HttpServiceServer {
    pub url: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct TcpService {
    pub loadbalancer: Option<TcpLoadbalancer>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct TcpLoadbalancer {
    pub servers: Vec<TcpServiceServer>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct TcpServiceServer {
    pub name: Option<String>,
    pub address: String,
}
