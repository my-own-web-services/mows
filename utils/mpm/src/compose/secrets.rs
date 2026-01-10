use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tracing::{debug, trace, warn};

/// Parse a quoted string value, handling escape sequences
/// Returns the unquoted value with escapes processed
fn parse_quoted_value(value: &str, quote_char: char) -> String {
    let inner = &value[1..value.len() - 1];
    let mut result = String::with_capacity(inner.len());
    let mut chars = inner.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\\' {
            // Handle escape sequences
            match chars.peek() {
                Some(&'n') => {
                    chars.next();
                    result.push('\n');
                }
                Some(&'t') => {
                    chars.next();
                    result.push('\t');
                }
                Some(&'r') => {
                    chars.next();
                    result.push('\r');
                }
                Some(&'\\') => {
                    chars.next();
                    result.push('\\');
                }
                Some(&c) if c == quote_char => {
                    chars.next();
                    result.push(quote_char);
                }
                _ => {
                    // Unknown escape, keep the backslash
                    result.push('\\');
                }
            }
        } else {
            result.push(c);
        }
    }

    result
}

/// Check if a value is properly quoted (balanced quotes)
fn is_properly_quoted(value: &str) -> Option<char> {
    if value.len() >= 2 {
        let first = value.chars().next()?;
        let last = value.chars().last()?;

        if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
            // Check it's not just escaped quotes
            let inner = &value[1..value.len() - 1];
            // Count unescaped quotes
            let mut escaped = false;
            for c in inner.chars() {
                if escaped {
                    escaped = false;
                } else if c == '\\' {
                    escaped = true;
                } else if c == first {
                    // Unescaped quote inside - not properly quoted
                    return None;
                }
            }
            return Some(first);
        }
    }
    None
}

/// Parse a .env file into an ordered list of (key, value) pairs
/// Preserves comments and empty lines as None values
/// Handles:
/// - Quoted strings with escape sequences (\n, \t, \\, \", \')
/// - Both single and double quotes
/// - Empty values
/// - Comments (lines starting with #)
pub fn parse_env_file_ordered(content: &str) -> Vec<(String, Option<String>)> {
    let mut entries = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Preserve comments and empty lines
        if trimmed.is_empty() || trimmed.starts_with('#') {
            entries.push((line.to_string(), None));
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            let key = key.trim().to_string();

            // Validate key is not empty
            if key.is_empty() {
                warn!("Skipping line with empty key: {}", line);
                entries.push((line.to_string(), None));
                continue;
            }

            // Validate key contains only valid characters (alphanumeric and underscore)
            if !key.chars().all(|c| c.is_alphanumeric() || c == '_') {
                warn!("Key contains invalid characters: {}", key);
            }

            let value = value.trim();

            // Parse the value, handling quotes and escapes
            let parsed_value = if let Some(quote_char) = is_properly_quoted(value) {
                // Properly quoted string - parse with escape handling
                parse_quoted_value(value, quote_char)
            } else if value.starts_with('"') || value.starts_with('\'') {
                // Starts with quote but not properly closed - warn and use as-is
                warn!(
                    "Unbalanced quotes in value for key '{}', using raw value",
                    key
                );
                value.to_string()
            } else {
                // Unquoted value - use as-is
                value.to_string()
            };

            entries.push((key, Some(parsed_value)));
        } else {
            // Line without = sign, preserve as-is
            entries.push((line.to_string(), None));
        }
    }

    entries
}

/// Check if a value is considered empty (whitespace-only counts as empty)
pub fn is_value_empty(value: &str) -> bool {
    value.trim().is_empty()
}

/// Merge generated secrets: preserve non-empty values from existing file
/// Returns the merged content as a string
pub fn merge_generated_secrets(
    existing_content: Option<&str>,
    new_content: &str,
) -> String {
    let new_entries = parse_env_file_ordered(new_content);

    // If no existing content, just return the new content
    let existing_content = match existing_content {
        Some(c) if !c.trim().is_empty() => c,
        _ => return new_content.to_string(),
    };

    // Parse existing entries into a map for lookup
    let existing_map: HashMap<String, String> = parse_env_file_ordered(existing_content)
        .into_iter()
        .filter_map(|(key, value)| value.map(|v| (key, v)))
        .collect();

    // Build merged output
    let mut lines = Vec::new();

    for (key, value) in new_entries {
        match value {
            None => {
                // Comment or empty line - preserve from new template
                lines.push(key);
            }
            Some(new_value) => {
                // Check if existing has a non-empty value for this key
                if let Some(existing_value) = existing_map.get(&key) {
                    if !is_value_empty(existing_value) {
                        // Keep existing non-empty value
                        trace!("Preserving existing value for key: {}", key);
                        lines.push(format!("{}={}", key, existing_value));
                    } else {
                        // Existing value is empty, use new value
                        trace!("Replacing empty value for key: {}", key);
                        lines.push(format!("{}={}", key, new_value));
                    }
                } else {
                    // Key not in existing file, use new value
                    trace!("Adding new key: {}", key);
                    lines.push(format!("{}={}", key, new_value));
                }
            }
        }
    }

    lines.join("\n")
}

