//! Per-service registration of resource types and per-resource-type
//! metadata that the engine needs to compose its queries.
//!
//! This is the contract a service implements at startup so the engine
//! knows which table holds resources of type `T`, which column is the
//! owner, and which join table maps resources to resource-groups.
//!
//! See DATA_MODEL.md §3 for the canonical description.
//!
//! ## Identifier safety
//!
//! `ResourceAuthInfo` carries SQL table and column names that the
//! engine eventually interpolates into PL/pgSQL via `EXECUTE format()`
//! (LISTING.md §3b). To make that interpolation safe by construction,
//! the registry validates every name against [`SAFE_IDENTIFIER_REGEX`]
//! at build time — entries that don't match are refused. The engine
//! therefore never runs `EXECUTE format(... unvalidated-string ...)`
//! on a value that wasn't checked here first.

use std::collections::HashMap;

use thiserror::Error;

/// Strict regex for SQL identifiers the registry accepts.
///
/// Lower-case alphanumeric + underscore, must start with a letter.
/// Postgres allows more (mixed case, quoted, unicode), but the engine
/// has no use for any of that and the regex is the only line of
/// defense between the registry caller and `EXECUTE format()`. Keep
/// it tight.
pub const SAFE_IDENTIFIER_REGEX: &str = r"^[a-z][a-z0-9_]*$";

fn is_safe_identifier(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }
    let mut chars = s.chars();
    let first = chars.next().expect("non-empty checked above");
    if !first.is_ascii_lowercase() {
        return false;
    }
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// Errors returned by [`StaticResourceTypeRegistry::new`]. Surface at
/// service boot — a bad registry entry should fail the process, not
/// limp along and produce a SQL-injection vector on first request.
#[derive(Debug, Error)]
pub enum RegistryError {
    #[error(
        "resource_type {resource_type} field `{field}` = {value:?} is not a safe SQL identifier \
         (must match {regex})",
        regex = SAFE_IDENTIFIER_REGEX
    )]
    UnsafeIdentifier {
        resource_type: u32,
        field: &'static str,
        value: String,
    },
    #[error("resource_type {0} registered twice")]
    DuplicateResourceType(u32),
    #[error(
        "resource_type {resource_type} has group_membership_table set but missing one of \
         group_membership_resource_id_column / group_membership_group_id_column / \
         resource_group_type — all four are required together or none must be set"
    )]
    IncompleteGroupMembership { resource_type: u32 },
}

/// Metadata for one resource type — enough for the engine to JOIN
/// against the service's resource table without hardcoding anything
/// service-specific in the engine.
#[derive(Debug, Clone)]
pub struct ResourceAuthInfo {
    pub resource_table: &'static str,
    pub resource_table_id_column: &'static str,
    pub resource_table_owner_column: Option<&'static str>,
    pub resource_type: u32,

    // For resources that can be members of resource-groups:
    pub group_membership_table: Option<&'static str>,
    pub group_membership_resource_id_column: Option<&'static str>,
    pub group_membership_group_id_column: Option<&'static str>,
    pub resource_group_type: Option<u32>,
}

/// Trait services implement at startup to register their types.
///
/// Constructed once in `mod state`-equivalent code; the engine holds an
/// `Arc<dyn ResourceTypeRegistry>` and dispatches per call.
pub trait ResourceTypeRegistry: Send + Sync + std::fmt::Debug {
    fn lookup(&self, resource_type: u32) -> Option<&ResourceAuthInfo>;
    fn all(&self) -> &[ResourceAuthInfo];
}

/// Concrete `ResourceTypeRegistry` backed by a fixed `Vec` populated at
/// service startup. Validates every entry's identifiers and rejects
/// duplicates at construction time.
#[derive(Debug)]
pub struct StaticResourceTypeRegistry {
    entries: Vec<ResourceAuthInfo>,
    by_type: HashMap<u32, usize>,
}

impl StaticResourceTypeRegistry {
    /// Build a registry from a list of entries. Validates each entry
    /// and rejects duplicates. Returns the first error encountered.
    pub fn new(entries: Vec<ResourceAuthInfo>) -> Result<Self, RegistryError> {
        let mut by_type: HashMap<u32, usize> = HashMap::with_capacity(entries.len());
        for (index, entry) in entries.iter().enumerate() {
            validate_entry(entry)?;
            if by_type.insert(entry.resource_type, index).is_some() {
                return Err(RegistryError::DuplicateResourceType(entry.resource_type));
            }
        }
        Ok(Self { entries, by_type })
    }
}

impl ResourceTypeRegistry for StaticResourceTypeRegistry {
    fn lookup(&self, resource_type: u32) -> Option<&ResourceAuthInfo> {
        self.by_type.get(&resource_type).map(|i| &self.entries[*i])
    }
    fn all(&self) -> &[ResourceAuthInfo] {
        &self.entries
    }
}

