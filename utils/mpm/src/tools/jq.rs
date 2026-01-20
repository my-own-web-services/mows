use std::path::PathBuf;
use tracing::debug;

use crate::error::{MpmError, Result};
use crate::utils::{parse_yaml, read_input, write_output, yaml_to_4_space_indent};

pub fn jq_command(
    query: &str,
    input: &Option<PathBuf>,
    output: &Option<PathBuf>,
    yaml_output: bool,
) -> Result<()> {
    use jaq_interpret::{Ctx, FilterT, RcIter, Val};

    debug!("Running jq query: {}", query);
    let content = read_input(input)?;

    // Try to parse as JSON first, then YAML
    let input_value: serde_json::Value = if let Ok(json) = serde_json::from_str(&content) {
        json
    } else {
        let yaml: serde_yaml_neo::Value = parse_yaml(&content, input.as_deref())?;
        serde_json::to_value(&yaml).map_err(MpmError::JsonSerialize)?
    };

    // Parse the jq filter
    let (main, errs) = jaq_parse::parse(query, jaq_parse::main());
    if !errs.is_empty() {
        let err_msgs: Vec<String> = errs.iter().map(|e| format!("{:?}", e)).collect();
        return Err(MpmError::Jq(format!("Failed to parse query: {}", err_msgs.join(", "))));
    }
    let main = main.ok_or_else(|| MpmError::Jq("Failed to parse query".to_string()))?;

    // Create filter context (starts with core filters only)
    let mut arena = jaq_interpret::ParseCtx::new(Vec::new());
    let filter = arena.compile(main);

    if !arena.errs.is_empty() {
        let err_msgs: Vec<String> = arena.errs.iter().map(|e| format!("{}", e.0)).collect();
        return Err(MpmError::Jq(format!(
            "Failed to compile query: {}",
            err_msgs.join(", ")
        )));
    }

    // Convert JSON to Val (jaq Val has From<serde_json::Value> impl)
    let input_val = Val::from(input_value.clone());

    // Run the filter
    let inputs = RcIter::new(core::iter::empty());
    let ctx = Ctx::new([], &inputs);

    let results: Vec<Val> = filter
        .run((ctx, input_val))
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|e| MpmError::Jq(format!("query error: {}", e)))?;

    // Format output
    let output_str = if results.len() == 1 {
        let result_json: serde_json::Value = results[0].clone().into();

        if yaml_output {
            let yaml = serde_yaml_neo::to_string(&result_json)?;
            yaml_to_4_space_indent(&yaml)
        } else {
            serde_json::to_string_pretty(&result_json).map_err(MpmError::JsonSerialize)?
        }
    } else {
        let results_json: Vec<serde_json::Value> =
            results.iter().map(|v| v.clone().into()).collect();

        if yaml_output {
            let yaml = serde_yaml_neo::to_string(&results_json)?;
            yaml_to_4_space_indent(&yaml)
        } else {
            results_json
                .iter()
                .map(|v| serde_json::to_string(v).unwrap())
                .collect::<Vec<_>>()
                .join("\n")
        }
    };

    write_output(output, &output_str)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_jq_simple_query() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"name": "test", "value": 42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".name",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            false,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("\"test\""));
    }

    // TODO: Re-enable when standard library support is added
    // Currently only core filters are available, not stdlib functions like select()
    #[test]
    #[ignore]
    fn test_jq_filter() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(
            input_file,
            r#"{{"items": [{{"name": "a", "value": 1}}, {{"name": "b", "value": 2}}]}}"#
        )
        .unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".items[] | select(.value > 1)",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            false,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("\"b\""));
        assert!(!content.contains("\"a\""));
    }

    #[test]
    fn test_jq_yaml_input() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, "name: test\nvalue: 42").unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".name",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            false,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("\"test\""));
    }

    #[test]
    fn test_jq_yaml_output() {
        let mut input_file = NamedTempFile::new().unwrap();
        write!(input_file, r#"{{"name": "test", "value": 42}}"#).unwrap();
        input_file.flush().unwrap();

        let output_file = NamedTempFile::new().unwrap();

        jq_command(
            ".",
            &Some(input_file.path().to_path_buf()),
            &Some(output_file.path().to_path_buf()),
            true,
        )
        .unwrap();

        let content = fs::read_to_string(output_file.path()).unwrap();
        assert!(content.contains("name: test"));
        assert!(content.contains("value: 42"));
    }
}
