use mows_common_rust::error_display::{check_yaml_indentation_error, format_file_error};
use std::path::Path;

use crate::error::{MowsError, Result};

/// Parse YAML content with proper error formatting (including indentation error detection).
/// If a path is provided, errors will include a code frame showing the error location.
pub fn parse_yaml<T: serde::de::DeserializeOwned>(
    content: &str,
    path: Option<&Path>,
) -> Result<T> {
    serde_yaml_neo::from_str(content).map_err(|e| MowsError::Message(format_yaml_error(content, path, &e)))
}

/// Extract "while parsing... at line X column Y" from YAML error messages.
/// This gives a better error location for some block-related errors.
fn parse_yaml_context_location(message: &str) -> Option<(usize, usize)> {
    let ctx_idx = message.find("while parsing")?;
    let rest = &message[ctx_idx..];
    let line_idx = rest.find("at line ")?;
    let after_line = &rest[line_idx + 8..];
    let line_end = after_line.find(|c: char| !c.is_ascii_digit())?;
    let line: usize = after_line[..line_end].parse().ok()?;

    let col_idx = after_line.find("column ")?;
    let after_col = &after_line[col_idx + 7..];
    let col_end = after_col
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(after_col.len());
    let col: usize = after_col[..col_end].parse().ok()?;

    Some((line, col))
}

/// Scan all lines for indentation errors and return the first one found.
/// Returns (message, line_number, indent_len).
fn find_first_indentation_error(content: &str) -> Option<(String, usize, usize)> {
    let lines: Vec<&str> = content.lines().collect();
    for (i, _) in lines.iter().enumerate() {
        if let Some((msg, indent_len)) = check_yaml_indentation_error(content, i + 1) {
            return Some((msg, i + 1, indent_len));
        }
    }
    None
}

/// Format a YAML parse error with indentation checking and optional code frame.
pub fn format_yaml_error(content: &str, path: Option<&Path>, err: &serde_yaml_neo::Error) -> String {
    let raw_message = format!("{}", err);

    // Get both the error location and the context location
    let error_loc = err.location().map(|loc| (loc.line(), loc.column()));
    let context_loc = parse_yaml_context_location(&raw_message);

    // First check the error line and context line for indentation issues
    // Returns (message, line, indent_len)
    let indentation_result = error_loc
        .and_then(|(line, _)| {
            check_yaml_indentation_error(content, line).map(|(msg, indent)| (msg, line, indent))
        })
        .or_else(|| {
            context_loc.and_then(|(line, _)| {
                check_yaml_indentation_error(content, line).map(|(msg, indent)| (msg, line, indent))
            })
        })
        // If not found at error locations, scan the whole file
        .or_else(|| find_first_indentation_error(content));

    let (message, display_line, display_col, error_len) =
        if let Some((indent_msg, line, indent_len)) = indentation_result {
            // We found an actual indentation error - show our custom message
            // Highlight all the faulty spaces
            (indent_msg, line, 1, indent_len)
        } else {
            // No indentation error detected - show original YAML error
            let (line, col) = context_loc.or(error_loc).unwrap_or((1, 1));
            (raw_message, line, col, 1)
        };

    // If we have a path, format with code frame
    if let Some(p) = path {
        format_file_error(
            p,
            content,
            &message,
            display_line,
            display_col,
            error_len,
            6,
            None,
            None,
        )
    } else {
        // No path (stdin) - just return the error message
        format!("Failed to parse YAML: {}", message)
    }
}
