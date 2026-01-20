use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tracing::{debug, trace, warn};

use crate::error::Result;

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
    use crate::error::IoResultExt;

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

/// Validate that required provided secrets have values set
/// Returns an error listing missing required secrets
pub fn validate_provided_secrets(
    manifest: &super::manifest::MowsManifest,
    secrets_path: &Path,
) -> Result<()> {
    use crate::error::MpmError;

    let defs = match &manifest.spec.compose {
        Some(c) => c.provided_secrets.as_ref(),
        None => return Ok(()),
    };

    let Some(defs) = defs else { return Ok(()) };

    let existing = load_secrets_as_map(secrets_path)?;
    let mut missing: Vec<&String> = Vec::new();

    for (name, def) in defs {
        if !def.optional {
            let has_value = existing
                .get(name)
                .map(|v| !v.trim().is_empty())
                .unwrap_or(false);
            let has_default = def
                .default
                .as_ref()
                .map(|d| !d.is_null())
                .unwrap_or(false);

            if !has_value && !has_default {
                missing.push(name);
            }
        }
    }

    if !missing.is_empty() {
        missing.sort();
        let missing_str: Vec<&str> = missing.iter().map(|s| s.as_str()).collect();
        return Err(MpmError::Validation(format!(
            "Missing required secrets: {}.\n\
             Edit provided-secrets.env at: {}\n\
             Then run 'mpm compose up' again.",
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
        serde_yaml_neo::Value::String(s) => s.clone(),
        _ => String::new(),
    }
}

/// Generate a provided-secrets.env file from manifest definitions
pub fn generate_provided_secrets_file(
    defs: &HashMap<String, super::manifest::ProvidedSecretDef>,
    output_path: &Path,
) -> Result<()> {
    use crate::error::IoResultExt;

    let mut content = String::from("# User-provided secrets\n");
    content.push_str("# Fill in the required values before running 'mpm compose up'\n\n");

    // Sort keys for deterministic output
    let mut keys: Vec<&String> = defs.keys().collect();
    keys.sort();

    for name in keys {
        let def = &defs[name];

        // Build comment with required/optional status and default value
        let required_str = if def.optional { "optional" } else { "required" };
        let default_str = match &def.default {
            Some(v) if !v.is_null() => format!(", default: {}", format_yaml_value_for_env(v)),
            _ => String::new(),
        };
        content.push_str(&format!("# ({}{})\n", required_str, default_str));

        // Add key with default value if present and not null
        let value = match &def.default {
            Some(v) if !v.is_null() => format_yaml_value_for_env(v),
            _ => String::new(),
        };
        content.push_str(&format!("{}={}\n\n", name, value));
    }

    fs::write(output_path, &content)
        .io_context(format!("Failed to write {}", output_path.display()))?;

    Ok(())
}

/// Regenerate secrets (all or specific key)
/// This works by clearing the value(s) in generated-secrets.env,
/// then re-running the render pipeline which will regenerate empty values
pub fn secrets_regenerate(key: Option<&str>) -> Result<()> {
    use crate::error::{IoResultExt, MpmError};
    use super::find_manifest_dir;
    use super::render::{render_generated_secrets, write_secret_file, RenderContext};
    use tracing::info;

    let base_dir = find_manifest_dir()?;

    let secrets_path = base_dir.join("results/generated-secrets.env");

    if !secrets_path.exists() {
        return Err(MpmError::path(&secrets_path,
            "No generated-secrets.env found. Run 'mpm compose up' first.",
        ));
    }

    // Read current secrets
    let content = fs::read_to_string(&secrets_path)
        .io_context("Failed to read secrets file")?;

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
            return Err(MpmError::Validation(format!("Key '{}' not found in generated-secrets.env", k)));
        }
        return Err(MpmError::Validation("No keys found in generated-secrets.env".to_string()));
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

        let mut defs = HashMap::new();
        defs.insert(
            "API_KEY".to_string(),
            ProvidedSecretDef {
                default: None,
                optional: false,
            },
        );
        defs.insert(
            "SMTP_PORT".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Number(465.into())),
                optional: false,
            },
        );
        defs.insert(
            "OPTIONAL_SECRET".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::String("default-value".to_string())),
                optional: true,
            },
        );

        generate_provided_secrets_file(&defs, &output_path).unwrap();

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
    fn test_validate_provided_secrets_all_present() {
        use super::super::manifest::{
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
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
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
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
    fn test_validate_provided_secrets_with_default() {
        use super::super::manifest::{
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Should pass because the secret has a default value
        let result = validate_provided_secrets(&manifest, secrets_file.path());
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_provided_secrets_optional_missing() {
        use super::super::manifest::{
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
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
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
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
    fn test_validate_provided_secrets_file_not_exists() {
        use super::super::manifest::{
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
                    provided_secrets: Some(provided_secrets),
                    extra: serde_yaml_neo::Value::default(),
                }),
            },
        };

        // Should pass because the secret has a default value
        let result = validate_provided_secrets(&manifest, nonexistent_path);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_provided_secrets_file_not_exists_missing_required() {
        use super::super::manifest::{
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
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
            ComposeConfig, ManifestMetadata, ManifestSpec, MowsManifest, ProvidedSecretDef,
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
                compose: Some(ComposeConfig {
                    values_file_path: None,
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

        let mut defs = HashMap::new();
        defs.insert(
            "FEATURE_ENABLED".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Bool(true)),
                optional: false,
            },
        );
        defs.insert(
            "DEBUG_MODE".to_string(),
            ProvidedSecretDef {
                default: Some(serde_yaml_neo::Value::Bool(false)),
                optional: true,
            },
        );

        generate_provided_secrets_file(&defs, &output_path).unwrap();

        let content = std::fs::read_to_string(&output_path).unwrap();

        assert!(content.contains("# (optional, default: false)\nDEBUG_MODE=false\n"));
        assert!(content.contains("# (required, default: true)\nFEATURE_ENABLED=true\n"));
    }
}
