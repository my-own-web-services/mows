use std::collections::HashSet;
use std::path::Path;
use std::process::Command;
use tracing::{debug, info};

/// Result of a single check
#[derive(Debug)]
pub struct CheckResult {
    pub name: String,
    pub passed: bool,
    pub message: String,
    pub severity: Severity,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Severity {
    Error,
    Warning,
    Info,
}

impl CheckResult {
    fn pass(name: &str, message: &str) -> Self {
        Self {
            name: name.to_string(),
            passed: true,
            message: message.to_string(),
            severity: Severity::Info,
        }
    }

    fn warn(name: &str, message: &str) -> Self {
        Self {
            name: name.to_string(),
            passed: false,
            message: message.to_string(),
            severity: Severity::Warning,
        }
    }

    fn error(name: &str, message: &str) -> Self {
        Self {
            name: name.to_string(),
            passed: false,
            message: message.to_string(),
            severity: Severity::Error,
        }
    }
}

/// Run all debug checks on the deployment
pub fn run_debug_checks(
    compose_content: &serde_yaml::Value,
    base_dir: &Path,
    project_name: &str,
) -> Vec<CheckResult> {
    let mut results = Vec::new();

    // Check Traefik if labels are used
    results.extend(check_traefik(compose_content, project_name));

    // Check Ofelia/Watchtower handlers
    results.extend(check_scheduled_handlers(compose_content));

    // Check volume mounts
    results.extend(check_volume_mounts(compose_content, base_dir));

    // Check file permissions for mounted volumes
    results.extend(check_file_permissions(compose_content, base_dir));

    results
}

/// Run post-deployment health checks
pub fn run_health_checks(project_name: &str) -> Vec<CheckResult> {
    let mut results = Vec::new();

    // Check container status
    results.extend(check_container_status(project_name));

    // Check container logs for errors
    results.extend(check_container_logs(project_name));

    // Check endpoint connectivity
    results.extend(check_endpoints(project_name));

    results
}

/// Check if Traefik is available when traefik labels are used
fn check_traefik(compose: &serde_yaml::Value, project_name: &str) -> Vec<CheckResult> {
    let mut results = Vec::new();

    // Check if any service uses traefik labels
    let uses_traefik = has_traefik_labels(compose);

    if !uses_traefik {
        debug!("No traefik labels found, skipping traefik check");
        return results;
    }

    info!("Traefik labels detected, checking for traefik container...");

    // Get networks used by this project
    let project_networks = get_compose_networks(compose, project_name);

    // Check if traefik container exists and is running
    let output = Command::new("docker")
        .args(["ps", "--filter", "name=traefik", "--format", "{{.Names}}"])
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let containers = String::from_utf8_lossy(&out.stdout);
            let traefik_containers: Vec<&str> =
                containers.lines().filter(|s| !s.is_empty()).collect();

            if traefik_containers.is_empty() {
                results.push(CheckResult::warn(
                    "traefik",
                    "Traefik labels are used but no traefik container is running. \
                     Services may not be accessible.",
                ));
            } else {
                // Check if traefik is on the same network
                for container in &traefik_containers {
                    let networks = get_container_networks(container);
                    let shared: Vec<_> = project_networks
                        .intersection(&networks)
                        .collect();

                    if shared.is_empty() {
                        results.push(CheckResult::warn(
                            "traefik-network",
                            &format!(
                                "Traefik container '{}' is not on the same network as this deployment. \
                                 Project networks: {:?}, Traefik networks: {:?}",
                                container, project_networks, networks
                            ),
                        ));
                    } else {
                        results.push(CheckResult::pass(
                            "traefik",
                            &format!(
                                "Traefik container '{}' found on shared network(s): {:?}",
                                container, shared
                            ),
                        ));
                    }
                }
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            results.push(CheckResult::error(
                "traefik",
                &format!("Failed to check for traefik container: {}", stderr),
            ));
        }
        Err(e) => {
            results.push(CheckResult::error(
                "traefik",
                &format!("Failed to run docker command: {}", e),
            ));
        }
    }

    results
}

