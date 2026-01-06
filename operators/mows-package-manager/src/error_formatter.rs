use std::sync::atomic::{AtomicBool, Ordering};
use syntect::easy::HighlightLines;
use syntect::highlighting::{Style, ThemeSet};
use syntect::parsing::SyntaxSet;
use syntect::util::{as_24_bit_terminal_escaped, LinesWithEndings};

/// Global flag to disable colors
static NO_COLOR: AtomicBool = AtomicBool::new(false);

/// Set whether colors should be disabled globally
pub fn set_no_color(no_color: bool) {
    NO_COLOR.store(no_color, Ordering::Relaxed);
}

/// Check if we should use colors (are we in a terminal?)
pub fn should_use_colors() -> bool {
    // If --no-color flag is set, always return false
    if NO_COLOR.load(Ordering::Relaxed) {
        return false;
    }
    // Check if stderr is a TTY (that's where errors typically go)
    atty::is(atty::Stream::Stderr)
}

/// Conditionally apply color codes
pub fn color_text(text: &str, ansi_code: &str) -> String {
    if should_use_colors() {
        format!("{}{}\x1b[0m", ansi_code, text)
    } else {
        text.to_string()
    }
}

/// Get colored prefix for error messages
pub fn error_prefix() -> String {
    if should_use_colors() {
        "\x1b[1;31m✗\x1b[0m".to_string()
    } else {
        "ERROR:".to_string()
    }
}

/// Get colored label
pub fn label(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }
    if should_use_colors() {
        format!("\x1b[1m{}:\x1b[0m", text)
    } else {
        format!("{}:", text)
    }
}

/// Get hint prefix
pub fn hint_prefix() -> String {
    if should_use_colors() {
        "\x1b[1;33m💡 Hint:\x1b[0m".to_string()
    } else {
        "HINT:".to_string()
    }
}

/// Format JSON with optional syntax highlighting
pub fn format_json_highlighted(json_str: &str, show_line_numbers: bool) -> String {
    if !should_use_colors() {
        return format_plain_with_line_numbers(json_str, show_line_numbers);
    }

    let ps = SyntaxSet::load_defaults_newlines();
    let ts = ThemeSet::load_defaults();

    let syntax = ps
        .find_syntax_by_extension("json")
        .unwrap_or_else(|| ps.find_syntax_plain_text());

    let mut h = HighlightLines::new(syntax, &ts.themes["base16-ocean.dark"]);

    let mut output = String::new();

    for (line_num, line) in LinesWithEndings::from(json_str).enumerate() {
        let ranges: Vec<(Style, &str)> = h.highlight_line(line, &ps).unwrap_or_default();
        if show_line_numbers {
            output.push_str(&format!("{:4} │ ", line_num + 1));
        }
        let escaped = as_24_bit_terminal_escaped(&ranges[..], false);
        output.push_str(&escaped);
    }

    output
}

