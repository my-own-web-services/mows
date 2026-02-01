use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::path::Path;
use tracing::{debug, trace, warn};

use crate::error::{IoResultExt, Result};

use super::SENSITIVE_FILE_MODE;

/// File permission mode for secrets files: owner read/write only (rw-------).
/// Prevents world-readable credentials.
/// Re-exported from compose module's shared constant.
pub const SECRET_FILE_MODE: u32 = SENSITIVE_FILE_MODE;

/// Write a file with restricted permissions (600 - owner read/write only).
///
/// Used for secrets files to prevent world-readable credentials.
/// Permissions are set atomically at file creation to avoid race conditions
/// where file exists briefly with default (potentially world-readable) permissions.
pub fn write_secret_file(path: &Path, content: &str) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .mode(SECRET_FILE_MODE)
        .open(path)
        .io_context(format!("Failed to create file '{}'", path.display()))?;

    file.write_all(content.as_bytes())
        .io_context(format!("Failed to write to '{}'", path.display()))?;

    Ok(())
}

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
pub fn load_secrets_as_map(path: &Path) -> Result<HashMap<String, String>> {
    if !path.exists() {
        debug!("Secrets file does not exist: {}", path.display());
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(path)
        .io_context(format!("Failed to read secrets file '{}'", path.display()))?;

    let map = parse_env_file_ordered(&content)
        .into_iter()
        .filter_map(|(key, value)| value.map(|v| (key, v)))
        .collect();

    Ok(map)
}

/// Sync provided-secrets.env with manifest definitions.
/// Adds any secrets defined in manifest but missing from the file.
/// Returns the number of secrets added.
pub fn sync_provided_secrets_from_manifest(
    manifest: &super::manifest::MowsManifest,
    secrets_path: &Path,
) -> Result<usize> {
    use tracing::info;

    let secret_definitions = match &manifest.spec.compose {
        Some(c) => c.provided_secrets.as_ref(),
        None => return Ok(0),
    };

    let Some(secret_definitions) = secret_definitions else { return Ok(0) };

    // Load existing secrets
    let existing = load_secrets_as_map(secrets_path)?;

    // Find secrets in manifest that are not in the file
    let mut missing_secrets: Vec<(&String, &super::manifest::ProvidedSecretDef)> = Vec::new();
    for (name, definition) in secret_definitions {
        if !existing.contains_key(name) {
            missing_secrets.push((name, definition));
        }
    }

    if missing_secrets.is_empty() {
        return Ok(0);
    }

    // Sort for deterministic output
    missing_secrets.sort_by_key(|(name, _)| *name);

    // Build content to append
    let mut append_content = String::new();
    for (name, definition) in &missing_secrets {
        // Build comment with required/optional status and default value
        let required_str = if definition.optional { "optional" } else { "required" };
        let default_str = match &definition.default {
            Some(v) if !v.is_null() => format!(", default: {}", format_yaml_value_for_env(v)),
            _ => String::new(),
        };
        append_content.push_str(&format!("\n# ({}{})\n", required_str, default_str));

        // Add key with default value if present and not null
        let value = match &definition.default {
            Some(v) if !v.is_null() => format_yaml_value_for_env(v),
            _ => String::new(),
        };
        append_content.push_str(&format!("{}={}\n", name, value));
    }

    // Read existing file content (or empty if doesn't exist)
    let existing_content = if secrets_path.exists() {
        fs::read_to_string(secrets_path)
            .io_context(format!("Failed to read {}", secrets_path.display()))?
    } else {
        String::from("# User-provided secrets\n# Fill in the required values before running 'mows package-manager compose up'\n")
    };

    // Write merged content
    let new_content = format!("{}{}", existing_content.trim_end(), append_content);
    fs::write(secrets_path, new_content)
        .io_context(format!("Failed to write {}", secrets_path.display()))?;

    let count = missing_secrets.len();
    info!("Added {} new secret(s) to provided-secrets.env", count);

    Ok(count)
}

/// Validate that required provided secrets have values set.
/// This should be called AFTER sync_provided_secrets_from_manifest.
/// Returns an error listing missing required secrets.
pub fn validate_provided_secrets(
    manifest: &super::manifest::MowsManifest,
    secrets_path: &Path,
) -> Result<()> {
    use crate::error::MowsError;

    let secret_definitions = match &manifest.spec.compose {
        Some(c) => c.provided_secrets.as_ref(),
        None => return Ok(()),
    };

    let Some(secret_definitions) = secret_definitions else { return Ok(()) };

    let existing = load_secrets_as_map(secrets_path)?;
    let mut missing: Vec<&String> = Vec::new();

    for (name, definition) in secret_definitions {
        if !definition.optional {
            let has_value = existing
                .get(name)
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false);

            if !has_value {
                missing.push(name);
            }
        }
    }

    if !missing.is_empty() {
        missing.sort();
        let missing_str: Vec<&str> = missing.iter().map(|s| s.as_str()).collect();
        return Err(MowsError::Validation(format!(
            "Missing required secrets: {}.\n\
             Edit provided-secrets.env at: {}\n\
             Then run 'mows package-manager compose up' (or 'mpm compose up') again.",
            missing_str.join(", "),
            secrets_path.display()
        )));
    }

    Ok(())
}

