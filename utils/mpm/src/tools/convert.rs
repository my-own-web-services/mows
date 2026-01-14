use std::path::PathBuf;
use tracing::debug;

use crate::utils::{parse_yaml, read_input, write_output, yaml_to_4_space_indent};

pub fn json_to_yaml(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    debug!("Converting JSON to YAML");
    let content = read_input(input)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;
    let yaml =
        serde_yaml::to_string(&value).map_err(|e| format!("Failed to convert to YAML: {}", e))?;
    write_output(output, &yaml_to_4_space_indent(&yaml))
}

pub fn yaml_to_json(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    debug!("Converting YAML to JSON");
    let content = read_input(input)?;
    let value: serde_yaml::Value = parse_yaml(&content, input.as_deref())?;
    let json = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to convert to JSON: {}", e))?;
    write_output(output, &json)
}

pub fn prettify_json(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<(), String> {
    debug!("Prettifying JSON");
    let content = read_input(input)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse JSON: {}", e))?;
    let json = serde_json::to_string_pretty(&value)
        .map_err(|e| format!("Failed to prettify JSON: {}", e))?;
    write_output(output, &json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_json_to_yaml() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"key": "value", "number": 42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("key: value"));
        assert!(content.contains("number: 42"));
    }

    #[test]
    fn test_yaml_to_json() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "key: value\nnumber: 42").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        yaml_to_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(json["key"], "value");
        assert_eq!(json["number"], 42);
    }

    #[test]
    fn test_prettify_json() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"key":"value","number":42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        prettify_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        // Should be pretty-printed with indentation
        assert!(content.contains("  \"key\""));
        assert!(content.contains("  \"number\""));
    }
}
