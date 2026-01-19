//! Post-deployment health checks for Docker Compose containers.
//!
//! Collects health information including:
//! - Container running status and health check state
//! - Recent log errors
//! - Port connectivity
//! - Traefik URL extraction from labels

use std::process::Command;
use std::time::Duration;
use tracing::{debug, warn};

/// Health information for a Docker container.
///
/// Contains the container's running state, health check status, recent log errors,
/// exposed ports with their connectivity status, and any configured Traefik URLs.
///
/// # Fields
/// - `name`: Full container name as reported by Docker (includes project prefix)
/// - `running`: Whether the container status contains "Up"
/// - `status`: Raw status string from Docker (e.g., "Up 2 hours", "Exited (1) 5 minutes ago")
/// - `health`: Docker health check status if configured (e.g., "healthy", "unhealthy", "starting")
/// - `has_healthcheck`: True if the container has a healthcheck configured (even if still starting)
/// - `log_errors`: Recent log lines containing error patterns (last 30 seconds)
/// - `ports`: Host ports exposed by the container with TCP connectivity status
/// - `traefik_urls`: Hostnames extracted from Traefik labels (e.g., ["example.com", "www.example.com"])
#[derive(Debug)]
pub struct ContainerHealth {
    pub name: String,
    pub running: bool,
    pub status: String,
    pub health: Option<String>,
    pub has_healthcheck: bool,
    pub log_errors: Vec<String>,
    pub ports: Vec<PortStatus>,
    pub traefik_urls: Vec<String>,
}

/// Status of an exposed port on a container.
///
/// # Fields
/// - `port`: The host port number (from Docker port mapping like "0.0.0.0:8080->80/tcp")
/// - `responding`: True if a TCP connection succeeds within the retry window
#[derive(Debug)]
pub struct PortStatus {
    pub port: u16,
    pub responding: bool,
}

/// Container readiness status for polling.
#[derive(Debug)]
pub struct ContainerReadiness {
    /// Number of containers found
    pub total: usize,
    /// Number of containers with "Up" status
    pub running: usize,
    /// Number of containers still in "starting" health state
    pub starting: usize,
    /// Whether all containers are ready (running and not starting)
    pub all_ready: bool,
}

/// Check if containers are ready (all running, none still starting).
///
/// This is useful for polling to wait for containers to be ready before
/// running full health checks. Returns readiness status without collecting
/// logs or checking ports (which can be slow).
///
/// # Arguments
/// - `project_name`: Docker Compose project name
///
/// # Returns
/// `ContainerReadiness` with counts and overall readiness status
pub fn check_containers_ready(project_name: &str) -> ContainerReadiness {
    let output = Command::new("docker")
        .args([
            "compose",
            "-p",
            project_name,
            "ps",
            "--format",
            "{{.Status}}\t{{.Health}}",
        ])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            return parse_readiness_output(&stdout);
        }
    }

    ContainerReadiness {
        total: 0,
        running: 0,
        starting: 0,
        all_ready: false,
    }
}

/// Collect container health information
pub(super) fn collect_container_health(
    project_name: &str,
    compose: Option<&serde_yaml::Value>,
) -> Vec<ContainerHealth> {
    let mut containers: Vec<ContainerHealth> = Vec::new();

    // Get container status
    let output = Command::new("docker")
        .args([
            "compose",
            "-p",
            project_name,
            "ps",
            "--format",
            "{{.Name}}\t{{.Status}}\t{{.Health}}",
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    let status = parts[1].to_string();
                    let health_str = parts.get(2).unwrap_or(&"").to_string();

                    let (health, has_healthcheck) = if health_str.is_empty() {
                        (None, false)
                    } else {
                        (Some(health_str.clone()), true)
                    };

                    containers.push(ContainerHealth {
                        name,
                        running: status.contains("Up"),
                        status,
                        health,
                        has_healthcheck,
                        log_errors: Vec::new(),
                        ports: Vec::new(),
                        traefik_urls: Vec::new(),
                    });
                }
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            warn!("Failed to get container status: {}", stderr.trim());
        }
        Err(e) => {
            warn!("Failed to run docker compose ps: {}", e);
        }
    }

    // Collect log errors for each container
    collect_container_logs(project_name, &mut containers);

    // Collect port status
    collect_port_status(project_name, &mut containers);

    // Collect traefik URLs if compose is provided
    if let Some(compose) = compose {
        collect_traefik_urls(compose, &mut containers);
    }

    containers
}