/// Check if ofelia or watchtower is available when needed
fn check_scheduled_handlers(compose: &serde_yaml::Value) -> Vec<CheckResult> {
    let mut results = Vec::new();

    let uses_ofelia = has_labels_containing(compose, "ofelia");
    let uses_watchtower = has_labels_containing(compose, "watchtower")
        || has_labels_containing(compose, "com.centurylinklabs.watchtower");

    if uses_ofelia {
        info!("Ofelia labels detected, checking for ofelia container...");
        match check_container_exists("ofelia") {
            Some(true) => {
                results.push(CheckResult::pass(
                    "ofelia",
                    "Ofelia scheduler container is running",
                ));
            }
            Some(false) => {
                results.push(CheckResult::warn(
                    "ofelia",
                    "Ofelia labels are used but no ofelia container is running. \
                     Scheduled tasks may not execute.",
                ));
            }
            None => {
                results.push(CheckResult::error(
                    "ofelia",
                    "Failed to check for ofelia container",
                ));
            }
        }
    }

    if uses_watchtower {
        info!("Watchtower labels detected, checking for watchtower container...");
        match check_container_exists("watchtower") {
            Some(true) => {
                results.push(CheckResult::pass(
                    "watchtower",
                    "Watchtower container is running",
                ));
            }
            Some(false) => {
                results.push(CheckResult::warn(
                    "watchtower",
                    "Watchtower labels are used but no watchtower container is running. \
                     Auto-updates may not work.",
                ));
            }
            None => {
                results.push(CheckResult::error(
                    "watchtower",
                    "Failed to check for watchtower container",
                ));
            }
        }
    }

    results
}

/// Check if volume mount paths exist
fn check_volume_mounts(compose: &serde_yaml::Value, base_dir: &Path) -> Vec<CheckResult> {
    let mut results = Vec::new();
    let results_dir = base_dir.join("results");

    let services = match compose.get("services") {
        Some(serde_yaml::Value::Mapping(m)) => m,
        _ => return results,
    };

    for (service_name, service) in services {
        let service_name = service_name.as_str().unwrap_or("unknown");

        let volumes = match service.get("volumes") {
            Some(serde_yaml::Value::Sequence(v)) => v,
            _ => continue,
        };

        for volume in volumes {
            // Handle both short and long volume syntax
            let (host_path, volume_type) = match volume {
                serde_yaml::Value::String(s) => {
                    // Short syntax: "host:container" or "host:container:mode"
                    let host = s.split(':').next().unwrap_or("").to_string();
                    (host, None)
                }
                serde_yaml::Value::Mapping(m) => {
                    // Long syntax with type field
                    let vol_type = m.get("type").and_then(|v| v.as_str());
                    let source = m.get("source")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    (source, vol_type)
                }
                _ => continue,
            };

            // Skip tmpfs and named volumes (type: volume)
            if let Some(t) = volume_type {
                if t == "tmpfs" || t == "volume" {
                    continue;
                }
            }

            // Skip empty paths
            if host_path.is_empty() {
                continue;
            }

            // Skip named volumes: no path separators and no leading dot
            // Named volumes are just identifiers like "mydata" or "db-data"
            let is_named_volume = !host_path.contains('/')
                && !host_path.starts_with('.')
                && !host_path.contains('\\');

            if is_named_volume {
                continue;
            }

            // Resolve relative paths from the results directory
            // (where docker-compose.yaml is located and runs from)
            let full_path = if host_path.starts_with('/') {
                std::path::PathBuf::from(&host_path)
            } else {
                // Relative paths are relative to where docker-compose runs (results dir)
                results_dir.join(&host_path)
            };

            if !full_path.exists() {
                results.push(CheckResult::warn(
                    &format!("volume-{}", service_name),
                    &format!(
                        "Volume mount path does not exist for service '{}': {}",
                        service_name,
                        full_path.display()
                    ),
                ));
            } else {
                debug!(
                    "Volume mount exists for {}: {}",
                    service_name,
                    full_path.display()
                );
            }
        }
    }

    results
}

