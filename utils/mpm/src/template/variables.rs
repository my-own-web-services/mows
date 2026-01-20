use crate::utils::format_yaml_error;
use gtmpl_ng::helm_functions::serde_json_value_to_gtmpl_value;
use gtmpl_ng::{self as gtmpl};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, trace};

/// Parse a variable argument in the format "name:path"
pub fn parse_variable_arg(arg: &str) -> Result<(String, PathBuf), String> {
    let parts: Vec<&str> = arg.splitn(2, ':').collect();
    if parts.len() != 2 {
        return Err(format!(
            "Invalid variable format '{}': expected 'name:path'",
            arg
        ));
    }
    let name = parts[0].to_string();
    let path = PathBuf::from(parts[1]);

    if name.is_empty() {
        return Err(format!("Variable name cannot be empty in '{}'", arg));
    }

    Ok((name, path))
}

/// Parse a .env file into a HashMap
pub fn parse_env_file(content: &str) -> HashMap<String, gtmpl::Value> {
    let mut map = HashMap::new();
    for line in content.lines() {
        let line = line.trim();
        // Skip empty lines and comments
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            // Remove surrounding quotes if present
            let value = value.trim();
            let value = if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value[1..value.len() - 1].to_string()
            } else {
                value.to_string()
            };
            map.insert(key, gtmpl::Value::String(value));
        }
    }
    map
}

/// Load a single variable file (JSON, YAML, or .env)
pub fn load_variable_file(path: &Path) -> Result<gtmpl::Value, String> {
    debug!("Loading variable file: {}", path.display());
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read variable file '{}': {}", path.display(), e))?;

    // Check file extension for .env files
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");

    // Match both "*.env" extension and ".env" filename (dotfiles)
    if extension == "env" || filename == ".env" || filename.starts_with(".env.") {
        trace!("Parsing as .env file");
        let map = parse_env_file(&content);
        return Ok(gtmpl::Value::Object(map));
    }

    // Try JSON first, then YAML
    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&content) {
        trace!("Parsed as JSON");
        Ok(serde_json_value_to_gtmpl_value(json_value))
    } else {
        // Try YAML with proper error formatting
        match serde_yaml_neo::from_str::<serde_yaml_neo::Value>(&content) {
            Ok(yaml_value) => {
                trace!("Parsed as YAML");
                // Convert YAML to JSON first, then to gtmpl Value
                // This works because JSON is a subset of YAML
                let json_value: serde_json::Value = serde_json::to_value(&yaml_value)
                    .map_err(|e| format!("Failed to convert YAML to JSON: {}", e))?;
                Ok(serde_json_value_to_gtmpl_value(json_value))
            }
            Err(yaml_err) => Err(format_yaml_error(&content, Some(path), &yaml_err))
        }
    }
}

/// Find a default values file in the given directory
/// Checks for values.yml, values.yaml, values.json in order
pub fn find_values_file(dir: &Path) -> Option<PathBuf> {
    let candidates = ["values.yml", "values.yaml", "values.json"];
    for name in candidates {
        let path = dir.join(name);
        if path.is_file() {
            return Some(path);
        }
    }
    None
}

