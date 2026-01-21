//! Pre-deployment checks for Docker Compose projects.
//!
//! These checks run after templates are rendered but before `docker compose up`:
//! - Traefik container availability and network connectivity
//! - Ofelia/Watchtower handler availability
//! - Volume mount path existence
//! - File permission checks

use std::collections::HashSet;
use std::path::Path;
use tracing::{debug, info};

use crate::compose::DockerClient;

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
    pub(super) fn pass(name: &str, message: &str) -> Self {
        Self {
            name: name.to_string(),
            passed: true,
            message: message.to_string(),
            severity: Severity::Info,
        }
    }

    pub(super) fn warn(name: &str, message: &str) -> Self {
        Self {
            name: name.to_string(),
            passed: false,
            message: message.to_string(),
            severity: Severity::Warning,
        }
    }

    pub(super) fn error(name: &str, message: &str) -> Self {
        Self {
            name: name.to_string(),
            passed: false,
            message: message.to_string(),
            severity: Severity::Error,
        }
    }
}

/// Parsed volume mount from Docker Compose.
struct VolumeMount {
    /// Host path or volume name
    host_path: String,
    /// Volume type if specified (bind, volume, tmpfs)
    volume_type: Option<String>,
}

/// Parse volume entry from Docker Compose YAML.
///
/// Handles both short syntax ("host:container:mode") and long syntax
/// (mapping with source/target/type fields).
///
/// Returns None for entries that can't be parsed.
fn parse_volume_entry(volume: &serde_yaml_neo::Value) -> Option<VolumeMount> {
    match volume {
        serde_yaml_neo::Value::String(s) => {
            // Short syntax: "host:container" or "host:container:mode"
            let host_path = s.split(':').next().unwrap_or("").to_string();
            Some(VolumeMount {
                host_path,
                volume_type: None,
            })
        }
        serde_yaml_neo::Value::Mapping(m) => {
            // Long syntax with type field
            let volume_type = m.get("type").and_then(|v| v.as_str()).map(String::from);
            let host_path = m
                .get("source")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            Some(VolumeMount {
                host_path,
                volume_type,
            })
        }
        _ => None,
    }
}

/// Check if a volume mount should be skipped (tmpfs, named volumes, etc.)
fn should_skip_volume(mount: &VolumeMount) -> bool {
    // Skip tmpfs and named volumes (type: volume)
    if let Some(ref t) = mount.volume_type {
        if t == "tmpfs" || t == "volume" {
            return true;
        }
    }

    // Skip empty paths
    if mount.host_path.is_empty() {
        return true;
    }

    // Skip named volumes: no path separators and no leading dot
    // Named volumes are just identifiers like "mydata" or "db-data"
    let is_named_volume = !mount.host_path.contains('/')
        && !mount.host_path.starts_with('.')
        && !mount.host_path.contains('\\');

    is_named_volume
}

/// Run all debug checks on the deployment
pub fn run_debug_checks(
    client: &dyn DockerClient,
    compose_content: &serde_yaml_neo::Value,
    base_dir: &Path,
    project_name: &str,
) -> Vec<CheckResult> {
    let mut results = Vec::new();

    // Check Traefik if labels are used
    results.extend(check_traefik(client, compose_content, project_name));

    // Check Ofelia/Watchtower handlers
    results.extend(check_scheduled_handlers(client, compose_content));

    // Check volume mounts
    results.extend(check_volume_mounts(compose_content, base_dir));

    // Check file permissions for mounted volumes
    results.extend(check_file_permissions(compose_content, base_dir));

    results
}