/// Collect recent log errors for containers (last 30 seconds).
fn collect_container_logs(project_name: &str, containers: &mut [ContainerHealth]) {
    let output = Command::new("docker")
        .args([
            "compose",
            "-p",
            project_name,
            "logs",
            "--since",
            "30s",
            "--no-color",
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let combined = format!("{}{}", stdout, stderr);

            let error_patterns = ["error", "fatal", "panic", "exception", "failed"];

            for line in combined.lines() {
                let lower = line.to_lowercase();
                if error_patterns.iter().any(|p| lower.contains(p)) && !is_log_false_positive(&lower)
                {
                    // Try to match line to a container
                    for container in containers.iter_mut() {
                        // Log format is usually "container_name  | log message"
                        if line.contains(&container.name) || line.starts_with(&container.name) {
                            container.log_errors.push(line.to_string());
                            break;
                        }
                    }
                }
            }
        }
        Ok(_) => {
            debug!("Could not fetch container logs (this is normal if containers just started)");
        }
        Err(e) => {
            debug!("Failed to run docker compose logs: {}", e);
        }
    }
}

/// Collect port status for containers
fn collect_port_status(project_name: &str, containers: &mut [ContainerHealth]) {
    use std::collections::HashSet;

    let output = Command::new("docker")
        .args([
            "compose",
            "-p",
            project_name,
            "ps",
            "--format",
            "{{.Name}}\t{{.Ports}}",
        ])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 2 {
                    let name = parts[0];
                    let ports = parts[1];

                    if let Some(container) = containers.iter_mut().find(|c| c.name == name) {
                        // Track seen ports to avoid duplicates (Docker reports IPv4 and IPv6 bindings separately)
                        let mut seen_ports: HashSet<u16> = HashSet::new();

                        for port_mapping in ports.split(", ") {
                            if let Some(binding) = extract_host_binding(port_mapping) {
                                // Skip if we've already processed this port
                                if !seen_ports.insert(binding.port) {
                                    continue;
                                }

                                // Determine the address to connect to based on interface binding
                                // - 0.0.0.0 or :: means all interfaces, so we connect to localhost
                                // - specific IP means connect to that IP
                                let connect_addr = match binding.interface.as_str() {
                                    "0.0.0.0" | "::" => "127.0.0.1".to_string(),
                                    addr => addr.to_string(),
                                };

                                let url = format!("http://{}:{}", connect_addr, binding.port);
                                let responding = check_http_endpoint(&url).unwrap_or(false);
                                container.ports.push(PortStatus {
                                    port: binding.port,
                                    responding,
                                });
                            }
                        }
                    }
                }
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            warn!("Failed to get port status: {}", stderr.trim());
        }
        Err(e) => {
            warn!("Failed to run docker compose ps for ports: {}", e);
        }
    }
}