/// Check container status after deployment
fn check_container_status(project_name: &str) -> Vec<CheckResult> {
    let mut results = Vec::new();

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
                    let name = parts[0];
                    let status = parts[1];
                    let health = parts.get(2).unwrap_or(&"");

                    if status.contains("Up") {
                        if health.contains("unhealthy") {
                            results.push(CheckResult::warn(
                                &format!("container-{}", name),
                                &format!("Container '{}' is running but unhealthy", name),
                            ));
                        } else {
                            results.push(CheckResult::pass(
                                &format!("container-{}", name),
                                &format!("Container '{}' is running ({})", name, status),
                            ));
                        }
                    } else {
                        results.push(CheckResult::error(
                            &format!("container-{}", name),
                            &format!("Container '{}' is not running: {}", name, status),
                        ));
                    }
                }
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            results.push(CheckResult::error(
                "container-status",
                &format!("Failed to get container status: {}", stderr),
            ));
        }
        Err(e) => {
            results.push(CheckResult::error(
                "container-status",
                &format!("Failed to run docker compose ps: {}", e),
            ));
        }
    }

    results
}

/// Check container logs for errors
fn check_container_logs(project_name: &str) -> Vec<CheckResult> {
    let mut results = Vec::new();

    // Get logs from the last 30 seconds
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

            // Look for common error patterns
            let error_patterns = ["error", "fatal", "panic", "exception", "failed"];
            let mut error_lines = Vec::new();

            for line in combined.lines() {
                let lower = line.to_lowercase();
                if error_patterns.iter().any(|p| lower.contains(p)) {
                    // Skip common false positives
                    if is_log_false_positive(&lower) {
                        continue;
                    }
                    error_lines.push(line);
                }
            }

            if error_lines.is_empty() {
                results.push(CheckResult::pass(
                    "logs",
                    "No errors found in recent container logs",
                ));
            } else {
                let sample: Vec<_> = error_lines.iter().take(5).collect();
                results.push(CheckResult::warn(
                    "logs",
                    &format!(
                        "Found {} potential error(s) in logs:\n{}",
                        error_lines.len(),
                        sample
                            .iter()
                            .map(|s| format!("  {}", s))
                            .collect::<Vec<_>>()
                            .join("\n")
                    ),
                ));
            }
        }
        _ => {
            debug!("Could not check logs (this is normal if no containers are running)");
        }
    }

    results
}

/// Check if a log line is a known false positive
fn is_log_false_positive(lower: &str) -> bool {
    // Common false positive patterns
    let false_positive_patterns = [
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
        // Negative assertions in tests/startup
        "without error",
        "if error",
        "error == nil",
        "error != nil",
        "catch error",
        // Status messages
        "error handling",
        "error recovery",
        "exception handler",
    ];

    false_positive_patterns.iter().any(|p| lower.contains(p))
}

// Helper functions

fn has_traefik_labels(compose: &serde_yaml::Value) -> bool {
    has_labels_containing(compose, "traefik")
}

fn has_labels_containing(compose: &serde_yaml::Value, pattern: &str) -> bool {
    let services = match compose.get("services") {
        Some(serde_yaml::Value::Mapping(m)) => m,
        _ => return false,
    };

    for (_, service) in services {
        let labels = match service.get("labels") {
            Some(serde_yaml::Value::Mapping(m)) => {
                m.iter()
                    .filter_map(|(k, _)| k.as_str())
                    .collect::<Vec<_>>()
            }
            Some(serde_yaml::Value::Sequence(s)) => s
                .iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>(),
            _ => continue,
        };

        for label in labels {
            if label.to_lowercase().contains(pattern) {
                return true;
            }
        }
    }

    false
}

