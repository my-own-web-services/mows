//! Template error formatting.

use gtmpl_ng::all_functions::all_functions;
use gtmpl_ng::{ExecError, TemplateError, Value};
use colored::Colorize;
use mows_common_rust::error_display::format_file_error;
use std::path::Path;
use strsim::levenshtein;

/// Extract all field names from a gtmpl Value (recursively collects nested field paths and leaf names)
fn collect_field_names(value: &Value, prefix: &str, fields: &mut Vec<String>) {
    if let Value::Object(map) = value {
        for (key, val) in map {
            // Add the leaf name (just the key itself)
            if !fields.contains(key) {
                fields.push(key.clone());
            }
            // Add the full path
            let full_path = if prefix.is_empty() {
                key.clone()
            } else {
                format!("{}.{}", prefix, key)
            };
            if !fields.contains(&full_path) {
                fields.push(full_path.clone());
            }
            // Recurse into nested objects
            collect_field_names(val, &full_path, fields);
        }
    }
}

/// Find the best matching field name for a missing field
fn find_similar_field(missing: &str, available: &[String]) -> Option<String> {
    // Extract just the last component if it's a path like ".foo.bar"
    let missing_clean = missing.trim_start_matches('.');

    let mut best_match: Option<(&str, usize)> = None;

    for field in available {
        let dist = levenshtein(missing_clean, field);
        // Only suggest if distance is reasonable (at most half the length + 2)
        let max_dist = (missing_clean.len() / 2).max(2);
        if dist <= max_dist && best_match.map_or(true, |(_, d)| dist < d) {
            best_match = Some((field, dist));
        }
    }

    best_match.map(|(s, _)| s.to_string())
}

/// Find the position of a field access pattern (e.g., ".data") ensuring it's not
/// part of a larger identifier (e.g., ".database"). Returns the position of the dot.
fn find_field_access(haystack: &str, pattern: &str) -> Option<usize> {
    let mut start = 0;
    while let Some(pos) = haystack[start..].find(pattern) {
        let absolute_pos = start + pos;
        let end_pos = absolute_pos + pattern.len();
        // Check that the character after the pattern (if any) is not alphanumeric or underscore
        let next_char = haystack[end_pos..].chars().next();
        if next_char.is_none_or(|c| !c.is_alphanumeric() && c != '_') {
            return Some(absolute_pos);
        }
        // Continue searching after this match
        start = absolute_pos + 1;
    }
    None
}

/// Extract the missing field name from error message like "no field `foo`"
fn extract_missing_field(message: &str) -> Option<&str> {
    if let Some(start) = message.find("no field `") {
        let rest = &message[start + 10..];
        if let Some(end) = rest.find('`') {
            return Some(&rest[..end]);
        }
    }
    None
}

/// Extract the missing function name from error message like "function foo not defined"
fn extract_missing_function(message: &str) -> Option<&str> {
    if let Some(start) = message.find("function ") {
        let rest = &message[start + 9..];
        if let Some(end) = rest.find(" not defined") {
            return Some(&rest[..end]);
        }
    }
    None
}

/// Get list of all available function names
fn get_available_functions() -> Vec<String> {
    all_functions()
        .into_iter()
        .map(|(name, _)| name.to_string())
        .collect()
}

/// Format a "did you mean" suggestion with green color
fn format_suggestion(message: &str, suggestion: &str) -> String {
    format!("{}, {}", message, format!("did you mean `{}`?", suggestion).green())
}

/// Find the best matching function name for a missing function
fn find_similar_function(missing: &str, available: &[String]) -> Option<String> {
    let missing_lower = missing.to_lowercase();

    let mut best_match: Option<(&str, usize)> = None;

    for func in available {
        let func_lower = func.to_lowercase();
        let dist = levenshtein(&missing_lower, &func_lower);
        // Only suggest if distance is reasonable (at most half the length + 2)
        let max_dist = (missing.len() / 2).max(2);
        if dist <= max_dist && best_match.map_or(true, |(_, d)| dist < d) {
            best_match = Some((func, dist));
        }
    }

    best_match.map(|(s, _)| s.to_string())
}