/// Collect traefik URLs from compose labels
fn collect_traefik_urls(compose: &serde_yaml::Value, containers: &mut [ContainerHealth]) {
    let services = match compose.get("services") {
        Some(serde_yaml::Value::Mapping(m)) => m,
        _ => return,
    };

    for (service_name, service) in services {
        let service_name = service_name.as_str().unwrap_or("");

        // Find matching container (container name includes project prefix)
        let container = containers
            .iter_mut()
            .find(|c| c.name.ends_with(service_name));

        if let Some(container) = container {
            // Look for traefik.http.routers.*.rule label with Host()
            let labels = match service.get("labels") {
                Some(serde_yaml::Value::Mapping(m)) => m
                    .iter()
                    .filter_map(|(k, v)| Some((k.as_str()?, v.as_str()?)))
                    .collect::<Vec<_>>(),
                Some(serde_yaml::Value::Sequence(s)) => s
                    .iter()
                    .filter_map(|v| v.as_str())
                    .filter_map(|s| {
                        let mut parts = s.splitn(2, '=');
                        Some((parts.next()?, parts.next()?))
                    })
                    .collect::<Vec<_>>(),
                _ => continue,
            };

            for (key, value) in labels {
                if key.contains("traefik") && key.contains(".rule") {
                    // Extract all hosts from Host(`example.com`) patterns.
                    // Note: Using manual string parsing instead of regex to avoid adding
                    // the regex crate as a dependency. The pattern is simple (Host(`...`))
                    // and this approach handles all practical cases including multiple
                    // hosts and complex rules like `Host(`a.com`) || Host(`b.com`)`.
                    let mut search_pos = 0;
                    while let Some(start) = value[search_pos..].find("Host(`") {
                        let abs_start = search_pos + start + 6;
                        if let Some(end) = value[abs_start..].find("`)") {
                            let host_str = value[abs_start..abs_start + end].to_string();
                            if !container.traefik_urls.contains(&host_str) {
                                container.traefik_urls.push(host_str);
                            }
                            search_pos = abs_start + end;
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    }
}

/// Common false positive patterns for log error detection.
/// These patterns indicate the log line is NOT an actual error.
const FALSE_POSITIVE_PATTERNS: &[&str] = &[
    // No error / errors: 0
    "no error",
    "0 error",
    "errors: 0",
    "errors=0",
    // Configuration variables and log settings
    "error_log",
    "error_reporting",
    "error_page",
    "error_handler",
    "errorhandler",
    "on_error",
    "onerror",
    // Log level names in structured logging
    "level=error",
    "level\":\"error",
    "loglevel",
    "log_level",
    // File/URL paths containing 'error'
    "/error/",
    "/errors/",
    "error.log",
    "errors.log",
    // Common metrics and monitoring
    "error_count",
    "error_rate",
    "error_total",
    "errors_total",
    "_error_seconds",
    "_errors_bucket",
    // Negative assertions in tests/startup
    "without error",
    "if error",
    "error == nil",
    "error != nil",
    "err != nil",
    "catch error",
    // Status messages
    "error handling",
    "error recovery",
    "exception handler",
    // Language-specific error handling (not actual errors)
    "rescue error",
    "except error",
    ".on('error'",
    ".on(\"error\"",
    "adderrorlistener",
    "removeerrorlistener",
    // Framework patterns
    "errorboundary",
    "errormiddleware",
    "errorinterceptor",
    // Test-related patterns
    "expect_error",
    "expect(error",
    "expecterror",
    "should_raise_error",
    "should raise_error",
    "assertraises",
    "assertthrows",
    "tothrow",
    "to_throw",
    "test_error",
    "mock_error",
    // HTTP error page configurations
    "error_404",
    "error_500",
    "error_502",
    "error_503",
    // Method/function names (not actual errors)
    "print_error",
    "log_error",
    "write_error",
    "format_error",
    "format_exception",
    "error_string",
    "error_message",
    "get_error",
    "set_error",
    "geterror",
    "seterror",
    // Callback and handler registrations
    "on_connect_error",
    "connection_error_handler",
    "error_callback",
    // Documentation patterns
    "@error",
    "@throws",
    "@exception",
    // Field names in structured data
    "error_code",
    "error_type",
    "error_id",
    "errorcode",
    "errortype",
    // Successful error handling
    "recovered from error",
    "error resolved",
    "fixed error",
    "cleared error",
    // Debug/tracing context
    "error context",
    "error boundary",
    // Stream names
    "stderr",
    // Environment variables
    "node_env",
    "rust_backtrace",
];

/// Get the compiled Aho-Corasick automaton for false positive patterns.
/// Built once on first use for efficient multi-pattern matching.
fn get_false_positive_matcher() -> &'static aho_corasick::AhoCorasick {
    use std::sync::OnceLock;
    static MATCHER: OnceLock<aho_corasick::AhoCorasick> = OnceLock::new();
    MATCHER.get_or_init(|| {
        aho_corasick::AhoCorasick::new(FALSE_POSITIVE_PATTERNS)
            .expect("Failed to build Aho-Corasick automaton")
    })
}

/// Check if a log line is a known false positive.
///
/// Uses Aho-Corasick algorithm for efficient O(n) multi-pattern matching
/// instead of O(n*m) where n is line length and m is number of patterns.
fn is_log_false_positive(lower: &str) -> bool {
    get_false_positive_matcher().is_match(lower)
}

/// Extracted host binding from a Docker port mapping.
///
/// Contains both the interface address and port number.
#[derive(Debug, Clone)]
struct HostBinding {
    /// Interface address (e.g., "127.0.0.1", "0.0.0.0", "::", "::1")
    interface: String,
    /// Host port number
    port: u16,
}

/// Extract the host binding from a Docker port mapping string.
///
/// Handles various formats:
/// - IPv4: `0.0.0.0:8080->80/tcp` -> interface="0.0.0.0", port=8080
/// - IPv6 all interfaces: `:::8080->80/tcp` -> interface="::", port=8080
/// - IPv6 specific: `[::1]:8080->80/tcp` -> interface="::1", port=8080
/// - No host binding: `8080->80/tcp` -> interface="0.0.0.0", port=8080
fn extract_host_binding(port_mapping: &str) -> Option<HostBinding> {
    let arrow_pos = port_mapping.find("->")?;
    let host_part = &port_mapping[..arrow_pos];

    // Handle IPv6 bracketed format like [::1]:8080
    if host_part.contains('[') {
        // Find the closing bracket, port is after ]:
        if let Some(bracket_pos) = host_part.rfind("]:") {
            let interface = &host_part[1..bracket_pos]; // Extract between [ and ]
            let port_str = &host_part[bracket_pos + 2..];
            return Some(HostBinding {
                interface: interface.to_string(),
                port: port_str.parse().ok()?,
            });
        }
        // Malformed bracketed address
        return None;
    }

    // For non-bracketed formats, get port after last colon
    // This handles: 0.0.0.0:8080, :::8080, 8080
    let port_str = host_part.rsplit(':').next()?;
    let port: u16 = port_str.parse().ok()?;

    // Extract interface (everything before the last colon)
    let interface = if let Some(colon_pos) = host_part.rfind(':') {
        let iface = &host_part[..colon_pos];
        if iface.is_empty() {
            // :::8080 format - the interface is :: (IPv6 all interfaces)
            "::".to_string()
        } else {
            iface.to_string()
        }
    } else {
        // No colon means just a port number, default to all interfaces
        "0.0.0.0".to_string()
    };

    Some(HostBinding { interface, port })
}

/// Parse a socket address from an HTTP URL.
///
/// Handles URLs like "http://127.0.0.1:8080" or "http://[::1]:8080/path".
fn parse_socket_addr(url: &str) -> Option<std::net::SocketAddr> {
    let url = url.strip_prefix("http://").unwrap_or(url);
    let addr = url.split('/').next()?;
    addr.parse().ok()
}

/// Try to connect to an HTTP endpoint with retry
fn check_http_endpoint(url: &str) -> Option<bool> {
    use std::net::TcpStream;
    use std::thread::sleep;
    use std::time::Duration;

    let addr = parse_socket_addr(url)?;

    // Retry a few times with increasing delays
    // Services often take a moment to start accepting connections
    let retries = [100, 300, 600]; // ms delays before each retry

    for (attempt, delay_ms) in retries.iter().enumerate() {
        if attempt > 0 {
            sleep(Duration::from_millis(*delay_ms));
        }

        match TcpStream::connect_timeout(&addr, Duration::from_millis(500)) {
            Ok(_) => return Some(true),
            Err(_) => continue,
        }
    }

    None
}

/// Parse container readiness from Docker compose ps output.
///
/// Input is tab-separated lines with format: "Status\tHealth"
fn parse_readiness_output(output: &str) -> ContainerReadiness {
    let mut total = 0;
    let mut running = 0;
    let mut starting = 0;

    for line in output.lines() {
        if line.is_empty() {
            continue;
        }
        total += 1;
        let parts: Vec<&str> = line.split('\t').collect();
        let status = parts.first().unwrap_or(&"");
        let health = parts.get(1).unwrap_or(&"");

        if status.contains("Up") {
            running += 1;
        }
        if health.contains("starting") {
            starting += 1;
        }
    }

    ContainerReadiness {
        total,
        running,
        starting,
        all_ready: total > 0 && running == total && starting == 0,
    }
}

/// Result of a URL reachability check
pub(super) struct UrlCheckResult {
    pub url: String,
    pub status_code: u16,
    pub status_text: String,
}

/// Check if a traefik host is reachable, trying HTTP then HTTPS
/// Returns the URL and status info if reachable, None otherwise
pub(super) fn check_traefik_host(host: &str) -> Option<UrlCheckResult> {
    // Try HTTP first (common for local dev with traefik)
    let http_url = format!("http://{}", host);
    if let Some(result) = check_url_reachable(&http_url) {
        return Some(result);
    }

    // Try HTTPS
    let https_url = format!("https://{}", host);
    if let Some(result) = check_url_reachable(&https_url) {
        return Some(result);
    }

    None
}

/// Check if a hostname is a localhost domain.
/// Returns true for localhost, *.localhost, 127.x.x.x, and ::1.
fn is_localhost_host(host: &str) -> bool {
    // Handle bracketed IPv6 first (e.g., [::1]:8080)
    if host.starts_with('[') {
        let bracket_end = host.find(']').unwrap_or(host.len());
        let ipv6 = &host[1..bracket_end];
        return ipv6 == "::1";
    }

    // Check for bare IPv6 localhost
    if host == "::1" {
        return true;
    }

    // Remove port if present (only for non-IPv6)
    let host = host.split(':').next().unwrap_or(host);

    // Check for localhost or *.localhost
    if host == "localhost" || host.ends_with(".localhost") {
        return true;
    }

    // Check for 127.x.x.x
    if host.starts_with("127.") {
        return true;
    }

    false
}

/// Check if a URL is reachable using native HTTP client.
/// Returns URL and status info if the URL responds with 2xx or 3xx status code.
/// TLS certificate validation is skipped only for localhost domains.
fn check_url_reachable(url: &str) -> Option<UrlCheckResult> {
    use reqwest::blocking::Client;

    // Extract host from URL to determine if we should skip TLS validation
    let skip_tls = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .and_then(|rest| rest.split('/').next())
        .map(is_localhost_host)
        .unwrap_or(false);

    let client = match Client::builder()
        .timeout(Duration::from_secs(2))
        .connect_timeout(Duration::from_secs(2))
        .danger_accept_invalid_certs(skip_tls)
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            debug!("Failed to create HTTP client: {}", e);
            return None;
        }
    };

    match client.head(url).send() {
        Ok(response) => {
            let status = response.status();
            if status.is_success() || status.is_redirection() {
                Some(UrlCheckResult {
                    url: url.to_string(),
                    status_code: status.as_u16(),
                    status_text: status.canonical_reason().unwrap_or("OK").to_string(),
                })
            } else {
                None
            }
        }
        Err(e) => {
            debug!("HTTP request to {} failed: {}", url, e);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests for extract_host_binding

    #[test]
    fn test_extract_host_binding_ipv4() {
        let binding = extract_host_binding("0.0.0.0:8080->80/tcp").unwrap();
        assert_eq!(binding.interface, "0.0.0.0");
        assert_eq!(binding.port, 8080);
    }

    #[test]
    fn test_extract_host_binding_ipv4_localhost() {
        let binding = extract_host_binding("127.0.0.1:3000->3000/tcp").unwrap();
        assert_eq!(binding.interface, "127.0.0.1");
        assert_eq!(binding.port, 3000);
    }

    #[test]
    fn test_extract_host_binding_ipv4_specific() {
        let binding = extract_host_binding("192.168.1.100:8080->80/tcp").unwrap();
        assert_eq!(binding.interface, "192.168.1.100");
        assert_eq!(binding.port, 8080);
    }

    #[test]
    fn test_extract_host_binding_ipv6_all() {
        // Docker format for IPv6 all interfaces
        let binding = extract_host_binding(":::8080->80/tcp").unwrap();
        assert_eq!(binding.interface, "::");
        assert_eq!(binding.port, 8080);
    }

    #[test]
    fn test_extract_host_binding_ipv6_bracketed() {
        let binding = extract_host_binding("[::1]:8080->80/tcp").unwrap();
        assert_eq!(binding.interface, "::1");
        assert_eq!(binding.port, 8080);

        let binding = extract_host_binding("[fe80::1]:3000->3000/tcp").unwrap();
        assert_eq!(binding.interface, "fe80::1");
        assert_eq!(binding.port, 3000);
    }

    #[test]
    fn test_extract_host_binding_no_host() {
        let binding = extract_host_binding("8080->80/tcp").unwrap();
        assert_eq!(binding.interface, "0.0.0.0"); // defaults to all interfaces
        assert_eq!(binding.port, 8080);
    }

    #[test]
    fn test_extract_host_binding_malformed() {
        assert!(extract_host_binding("no-arrow").is_none());
        assert!(extract_host_binding("").is_none());
        assert!(extract_host_binding("abc:def->80/tcp").is_none());
    }

    #[test]
    fn test_extract_host_binding_ipv6_malformed_bracket() {
        // Missing closing bracket - should return None
        assert!(extract_host_binding("[::1:8080->80/tcp").is_none());
    }

    // Tests for is_log_false_positive

    #[test]
    fn test_log_false_positive_no_error() {
        assert!(is_log_false_positive("no error occurred"));
        assert!(is_log_false_positive("0 errors found"));
        assert!(is_log_false_positive("errors: 0"));
        assert!(is_log_false_positive("errors=0"));
    }

    #[test]
    fn test_log_false_positive_config() {
        assert!(is_log_false_positive("error_log /var/log/nginx/error.log"));
        assert!(is_log_false_positive("error_reporting = E_ALL"));
        assert!(is_log_false_positive("on_error callback registered"));
    }

    #[test]
    fn test_log_false_positive_levels() {
        assert!(is_log_false_positive("level=error")); // structured log config
        assert!(is_log_false_positive("loglevel=debug"));
    }

    #[test]
    fn test_log_false_positive_paths() {
        assert!(is_log_false_positive("loading /api/errors/handler"));
        assert!(is_log_false_positive("wrote to error.log"));
    }

    #[test]
    fn test_log_real_error() {
        // These should NOT be false positives
        assert!(!is_log_false_positive("error: connection refused"));
        assert!(!is_log_false_positive("fatal error occurred"));
        assert!(!is_log_false_positive("database error: timeout"));
    }

    #[test]
    fn test_log_false_positive_language_patterns() {
        // Ruby
        assert!(is_log_false_positive("rescue error in callback"));
        // Python
        assert!(is_log_false_positive("except error as e:"));
        // Node.js event handlers
        assert!(is_log_false_positive("socket.on('error', handler)"));
        assert!(is_log_false_positive("stream.on(\"error\", callback)"));
        // Go error checks
        assert!(is_log_false_positive("if err != nil {"));
    }

    #[test]
    fn test_log_false_positive_test_patterns() {
        assert!(is_log_false_positive("expect_error to be raised"));
        assert!(is_log_false_positive("expect(error).tobenil()"));
        assert!(is_log_false_positive("assertraises(valueerror)"));
        assert!(is_log_false_positive("should_raise_error when nil"));
        assert!(is_log_false_positive("test_error_handling"));
        assert!(is_log_false_positive("mock_error for testing"));
    }

    #[test]
    fn test_log_false_positive_method_names() {
        assert!(is_log_false_positive("calling log_error()"));
        assert!(is_log_false_positive("print_error(msg)"));
        assert!(is_log_false_positive("format_error returned"));
        assert!(is_log_false_positive("get_error() called"));
        assert!(is_log_false_positive("seterror(code)"));
    }

    #[test]
    fn test_log_false_positive_http_pages() {
        assert!(is_log_false_positive("serving error_404 page"));
        assert!(is_log_false_positive("configured error_500.html"));
        assert!(is_log_false_positive("error_502 gateway timeout"));
    }

    #[test]
    fn test_log_false_positive_metrics() {
        assert!(is_log_false_positive("http_request_error_seconds_bucket"));
        assert!(is_log_false_positive(
            "process_errors_total{type=\"network\"}"
        ));
    }

    #[test]
    fn test_log_false_positive_success_messages() {
        assert!(is_log_false_positive("recovered from error successfully"));
        assert!(is_log_false_positive("previous error resolved"));
        assert!(is_log_false_positive("fixed error in config"));
        assert!(is_log_false_positive("cleared error state"));
    }

    #[test]
    fn test_log_false_positive_frameworks() {
        assert!(is_log_false_positive("react errorboundary caught"));
        assert!(is_log_false_positive("using errormiddleware"));
        assert!(is_log_false_positive("registered errorinterceptor"));
    }

    // Tests for collect_traefik_urls

    #[test]
    fn test_collect_traefik_urls_mapping_labels() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.http.routers.web.rule: "Host(`example.com`)"
"#,
        )
        .unwrap();

        let mut containers = vec![ContainerHealth {
            name: "project-web".to_string(), // ends with service name "web"
            running: true,
            status: "Up".to_string(),
            health: None,
            has_healthcheck: false,
            log_errors: vec![],
            ports: vec![],
            traefik_urls: vec![],
        }];

        collect_traefik_urls(&compose, &mut containers);

        assert_eq!(containers[0].traefik_urls, vec!["example.com".to_string()]);
    }

    #[test]
    fn test_collect_traefik_urls_sequence_labels() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  api:
    image: nginx
    labels:
      - "traefik.http.routers.api.rule=Host(`api.example.com`)"
"#,
        )
        .unwrap();

        let mut containers = vec![ContainerHealth {
            name: "project-api".to_string(), // ends with service name "api"
            running: true,
            status: "Up".to_string(),
            health: None,
            has_healthcheck: false,
            log_errors: vec![],
            ports: vec![],
            traefik_urls: vec![],
        }];

        collect_traefik_urls(&compose, &mut containers);

        assert_eq!(
            containers[0].traefik_urls,
            vec!["api.example.com".to_string()]
        );
    }

    #[test]
    fn test_collect_traefik_urls_complex_rule() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.http.routers.web.rule: "Host(`example.com`) && PathPrefix(`/api`)"
"#,
        )
        .unwrap();

        let mut containers = vec![ContainerHealth {
            name: "project-web".to_string(), // ends with service name "web"
            running: true,
            status: "Up".to_string(),
            health: None,
            has_healthcheck: false,
            log_errors: vec![],
            ports: vec![],
            traefik_urls: vec![],
        }];

        collect_traefik_urls(&compose, &mut containers);

        // Should extract the host even with complex rule
        assert_eq!(containers[0].traefik_urls, vec!["example.com".to_string()]);
    }

    #[test]
    fn test_collect_traefik_urls_no_match() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  web:
    image: nginx