fn get_compose_networks(compose: &serde_yaml::Value, project_name: &str) -> HashSet<String> {
    let mut networks = HashSet::new();
    let mut has_explicit_service_networks = false;

    // Check if any service explicitly specifies networks
    if let Some(serde_yaml::Value::Mapping(services)) = compose.get("services") {
        for (_, service) in services {
            if service.get("networks").is_some() {
                has_explicit_service_networks = true;
                break;
            }
        }
    }

    // Only add default network if no service explicitly specifies networks
    // Docker Compose creates the default network only when no explicit networks are used
    if !has_explicit_service_networks {
        networks.insert(format!("{}_default", project_name));
    }

    // Check for explicitly defined networks
    if let Some(serde_yaml::Value::Mapping(nets)) = compose.get("networks") {
        for (name, config) in nets {
            if let Some(name_str) = name.as_str() {
                // Check if external
                let is_external = config
                    .get("external")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                if is_external {
                    // Use the network name as-is or from 'name' field
                    let net_name = config
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or(name_str);
                    networks.insert(net_name.to_string());
                } else {
                    networks.insert(format!("{}_{}", project_name, name_str));
                }
            }
        }
    }

    networks
}

fn get_container_networks(container_name: &str) -> HashSet<String> {
    let mut networks = HashSet::new();

    let output = Command::new("docker")
        .args([
            "inspect",
            container_name,
            "--format",
            "{{range $k, $v := .NetworkSettings.Networks}}{{$k}}\n{{end}}",
        ])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                if !line.is_empty() {
                    networks.insert(line.to_string());
                }
            }
        }
    }

    networks
}

fn check_container_exists(name_pattern: &str) -> Option<bool> {
    let output = Command::new("docker")
        .args([
            "ps",
            "--filter",
            &format!("name={}", name_pattern),
            "--format",
            "{{.Names}}",
        ])
        .output()
        .ok()?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Some(!stdout.trim().is_empty())
    } else {
        None
    }
}

/// Check file permissions for mounted volumes
fn check_file_permissions(compose: &serde_yaml::Value, base_dir: &Path) -> Vec<CheckResult> {
    use std::os::unix::fs::MetadataExt;

    let mut results = Vec::new();
    let results_dir = base_dir.join("results");

    let services = match compose.get("services") {
        Some(serde_yaml::Value::Mapping(m)) => m,
        _ => return results,
    };

    for (service_name, service) in services {
        let service_name = service_name.as_str().unwrap_or("unknown");

        let volumes = match service.get("volumes") {
            Some(serde_yaml::Value::Sequence(v)) => v,
            _ => continue,
        };

        for volume in volumes {
            let host_path = match volume {
                serde_yaml::Value::String(s) => s.split(':').next().unwrap_or("").to_string(),
                serde_yaml::Value::Mapping(m) => {
                    // Skip non-bind mounts
                    let vol_type = m.get("type").and_then(|v| v.as_str());
                    if vol_type == Some("tmpfs") || vol_type == Some("volume") {
                        continue;
                    }
                    m.get("source")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string()
                }
                _ => continue,
            };

            if host_path.is_empty() || (!host_path.contains('/') && !host_path.starts_with('.')) {
                continue;
            }

            let full_path = if host_path.starts_with('/') {
                std::path::PathBuf::from(&host_path)
            } else {
                results_dir.join(&host_path)
            };

            if let Ok(metadata) = std::fs::metadata(&full_path) {
                let mode = metadata.mode();
                let is_readable = mode & 0o004 != 0; // World readable
                let is_writable = mode & 0o002 != 0; // World writable

                // Check if a config file is world-writable (potential security issue)
                if is_writable && full_path.is_file() {
                    results.push(CheckResult::warn(
                        &format!("perms-{}", service_name),
                        &format!(
                            "File '{}' is world-writable (mode {:o})",
                            full_path.display(),
                            mode & 0o777
                        ),
                    ));
                }

                // Check if a directory is not readable (containers might fail)
                if full_path.is_dir() && !is_readable {
                    results.push(CheckResult::warn(
                        &format!("perms-{}", service_name),
                        &format!(
                            "Directory '{}' may not be readable by container (mode {:o})",
                            full_path.display(),
                            mode & 0o777
                        ),
                    ));
                }
            }
        }
    }

    results
}