/// Load the default values file and merge with explicit variable args
/// Default values are loaded at root level (like .Abc), explicit variables are nested
pub fn load_variables_with_defaults(
    input_path: &Path,
    variable_args: &[String],
) -> Result<gtmpl::Value, String> {
    let mut root: HashMap<String, gtmpl::Value> = HashMap::new();

    // Look for values file in multiple locations (in order of priority):
    // 1. Current working directory
    // 2. Input directory (or parent if input is a file)
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let input_dir = if input_path.is_file() {
        input_path.parent().unwrap_or(Path::new("."))
    } else {
        input_path
    };

    let values_path = find_values_file(&cwd).or_else(|| {
        // Only check input_dir if it's different from cwd
        if input_dir != cwd {
            find_values_file(input_dir)
        } else {
            None
        }
    });

    // Look for default values file (values.yml, values.yaml, values.json)
    if let Some(values_path) = values_path {
        debug!("Found default values file: {}", values_path.display());
        let values = load_variable_file(&values_path)?;

        // Merge values at root level
        if let gtmpl::Value::Object(map) = values {
            for (k, v) in map {
                root.insert(k, v);
            }
        }
    } else {
        trace!("No default values file found");
    }

    // Load explicit variable arguments (these are nested under their name)
    for arg in variable_args {
        let (name, path) = parse_variable_arg(arg)?;
        debug!("Loading variable '{}' from: {}", name, path.display());

        let value = load_variable_file(&path)?;
        root.insert(name, value);
    }

    Ok(gtmpl::Value::Object(root))
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::{tempdir, NamedTempFile};

    // Helper to load variables without a values file
    fn load_variables_only(args: &[String]) -> Result<gtmpl::Value, String> {
        load_variables_with_defaults(Path::new("/nonexistent"), args)
    }

    #[test]
    fn test_load_variables_json() {
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, r#"{{"name": "test", "count": 42}}"#).unwrap();
        temp_file.flush().unwrap();

        let arg = format!("config:{}", temp_file.path().display());
        let variables = load_variables_only(&[arg]).unwrap();

        // Verify variables were loaded under the "config" key
        match variables {
            gtmpl::Value::Object(map) => {
                assert!(map.contains_key("config"));
                if let Some(gtmpl::Value::Object(config)) = map.get("config") {
                    assert!(config.contains_key("name"));
                    assert!(config.contains_key("count"));
                } else {
                    panic!("Expected config to be an object");
                }
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_load_variables_yaml() {
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, "name: test\ncount: 42").unwrap();
        temp_file.flush().unwrap();

        let arg = format!("data:{}", temp_file.path().display());
        let variables = load_variables_only(&[arg]).unwrap();

        // Verify variables were loaded under the "data" key
        match variables {
            gtmpl::Value::Object(map) => {
                assert!(map.contains_key("data"));
                if let Some(gtmpl::Value::Object(data)) = map.get("data") {
                    assert!(data.contains_key("name"));
                    assert!(data.contains_key("count"));
                } else {
                    panic!("Expected data to be an object");
                }
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_load_variables_env() {
        let mut temp_file = tempfile::Builder::new()
            .suffix(".env")
            .tempfile()
            .unwrap();
        write!(
            temp_file,
            "API_KEY=secret123\nDEBUG=true\n# comment\nQUOTED=\"hello world\""
        )
        .unwrap();
        temp_file.flush().unwrap();

        let arg = format!("secrets:{}", temp_file.path().display());
        let variables = load_variables_only(&[arg]).unwrap();

        match variables {
            gtmpl::Value::Object(map) => {
                assert!(map.contains_key("secrets"));
                if let Some(gtmpl::Value::Object(secrets)) = map.get("secrets") {
                    assert_eq!(
                        secrets.get("API_KEY"),
                        Some(&gtmpl::Value::String("secret123".to_string()))
                    );
                    assert_eq!(
                        secrets.get("DEBUG"),
                        Some(&gtmpl::Value::String("true".to_string()))
                    );
                    assert_eq!(
                        secrets.get("QUOTED"),
                        Some(&gtmpl::Value::String("hello world".to_string()))
                    );
                } else {
                    panic!("Expected secrets to be an object");
                }
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_load_multiple_variables() {
        let mut config_file = NamedTempFile::new().unwrap();
        write!(config_file, r#"{{"host": "localhost"}}"#).unwrap();
        config_file.flush().unwrap();

        let mut data_file = NamedTempFile::new().unwrap();
        write!(data_file, "name: test").unwrap();
        data_file.flush().unwrap();

        let args = vec![
            format!("config:{}", config_file.path().display()),
            format!("data:{}", data_file.path().display()),
        ];
        let variables = load_variables_only(&args).unwrap();

        match variables {
            gtmpl::Value::Object(map) => {
                assert!(map.contains_key("config"));
                assert!(map.contains_key("data"));
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_load_values_file() {
        let dir = tempdir().unwrap();
        let values_path = dir.path().join("values.yaml");
        std::fs::write(&values_path, "hostname: example.com\nport: 8080").unwrap();

        let variables = load_variables_with_defaults(dir.path(), &[]).unwrap();

        match variables {
            gtmpl::Value::Object(map) => {
                assert_eq!(
                    map.get("hostname"),
                    Some(&gtmpl::Value::String("example.com".to_string()))
                );
                assert_eq!(map.get("port"), Some(&gtmpl::Value::from(8080)));
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_load_values_file_with_explicit_vars() {
        let dir = tempdir().unwrap();
        let values_path = dir.path().join("values.yml");
        std::fs::write(&values_path, "hostname: example.com").unwrap();

        let mut extra_file = NamedTempFile::new().unwrap();
        write!(extra_file, "name: my-service").unwrap();
        extra_file.flush().unwrap();

        let args = vec![format!("extra:{}", extra_file.path().display())];
        let variables = load_variables_with_defaults(dir.path(), &args).unwrap();

        match variables {
            gtmpl::Value::Object(map) => {
                // Values file at root
                assert_eq!(
                    map.get("hostname"),
                    Some(&gtmpl::Value::String("example.com".to_string()))
                );
                // Explicit variable nested
                assert!(map.contains_key("extra"));
            }
            _ => panic!("Expected object"),
        }
    }
}
