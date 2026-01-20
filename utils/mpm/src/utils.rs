use mows_common_rust::error_display::{check_yaml_indentation_error, format_file_error};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::process::Command;
use tracing::{debug, trace};

use crate::error::{IoResultExt, MpmError, Result};

// Re-export YAML indentation utilities from dedicated module
pub use crate::yaml_indent::{detect_yaml_indent, yaml_to_4_space_indent};

pub fn find_git_root() -> Result<PathBuf> {
    debug!("Finding git repository root");
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .map_err(|e| MpmError::command("git rev-parse", e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MpmError::Git(format!("Not in a git repository: {}", stderr.trim())));
    }

    let path_str = String::from_utf8_lossy(&output.stdout);
    let path = PathBuf::from(path_str.trim());

    debug!("Git root: {}", path.display());
    Ok(path)
}

pub fn read_input(input: &Option<PathBuf>) -> Result<String> {
    match input {
        Some(path) => {
            trace!("Reading input from file: {}", path.display());
            fs::read_to_string(path)
                .io_context(format!("Failed to read file '{}'", path.display()))
        }
        None => {
            trace!("Reading input from stdin");
            let mut buffer = String::new();
            io::stdin()
                .read_to_string(&mut buffer)
                .io_context("Failed to read from stdin")?;
            Ok(buffer)
        }
    }
}

pub fn write_output(output: &Option<PathBuf>, content: &str) -> Result<()> {
    match output {
        Some(path) => {
            trace!("Writing output to file: {}", path.display());
            fs::write(path, content)
                .io_context(format!("Failed to write to file '{}'", path.display()))
        }
        None => {
            trace!("Writing output to stdout");
            print!("{}", content);
            Ok(())
        }
    }
}

/// Parse YAML content with proper error formatting (including indentation error detection).
/// If a path is provided, errors will include a code frame showing the error location.
pub fn parse_yaml<T: serde::de::DeserializeOwned>(
    content: &str,
    path: Option<&Path>,
) -> Result<T> {
    serde_yaml_neo::from_str(content).map_err(|e| MpmError::Message(format_yaml_error(content, path, &e)))
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_read_input_from_file() {
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, "test content").unwrap();
        temp_file.flush().unwrap();

        let path = Some(temp_file.path().to_path_buf());
        let result = read_input(&path).unwrap();
        assert_eq!(result, "test content");
    }

    #[test]
    fn test_write_output_to_file() {
        let temp_file = NamedTempFile::new().unwrap();
        let path = Some(temp_file.path().to_path_buf());

        write_output(&path, "test output").unwrap();

        let content = fs::read_to_string(temp_file.path()).unwrap();
        assert_eq!(content, "test output");
    }
}