/// Check endpoint connectivity after deployment
fn check_endpoints(project_name: &str) -> Vec<CheckResult> {
    let mut results = Vec::new();

    // Get exposed ports from running containers
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

    let port_info = match output {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        _ => return results,
    };

    for line in port_info.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 2 {
            continue;
        }

        let container_name = parts[0];
        let ports = parts[1];

        // Parse port mappings like "0.0.0.0:8080->80/tcp"
        for port_mapping in ports.split(", ") {
            if let Some(host_port) = extract_host_port(port_mapping) {
                // Try to connect to the port
                let url = format!("http://127.0.0.1:{}", host_port);
                match check_http_endpoint(&url) {
                    Some(true) => {
                        results.push(CheckResult::pass(
                            &format!("endpoint-{}", container_name),
                            &format!("Port {} is responding", host_port),
                        ));
                    }
                    Some(false) => {
                        // Port open but HTTP failed - could be non-HTTP service
                        debug!(
                            "Port {} open but HTTP check failed (may be non-HTTP service)",
                            host_port
                        );
                    }
                    None => {
                        results.push(CheckResult::warn(
                            &format!("endpoint-{}", container_name),
                            &format!(
                                "Cannot connect to port {} (service may still be starting)",
                                host_port
                            ),
                        ));
                    }
                }
            }
        }
    }

    results
}

/// Extract host port from docker port mapping string
fn extract_host_port(port_mapping: &str) -> Option<u16> {
    // Format: "0.0.0.0:8080->80/tcp" or ":::8080->80/tcp" or "8080->80/tcp"
    let arrow_pos = port_mapping.find("->")?;
    let host_part = &port_mapping[..arrow_pos];

    // Get the port after the last colon
    let port_str = host_part.rsplit(':').next()?;
    port_str.parse().ok()
}

/// Try to connect to an HTTP endpoint with retry
fn check_http_endpoint(url: &str) -> Option<bool> {
    use std::net::TcpStream;
    use std::time::Duration;
    use std::thread::sleep;

    // Extract host and port from URL
    let url = url.strip_prefix("http://").unwrap_or(url);
    let addr = url.split('/').next()?;
    let addr: std::net::SocketAddr = addr.parse().ok()?;

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

/// Print check results to the console
pub fn print_check_results(results: &[CheckResult]) {
    if results.is_empty() {
        return;
    }

    println!("\n--- Debug Checks ---");

    let mut errors = 0;
    let mut warnings = 0;

    for result in results {
        let icon = if result.passed {
            "✓"
        } else {
            match result.severity {
                Severity::Error => {
                    errors += 1;
                    "✗"
                }
                Severity::Warning => {
                    warnings += 1;
                    "⚠"
                }
                Severity::Info => "ℹ",
            }
        };

        println!("{} [{}] {}", icon, result.name, result.message);
    }

    println!();
    if errors > 0 || warnings > 0 {
        println!(
            "Summary: {} error(s), {} warning(s)",
            errors, warnings
        );
    } else {
        println!("All checks passed!");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_has_traefik_labels() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.enable: "true"
      traefik.http.routers.web.rule: "Host(`example.com`)"
"#,
        )
        .unwrap();

        assert!(has_traefik_labels(&compose));
    }

    #[test]
    fn test_no_traefik_labels() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      app: web
"#,
        )
        .unwrap();

        assert!(!has_traefik_labels(&compose));
    }

    #[test]
    fn test_get_compose_networks() {
        let compose: serde_yaml::Value = serde_yaml::from_str(
            r#"
services:
  web:
    image: nginx
networks:
  frontend:
  backend:
    external: true
    name: shared-backend
"#,
        )
        .unwrap();

        let networks = get_compose_networks(&compose, "myproject");

        assert!(networks.contains("myproject_default"));
        assert!(networks.contains("myproject_frontend"));
        assert!(networks.contains("shared-backend"));
    }

    #[test]
    fn test_check_result_creation() {
        let pass = CheckResult::pass("test", "All good");
        assert!(pass.passed);
        assert_eq!(pass.severity, Severity::Info);

        let warn = CheckResult::warn("test", "Warning message");
        assert!(!warn.passed);
        assert_eq!(warn.severity, Severity::Warning);

        let err = CheckResult::error("test", "Error message");
        assert!(!err.passed);
        assert_eq!(err.severity, Severity::Error);
    }
}
