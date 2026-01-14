//! YAML indentation utilities.
//!
//! Provides functions to detect and convert YAML indentation levels.
//! serde_yaml always outputs 2-space indentation, so these utilities
//! allow converting to other indentation styles (e.g., 4-space).

/// Detect indentation size from YAML content.
///
/// Looks for the first indented line and returns the number of spaces used.
/// Returns None if no indentation is detected.
///
/// # Example
/// ```
/// use mpm::yaml_indent::detect_yaml_indent;
///
/// let yaml = "foo:\n    bar: baz";
/// assert_eq!(detect_yaml_indent(yaml), Some(4));
/// ```
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

/// Convert serde_yaml's 2-space indentation to a target indentation.
///
/// serde_yaml always outputs 2-space indentation, so we post-process the output.
/// Handles YAML arrays correctly by preserving relative indentation of list item properties.
///
/// # Arguments
/// * `yaml` - YAML content with 2-space indentation
/// * `target_indent` - Target number of spaces per indentation level
///
/// # Example
/// ```
/// use mpm::yaml_indent::yaml_with_indent;
///
/// let yaml = "foo:\n  bar: baz";
/// let result = yaml_with_indent(yaml, 4);
/// assert_eq!(result, "foo:\n    bar: baz");
/// ```
pub fn yaml_with_indent(yaml: &str, target_indent: usize) -> String {
    if target_indent == 2 {
        return yaml.to_string();
    }

    let lines: Vec<&str> = yaml.lines().collect();
    let mut result = Vec::new();

    // Track list contexts: maps original list item indent to new indent
    // Also tracks continuation indent for properties within list items
    // Format: (orig_list_indent, new_list_indent, orig_cont_indent, new_cont_indent)
    let mut list_contexts: Vec<(usize, usize, usize, usize)> = Vec::new();

    // Track pending list from a block key (key:\n- item)
    let mut pending_block_indent: Option<usize> = None;

    for line in lines.iter() {
        let leading_spaces = line.len() - line.trim_start_matches(' ').len();
        let trimmed = line.trim_start();

        // Check if this line ends with : (block value follows)
        let ends_with_block = trimmed.ends_with(':') && !trimmed.contains(": ");

        // Clean up list contexts - remove entries where we've moved to a shallower level
        list_contexts.retain(|(orig_list, _, _, _)| *orig_list <= leading_spaces);

        if trimmed.starts_with("- ") {
            // This is a list item
            let new_indent = if let Some(base_indent) = pending_block_indent {
                // First item after a block key - use the pending indent
                // Also register this list context for subsequent items
                list_contexts.push((
                    leading_spaces,     // original list item indent
                    base_indent,        // new list item indent
                    leading_spaces + 2, // original continuation indent
                    base_indent + 2,    // new continuation indent
                ));
                pending_block_indent = None;
                base_indent
            } else if let Some((_, new_list, _, _)) = list_contexts
                .iter()
                .find(|(orig_list, _, _, _)| *orig_list == leading_spaces)
            {
                // Subsequent item in an existing list context
                *new_list
            } else {
                // List item without context - convert normally
                (leading_spaces / 2) * target_indent
            };

            let new_line = format!("{}{}", " ".repeat(new_indent), trimmed);
            result.push(new_line);
        } else if leading_spaces > 0 {
            pending_block_indent = None;

            // Check if this line is a list item continuation
            if let Some((_, _, _, new_cont)) = list_contexts
                .iter()
                .find(|(_, _, orig_cont, _)| *orig_cont == leading_spaces)
            {
                // This is a continuation of a list item - use the mapped indent
                let new_line = format!("{}{}", " ".repeat(*new_cont), trimmed);
                result.push(new_line);
            } else {
                // Regular indented line - convert normally
                let levels = leading_spaces / 2;
                let new_line = format!("{}{}", " ".repeat(levels * target_indent), trimmed);
                result.push(new_line);
            }
        } else {
            // No leading spaces
            if ends_with_block {
                // This key has a block value, next content should be indented
                pending_block_indent = Some(target_indent);
            } else {
                pending_block_indent = None;
            }
            result.push(line.to_string());
        }
    }

    result.join("\n")
}

/// Convert serde_yaml's 2-space indentation to 4-space indentation.
///
/// Convenience wrapper for [`yaml_with_indent`] with default 4 spaces.
///
/// # Example
/// ```
/// use mpm::yaml_indent::yaml_to_4_space_indent;
///
/// let yaml = "foo:\n  bar: baz";
/// let result = yaml_to_4_space_indent(yaml);
/// assert_eq!(result, "foo:\n    bar: baz");
/// ```
pub fn yaml_to_4_space_indent(yaml: &str) -> String {
    yaml_with_indent(yaml, 4)
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

    #[test]
    fn test_yaml_with_indent_2_to_4() {
        let yaml = "foo:\n  bar: baz\n  nested:\n    deep: value";
        let expected = "foo:\n    bar: baz\n    nested:\n        deep: value";
        assert_eq!(yaml_with_indent(yaml, 4), expected);
    }

    #[test]
    fn test_yaml_with_indent_2_to_2() {
        let yaml = "foo:\n  bar: baz";
        assert_eq!(yaml_with_indent(yaml, 2), yaml);
    }

    #[test]
    fn test_yaml_to_4_space_indent() {
        let yaml = "foo:\n  bar:\n    baz: qux";
        let expected = "foo:\n    bar:\n        baz: qux";
        assert_eq!(yaml_to_4_space_indent(yaml), expected);
    }

    #[test]
    fn test_yaml_with_indent_handles_lists() {
        let yaml = "items:\n  - name: first\n    value: 1\n  - name: second";
        let expected = "items:\n    - name: first\n      value: 1\n    - name: second";
        assert_eq!(yaml_with_indent(yaml, 4), expected);
    }

    #[test]
    fn test_yaml_with_indent_nested_lists() {
        let yaml = "outer:\n  inner:\n    - item1\n    - item2";
        let expected = "outer:\n    inner:\n        - item1\n        - item2";
        assert_eq!(yaml_with_indent(yaml, 4), expected);
    }

    #[test]
    fn test_yaml_with_indent_preserves_empty_lines() {
        let yaml = "foo:\n  bar: baz\n\n  qux: quux";
        let expected = "foo:\n    bar: baz\n\n    qux: quux";
        assert_eq!(yaml_with_indent(yaml, 4), expected);
    }
}
