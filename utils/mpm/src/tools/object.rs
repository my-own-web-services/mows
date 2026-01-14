use std::path::PathBuf;
use tracing::debug;

use crate::utils::{detect_yaml_indent, parse_yaml, read_input, write_output, yaml_with_indent};

use super::selector::{find_matching_paths, get_value_at_path_mut, is_docker_compose};

/// Error type for flatten labels operation
#[derive(Debug)]
pub enum FlattenLabelsError {
    NoLabels,
    NotDockerCompose,
    FlattenFailed(String),
}

impl std::fmt::Display for FlattenLabelsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FlattenLabelsError::NoLabels => write!(f, "No labels found to flatten"),
            FlattenLabelsError::NotDockerCompose => write!(f, "Not a Docker Compose file"),
            FlattenLabelsError::FlattenFailed(msg) => write!(f, "Flatten failed: {}", msg),
        }
    }
}

/// Flatten labels in a docker-compose YAML value
/// This transforms nested label structures to flat dot-notation
pub fn flatten_labels_in_compose(mut value: serde_yaml::Value) -> Result<serde_yaml::Value, FlattenLabelsError> {
    if !is_docker_compose(&value) {
        return Err(FlattenLabelsError::NotDockerCompose);
    }

    let pattern = vec!["services", "*", "labels"];
    let matching_paths = find_matching_paths(&value, &pattern);

    if matching_paths.is_empty() {
        return Err(FlattenLabelsError::NoLabels);
    }

    for path in matching_paths {
        if let Some(target) = get_value_at_path_mut(&mut value, &path) {
            let flattened = mows_common_rust::labels::tree_to_labels(target.clone())
                .map_err(|e| FlattenLabelsError::FlattenFailed(e.to_string()))?;
            *target = flattened;
        }
    }

    Ok(value)
}

pub fn expand_object_command(
    input: &Option<PathBuf>,
    output: &Option<PathBuf>,
    selector: &Option<String>,
) -> Result<(), String> {
    debug!("Expanding dot-notation keys to nested object");
    let content = read_input(input)?;
    let indent = detect_yaml_indent(&content).unwrap_or(4);
    let mut value: serde_yaml::Value = parse_yaml(&content, input.as_deref())?;

    // Determine the selector to use
    let effective_selector = match selector {
        Some(s) => s.clone(),
        None => {
            if is_docker_compose(&value) {
                debug!("Detected Docker Compose file, using default selector: services.*.labels");
                "services.*.labels".to_string()
            } else {
                // No selector means transform the entire document
                String::new()
            }
        }
    };

    if effective_selector.is_empty() {
        // Transform the entire document
        let tree = mows_common_rust::labels::labels_to_tree(value)
            .map_err(|e| format!("Failed to expand: {}", e))?;
        let yaml = serde_yaml::to_string(&tree)
            .map_err(|e| format!("Failed to convert to YAML: {}", e))?;
        write_output(output, &yaml_with_indent(&yaml, indent))
    } else {
        // Transform only matching paths
        let pattern: Vec<&str> = effective_selector.split('.').collect();
        let matching_paths = find_matching_paths(&value, &pattern);

        debug!(
            "Found {} matching paths for pattern '{}'",
            matching_paths.len(),
            effective_selector
        );

        for path in matching_paths {
            if let Some(target) = get_value_at_path_mut(&mut value, &path) {
                let transformed = mows_common_rust::labels::labels_to_tree(target.clone())
                    .map_err(|e| format!("Failed to expand at path {:?}: {}", path, e))?;
                *target = transformed;
            }
        }

        let yaml = serde_yaml::to_string(&value)
            .map_err(|e| format!("Failed to convert to YAML: {}", e))?;
        write_output(output, &yaml_with_indent(&yaml, indent))
    }
}

