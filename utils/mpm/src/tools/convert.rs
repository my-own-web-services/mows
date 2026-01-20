use std::path::PathBuf;
use tracing::debug;

use crate::error::{MpmError, Result};
use crate::utils::{parse_yaml, read_input, write_output, yaml_to_4_space_indent};

pub fn json_to_yaml(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<()> {
    debug!("Converting JSON to YAML");
    let content = read_input(input)?;
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(MpmError::JsonParse)?;
    let yaml = serde_yaml_neo::to_string(&value)?;
    write_output(output, &yaml_to_4_space_indent(&yaml))
}

pub fn yaml_to_json(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<()> {
    debug!("Converting YAML to JSON");
    let content = read_input(input)?;
    let value: serde_yaml_neo::Value = parse_yaml(&content, input.as_deref())?;
    let json = serde_json::to_string_pretty(&value).map_err(MpmError::JsonSerialize)?;
    write_output(output, &json)
}

pub fn prettify_json(input: &Option<PathBuf>, output: &Option<PathBuf>) -> Result<()> {
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

    // =========================================================================
    // Input Validation Edge Cases (#61)
    // =========================================================================

    #[test]
    fn test_json_to_yaml_invalid_json() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "{{ invalid json }}").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_yaml_to_json_invalid_yaml() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "key: [unclosed bracket").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = yaml_to_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_prettify_json_invalid() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "not json at all").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = prettify_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_json_to_yaml_empty_file() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        // Empty file is not valid JSON
        assert!(result.is_err());
    }

    #[test]
    fn test_yaml_to_json_empty_file() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = yaml_to_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        // Empty YAML might parse as null
        // Just ensure it doesn't panic
        let _ = result;
    }

    #[test]
    fn test_json_to_yaml_very_large_file() {
        let mut input_file = NamedTempFile::new().unwrap();
        // Create a JSON with 1000 keys
        let mut json = String::from("{");
        for i in 0..1000 {
            if i > 0 {
                json.push(',');
            }
            json.push_str(&format!("\"key_{}\": \"value_{}\"", i, i));
        }
        json.push('}');
        write!(input_file, "{}", json).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_json_to_yaml_deeply_nested() {
        let mut input_file = NamedTempFile::new().unwrap();
        // Create deeply nested JSON
        let json = r#"{"l1":{"l2":{"l3":{"l4":{"l5":{"l6":{"l7":{"l8":{"l9":{"l10":"deep"}}}}}}}}}}"#;
        write!(input_file, "{}", json).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_json_to_yaml_unicode() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"name": "日本語", "emoji": "🎉"}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("日本語") || content.contains("\\u"));
    }

    #[test]
    fn test_yaml_to_json_unicode() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "name: 日本語\nemoji: 🎉").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = yaml_to_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_json_to_yaml_special_characters() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            r#"{{"special": "!@#$%^&*()[]{{}}|\\:\";<>?,./"}}"#
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_json_to_yaml_arrays() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"items": [1, 2, 3, "four", {{"nested": true}}]}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("items:"));
    }

    #[test]
    fn test_yaml_to_json_multiline_strings() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            "text: |\n  Line 1\n  Line 2\n  Line 3\nfolded: >\n  Folded\n  text"
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = yaml_to_json(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_json_nonexistent_input() {
        let result = json_to_yaml(
            &Some(PathBuf::from("/nonexistent/path/file.json")),
            &Some(PathBuf::from("/tmp/output.yaml")),
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_yaml_nonexistent_input() {
        let result = yaml_to_json(
            &Some(PathBuf::from("/nonexistent/path/file.yaml")),
            &Some(PathBuf::from("/tmp/output.json")),
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_json_to_yaml_null_value() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"value": null}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_json_to_yaml_boolean_values() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"yes": true, "no": false}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("true") || content.contains("yes"));
        assert!(content.contains("false") || content.contains("no"));
    }

    #[test]
    fn test_json_to_yaml_numeric_types() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            r#"{{"int": 42, "float": 3.14, "neg": -100, "exp": 1e10}}"#
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();
        let result = json_to_yaml(
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
        );

        assert!(result.is_ok());
    }
}
