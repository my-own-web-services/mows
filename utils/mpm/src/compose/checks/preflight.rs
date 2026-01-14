//! Pre-deployment checks for Docker Compose projects.
//!
//! These checks run after templates are rendered but before `docker compose up`:
//! - Traefik container availability and network connectivity
//! - Ofelia/Watchtower handler availability
//! - Volume mount path existence
//! - File permission checks

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
fn parse_volume_entry(volume: &serde_yaml::Value) -> Option<VolumeMount> {
    match volume {
        serde_yaml::Value::String(s) => {
            // Short syntax: "host:container" or "host:container:mode"
            let host_path = s.split(':').next().unwrap_or("").to_string();
            Some(VolumeMount {
                host_path,
                volume_type: None,
            })
        }
        serde_yaml::Value::Mapping(m) => {
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
            Some(serde_yaml::Value::Mapping(m)) => m
                .iter()
                .filter_map(|(k, _)| k.as_str())
                .collect::<Vec<_>>(),
            Some(serde_yaml::Value::Sequence(s)) => {
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
