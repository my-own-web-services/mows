use std::path::Path;
use tracing::debug;

use crate::error::{MpmError, Result};
use crate::utils::{parse_yaml, read_input, write_output};

pub fn json_to_yaml(input: Option<&Path>, output: Option<&Path>) -> Result<()> {
    debug!("Converting JSON to YAML");
    let content = read_input(input)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(MpmError::JsonParse)?;
    let yaml = serde_yaml_neo::to_string_with_indent(&value, 4)?;
    write_output(output, &yaml)
}

pub fn yaml_to_json(input: Option<&Path>, output: Option<&Path>) -> Result<()> {
    debug!("Converting YAML to JSON");
    let content = read_input(input)?;
    let value: serde_yaml_neo::Value = parse_yaml(&content, input)?;
    let json = serde_json::to_string_pretty(&value).map_err(MpmError::JsonSerialize)?;
    write_output(output, &json)
}

pub fn prettify_json(input: Option<&Path>, output: Option<&Path>) -> Result<()> {
    debug!("Prettifying JSON");
    let content = read_input(input)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(MpmError::JsonParse)?;
    let json = serde_json::to_string_pretty(&value).map_err(MpmError::JsonSerialize)?;
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

        json_to_yaml(Some(input_file.path()), Some(output_file.path())).unwrap();

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

        yaml_to_json(Some(input_file.path()), Some(output_file.path())).unwrap();

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

        prettify_json(Some(input_file.path()), Some(output_file.path())).unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        // Should be pretty-printed with indentation
        assert!(content.contains("  \"key\""));
        assert!(content.contains("  \"number\""));
    }
}