/// Format a template error with syntax-highlighted context
pub fn format_template_error(
    file_path: &Path,
    content: &str,
    error: &TemplateError,
    preamble_lines: usize,
    context_lines: usize,
    variables: Option<&Value>,
) -> String {
    let (mut message, line, mut col, mut len) = extract_error_info(error, preamble_lines);

    // Try to find "did you mean" suggestion for missing field errors
    if let Some(missing_field) = extract_missing_field(&message) {
        // Try to adjust col/len to point to the actual missing field in the line
        // Search for ".field" pattern followed by a non-alphanumeric char to avoid
        // matching substrings (e.g., ".data" in ".database")
        if let Some(line_content) = content.lines().nth(line.saturating_sub(1)) {
            let search_pattern = format!(".{}", missing_field);
            if let Some(pos) = find_field_access(line_content, &search_pattern) {
                col = pos + 2; // +1 for 1-based, +1 to skip the leading dot
                len = missing_field.len();
            }
        }

        if let Some(vars) = variables {
            let mut available_fields = Vec::new();
            collect_field_names(vars, "", &mut available_fields);
            if let Some(similar) = find_similar_field(missing_field, &available_fields) {
                message = format_suggestion(&message, &similar);
            }
        }
    }

    // Try to find "did you mean" suggestion for missing function errors
    if let Some(missing_func) = extract_missing_function(&message) {
        // Try to adjust col/len to point to the actual missing function in the line
        if let Some(line_content) = content.lines().nth(line.saturating_sub(1)) {
            if let Some(func_pos) = line_content.find(missing_func) {
                col = func_pos + 1; // 1-based
                len = missing_func.len();
            }
        }

        let available_funcs = get_available_functions();
        if let Some(similar) = find_similar_function(missing_func, &available_funcs) {
            message = format_suggestion(&message, &similar);
        }
    }

    format_file_error(file_path, content, &message, line, col, len, context_lines, None, None)
}

fn extract_error_info(error: &TemplateError, preamble_lines: usize) -> (String, usize, usize, usize) {
    match error {
        TemplateError::ExecError(exec_err) => extract_exec_error_info(exec_err, preamble_lines),
        TemplateError::ParseError(parse_err) => {
            let msg = format!("{}", parse_err);
            if let Some((line, col, len)) = parse_position(&msg, preamble_lines) {
                (extract_message(&msg).to_string(), line, col, len)
            } else {
                (msg, 1, 1, 1)
            }
        }
    }
}

fn extract_exec_error_info(error: &ExecError, preamble_lines: usize) -> (String, usize, usize, usize) {
    if let Some(structured) = error.as_structured() {
        let message = clean_message(&structured.message);
        let ctx = &structured.context;
        (message, ctx.line.saturating_sub(preamble_lines), ctx.col, ctx.len)
    } else {
        let msg = format!("{}", error);
        if let Some((line, col, len)) = parse_position(&msg, preamble_lines) {
            (clean_message(extract_message(&msg)), line, col, len)
        } else {
            (clean_message(&msg), 1, 1, 1)
        }
    }
}

fn clean_message(msg: &str) -> String {
    if let Some(pos) = msg.find(" in {") {
        msg[..pos].to_string()
    } else {
        msg.to_string()
    }
}

fn parse_position(error: &str, preamble_lines: usize) -> Option<(usize, usize, usize)> {
    // Pattern: "template: :N:C:L:"
    let start = error.find("template: :")? + 11;
    let rest = &error[start..];
    let mut parts = rest.splitn(4, ':');
    let line: usize = parts.next()?.parse().ok()?;
    let col: usize = parts.next()?.parse().ok()?;
    let len: usize = parts.next()?.parse().ok()?;
    Some((line.saturating_sub(preamble_lines), col, len))
}

fn extract_message(error: &str) -> &str {
    if let Some(idx) = error.find("template: :") {
        let rest = &error[idx + 11..];
        let mut colons = 0;
        for (i, c) in rest.char_indices() {
            if c == ':' {
                colons += 1;
                if colons == 3 {
                    return rest[i + 1..].trim();
                }
            }
        }
        rest.trim()
    } else {
        error
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_field_access_avoids_substring_matches() {
        // ".data" should not match ".database"
        let line = ".services.api.database.storage.volumeName .services.api.data.storage";
        let result = find_field_access(line, ".data");
        // ".data" is at position 55 (after the second ".api")
        assert_eq!(result, Some(55));
    }

    #[test]
    fn test_find_field_access_matches_at_end_of_string() {
        let line = ".services.api.data";
        let result = find_field_access(line, ".data");
        assert_eq!(result, Some(13));
    }

    #[test]
    fn test_find_field_access_matches_followed_by_dot() {
        let line = ".foo.data.bar";
        let result = find_field_access(line, ".data");
        assert_eq!(result, Some(4));
    }

    #[test]
    fn test_find_field_access_matches_followed_by_space() {
        let line = ".foo.data .bar";
        let result = find_field_access(line, ".data");
        assert_eq!(result, Some(4));
    }

    #[test]
    fn test_find_field_access_no_match_when_only_substring() {
        let line = ".services.database";
        let result = find_field_access(line, ".data");
        assert_eq!(result, None);
    }

    #[test]
    fn test_find_field_access_with_underscore_continuation() {
        // ".data_extra" should not match ".data"
        let line = ".services.data_extra .services.data";
        let result = find_field_access(line, ".data");
        assert_eq!(result, Some(30));
    }
}