"#,
        )
        .unwrap();

        let mut containers = vec![ContainerHealth {
            name: "project-web".to_string(), // ends with service name "web"
            running: true,
            status: "Up".to_string(),
            health: None,
            has_healthcheck: false,
            log_errors: vec![],
            ports: vec![],
            traefik_urls: vec![],
        }];

        collect_traefik_urls(&compose, &mut containers);

        assert!(containers[0].traefik_urls.is_empty());
    }

    #[test]
    fn test_collect_traefik_urls_multiple_routers() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.enable: true
      traefik.http.routers.web.rule: "Host(`localhost`)"
      traefik.http.routers.web.entrypoints: web
      traefik.http.routers.web-www.rule: "Host(`www.example.com`)"
      traefik.http.routers.web-www.entrypoints: web
      traefik.http.routers.web-prod.rule: "Host(`example.com`)"
      traefik.http.routers.web-prod.entrypoints: websecure
"#,
        )
        .unwrap();

        let mut containers = vec![ContainerHealth {
            name: "project-web".to_string(),
            running: true,
            status: "Up".to_string(),
            health: None,
            has_healthcheck: false,
            log_errors: vec![],
            ports: vec![],
            traefik_urls: vec![],
        }];

        collect_traefik_urls(&compose, &mut containers);

        // Should collect all three hosts
        assert_eq!(containers[0].traefik_urls.len(), 3);
        assert!(containers[0].traefik_urls.contains(&"localhost".to_string()));
        assert!(containers[0]
            .traefik_urls
            .contains(&"www.example.com".to_string()));
        assert!(containers[0]
            .traefik_urls
            .contains(&"example.com".to_string()));
    }

    // Tests for parse_socket_addr

    #[test]
    fn test_parse_socket_addr_ipv4() {
        let addr = parse_socket_addr("http://127.0.0.1:8080").unwrap();
        assert_eq!(addr.to_string(), "127.0.0.1:8080");
    }

    #[test]
    fn test_parse_socket_addr_ipv4_with_path() {
        let addr = parse_socket_addr("http://127.0.0.1:8080/health").unwrap();
        assert_eq!(addr.to_string(), "127.0.0.1:8080");
    }

    #[test]
    fn test_parse_socket_addr_ipv6() {
        let addr = parse_socket_addr("http://[::1]:8080").unwrap();
        assert_eq!(addr.to_string(), "[::1]:8080");
    }

    #[test]
    fn test_parse_socket_addr_no_scheme() {
        // Should work without http:// prefix
        let addr = parse_socket_addr("127.0.0.1:8080").unwrap();
        assert_eq!(addr.to_string(), "127.0.0.1:8080");
    }

    #[test]
    fn test_parse_socket_addr_invalid() {
        assert!(parse_socket_addr("not-a-valid-addr").is_none());
        assert!(parse_socket_addr("http://localhost:8080").is_none()); // localhost needs resolution
    }

    // Tests for parse_readiness_output

    #[test]
    fn test_parse_readiness_output_all_ready() {
        let output = "Up 5 minutes\thealthy\nUp 3 minutes\thealthy\n";
        let result = parse_readiness_output(output);
        assert_eq!(result.total, 2);
        assert_eq!(result.running, 2);
        assert_eq!(result.starting, 0);
        assert!(result.all_ready);
    }

    #[test]
    fn test_parse_readiness_output_starting() {
        let output = "Up 5 minutes\thealthy\nUp 10 seconds\tstarting\n";
        let result = parse_readiness_output(output);
        assert_eq!(result.total, 2);
        assert_eq!(result.running, 2);
        assert_eq!(result.starting, 1);
        assert!(!result.all_ready);
    }

    #[test]
    fn test_parse_readiness_output_not_running() {
        let output = "Up 5 minutes\thealthy\nExited (1) 2 minutes ago\t\n";
        let result = parse_readiness_output(output);
        assert_eq!(result.total, 2);
        assert_eq!(result.running, 1);
        assert_eq!(result.starting, 0);
        assert!(!result.all_ready);
    }

    #[test]
    fn test_parse_readiness_output_empty() {
        let output = "";
        let result = parse_readiness_output(output);
        assert_eq!(result.total, 0);
        assert_eq!(result.running, 0);
        assert_eq!(result.starting, 0);
        assert!(!result.all_ready);
    }

    #[test]
    fn test_parse_readiness_output_no_healthcheck() {
        // Containers without healthcheck have empty health field
        let output = "Up 5 minutes\t\nUp 3 minutes\t\n";
        let result = parse_readiness_output(output);
        assert_eq!(result.total, 2);
        assert_eq!(result.running, 2);
        assert_eq!(result.starting, 0);
        assert!(result.all_ready);
    }

    #[test]
    fn test_parse_readiness_output_mixed_state() {
        let output = "Up 10 minutes\thealthy\nUp 30 seconds\tstarting\nExited (0) 1 minute ago\t\n";
        let result = parse_readiness_output(output);
        assert_eq!(result.total, 3);
        assert_eq!(result.running, 2);
        assert_eq!(result.starting, 1);
        assert!(!result.all_ready);
    }

    // Tests for is_localhost_host

    #[test]
    fn test_is_localhost_host_localhost() {
        assert!(is_localhost_host("localhost"));
        assert!(is_localhost_host("localhost:8080"));
    }

    #[test]
    fn test_is_localhost_host_localhost_subdomain() {
        assert!(is_localhost_host("app.localhost"));
        assert!(is_localhost_host("my-app.localhost"));
        assert!(is_localhost_host("my-app.localhost:3000"));
    }

    #[test]
    fn test_is_localhost_host_127() {
        assert!(is_localhost_host("127.0.0.1"));
        assert!(is_localhost_host("127.0.0.1:8080"));
        assert!(is_localhost_host("127.0.1.1"));
        assert!(is_localhost_host("127.255.255.255"));
    }

    #[test]
    fn test_is_localhost_host_ipv6() {
        assert!(is_localhost_host("::1"));
        assert!(is_localhost_host("[::1]"));
        assert!(is_localhost_host("[::1]:8080"));
    }

    #[test]
    fn test_is_localhost_host_external() {
        assert!(!is_localhost_host("example.com"));
        assert!(!is_localhost_host("example.com:443"));
        assert!(!is_localhost_host("192.168.1.1"));
        assert!(!is_localhost_host("10.0.0.1:8080"));
        assert!(!is_localhost_host("api.example.com"));
    }

    #[test]
    fn test_is_localhost_host_tricky_cases() {
        // These should NOT be considered localhost
        assert!(!is_localhost_host("notlocalhost"));
        assert!(!is_localhost_host("localhost.example.com"));
        assert!(!is_localhost_host("my-localhost.com"));
        assert!(!is_localhost_host("128.0.0.1")); // Not 127.x.x.x
    }
}
