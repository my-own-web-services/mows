//! Per-service registration of resource types and per-resource-type
//! metadata that the engine needs to compose its queries.
//!
//! This is the contract a service implements at startup so the engine
//! knows which table holds resources of type `T`, which column is the
//! owner, and which join table maps resources to resource-groups.
//!
//! See DATA_MODEL.md §3 for the canonical description.

/// Metadata for one resource type — enough for the engine to JOIN
/// against the service's resource table without hardcoding anything
/// service-specific in the engine.
///
/// Identifier-injection note: at registry construction time the engine
/// validates every `*_table` / `*_column` field matches a strict
/// identifier regex; bad entries refuse to boot. Run-time interpolation
/// is therefore safe.
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
pub trait ResourceTypeRegistry: Send + Sync {
    fn lookup(&self, resource_type: u32) -> Option<&ResourceAuthInfo>;
    fn all(&self) -> &[ResourceAuthInfo];
}

// TODO Phase 1: provide a `StaticResourceTypeRegistry` helper that
// validates each entry's table/column names match `[a-z][a-z0-9_]*` and
// rejects construction otherwise. See DATA_MODEL.md §3 "Safety".
