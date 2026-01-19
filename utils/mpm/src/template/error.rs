//! Template error formatting.

use gtmpl_ng::all_functions::all_functions;
use gtmpl_ng::{ExecError, TemplateError, Value};
use colored::Colorize;
use mows_common_rust::error_display::format_file_error;
use std::path::Path;

/// Calculate Levenshtein distance between two strings
fn levenshtein(a: &str, b: &str) -> usize {
    let a_len = a.chars().count();
    let b_len = b.chars().count();

    if a_len == 0 {
        return b_len;
    }
    if b_len == 0 {
        return a_len;
    }

    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();

    let mut prev_row: Vec<usize> = (0..=b_len).collect();
    let mut curr_row: Vec<usize> = vec![0; b_len + 1];

    for i in 1..=a_len {
        curr_row[0] = i;
        for j in 1..=b_len {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            curr_row[j] = (prev_row[j] + 1)
                .min(curr_row[j - 1] + 1)
                .min(prev_row[j - 1] + cost);
        }
        std::mem::swap(&mut prev_row, &mut curr_row);
    }

    prev_row[b_len]
}

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
        if dist <= max_dist {
            if best_match.is_none() || dist < best_match.unwrap().1 {
                best_match = Some((field, dist));
            }
        }
    }

    best_match.map(|(s, _)| s.to_string())
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
        if dist <= max_dist {
            if best_match.is_none() || dist < best_match.unwrap().1 {
                best_match = Some((func, dist));
            }
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
        if let Some(line_content) = content.lines().nth(line.saturating_sub(1)) {
            if let Some(field_pos) = line_content.find(missing_field) {
                col = field_pos + 1; // 1-based
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