/// Format text with line numbers (no colors)
fn format_plain_with_line_numbers(text: &str, show_line_numbers: bool) -> String {
    if !show_line_numbers {
        return text.to_string();
    }

    text.lines()
        .enumerate()
        .map(|(i, line)| format!("  {:4} │ {}", i + 1, line))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Format YAML string with optional syntax highlighting and line numbers
pub fn format_yaml_highlighted(yaml_str: &str, show_line_numbers: bool) -> String {
    if !should_use_colors() {
        return format_plain_with_line_numbers(yaml_str, show_line_numbers);
    }

    let ps = SyntaxSet::load_defaults_newlines();
    let ts = ThemeSet::load_defaults();

    let syntax = ps
        .find_syntax_by_extension("yaml")
        .unwrap_or_else(|| ps.find_syntax_plain_text());

    let mut h = HighlightLines::new(syntax, &ts.themes["base16-ocean.dark"]);

    let mut output = String::new();

    for (line_num, line) in LinesWithEndings::from(yaml_str).enumerate() {
        let ranges: Vec<(Style, &str)> = h.highlight_line(line, &ps).unwrap_or_default();
        if show_line_numbers {
            output.push_str(&format!("  {:4} │ ", line_num + 1));
        }
        let escaped = as_24_bit_terminal_escaped(&ranges[..], false);
        output.push_str(&escaped);
    }

    output
}

/// Format YAML with specific error line highlighted
pub fn format_yaml_with_error_line(
    yaml_str: &str,
    error_line: usize,
    error_message: &str,
) -> String {
    let use_colors = should_use_colors();
    let lines: Vec<&str> = yaml_str.lines().collect();

    // Show context: 3 lines before and after the error
    let start = error_line.saturating_sub(4).max(0);
    let end = (error_line + 3).min(lines.len());

    if !use_colors {
        // Plain text version
        let mut output = String::new();
        for line_num in start..end {
            let line = lines.get(line_num).unwrap_or(&"");
            let is_error_line = line_num == error_line - 1;

            if is_error_line {
                output.push_str(&format!(
                    "  {:4} │ {}  ← {}\n",
                    line_num + 1,
                    line,
                    error_message
                ));
            } else {
                output.push_str(&format!("  {:4} │ {}\n", line_num + 1, line));
            }
        }
        return output;
    }

    // Colored version
    let ps = SyntaxSet::load_defaults_newlines();
    let ts = ThemeSet::load_defaults();

    let syntax = ps
        .find_syntax_by_extension("yaml")
        .unwrap_or_else(|| ps.find_syntax_plain_text());

    let mut h = HighlightLines::new(syntax, &ts.themes["base16-ocean.dark"]);

    let mut output = String::new();

    for line_num in start..end {
        let line = lines.get(line_num).unwrap_or(&"");
        let line_with_newline = format!("{}\n", line);
        let ranges: Vec<(Style, &str)> = h
            .highlight_line(&line_with_newline, &ps)
            .unwrap_or_default();

        let is_error_line = line_num == error_line - 1;
        let line_num_str = format!("{:4}", line_num + 1);

        // Print line number and bar without background
        output.push_str(&format!("  {} │ ", line_num_str));

        if is_error_line {
            // Apply dim red background highlight only to the code content (dark red)
            output.push_str("\x1b[48;2;60;20;20m"); // RGB: very dark red background
        }

        let escaped = as_24_bit_terminal_escaped(&ranges[..], false);
        // Remove the newline from the escaped string
        let escaped_trimmed = escaped.trim_end();
        output.push_str(escaped_trimmed);

        // Add padding spaces with background if it's an error line (to extend background to edge)
        if is_error_line {
            output.push_str("  "); // Extra spaces with background before resetting
            output.push_str("\x1b[0m"); // Reset
                                        // Add error message to the right with some padding
            output.push_str(&format!("\x1b[1;31m ← {}\x1b[0m", error_message));
        }

        output.push('\n');
    }

    output
}

/// Extract line number from serde error message
pub fn extract_line_number_from_error(error: &str) -> Option<usize> {
    // Try to extract line number from common error patterns
    // Example: "invalid type: map, expected a string at line 5 column 10"
    let patterns = [
        regex::Regex::new(r"at line (\d+)").ok()?,
        regex::Regex::new(r"line (\d+)").ok()?,
        regex::Regex::new(r":(\d+):").ok()?,
    ];

    for pattern in &patterns {
        if let Some(captures) = pattern.captures(error) {
            if let Some(line_match) = captures.get(1) {
                if let Ok(line_num) = line_match.as_str().parse::<usize>() {
                    return Some(line_num);
                }
            }
        }
    }

    None
}

/// Extract field path from Kubernetes error messages
/// Examples:
/// - ".spec.replicas: expected numeric" -> ["spec", "replicas"]
/// - "failed to create typed patch object (/name; apps/v1, Kind=Deployment): .spec.template.spec.containers[0].name: invalid" -> ["spec", "template", "spec", "containers", "name"]
pub fn extract_field_path_from_error(error_message: &str) -> Option<Vec<String>> {
    // Try to find patterns like: .field.path: error message
    // or: .field.path[index]: error message
    if let Some(field_start) = error_message.find("): .") {
        // Pattern: "...): .spec.replicas: error"
        let after_paren = &error_message[field_start + 3..];
        if let Some(colon_pos) = after_paren.find(':') {
            let field_path = &after_paren[..colon_pos];
            return Some(parse_field_path(field_path));
        }
    } else if let Some(dot_pos) = error_message.find(": .") {
        // Pattern: "error: .spec.replicas: message"
        let after_dot = &error_message[dot_pos + 3..];
        if let Some(colon_pos) = after_dot.find(':') {
            let field_path = &after_dot[..colon_pos];
            return Some(parse_field_path(field_path));
        }
    }

    None
}

/// Parse field path string into components
/// ".spec.replicas" -> ["spec", "replicas"]
/// ".spec.template.spec.containers[0].name" -> ["spec", "template", "spec", "containers", "name"]
fn parse_field_path(path: &str) -> Vec<String> {
    path.trim_start_matches('.')
        .split('.')
        .map(|part| {
            // Remove array indices like [0] from the field name
            if let Some(bracket_pos) = part.find('[') {
                part[..bracket_pos].to_string()
            } else {
                part.to_string()
            }
        })
        .filter(|s| !s.is_empty())
        .collect()
}

/// Find the line number of a field path in YAML
/// Example: ["spec", "replicas"] would find the line with "replicas:" under "spec:"
pub fn find_field_path_in_yaml(yaml_str: &str, field_path: &[String]) -> Option<usize> {
    if field_path.is_empty() {
        return None;
    }

    let lines: Vec<&str> = yaml_str.lines().collect();
    let mut current_path: Vec<String> = Vec::new();
    let mut indent_stack: Vec<usize> = Vec::new();

    for (line_num, line) in lines.iter().enumerate() {
        let trimmed = line.trim_start();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        // Calculate indentation
        let indent = line.len() - trimmed.len();

        // Pop from stack if we've dedented
        while !indent_stack.is_empty() && indent <= *indent_stack.last().unwrap() {
            indent_stack.pop();
            if !current_path.is_empty() {
                current_path.pop();
            }
        }

        // Check if this is a key line (has a colon)
        if let Some(colon_pos) = trimmed.find(':') {
            let key = trimmed[..colon_pos].trim();

            // Push current field to path
            current_path.push(key.to_string());
            indent_stack.push(indent);

            // Check if we match the target path
            if current_path.len() == field_path.len() {
                let matches = current_path.iter()
                    .zip(field_path.iter())
                    .all(|(a, b)| a == b);

                if matches {
                    return Some(line_num + 1);
                }
            }
        }
    }

    None
}

/// Try to find the problematic field in YAML and return its line number
pub fn find_field_in_yaml(yaml_str: &str, field_hint: &str) -> Option<usize> {
    // First try to extract field path from error message
    if let Some(field_path) = extract_field_path_from_error(field_hint) {
        if let Some(line_num) = find_field_path_in_yaml(yaml_str, &field_path) {
            return Some(line_num);
        }
    }

    // Fallback: Common problematic patterns in Kubernetes YAML
    let problematic_patterns = [
        "annotations:", // Often misplaced
        "labels:",
        "metadata:",
    ];

    for (line_num, line) in yaml_str.lines().enumerate() {
        let trimmed = line.trim_start();

        // Check if this line might be the problem
        for pattern in &problematic_patterns {
            if trimmed.starts_with(pattern) {
                // If annotations is under labels (common mistake), flag it
                if pattern == &"annotations:" && field_hint.contains("map") {
                    // Look at previous lines to see if we're nested under labels
                    if line_num > 0 {
                        let prev_lines: Vec<&str> = yaml_str.lines().take(line_num).collect();
                        for prev_line in prev_lines.iter().rev().take(5) {
                            if prev_line.trim().starts_with("labels:") {
                                return Some(line_num + 1);
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_line_number() {
        assert_eq!(
            extract_line_number_from_error("error at line 42 column 10"),
            Some(42)
        );
        assert_eq!(
            extract_line_number_from_error("foo.yaml:15: invalid syntax"),
            Some(15)
        );
    }

    #[test]
    fn test_extract_field_path_from_error() {
        // Test Kubernetes API error format
        let error1 = "failed to create typed patch object (/pektin-api; apps/v1, Kind=Deployment): .spec.replicas: expected numeric (int or float), got string";
        assert_eq!(
            extract_field_path_from_error(error1),
            Some(vec!["spec".to_string(), "replicas".to_string()])
        );

        // Test with array indices
        let error2 = "): .spec.template.spec.containers[0].name: invalid value";
        assert_eq!(
            extract_field_path_from_error(error2),
            Some(vec![
                "spec".to_string(),
                "template".to_string(),
                "spec".to_string(),
                "containers".to_string(),
                "name".to_string()
            ])
        );

        // Test simple format
        let error3 = "error: .metadata.name: required field is missing";
        assert_eq!(
            extract_field_path_from_error(error3),
            Some(vec!["metadata".to_string(), "name".to_string()])
        );
    }

    #[test]
    fn test_find_field_path_in_yaml() {
        let yaml = r#"apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  replicas: '1'
  selector:
    matchLabels:
      app: test"#;

        // Test finding spec.replicas
        let path = vec!["spec".to_string(), "replicas".to_string()];
        assert_eq!(find_field_path_in_yaml(yaml, &path), Some(6));

        // Test finding metadata.name
        let path = vec!["metadata".to_string(), "name".to_string()];
        assert_eq!(find_field_path_in_yaml(yaml, &path), Some(4));

        // Test finding nested field
        let path = vec!["spec".to_string(), "selector".to_string(), "matchLabels".to_string()];
        assert_eq!(find_field_path_in_yaml(yaml, &path), Some(8));
    }

    #[test]
    fn test_find_field_in_yaml_with_real_error() {
        let yaml = r#"apiVersion: apps/v1
kind: Deployment
metadata:
  name: pektin-api
spec:
  replicas: '1'
  selector:
    matchLabels:
      app: pektin-api"#;

        let error = "failed to create typed patch object (/pektin-api; apps/v1, Kind=Deployment): .spec.replicas: expected numeric (int or float), got string";

        assert_eq!(find_field_in_yaml(yaml, error), Some(6));
    }
}
