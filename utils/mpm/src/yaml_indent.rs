//! YAML indentation utilities.
//!
//! Provides functions to detect YAML indentation levels.

/// Detect indentation size from YAML content.
///
/// Looks for the first indented line and returns the number of spaces used.
/// Returns None if no indentation is detected.
pub fn detect_yaml_indent(content: &str) -> Option<usize> {
    for line in content.lines() {
        let trimmed = line.trim_start_matches(' ');
        let indent = line.len() - trimmed.len();
        // Only count lines that have actual content (not empty/whitespace-only)
        // and have some indentation
        if indent > 0 && !trimmed.is_empty() && !trimmed.starts_with('#') {
            return Some(indent);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_yaml_indent_4_spaces() {
        let yaml = "foo:\n    bar: baz\n    qux: quux";
        assert_eq!(detect_yaml_indent(yaml), Some(4));
    }

    #[test]
    fn test_detect_yaml_indent_2_spaces() {
        let yaml = "foo:\n  bar: baz";
        assert_eq!(detect_yaml_indent(yaml), Some(2));
    }

    #[test]
    fn test_detect_yaml_indent_no_indent() {
        let yaml = "foo: bar\nbaz: qux";
        assert_eq!(detect_yaml_indent(yaml), None);
    }

    #[test]
    fn test_detect_yaml_indent_ignores_comments() {
        let yaml = "# comment\n  # indented comment\nfoo:\n    bar: baz";
        assert_eq!(detect_yaml_indent(yaml), Some(4));
    }
}