pub fn flatten_object_command(
    input: &Option<PathBuf>,
    output: &Option<PathBuf>,
    selector: &Option<String>,
) -> Result<(), String> {
    debug!("Flattening nested object to dot-notation keys");
    let content = read_input(input)?;
    let indent = detect_yaml_indent(&content).unwrap_or(4);
    let mut value: serde_yaml::Value = parse_yaml(&content, input.as_deref())?;

    // Determine the selector to use
    let effective_selector = match selector {
        Some(s) => s.clone(),
        None => {
            if is_docker_compose(&value) {
                debug!("Detected Docker Compose file, using default selector: services.*.labels");
                "services.*.labels".to_string()
            } else {
                // No selector means transform the entire document
                String::new()
            }
        }
    };

    if effective_selector.is_empty() {
        // Transform the entire document
        let labels = mows_common_rust::labels::tree_to_labels(value)
            .map_err(|e| format!("Failed to flatten: {}", e))?;
        let yaml = serde_yaml::to_string(&labels)
            .map_err(|e| format!("Failed to convert to YAML: {}", e))?;
        write_output(output, &yaml_with_indent(&yaml, indent))
    } else {
        // Transform only matching paths
        let pattern: Vec<&str> = effective_selector.split('.').collect();
        let matching_paths = find_matching_paths(&value, &pattern);

        debug!(
            "Found {} matching paths for pattern '{}'",
            matching_paths.len(),
            effective_selector
        );

        for path in matching_paths {
            if let Some(target) = get_value_at_path_mut(&mut value, &path) {
                let transformed = mows_common_rust::labels::tree_to_labels(target.clone())
                    .map_err(|e| format!("Failed to flatten at path {:?}: {}", path, e))?;
                *target = transformed;
            }
        }

        let yaml = serde_yaml::to_string(&value)
            .map_err(|e| format!("Failed to convert to YAML: {}", e))?;
        write_output(output, &yaml_with_indent(&yaml, indent))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_expand_object() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "traefik.http.routers.myapp.rule: \"Host(`example.com`)\"\ntraefik.http.routers.myapp.entrypoints: web"
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        expand_object_command(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            &None,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let tree: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify nested structure
        assert!(tree.get("traefik").is_some());
        assert!(tree["traefik"].get("http").is_some());
        assert!(tree["traefik"]["http"].get("routers").is_some());
    }

    #[test]
    fn test_flatten_object() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "traefik:\n  http:\n    routers:\n      myapp:\n        rule: \"Host(`example.com`)\"\n        entrypoints: web"
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        flatten_object_command(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            &None,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let labels: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify flat structure
        assert!(labels.get("traefik.http.routers.myapp.rule").is_some());
        assert!(labels
            .get("traefik.http.routers.myapp.entrypoints")
            .is_some());
    }

    #[test]
    fn test_expand_object_with_arrays() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "\"items[0].name\": first\n\"items[0].value\": \"1\"\n\"items[1].name\": second"
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        expand_object_command(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            &None,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let tree: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify array structure
        assert!(tree.get("items").is_some());
        let items = tree["items"].as_sequence().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0]["name"], "first");
    }

    #[test]
    fn test_roundtrip_expand_flatten() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "traefik.http.routers.myapp.rule: \"Host(`example.com`)\"\ntraefik.http.services.myapp.port: \"8080\""
        )
        .unwrap();
        input_file.flush().unwrap();

        let tree_file = NamedTempFile::new().unwrap();
        let output_file = NamedTempFile::new().unwrap();

        // Expand to nested object
        expand_object_command(
            &Some(input_file.path().to_path_buf()),
            &Some(tree_file.path().to_path_buf()),
            &None,
        )
        .unwrap();

        // Flatten back to dot-notation
        flatten_object_command(
            &Some(tree_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            &None,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let labels: serde_yaml::Value = serde_yaml::from_str(&content).unwrap();

        // Verify all keys are present
        assert!(labels.get("traefik.http.routers.myapp.rule").is_some());
        assert!(labels.get("traefik.http.services.myapp.port").is_some());
    }
}