/// Load secrets from a .env file as a HashMap
pub fn load_secrets_as_map(path: &Path) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        debug!("Secrets file does not exist: {}", path.display());
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read secrets file '{}': {}", path.display(), e))?;

    let map = parse_env_file_ordered(&content)
        .into_iter()
        .filter_map(|(key, value)| value.map(|v| (key, v)))
        .collect();

    Ok(map)
}

/// Regenerate secrets (all or specific key)
/// This works by clearing the value(s) in generated-secrets.env,
/// then re-running the render pipeline which will regenerate empty values
pub fn secrets_regenerate(key: Option<&str>) -> Result<(), String> {
    use super::find_manifest_dir;
    use super::render::{render_generated_secrets, write_secret_file, RenderContext};
    use tracing::info;

    let base_dir = find_manifest_dir()?;

    let secrets_path = base_dir.join("results/generated-secrets.env");

    if !secrets_path.exists() {
        return Err(
            "No generated-secrets.env found. Run 'mpm compose up' first.".to_string()
        );
    }

    // Read current secrets
    let content = fs::read_to_string(&secrets_path)
        .map_err(|e| format!("Failed to read secrets file: {}", e))?;

    let entries = parse_env_file_ordered(&content);

    // Clear the specified key(s)
    let mut cleared_count = 0;
    let new_content: String = entries
        .into_iter()
        .map(|(k, v)| {
            match v {
                Some(_) if key.is_none() || key == Some(k.as_str()) => {
                    // Clear this key's value
                    cleared_count += 1;
                    format!("{}=", k)
                }
                Some(val) => format!("{}={}", k, val),
                None => k, // Comment or empty line
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    if cleared_count == 0 {
        if let Some(k) = key {
            return Err(format!("Key '{}' not found in generated-secrets.env", k));
        }
        return Err("No keys found in generated-secrets.env".to_string());
    }

    // Write the cleared content with secure permissions (600)
    write_secret_file(&secrets_path, &new_content)?;

    info!(
        "Cleared {} secret(s), re-rendering...",
        cleared_count
    );

    // Re-run the render to regenerate the secrets
    let ctx = RenderContext::new(&base_dir)?;
    render_generated_secrets(&ctx)?;

    if let Some(k) = key {
        info!("Regenerated secret: {}", k);
    } else {
        info!("Regenerated {} secrets", cleared_count);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_env_file_ordered() {
        let content = r#"# Comment
KEY1=value1
KEY2="quoted value"
KEY3='single quoted'
KEY4=

# Another comment
KEY5=  spaces
"#;
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 8);
        assert_eq!(entries[0], ("# Comment".to_string(), None));
        assert_eq!(
            entries[1],
            ("KEY1".to_string(), Some("value1".to_string()))
        );
        assert_eq!(
            entries[2],
            ("KEY2".to_string(), Some("quoted value".to_string()))
        );
        assert_eq!(
            entries[3],
            ("KEY3".to_string(), Some("single quoted".to_string()))
        );
        assert_eq!(entries[4], ("KEY4".to_string(), Some("".to_string())));
    }

    #[test]
    fn test_is_value_empty() {
        assert!(is_value_empty(""));
        assert!(is_value_empty("   "));
        assert!(is_value_empty("\t\n"));
        assert!(!is_value_empty("value"));
        assert!(!is_value_empty("  value  "));
    }

    #[test]
    fn test_merge_generated_secrets_preserve_existing() {
        let existing = "DB_PASSWORD=secret123\nAPI_KEY=mykey";
        let new = "DB_PASSWORD=newpassword\nAPI_KEY=newkey\nNEW_KEY=newvalue";

        let merged = merge_generated_secrets(Some(existing), new);

        assert!(merged.contains("DB_PASSWORD=secret123")); // Preserved
        assert!(merged.contains("API_KEY=mykey")); // Preserved
        assert!(merged.contains("NEW_KEY=newvalue")); // Added
        assert!(!merged.contains("newpassword")); // Not used
    }

    #[test]
    fn test_merge_generated_secrets_replace_empty() {
        let existing = "DB_PASSWORD=\nAPI_KEY=   ";
        let new = "DB_PASSWORD=generated1\nAPI_KEY=generated2";

        let merged = merge_generated_secrets(Some(existing), new);

        assert!(merged.contains("DB_PASSWORD=generated1")); // Replaced empty
        assert!(merged.contains("API_KEY=generated2")); // Replaced whitespace-only
    }

    #[test]
    fn test_merge_generated_secrets_no_existing() {
        let new = "KEY1=value1\nKEY2=value2";
        let merged = merge_generated_secrets(None, new);
        assert_eq!(merged, new);
    }

    #[test]
    fn test_merge_generated_secrets_preserves_comments() {
        let existing = "KEY1=existing";
        let new = "# Header comment\nKEY1=new\n\n# Footer";

        let merged = merge_generated_secrets(Some(existing), new);

        assert!(merged.contains("# Header comment"));
        assert!(merged.contains("KEY1=existing"));
        assert!(merged.contains("# Footer"));
    }
}
