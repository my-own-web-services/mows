//! Shared input validators used by the REST API.

use crate::error::{Result, SupervisorError};

/// Maximum byte-length we accept for any user-supplied "name" field
/// (VM name, agent name, etc.). Sized to fit in a UI row and short
/// enough to safely interpolate into future QEMU argv positions.
pub(super) const MAX_RESOURCE_NAME_LEN: usize = 64;

/// Reject anything that isn't ASCII alphanumeric, `.`, `-` or `_`.
///
/// Names produced here will eventually flow into the UI, the sqlite
/// `name` column, the read-only 9p `run.yaml` mounted into guests, and
/// (the moment someone adds `-name` to qemu's argv — there's already a
/// `vm_name` field on `VmLaunchSpec`) directly into qemu's command line
/// where commas split options. Holding the line at a strict charset
/// here removes whole categories of injection without surprising users.
pub(super) fn validate_resource_name(field: &str, raw: &str) -> Result<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(SupervisorError::BadRequest(format!(
            "{field} must not be empty"
        )));
    }
    if trimmed.len() > MAX_RESOURCE_NAME_LEN {
        return Err(SupervisorError::BadRequest(format!(
            "{field} must be at most {MAX_RESOURCE_NAME_LEN} characters"
        )));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'))
    {
        return Err(SupervisorError::BadRequest(format!(
            "{field} may only contain ASCII letters, digits, `.`, `-` and `_`"
        )));
    }
    // Reject names that consist exclusively of `.` characters
    // (i.e. `.` and `..`). These flow into `Path::join`, where `.`
    // collapses to "current directory" and `..` ascends — a literal
    // path-traversal vector for the `agent_id` callsite that uses the
    // returned string to compose `state_dir/agents/<id>/agent.log`.
    if trimmed.chars().all(|c| c == '.') {
        return Err(SupervisorError::BadRequest(format!(
            "{field} must not consist exclusively of `.` characters (rejected: {trimmed:?})"
        )));
    }
    Ok(trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_simple_names() {
        assert_eq!(validate_resource_name("name", "foo").unwrap(), "foo");
        assert_eq!(validate_resource_name("name", "foo-bar_1.2").unwrap(), "foo-bar_1.2");
        assert_eq!(validate_resource_name("name", "  spaced  ").unwrap(), "spaced");
    }

    #[test]
    fn rejects_empty_and_whitespace() {
        assert!(validate_resource_name("name", "").is_err());
        assert!(validate_resource_name("name", "   ").is_err());
    }

    #[test]
    fn rejects_commas_and_newlines() {
        for bad in ["foo,bar", "foo\nbar", "foo bar", "foo/bar", "../etc"] {
            assert!(
                validate_resource_name("name", bad).is_err(),
                "should reject {bad:?}"
            );
        }
    }

    #[test]
    fn rejects_path_traversal_names() {
        // MAJ-1 follow-up: `.` and `..` would otherwise pass the
        // charset check (their bytes are all in the allowed set) but
        // collapse to traversal when used in `Path::join`. The check
        // is independent of length so future "..." etc. are also
        // rejected.
        for bad in [".", "..", "...", "....."] {
            assert!(
                validate_resource_name("agent_id", bad).is_err(),
                "should reject all-dot name {bad:?}"
            );
        }
        // `.foo`, `foo.bar`, `f.b.` still pass because they have at
        // least one non-dot character.
        assert!(validate_resource_name("agent_id", ".foo").is_ok());
        assert!(validate_resource_name("agent_id", "foo.bar").is_ok());
        assert!(validate_resource_name("agent_id", "f.b.").is_ok());
    }

    #[test]
    fn rejects_overlong() {
        let long = "a".repeat(MAX_RESOURCE_NAME_LEN + 1);
        assert!(validate_resource_name("name", &long).is_err());
    }
}