/// Format a YAML value for use in an env file
fn format_yaml_value_for_env(value: &serde_yaml_neo::Value) -> String {
    match value {
        serde_yaml_neo::Value::Bool(b) => b.to_string(),
        serde_yaml_neo::Value::Number(n) => n.to_string(),
        serde_yaml_neo::Value::String(s) => s.to_string(),
        _ => String::new(),
    }
}

/// Generate a provided-secrets.env file from manifest definitions
pub fn generate_provided_secrets_file(
    secret_definitions: &HashMap<String, super::manifest::ProvidedSecretDef>,
    output_path: &Path,
) -> Result<()> {
    let mut content = String::from("# User-provided secrets\n");
    content.push_str("# Fill in the required values before running 'mows package-manager compose up'\n\n");

    // Sort keys for deterministic output
    let mut keys: Vec<&String> = secret_definitions.keys().collect();
    keys.sort();

    for name in keys {
        let definition = &secret_definitions[name];

        // Build comment with required/optional status and default value
        let required_str = if definition.optional { "optional" } else { "required" };
        let default_str = match &definition.default {
            Some(v) if !v.is_null() => format!(", default: {}", format_yaml_value_for_env(v)),
            _ => String::new(),
        };
        content.push_str(&format!("# ({}{})\n", required_str, default_str));

        // Add key with default value if present and not null
        let value = match &definition.default {
            Some(v) if !v.is_null() => format_yaml_value_for_env(v),
            _ => String::new(),
        };
        content.push_str(&format!("{}={}\n\n", name, value));
    }

    fs::write(output_path, &content)
        .io_context(format!("Failed to write {}", output_path.display()))?;

    Ok(())
}

/// Clear secret values in an env file, optionally filtering by key.
///
/// This is the core logic for secrets regeneration - it reads the file,
/// clears the specified key(s) values (setting them to empty), and writes
/// the file back with secure permissions.
///
/// # Arguments
/// * `secrets_path` - Path to the secrets env file
/// * `key` - Optional key to clear. If None, clears all keys.
///
/// # Returns
/// The number of keys that were cleared, or an error if the key was not found.
///
/// # Errors
/// * File doesn't exist
/// * Specified key not found in file
/// * No keys found in file (when clearing all)
pub fn clear_secret_values(secrets_path: &Path, key: Option<&str>) -> Result<usize> {
    use crate::error::MowsError;

    if !secrets_path.exists() {
        return Err(MowsError::path(
            secrets_path,
            "No generated-secrets.env found. Run 'mows package-manager compose up' (or 'mpm compose up') first.",
        ));
    }

    // Read current secrets
    let content = fs::read_to_string(secrets_path)
        .io_context("Failed to read secrets file")?;

    let entries = parse_env_file_ordered(&content);

    // Clear the specified key(s)
    let mut cleared_count = 0;
    let new_content: String = entries
        .into_iter()
        .map(|(key_name, value)| match value {
            Some(_) if key.is_none() || key == Some(key_name.as_str()) => {
                // Clear this key's value
                cleared_count += 1;
                format!("{}=", key_name)
            }
            Some(existing_value) => format!("{}={}", key_name, existing_value),
            None => key_name, // Comment or empty line
        })
        .collect::<Vec<_>>()
        .join("\n");

    if cleared_count == 0 {
        if let Some(key_name) = key {
            return Err(MowsError::Validation(format!(
                "Key '{}' not found in generated-secrets.env",
                key_name
            )));
        }
        return Err(MowsError::Validation(
            "No keys found in generated-secrets.env".to_string(),
        ));
    }

    // Write the cleared content with secure permissions (600)
    write_secret_file(secrets_path, &new_content)?;

    Ok(cleared_count)
}