fn validate_entry(entry: &ResourceAuthInfo) -> Result<(), RegistryError> {
    fn check(
        field: &'static str,
        value: &str,
        resource_type: u32,
    ) -> Result<(), RegistryError> {
        if is_safe_identifier(value) {
            Ok(())
        } else {
            Err(RegistryError::UnsafeIdentifier {
                resource_type,
                field,
                value: value.to_string(),
            })
        }
    }

    let rt = entry.resource_type;
    check("resource_table", entry.resource_table, rt)?;
    check("resource_table_id_column", entry.resource_table_id_column, rt)?;
    if let Some(col) = entry.resource_table_owner_column {
        check("resource_table_owner_column", col, rt)?;
    }
    // Group-membership fields are all-or-nothing.
    let group_fields_count = entry.group_membership_table.is_some() as u8
        + entry.group_membership_resource_id_column.is_some() as u8
        + entry.group_membership_group_id_column.is_some() as u8
        + entry.resource_group_type.is_some() as u8;
    if group_fields_count != 0 && group_fields_count != 4 {
        return Err(RegistryError::IncompleteGroupMembership { resource_type: rt });
    }
    if let Some(table) = entry.group_membership_table {
        check("group_membership_table", table, rt)?;
    }
    if let Some(col) = entry.group_membership_resource_id_column {
        check("group_membership_resource_id_column", col, rt)?;
    }
    if let Some(col) = entry.group_membership_group_id_column {
        check("group_membership_group_id_column", col, rt)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file_entry() -> ResourceAuthInfo {
        // Mirrors filez's `File` entry.
        ResourceAuthInfo {
            resource_table: "files",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("owner_id"),
            resource_type: 0,
            group_membership_table: Some("file_file_group_members"),
            group_membership_resource_id_column: Some("file_id"),
            group_membership_group_id_column: Some("file_group_id"),
            resource_group_type: Some(1),
        }
    }

    fn user_entry() -> ResourceAuthInfo {
        // Mirrors filez's `User` entry — no group membership.
        ResourceAuthInfo {
            resource_table: "users",
            resource_table_id_column: "id",
            resource_table_owner_column: Some("id"),
            resource_type: 2,
            group_membership_table: None,
            group_membership_resource_id_column: None,
            group_membership_group_id_column: None,
            resource_group_type: None,
        }
    }

    #[test]
    fn accepts_realistic_filez_entries() {
        let reg = StaticResourceTypeRegistry::new(vec![file_entry(), user_entry()])
            .expect("realistic entries pass");
        assert!(reg.lookup(0).is_some());
        assert!(reg.lookup(2).is_some());
        assert!(reg.lookup(999).is_none(), "lookup of unknown returns None");
        assert_eq!(reg.all().len(), 2);
    }

    #[test]
    fn rejects_uppercase_table_name() {
        let mut entry = file_entry();
        entry.resource_table = "Files";
        let err = StaticResourceTypeRegistry::new(vec![entry]).unwrap_err();
        match err {
            RegistryError::UnsafeIdentifier { field, value, .. } => {
                assert_eq!(field, "resource_table");
                assert_eq!(value, "Files");
            }
            other => panic!("expected UnsafeIdentifier, got {other:?}"),
        }
    }

    #[test]
    fn rejects_sql_injection_attempt() {
        // The class of value the regex is supposed to stop.
        let mut entry = file_entry();
        entry.resource_table = "files; DROP TABLE users";
        StaticResourceTypeRegistry::new(vec![entry])
            .expect_err("must reject identifier with semicolon");
    }

    #[test]
    fn rejects_empty_identifier() {
        let mut entry = file_entry();
        entry.resource_table_id_column = "";
        StaticResourceTypeRegistry::new(vec![entry]).expect_err("must reject empty identifier");
    }

    #[test]
    fn rejects_identifier_starting_with_digit() {
        let mut entry = file_entry();
        entry.resource_table = "1files";
        StaticResourceTypeRegistry::new(vec![entry])
            .expect_err("identifier must start with a letter");
    }

    #[test]
    fn rejects_duplicate_resource_type() {
        let a = file_entry();
        let mut b = file_entry();
        b.resource_table = "different_table";
        // Same resource_type = 0
        let err = StaticResourceTypeRegistry::new(vec![a, b]).unwrap_err();
        assert!(matches!(err, RegistryError::DuplicateResourceType(0)));
    }

    #[test]
    fn rejects_partial_group_membership_fields() {
        let mut entry = file_entry();
        entry.group_membership_resource_id_column = None;
        let err = StaticResourceTypeRegistry::new(vec![entry]).unwrap_err();
        assert!(matches!(err, RegistryError::IncompleteGroupMembership { .. }));
    }

    #[test]
    fn safe_identifier_regex_string_is_documented() {
        // Sanity check: the doc string matches what the validator actually accepts.
        assert!(is_safe_identifier("files"));
        assert!(is_safe_identifier("file_file_group_members"));
        assert!(is_safe_identifier("a"));
        assert!(!is_safe_identifier(""));
        assert!(!is_safe_identifier("Files"));
        assert!(!is_safe_identifier("1files"));
        assert!(!is_safe_identifier("files-table"));
        assert!(!is_safe_identifier("files table"));
        assert!(!is_safe_identifier("files; DROP TABLE x"));
    }
}