/// Check if Traefik is available when traefik labels are used
fn check_traefik(client: &dyn DockerClient, compose: &serde_yaml_neo::Value, project_name: &str) -> Vec<CheckResult> {
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
    match client.list_containers(&[("name", "traefik")]) {
        Ok(json) => {
            // Parse container names from JSON
            let traefik_containers = parse_container_names(&json);

            if traefik_containers.is_empty() {
                results.push(CheckResult::warn(
                    "traefik",
                    "Traefik labels are used but no traefik container is running. \
                     Services may not be accessible.",
                ));
            } else {
                // Check if traefik is on the same network
                for container in &traefik_containers {
                    let networks = get_container_networks(client, container);
                    let shared: Vec<_> = project_networks.intersection(&networks).collect();

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
        Err(e) => {
            results.push(CheckResult::error(
                "traefik",
                &format!("Failed to check for traefik container: {}", e),
            ));
        }
    }

    results
}

/// Check if ofelia or watchtower is available when needed
fn check_scheduled_handlers(client: &dyn DockerClient, compose: &serde_yaml_neo::Value) -> Vec<CheckResult> {
    let mut results = Vec::new();

    let uses_ofelia = has_labels_containing(compose, "ofelia");
    let uses_watchtower = has_labels_containing(compose, "watchtower")
        || has_labels_containing(compose, "com.centurylinklabs.watchtower");

    if uses_ofelia {
        info!("Ofelia labels detected, checking for ofelia container...");
        match check_container_exists(client, "ofelia") {
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
        match check_container_exists(client, "watchtower") {
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
fn check_volume_mounts(compose: &serde_yaml_neo::Value, base_dir: &Path) -> Vec<CheckResult> {
    let mut results = Vec::new();
    let results_dir = base_dir.join("results");

    let services = match compose.get("services") {
        Some(serde_yaml_neo::Value::Mapping(m)) => m,
        _ => return results,
    };

    for (service_name, service) in services {
        let service_name = service_name.as_str().unwrap_or("unknown");

        let volumes = match service.get("volumes") {
            Some(serde_yaml_neo::Value::Sequence(v)) => v,
            _ => continue,
        };

        for volume in volumes {
            let mount = match parse_volume_entry(volume) {
                Some(m) => m,
                None => continue,
            };

            if should_skip_volume(&mount) {
                continue;
            }

            // Resolve relative paths from the results directory
            // (where docker-compose.yaml is located and runs from)
            let full_path = if mount.host_path.starts_with('/') {
                std::path::PathBuf::from(&mount.host_path)
            } else {
                // Relative paths are relative to where docker-compose runs (results dir)
                // Use components() to normalize the path (removes . and resolves ..)
                normalize_path(&results_dir.join(&mount.host_path))
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

/// Check file permissions for mounted volumes
fn check_file_permissions(compose: &serde_yaml_neo::Value, base_dir: &Path) -> Vec<CheckResult> {
    use std::os::unix::fs::MetadataExt;

    let mut results = Vec::new();
    let results_dir = base_dir.join("results");

    let services = match compose.get("services") {
        Some(serde_yaml_neo::Value::Mapping(m)) => m,
        _ => return results,
    };

    for (service_name, service) in services {
        let service_name = service_name.as_str().unwrap_or("unknown");

        let volumes = match service.get("volumes") {
            Some(serde_yaml_neo::Value::Sequence(v)) => v,
            _ => continue,
        };

        for volume in volumes {
            let mount = match parse_volume_entry(volume) {
                Some(m) => m,
                None => continue,
            };

            if should_skip_volume(&mount) {
                continue;
            }

            let full_path = if mount.host_path.starts_with('/') {
                std::path::PathBuf::from(&mount.host_path)
            } else {
                normalize_path(&results_dir.join(&mount.host_path))
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

// Helper functions

/// Normalize a path by removing `.` and resolving `..` components
fn normalize_path(path: &Path) -> std::path::PathBuf {
    use std::path::Component;
    let mut normalized = std::path::PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {} // Skip `.`
            Component::ParentDir => {
                normalized.pop(); // Go up one level for `..`
            }
            other => normalized.push(other),
        }
    }
    normalized
}

fn has_traefik_labels(compose: &serde_yaml_neo::Value) -> bool {
    has_labels_containing(compose, "traefik")
}

fn has_labels_containing(compose: &serde_yaml_neo::Value, pattern: &str) -> bool {
    let services = match compose.get("services") {
        Some(serde_yaml_neo::Value::Mapping(m)) => m,
        _ => return false,
    };

    for (_, service) in services {
        let labels = match service.get("labels") {
            Some(serde_yaml_neo::Value::Mapping(m)) => m
                .iter()
                .filter_map(|(k, _)| k.as_str())
                .collect::<Vec<_>>(),
            Some(serde_yaml_neo::Value::Sequence(s)) => {
                s.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>()
            }
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

fn get_compose_networks(compose: &serde_yaml_neo::Value, project_name: &str) -> HashSet<String> {
    let mut networks = HashSet::new();
    let mut has_explicit_service_networks = false;

    // Check if any service explicitly specifies networks
    if let Some(serde_yaml_neo::Value::Mapping(services)) = compose.get("services") {
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
    if let Some(serde_yaml_neo::Value::Mapping(nets)) = compose.get("networks") {
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

fn get_container_networks(client: &dyn DockerClient, container_name: &str) -> HashSet<String> {
    let mut networks = HashSet::new();

    if let Ok(json) = client.inspect_container(container_name) {
        // Parse networks from JSON response
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) {
            if let Some(network_settings) = value.get("NetworkSettings") {
                if let Some(networks_map) = network_settings.get("Networks") {
                    if let Some(obj) = networks_map.as_object() {
                        for key in obj.keys() {
                            networks.insert(key.clone());
                        }
                    }
                }
            }
        }
    }

    networks
}

fn check_container_exists(client: &dyn DockerClient, name_pattern: &str) -> Option<bool> {
    match client.list_containers(&[("name", name_pattern)]) {
        Ok(json) => {
            let containers = parse_container_names(&json);
            Some(!containers.is_empty())
        }
        Err(_) => None,
    }
}

/// Parse container names from bollard list_containers JSON response.
fn parse_container_names(json: &str) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(json) {
        if let Some(arr) = value.as_array() {
            for container in arr {
                // bollard returns Names as an array of strings like ["/container_name"]
                if let Some(container_names) = container.get("Names") {
                    if let Some(names_arr) = container_names.as_array() {
                        for name in names_arr {
                            if let Some(s) = name.as_str() {
                                // Remove leading slash
                                names.push(s.trim_start_matches('/').to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    names
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compose::docker::{ConfigurableMockClient, MockResponse};
    use tempfile::tempdir;

    #[test]
    fn test_has_traefik_labels() {
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
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
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
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
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
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

    #[test]
    fn test_run_debug_checks_no_issues() {
        let dir = tempdir().unwrap();
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        // No traefik labels, no ofelia/watchtower, no volume issues
        assert!(results.is_empty());
    }

    #[test]
    fn test_run_debug_checks_traefik_missing() {
        let dir = tempdir().unwrap();
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.enable: "true"
"#,
        )
        .unwrap();

        // Empty container list means traefik not running
        let client = ConfigurableMockClient {
            list_containers: MockResponse::ok("[]"),
            ..Default::default()
        };

        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "traefik");
        assert!(!results[0].passed);
        assert_eq!(results[0].severity, Severity::Warning);
        assert!(results[0].message.contains("no traefik container is running"));
    }

    #[test]
    fn test_run_debug_checks_traefik_running_same_network() {
        let dir = tempdir().unwrap();
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.enable: "true"
"#,
        )
        .unwrap();

        // Traefik container exists
        let client = ConfigurableMockClient {
            list_containers: MockResponse::ok(r#"[{"Names": ["/traefik"]}]"#),
            inspect_container: MockResponse::ok(
                r#"{"NetworkSettings": {"Networks": {"test-project_default": {}}}}"#,
            ),
            ..Default::default()
        };

        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "traefik");
        assert!(results[0].passed);
        assert!(results[0].message.contains("found on shared network"));
    }

    #[test]
    fn test_run_debug_checks_traefik_different_network() {
        let dir = tempdir().unwrap();
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.enable: "true"
"#,
        )
        .unwrap();

        // Traefik on different network
        let client = ConfigurableMockClient {
            list_containers: MockResponse::ok(r#"[{"Names": ["/traefik"]}]"#),
            inspect_container: MockResponse::ok(
                r#"{"NetworkSettings": {"Networks": {"other_network": {}}}}"#,
            ),
            ..Default::default()
        };

        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "traefik-network");
        assert!(!results[0].passed);
        assert_eq!(results[0].severity, Severity::Warning);
        assert!(results[0].message.contains("not on the same network"));
    }

    #[test]
    fn test_run_debug_checks_ofelia_missing() {
        let dir = tempdir().unwrap();
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  worker:
    image: worker
    labels:
      ofelia.job-exec.cleanup.schedule: "@daily"
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient {
            list_containers: MockResponse::ok("[]"),
            ..Default::default()
        };

        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "ofelia");
        assert!(!results[0].passed);
        assert!(results[0].message.contains("no ofelia container is running"));
    }

    #[test]
    fn test_run_debug_checks_watchtower_missing() {
        let dir = tempdir().unwrap();
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  app:
    image: myapp
    labels:
      com.centurylinklabs.watchtower.enable: "true"
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient {
            list_containers: MockResponse::ok("[]"),
            ..Default::default()
        };

        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "watchtower");
        assert!(!results[0].passed);
        assert!(results[0].message.contains("no watchtower container is running"));
    }

    #[test]
    fn test_run_debug_checks_volume_mount_missing() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("results")).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    volumes:
      - ./config:/etc/nginx/config
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        assert_eq!(results.len(), 1);
        assert!(results[0].name.contains("volume"));
        assert!(!results[0].passed);
        assert!(results[0].message.contains("does not exist"));
    }

    #[test]
    fn test_run_debug_checks_volume_mount_exists() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        std::fs::create_dir_all(&results_dir).unwrap();
        std::fs::create_dir_all(results_dir.join("config")).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    volumes:
      - ./config:/etc/nginx/config
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        // Volume exists, no warnings
        assert!(results.is_empty());
    }

    #[test]
    fn test_run_debug_checks_named_volume_skipped() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("results")).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  db:
    image: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        // Named volumes should be skipped
        assert!(results.is_empty());
    }

    #[test]
    fn test_parse_volume_entry_short_syntax() {
        let volume = serde_yaml_neo::Value::String("./data:/app/data".to_string());
        let mount = parse_volume_entry(&volume).unwrap();
        assert_eq!(mount.host_path, "./data");
        assert!(mount.volume_type.is_none());
    }

    #[test]
    fn test_parse_volume_entry_long_syntax() {
        let volume: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
type: bind
source: ./config
target: /app/config
"#,
        )
        .unwrap();
        let mount = parse_volume_entry(&volume).unwrap();
        assert_eq!(mount.host_path, "./config");
        assert_eq!(mount.volume_type, Some("bind".to_string()));
    }

    #[test]
    fn test_should_skip_volume_tmpfs() {
        let mount = VolumeMount {
            host_path: "".to_string(),
            volume_type: Some("tmpfs".to_string()),
        };
        assert!(should_skip_volume(&mount));
    }

    #[test]
    fn test_should_skip_volume_named() {
        let mount = VolumeMount {
            host_path: "mydata".to_string(),
            volume_type: None,
        };
        assert!(should_skip_volume(&mount));
    }

    #[test]
    fn test_should_not_skip_volume_bind() {
        let mount = VolumeMount {
            host_path: "./config".to_string(),
            volume_type: Some("bind".to_string()),
        };
        assert!(!should_skip_volume(&mount));
    }

    #[test]
    fn test_parse_container_names() {
        let json = r#"[{"Names": ["/container1"]}, {"Names": ["/container2", "/alias"]}]"#;
        let names = parse_container_names(json);
        assert_eq!(names.len(), 3);
        assert!(names.contains(&"container1".to_string()));
        assert!(names.contains(&"container2".to_string()));
        assert!(names.contains(&"alias".to_string()));
    }

    #[test]
    fn test_check_traefik_docker_error() {
        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    labels:
      traefik.enable: "true"
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient {
            list_containers: MockResponse::err("Docker daemon not responding"),
            ..Default::default()
        };

        let results = check_traefik(&client, &compose, "test-project");

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "traefik");
        assert!(!results[0].passed);
        assert_eq!(results[0].severity, Severity::Error);
        assert!(results[0].message.contains("Failed to check"));
    }

    // =========================================================================
    // Edge Case Tests (#35) - Volume checks
    // =========================================================================

    #[test]
    fn test_volume_mount_with_parent_dir_segments() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        std::fs::create_dir_all(&results_dir).unwrap();

        // Create a directory outside results but still within project
        std::fs::create_dir_all(dir.path().join("shared")).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    volumes:
      - ../shared:/app/shared
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        // Path resolves to existing directory, no warnings
        assert!(results.is_empty());
    }

    #[test]
    fn test_volume_mount_file_not_directory() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        std::fs::create_dir_all(&results_dir).unwrap();

        // Create a file (not a directory)
        std::fs::write(results_dir.join("nginx.conf"), "server {}").unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        // File mount exists, no warnings
        assert!(results.is_empty());
    }

    #[test]
    fn test_volume_mount_missing_file() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("results")).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        // File doesn't exist, should warn
        assert_eq!(results.len(), 1);
        assert!(results[0].name.contains("volume"));
        assert!(!results[0].passed);
    }

    #[test]
    fn test_volume_long_syntax_with_read_only() {
        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        std::fs::create_dir_all(&results_dir).unwrap();
        std::fs::create_dir_all(results_dir.join("config")).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  web:
    image: nginx
    volumes:
      - type: bind
        source: ./config
        target: /etc/nginx/conf.d
        read_only: true
"#,
        )
        .unwrap();

        let client = ConfigurableMockClient::default();
        let results = run_debug_checks(&client, &compose, dir.path(), "test-project");

        // Directory exists, no warnings (read_only doesn't affect existence check)
        assert!(results.is_empty());
    }

    // =========================================================================
    // Edge Case Tests (#36) - File permission checks
    // =========================================================================

    #[test]
    fn test_check_file_permissions_world_writable_file() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        std::fs::create_dir_all(&results_dir).unwrap();

        // Create a world-writable file
        let config_file = results_dir.join("config.yml");
        std::fs::write(&config_file, "key: value").unwrap();
        std::fs::set_permissions(&config_file, std::fs::Permissions::from_mode(0o666)).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  app:
    image: myapp
    volumes:
      - ./config.yml:/app/config.yml
"#,
        )
        .unwrap();

        let results = check_file_permissions(&compose, dir.path());

        assert_eq!(results.len(), 1);
        assert!(results[0].name.contains("perms"));
        assert!(!results[0].passed);
        assert!(results[0].message.contains("world-writable"));
    }

    #[test]
    fn test_check_file_permissions_dir_not_world_readable() {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        let results_dir = dir.path().join("results");
        std::fs::create_dir_all(&results_dir).unwrap();

        // Create a directory without world-read permission
        let data_dir = results_dir.join("data");
        std::fs::create_dir_all(&data_dir).unwrap();
        std::fs::set_permissions(&data_dir, std::fs::Permissions::from_mode(0o700)).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  app:
    image: myapp
    volumes:
      - ./data:/app/data
"#,
        )
        .unwrap();

        let results = check_file_permissions(&compose, dir.path());

        assert_eq!(results.len(), 1);
        assert!(results[0].message.contains("not be readable"));
    }

    #[test]
    fn test_check_file_permissions_nonexistent_path() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("results")).unwrap();

        let compose: serde_yaml_neo::Value = serde_yaml_neo::from_str(
            r#"
services:
  app:
    image: myapp
    volumes:
      - ./nonexistent:/app/data
"#,
        )
        .unwrap();

        let results = check_file_permissions(&compose, dir.path());

        // Nonexistent paths are handled by check_volume_mounts, not permissions check
        assert!(results.is_empty());
    }

    #[test]
    fn test_normalize_path_removes_dot_segments() {
        let path = std::path::Path::new("/foo/./bar/../baz");
        let normalized = normalize_path(path);
        assert_eq!(normalized, std::path::PathBuf::from("/foo/baz"));
    }

    #[test]
    fn test_normalize_path_relative() {
        let path = std::path::Path::new("results/../shared/./config");
        let normalized = normalize_path(path);
        assert_eq!(normalized, std::path::PathBuf::from("shared/config"));
    }
}