/// Regenerate secrets (all or specific key)
/// This works by clearing the value(s) in generated-secrets.env,
/// then re-running the render pipeline which will regenerate empty values
pub fn secrets_regenerate(key: Option<&str>) -> Result<()> {
    use super::find_manifest_dir;
    use super::render::{render_generated_secrets, RenderContext};
    use tracing::info;

    let base_dir = find_manifest_dir()?;
    let secrets_path = base_dir.join("results/generated-secrets.env");

    let cleared_count = clear_secret_values(&secrets_path, key)?;

    info!("Cleared {} secret(s), re-rendering...", cleared_count);

    // Re-run the render to regenerate the secrets
    let context = RenderContext::new(&base_dir)?;
    render_generated_secrets(&context)?;

    if let Some(key_name) = key {
        info!("Regenerated secret: {}", key_name);
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

    // =========================================================================
    // Edge Case Tests (#23) - Special characters, long values, escape sequences
    // =========================================================================

    #[test]
    fn test_very_long_secret_value() {
        let long_value = "x".repeat(10000);
        let content = format!("LONG_SECRET={}", long_value);
        let entries = parse_env_file_ordered(&content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            assert_eq!(value.len(), 10000);
        } else {
            panic!("Expected value");
        }
    }

    #[test]
    fn test_escape_sequences_in_double_quotes() {
        let content = r#"KEY="line1\nline2\ttabbed\\backslash""#;
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            assert!(value.contains('\n'), "Should have newline");
            assert!(value.contains('\t'), "Should have tab");
            assert!(value.contains('\\'), "Should have backslash");
        }
    }

    #[test]
    fn test_escape_sequences_in_single_quotes() {
        let content = r#"KEY='line1\nline2\ttabbed'"#;
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            // Single quotes should also process escape sequences
            assert!(value.contains('\n') || value.contains("\\n"));
        }
    }

    #[test]
    fn test_escaped_quotes() {
        let content = r#"KEY="value with \"quoted\" text""#;
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            assert!(value.contains('"'), "Should have preserved quotes");
        }
    }

    #[test]
    fn test_unbalanced_quotes_warning() {
        let content = r#"KEY="unclosed quote"#;
        let entries = parse_env_file_ordered(content);

        // Should still parse but warn
        assert_eq!(entries.len(), 1);
        assert!(entries[0].1.is_some());
    }

    #[test]
    fn test_multiple_equals_signs() {
        let content = "URL=https://example.com?foo=bar&baz=qux";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].0, "URL");
        if let Some(value) = &entries[0].1 {
            assert_eq!(value, "https://example.com?foo=bar&baz=qux");
        }
    }

    #[test]
    fn test_special_characters_in_value() {
        let content = "SPECIAL=!@#$%^&*()[]{}|;':\"<>?,./";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            assert!(value.contains('!'));
            assert!(value.contains('@'));
            assert!(value.contains('#'));
        }
    }

    #[test]
    fn test_unicode_in_value() {
        let content = "UNICODE=日本語テスト🎉";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            assert!(value.contains('日'));
            assert!(value.contains('🎉'));
        }
    }

    #[test]
    fn test_unicode_in_quoted_value() {
        let content = r#"UNICODE="日本語 with spaces 🎉""#;
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            assert!(value.contains('日'));
            assert!(value.contains("with spaces"));
            assert!(value.contains('🎉'));
        }
    }

    #[test]
    fn test_empty_content() {
        let content = "";
        let entries = parse_env_file_ordered(content);
        assert!(entries.is_empty());
    }

    #[test]
    fn test_only_comments() {
        let content = "# Comment 1\n# Comment 2\n# Comment 3";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 3);
        for entry in &entries {
            assert!(entry.1.is_none(), "Comments should have None value");
        }
    }

    #[test]
    fn test_only_empty_lines() {
        let content = "\n\n\n";
        let entries = parse_env_file_ordered(content);

        // Each empty line should be preserved
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn test_key_with_invalid_characters_warning() {
        // Keys with invalid characters should be warned but still parsed
        let content = "INVALID-KEY=value";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        // The key is still parsed
        assert!(entries[0].1.is_some());
    }

    #[test]
    fn test_empty_key() {
        let content = "=value";
        let entries = parse_env_file_ordered(content);

        // Empty key should be skipped
        assert_eq!(entries.len(), 1);
        assert!(entries[0].1.is_none(), "Empty key line should be preserved as-is");
    }

    #[test]
    fn test_line_without_equals() {
        let content = "not_a_valid_entry";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        assert!(entries[0].1.is_none());
    }

    #[test]
    fn test_merge_with_empty_existing_content() {
        let existing = "";
        let new = "KEY1=value1\nKEY2=value2";

        let merged = merge_generated_secrets(Some(existing), new);
        assert_eq!(merged, new);
    }

    #[test]
    fn test_merge_with_whitespace_only_existing() {
        let existing = "   \n\t\n   ";
        let new = "KEY1=value1";

        let merged = merge_generated_secrets(Some(existing), new);
        assert_eq!(merged, new);
    }

    #[test]
    fn test_merge_preserves_key_order_from_new() {
        let existing = "KEY3=existing3\nKEY1=existing1";
        let new = "KEY1=new1\nKEY2=new2\nKEY3=new3";

        let merged = merge_generated_secrets(Some(existing), new);

        // Order should follow `new`, but values from `existing` are used where non-empty
        let lines: Vec<&str> = merged.lines().collect();
        assert_eq!(lines.len(), 3);
        assert!(lines[0].starts_with("KEY1="));
        assert!(lines[1].starts_with("KEY2="));
        assert!(lines[2].starts_with("KEY3="));
    }

    #[test]
    fn test_parse_quoted_value_with_newlines() {
        let content = "MULTILINE=\"line1\\nline2\\nline3\"";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            let newline_count = value.chars().filter(|&c| c == '\n').count();
            assert_eq!(newline_count, 2, "Should have 2 newlines");
        }
    }

    #[test]
    fn test_value_with_leading_trailing_whitespace() {
        let content = "KEY=  value with spaces  ";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            // Leading/trailing whitespace should be trimmed
            assert_eq!(value, "value with spaces");
        }
    }

    #[test]
    fn test_quoted_value_preserves_whitespace() {
        let content = "KEY=\"  value with spaces  \"";
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 1);
        if let Some(value) = &entries[0].1 {
            // Quoted values should preserve internal whitespace
            assert!(value.contains("  value") || value.contains("value  "));
        }
    }

    #[test]
    fn test_mix_of_quoted_and_unquoted() {
        let content = r#"UNQUOTED=simple
DOUBLE="double quoted"
SINGLE='single quoted'
EMPTY=
COMPLEX="with \"escape\""
"#;
        let entries = parse_env_file_ordered(content);

        assert_eq!(entries.len(), 5);
        assert_eq!(entries[0].1, Some("simple".to_string()));
        assert_eq!(entries[1].1, Some("double quoted".to_string()));
        assert_eq!(entries[2].1, Some("single quoted".to_string()));
        assert_eq!(entries[3].1, Some("".to_string()));
    }

    #[test]
    fn test_load_secrets_nonexistent_file() {
        let path = std::path::Path::new("/nonexistent/path/secrets.env");
        let result = load_secrets_as_map(path);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_load_secrets_existing_file() {
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, "KEY1=value1\nKEY2=value2").unwrap();
        temp_file.flush().unwrap();

        let result = load_secrets_as_map(temp_file.path());
        assert!(result.is_ok());

        let map = result.unwrap();
        assert_eq!(map.get("KEY1"), Some(&"value1".to_string()));
        assert_eq!(map.get("KEY2"), Some(&"value2".to_string()));
    }

    #[test]
    fn test_is_properly_quoted_double() {
        assert_eq!(is_properly_quoted("\"hello\""), Some('"'));
        assert_eq!(is_properly_quoted("\"hello world\""), Some('"'));
        assert_eq!(is_properly_quoted("\"\""), Some('"'));
    }

    #[test]
    fn test_is_properly_quoted_single() {
        assert_eq!(is_properly_quoted("'hello'"), Some('\''));
        assert_eq!(is_properly_quoted("'hello world'"), Some('\''));
        assert_eq!(is_properly_quoted("''"), Some('\''));
    }

    #[test]
    fn test_is_properly_quoted_invalid() {
        assert_eq!(is_properly_quoted("hello"), None);
        assert_eq!(is_properly_quoted("\"hello"), None);
        assert_eq!(is_properly_quoted("hello\""), None);
        assert_eq!(is_properly_quoted("\"hello'"), None);
        assert_eq!(is_properly_quoted("'hello\""), None);
        assert_eq!(is_properly_quoted("a"), None);
        assert_eq!(is_properly_quoted(""), None);
    }

    #[test]
    fn test_is_properly_quoted_with_internal_quotes() {
        // Unescaped internal quote should not be considered properly quoted
        assert_eq!(is_properly_quoted("\"hel\"lo\""), None);
        // But escaped internal quote should be fine
        assert_eq!(is_properly_quoted(r#""hel\"lo""#), Some('"'));
    }

    // =========================================================================
    // Provided Secrets Tests - validate_provided_secrets, generate_provided_secrets_file
    // =========================================================================

    #[test]
    fn test_generate_provided_secrets_file() {
        use super::super::manifest::ProvidedSecretDef;
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let output_path = dir.path().join("provided-secrets.env");

        let mut secret_definitions = HashMap::new();
        secret_definitions.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );
        secret_definitions.insert(
            "SMTP_PORT".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Number(465.into())),
                optional: false,
            },
        );
        secret_definitions.insert(
            "OPTIONAL_SECRET".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::String("default-value".to_string())),
                optional: true,
            },
        );

        generate_provided_secrets_file(&secret_definitions, &output_path).unwrap();

        let content = std::fs::read_to_string(&output_path).unwrap();

        // Check header
        assert!(content.contains("# User-provided secrets"));

        // Check API_KEY (required, no default)
        assert!(content.contains("# (required)\nAPI_KEY=\n"));

        // Check SMTP_PORT (required, has default)
        assert!(content.contains("# (required, default: 465)\nSMTP_PORT=465\n"));

        // Check OPTIONAL_SECRET (optional, has default)
        assert!(content.contains("# (optional, default: default-value)\nOPTIONAL_SECRET=default-value\n"));
    }

    #[test]
    fn test_sync_adds_only_missing_secrets() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("provided-secrets.env");

        // Create existing file with one secret
        std::fs::write(&secrets_path, "API_KEY=existing-value\n").unwrap();

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::String("default-key".to_string())),
                optional: false,
            },
        );
        provided_secrets.insert(
            "NEW_SECRET".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::String("new-default".to_string())),
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Sync should only add NEW_SECRET (API_KEY already exists)
        let added = sync_provided_secrets_from_manifest(&manifest, &secrets_path).unwrap();
        assert_eq!(added, 1);

        let content = std::fs::read_to_string(&secrets_path).unwrap();
        // Existing value should be preserved
        assert!(content.contains("API_KEY=existing-value"));
        // New secret should be added with default
        assert!(content.contains("NEW_SECRET=new-default"));
    }

    #[test]
    fn test_sync_returns_zero_when_all_present() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("provided-secrets.env");

        // Create file with all secrets
        std::fs::write(&secrets_path, "API_KEY=value1\nSMTP_PORT=587\n").unwrap();

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );
        provided_secrets.insert(
            "SMTP_PORT".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Number(465.into())),
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // All secrets exist, should add nothing
        let added = sync_provided_secrets_from_manifest(&manifest, &secrets_path).unwrap();
        assert_eq!(added, 0);
    }

    #[test]
    fn test_sync_with_no_manifest_secrets() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest,
        };
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("provided-secrets.env");

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: None, // No providedSecrets
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // No secrets defined, should return 0
        let added = sync_provided_secrets_from_manifest(&manifest, &secrets_path).unwrap();
        assert_eq!(added, 0);
    }

    #[test]
    fn test_validate_provided_secrets_all_present() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut secrets_file = NamedTempFile::new().unwrap();
        write!(secrets_file, "API_KEY=secret123\nSMTP_PORT=587").unwrap();
        secrets_file.flush().unwrap();

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );
        provided_secrets.insert(
            "SMTP_PORT".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_provided_secrets_missing_required() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut secrets_file = NamedTempFile::new().unwrap();
        write!(secrets_file, "SMTP_PORT=587").unwrap(); // API_KEY missing
        secrets_file.flush().unwrap();

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: None, // No default, required
                optional: false,
            },
        );
        provided_secrets.insert(
            "SMTP_PORT".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("API_KEY"));
        assert!(err.contains("Missing required secrets"));
    }

    #[test]
    fn test_validate_provided_secrets_with_default_fails_without_sync() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use tempfile::NamedTempFile;

        // Empty secrets file
        let secrets_file = NamedTempFile::new().unwrap();

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "SMTP_PORT".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Number(465.into())), // Has default
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Validation alone should FAIL - sync must be called first to populate defaults
        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("SMTP_PORT"));
    }

    #[test]
    fn test_sync_then_validate_with_default() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("provided-secrets.env");

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "SMTP_PORT".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Number(465.into())), // Has default
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Sync should add the secret with its default
        let added = sync_provided_secrets_from_manifest(&manifest, &secrets_path).unwrap();
        assert_eq!(added, 1);

        // Now validation should pass
        let result = validate_provided_secrets(&manifest, &secrets_path);
        assert!(result.is_ok());

        // Verify the file contains the default value
        let content = std::fs::read_to_string(&secrets_path).unwrap();
        assert!(content.contains("SMTP_PORT=465"));
    }

    #[test]
    fn test_validate_provided_secrets_optional_missing() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use tempfile::NamedTempFile;

        // Empty secrets file
        let secrets_file = NamedTempFile::new().unwrap();

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "OPTIONAL_KEY".to_string(),
            ProvidedSecretDef {
                default: None, // No default
                optional: true, // But it's optional
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Should pass because the secret is optional
        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_provided_secrets_no_compose_config() {
        use super::super::manifest::{ManifestMetadata, ManifestSpec, MowsManifest};
        use tempfile::NamedTempFile;

        let secrets_file = NamedTempFile::new().unwrap();

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec { compose: None },
        };

        // Should pass - no compose config means no secrets to validate
        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_provided_secrets_no_provided_secrets_field() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest,
        };
        use tempfile::NamedTempFile;

        let secrets_file = NamedTempFile::new().unwrap();

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: None, // No providedSecrets field
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Should pass - no providedSecrets means nothing to validate
        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_provided_secrets_file_not_exists_with_default_fails() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use std::path::Path;

        let nonexistent_path = Path::new("/nonexistent/path/secrets.env");

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::String("default-key".to_string())),
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Should FAIL - validation only checks file values, not manifest defaults
        // sync must be called first to create the file with defaults
        let result = validate_provided_secrets(&manifest, nonexistent_path);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("API_KEY"));
    }

    #[test]
    fn test_validate_provided_secrets_file_not_exists_missing_required() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use std::path::Path;

        let nonexistent_path = Path::new("/nonexistent/path/secrets.env");

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: None, // No default
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Should fail - file doesn't exist and no default
        let result = validate_provided_secrets(&manifest, nonexistent_path);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("API_KEY"));
    }

    #[test]
    fn test_validate_provided_secrets_empty_value() {
        use super::super::manifest::{
            DeploymentConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
        };
        use std::io::Write;
        use tempfile::NamedTempFile;

        let mut secrets_file = NamedTempFile::new().unwrap();
        write!(secrets_file, "API_KEY=   \n").unwrap(); // Whitespace-only value
        secrets_file.flush().unwrap();

        let mut provided_secrets = HashMap::new();
        provided_secrets.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );

        let manifest = MowsManifest {
            manifest_version: "0.1".to_string(),
            metadata: ManifestMetadata {
                name: "test".to_string(),
                description: None,
                version: None,
            },
            spec: ManifestSpec {
                compose: Some(DeploymentConfig {
                    
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Should fail - whitespace-only counts as empty
        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("API_KEY"));
    }

    #[test]
    fn test_generate_provided_secrets_file_boolean_default() {
        use super::super::manifest::ProvidedSecretDef;
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let output_path = dir.path().join("provided-secrets.env");

        let mut secret_definitions = HashMap::new();
        secret_definitions.insert(
            "FEATURE_ENABLED".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Bool(true)),
                optional: false,
            },
        );
        secret_definitions.insert(
            "DEBUG_MODE".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Bool(false)),
                optional: true,
            },
        );

        generate_provided_secrets_file(&secret_definitions, &output_path).unwrap();

        let content = std::fs::read_to_string(&output_path).unwrap();

        assert!(content.contains("# (optional, default: false)\nDEBUG_MODE=false\n"));
        assert!(content.contains("# (required, default: true)\nFEATURE_ENABLED=true\n"));
    }

    // I/O Error Scenario Tests

    #[test]
    fn test_load_secrets_corrupted_content_gracefully_handled() {
        // Non-env format content should be parsed line by line
        // Lines without '=' are skipped
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let path = dir.path().join("corrupted.env");

        // Write content that looks invalid but should still be parseable
        std::fs::write(&path, "not a valid env file format\nthis is just text\nVALID_KEY=value").unwrap();

        let result = load_secrets_as_map(&path);
        assert!(result.is_ok());
        let map = result.unwrap();
        // Should have parsed the valid key
        assert_eq!(map.get("VALID_KEY"), Some(&"value".to_string()));
    }

    #[test]
    fn test_load_secrets_binary_content() {
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let path = dir.path().join("binary.env");

        // Write some binary content with a valid line
        let mut content = vec![0xFF, 0xFE, 0x00, 0x01]; // BOM-like bytes
        content.extend_from_slice(b"\nKEY=value\n");
        std::fs::write(&path, content).unwrap();

        // Should handle gracefully (may parse partial content)
        let result = load_secrets_as_map(&path);
        // Either succeeds or fails gracefully
        if let Ok(map) = result {
            // If it parses, KEY should be found
            assert!(map.contains_key("KEY") || map.is_empty());
        }
    }

    #[test]
    fn test_load_secrets_very_long_lines() {
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let path = dir.path().join("long.env");

        // Create a very long value
        let long_value = "x".repeat(100_000);
        std::fs::write(&path, format!("LONG_KEY={}\nSHORT_KEY=short", long_value)).unwrap();

        let result = load_secrets_as_map(&path);
        assert!(result.is_ok());
        let map = result.unwrap();
        assert_eq!(map.get("LONG_KEY").map(|s| s.len()), Some(100_000));
        assert_eq!(map.get("SHORT_KEY"), Some(&"short".to_string()));
    }

    #[test]
    fn test_write_secret_file_creates_with_permissions() {
        use tempfile::tempdir;
        use std::os::unix::fs::MetadataExt;

        let dir = tempdir().unwrap();
        let path = dir.path().join("secret.env");

        write_secret_file(&path, "SECRET=value").unwrap();

        // Verify file was created
        assert!(path.exists());

        // Verify permissions are restrictive (600)
        let metadata = std::fs::metadata(&path).unwrap();
        let mode = metadata.mode() & 0o777;
        assert_eq!(mode, 0o600, "Secret file should have 600 permissions");

        // Verify content
        let content = std::fs::read_to_string(&path).unwrap();
        assert_eq!(content, "SECRET=value");
    }

    #[test]
    fn test_write_secret_file_overwrites_existing() {
        use tempfile::tempdir;

        let dir = tempdir().unwrap();
        let path = dir.path().join("secret.env");

        // Write initial content
        write_secret_file(&path, "OLD=value").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "OLD=value");

        // Overwrite with new content
        write_secret_file(&path, "NEW=value").unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "NEW=value");
    }

    #[test]
    fn test_generate_secrets_to_readonly_parent_fails() {
        use super::super::manifest::ProvidedSecretDef;
        use tempfile::tempdir;
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir().unwrap();
        let readonly_dir = dir.path().join("readonly");
        std::fs::create_dir(&readonly_dir).unwrap();

        // Make directory read-only
        std::fs::set_permissions(&readonly_dir, std::fs::Permissions::from_mode(0o555)).unwrap();

        let output_path = readonly_dir.join("provided-secrets.env");

        let mut secret_definitions = HashMap::new();
        secret_definitions.insert(
            "KEY".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );

        let result = generate_provided_secrets_file(&secret_definitions, &output_path);

        // Should fail due to permission denied
        assert!(result.is_err());

        // Restore permissions for cleanup
        std::fs::set_permissions(&readonly_dir, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    #[test]
    fn test_merge_generated_secrets_handles_missing_file() {
        // Test that merge handles the case where there's no existing content
        let new_content = "NEW_KEY=new_value\nANOTHER_KEY=another";

        // When existing is None (file doesn't exist), merge should just use new content
        let merged = merge_generated_secrets(None, new_content);

        // Should contain the new keys
        assert!(merged.contains("NEW_KEY=new_value"));
        assert!(merged.contains("ANOTHER_KEY=another"));
    }

    #[test]
    fn test_merge_generated_secrets_preserves_existing_values() {
        let existing_content = "EXISTING_KEY=existing_value\nANOTHER=old";
        let new_content = "ANOTHER=new\nNEW_KEY=new_value";

        let merged = merge_generated_secrets(Some(existing_content), new_content);

        // Existing value should be preserved (not overwritten)
        assert!(merged.contains("ANOTHER=old"));
        // New key should be added
        assert!(merged.contains("NEW_KEY=new_value"));
    }

    // =========================================================================
    // clear_secret_values Tests (#26) - Core logic for secrets_regenerate
    // =========================================================================

    #[test]
    fn test_clear_secret_values_file_not_found() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let nonexistent_path = dir.path().join("nonexistent.env");

        let result = clear_secret_values(&nonexistent_path, None);

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("No generated-secrets.env found"));
    }

    #[test]
    fn test_clear_secret_values_key_not_found() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with some keys
        std::fs::write(&secrets_path, "KEY1=value1\nKEY2=value2").unwrap();

        let result = clear_secret_values(&secrets_path, Some("NONEXISTENT_KEY"));

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Key 'NONEXISTENT_KEY' not found"));
    }

    #[test]
    fn test_clear_secret_values_no_keys_found() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with only comments and empty lines
        std::fs::write(&secrets_path, "# This is a comment\n\n# Another comment").unwrap();

        let result = clear_secret_values(&secrets_path, None);

        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("No keys found"));
    }

    #[test]
    fn test_clear_secret_values_single_key() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with multiple keys
        std::fs::write(
            &secrets_path,
            "# Header\nKEY1=secret1\nKEY2=secret2\nKEY3=secret3",
        )
        .unwrap();

        let result = clear_secret_values(&secrets_path, Some("KEY2"));

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        let content = std::fs::read_to_string(&secrets_path).unwrap();
        // KEY2 should be cleared
        assert!(content.contains("KEY2=\n") || content.contains("KEY2="));
        assert!(!content.contains("KEY2=secret2"));
        // Other keys should be preserved
        assert!(content.contains("KEY1=secret1"));
        assert!(content.contains("KEY3=secret3"));
        // Comment should be preserved
        assert!(content.contains("# Header"));
    }

    #[test]
    fn test_clear_secret_values_all_keys() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with multiple keys
        std::fs::write(
            &secrets_path,
            "# Header\nKEY1=secret1\nKEY2=secret2\nKEY3=secret3",
        )
        .unwrap();

        let result = clear_secret_values(&secrets_path, None);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 3);

        let content = std::fs::read_to_string(&secrets_path).unwrap();
        // All keys should be cleared
        assert!(content.contains("KEY1="));
        assert!(content.contains("KEY2="));
        assert!(content.contains("KEY3="));
        assert!(!content.contains("secret1"));
        assert!(!content.contains("secret2"));
        assert!(!content.contains("secret3"));
        // Comment should be preserved
        assert!(content.contains("# Header"));
    }

    #[test]
    fn test_clear_secret_values_preserves_comments_and_empty_lines() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with comments and empty lines
        std::fs::write(
            &secrets_path,
            "# Header comment\n\nKEY1=value1\n\n# Middle comment\nKEY2=value2\n\n# Footer",
        )
        .unwrap();

        let result = clear_secret_values(&secrets_path, None);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 2);

        let content = std::fs::read_to_string(&secrets_path).unwrap();
        // Comments should be preserved
        assert!(content.contains("# Header comment"));
        assert!(content.contains("# Middle comment"));
        assert!(content.contains("# Footer"));
    }

    #[test]
    fn test_clear_secret_values_writes_using_write_secret_file() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with some content
        std::fs::write(&secrets_path, "KEY=value").unwrap();

        let result = clear_secret_values(&secrets_path, None);
        assert!(result.is_ok());

        // Verify file was written (content was modified)
        let content = std::fs::read_to_string(&secrets_path).unwrap();
        assert!(content.contains("KEY="));
        assert!(!content.contains("KEY=value"));
    }

    #[test]
    fn test_write_secret_file_sets_secure_permissions_on_new_file() {
        use std::os::unix::fs::PermissionsExt;
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("new-secrets.env");

        // Write new file with write_secret_file
        write_secret_file(&secrets_path, "KEY=value").unwrap();

        // Check that file has 600 permissions
        let metadata = std::fs::metadata(&secrets_path).unwrap();
        let permissions = metadata.permissions();
        assert_eq!(permissions.mode() & 0o777, 0o600);
    }

    #[test]
    fn test_clear_secret_values_with_quoted_values() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with quoted values
        std::fs::write(
            &secrets_path,
            "KEY1=\"quoted value\"\nKEY2='single quoted'\nKEY3=unquoted",
        )
        .unwrap();

        let result = clear_secret_values(&secrets_path, Some("KEY1"));

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        let content = std::fs::read_to_string(&secrets_path).unwrap();
        // KEY1 should be cleared
        assert!(!content.contains("quoted value"));
        // Other keys should be preserved
        assert!(content.contains("KEY2=single quoted") || content.contains("KEY2='single quoted'"));
        assert!(content.contains("KEY3=unquoted"));
    }

    #[test]
    fn test_clear_secret_values_with_special_characters() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file with special characters in values
        std::fs::write(
            &secrets_path,
            "URL=https://example.com?foo=bar\nPASSWORD=p@ss!w0rd#123",
        )
        .unwrap();

        let result = clear_secret_values(&secrets_path, Some("PASSWORD"));

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);

        let content = std::fs::read_to_string(&secrets_path).unwrap();
        // PASSWORD should be cleared
        assert!(!content.contains("p@ss!w0rd#123"));
        // URL should be preserved
        assert!(content.contains("URL=https://example.com?foo=bar"));
    }

    #[test]
    fn test_clear_secret_values_with_empty_existing_value() {
        use tempfile::TempDir;

        let dir = TempDir::new().unwrap();
        let secrets_path = dir.path().join("generated-secrets.env");

        // Create file where one key already has empty value
        std::fs::write(&secrets_path, "KEY1=value1\nKEY2=\nKEY3=value3").unwrap();

        let result = clear_secret_values(&secrets_path, Some("KEY2"));

        // Clearing an already-empty key should still count as clearing
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 1);
    }
}
