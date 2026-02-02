/// Check if a YAML value looks like a Docker Compose file
pub fn is_docker_compose(value: &serde_yaml_neo::Value) -> bool {
    if let serde_yaml_neo::Value::Mapping(map) = value {
        // Docker Compose files typically have "services" and optionally "version"
        map.contains_key(&serde_yaml_neo::Value::String("services".to_string()))
    } else {
        false
    }
}

/// Match a path pattern with glob support against a concrete path
/// Pattern segments can be "*" to match any single segment
pub fn path_matches_pattern(pattern: &[&str], path: &[String]) -> bool {
    if pattern.len() != path.len() {
        return false;
    }
    pattern
        .iter()
        .zip(path.iter())
        .all(|(pat, seg)| *pat == "*" || *pat == seg)
}

/// Find all paths in the YAML value that match the given pattern
pub fn find_matching_paths(value: &serde_yaml_neo::Value, pattern: &[&str]) -> Vec<Vec<String>> {
    let mut results = Vec::new();
    find_matching_paths_recursive(value, pattern, &mut Vec::new(), &mut results);
    results
}

fn find_matching_paths_recursive(
    value: &serde_yaml_neo::Value,
    pattern: &[&str],
    current_path: &mut Vec<String>,
    results: &mut Vec<Vec<String>>,
) {
    if current_path.len() == pattern.len() {
        if path_matches_pattern(pattern, current_path) {
            results.push(current_path.clone());
        }
        return;
    }

    if let serde_yaml_neo::Value::Mapping(map) = value {
        let pattern_segment = pattern.get(current_path.len()).unwrap_or(&"");
        for (key, child) in map {
            if let serde_yaml_neo::Value::String(key_str) = key {
                if *pattern_segment == "*" || *pattern_segment == key_str {
                    current_path.push(key_str.clone());
                    if current_path.len() == pattern.len() {
                        results.push(current_path.clone());
                    } else {
                        find_matching_paths_recursive(child, pattern, current_path, results);
                    }
                    current_path.pop();
                }
            }
        }
    }
}

/// Get a mutable reference to a nested value by path
pub fn get_value_at_path_mut<'a>(
    value: &'a mut serde_yaml_neo::Value,
    path: &[String],
) -> Option<&'a mut serde_yaml_neo::Value> {
    let mut current = value;
    for segment in path {
        if let serde_yaml_neo::Value::Mapping(map) = current {
            current = map.get_mut(&serde_yaml_neo::Value::String(segment.clone()))?;
        } else {
            return None;
        }
    }
    Some(current)
}
