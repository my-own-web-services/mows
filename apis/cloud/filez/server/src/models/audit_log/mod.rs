//! Durable audit trail (migration 00000000000014). Closes the
//! Phase 4 multi-review MAJ-7 finding — replaces ephemeral
//! `tracing::info!` lines at the §7.2 / §7.5 lifecycle events with
//! a queryable table.
//!
//! Two-layer API:
//!
//!   * [`AuditEvent`] — typed enum, one variant per event_type.
//!     Encodes the per-event metadata schema in the type system so
//!     callers can't omit fields or send the wrong shape. Each
//!     variant carries the spec section reference in its docstring.
//!   * [`AuditLog::insert`] — generic insert that takes any
//!     `AuditEvent` and the actor/resource context. Handlers call
//!     this; nothing else.
//!
//! The metadata column is JSONB on the wire but the model layer
//! always serialises through `AuditEvent`'s `serde::Serialize` impl
//! — never raw JSON construction.

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    ExpressionMethods, QueryDsl, Selectable, SelectableHelper,
};
use diesel_async::RunQueryDsl;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    database::Database,
    errors::FilezError,
    impl_typed_uuid,
    models::{
        access_policies::AccessPolicyResourceType, user_groups::UserGroupId, users::FilezUserId,
    },
    schema,
    utils::get_current_timestamp,
};

impl_typed_uuid!(AuditLogId);

/// One row in the audit_log table. Persistence shape — see
/// [`AuditEvent`] for the typed payload.
#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug, Insertable)]
#[diesel(table_name = schema::audit_log)]
#[diesel(check_for_backend(Pg))]
pub struct AuditLog {
    pub id: AuditLogId,
    pub event_type: String,
    pub actor_id: Option<FilezUserId>,
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Option<Uuid>,
    pub ts: chrono::NaiveDateTime,
    pub metadata: serde_json::Value,
}

/// Typed payload for an [`AuditLog`] row. Each variant pins the
/// metadata schema — handlers can't omit fields or pass the wrong
/// shape. `event_type` is the serde discriminator, so the wire
/// representation in the JSONB column matches the variant name
/// exactly (snake_case → e.g. `"user_group_deleted"`).
///
/// Wire-stable: variants and field names are part of the durable
/// audit record. Add new variants; never rename or remove an
/// existing one without a migration to rewrite stored rows.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "event_type", rename_all = "snake_case")]
pub enum AuditEvent {
    /// USER_GROUPS.md §7.2 — a group was deleted; every
    /// `access_policies` row with this group as subject was
    /// dropped in the same transaction.
    UserGroupDeleted {
        /// Count of `access_policies` rows dropped as a side-
        /// effect. Lets an admin estimate the "blast radius" of
        /// the deletion without re-querying the policy table.
        dropped_subject_policies: usize,
    },
    /// USER_GROUPS.md §7.5 — a user account was soft-deleted; every
    /// `user_groups` row they owned was transferred to the system
    /// `nobody` sentinel.
    UserGroupOwnerTransferredToNobody {
        /// Count of groups transferred. Admin should re-assign
        /// these manually (the spec is explicit: "we do not
        /// silently delete owner-less groups").
        transferred_groups: usize,
    },
    /// Phase 5 P5-2 — the listing-cover reconciler ran. Drift
    /// between `access_policies` and the cover tables (caused by
    /// bulk-loader paths that bypass the per-row triggers, or by
    /// trigger function bugs in a future migration) is self-healed
    /// each time this fires. The count is per (subject, resource)
    /// pair processed; a sudden change in cadence (e.g. half the
    /// expected count) is the admin signal that something dropped
    /// active policies out from under the system.
    CoverTablesReconciled {
        rows_processed: usize,
    },
    /// Phase 5 P5-3 — the materialisation-threshold recompute job
    /// ran. `flags_flipped` is the count of `user_groups` rows
    /// whose `materialize_uga` flag actually changed in this
    /// sweep. A sudden spike means the threshold is mis-tuned for
    /// the current group-size distribution (LISTING.md §6.2).
    UserGroupMaterializeFlagsRecomputed {
        flags_flipped: usize,
    },
}

impl AuditEvent {
    /// Stable snake_case discriminator written to the
    /// `audit_log.event_type` column. Derived from the serde tag.
    pub fn event_type(&self) -> &'static str {
        match self {
            AuditEvent::UserGroupDeleted { .. } => "user_group_deleted",
            AuditEvent::UserGroupOwnerTransferredToNobody { .. } => {
                "user_group_owner_transferred_to_nobody"
            }
            AuditEvent::CoverTablesReconciled { .. } => "cover_tables_reconciled",
            AuditEvent::UserGroupMaterializeFlagsRecomputed { .. } => {
                "user_group_materialize_flags_recomputed"
            }
        }
    }
}

impl AuditLog {
    /// Write one audit row. Handlers call this from inside their
    /// existing transaction (or a fresh one, for fire-and-forget
    /// events). All inputs are typed at the call site so a missed
    /// field is a compile error, not a silently empty JSON object.
    ///
    /// `actor_id` is `None` for system-initiated events (cron jobs,
    /// reconcilers). Per the table contract, the FK is
    /// `ON DELETE SET NULL` so the audit row survives the actor's
    /// account deletion.
    #[tracing::instrument(level = "trace", skip(database, event))]
    pub async fn insert(
        database: &Database,
        event: AuditEvent,
        actor_id: Option<&FilezUserId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
    ) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        let event_type = event.event_type().to_string();
        let metadata = serde_json::to_value(&event)
            .map_err(|e| FilezError::SerdeJsonError(e))?;
        let row = AuditLog {
            id: AuditLogId::new(),
            event_type,
            actor_id: actor_id.cloned(),
            resource_type,
            resource_id,
            ts: get_current_timestamp(),
            metadata,
        };
        diesel::insert_into(schema::audit_log::table)
            .values(&row)
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    /// Recent events touching a specific (resource_type,
    /// resource_id), newest first. Used by the Phase-7 admin UI to
    /// show "what happened to this group?".
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_by_resource(
        database: &Database,
        resource_type: AccessPolicyResourceType,
        resource_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditLog>, FilezError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::audit_log::table
            .filter(schema::audit_log::resource_type.eq(resource_type))
            .filter(schema::audit_log::resource_id.eq(resource_id))
            .order_by(schema::audit_log::ts.desc())
            .limit(limit)
            .select(AuditLog::as_select())
            .load::<AuditLog>(&mut connection)
            .await?;
        Ok(rows)
    }
}

#[cfg(test)]
mod event_wire_stability_guard {
    //! `event_type` snake_case strings are part of the durable
    //! audit record and must NEVER change silently. Renaming a
    //! variant or adjusting the serde tag changes every stored
    //! row's discriminator. This test pins the current names so a
    //! refactor that drifts them trips before the change can land.
    use super::*;

    #[test]
    fn user_group_deleted_event_type_is_stable() {
        let e = AuditEvent::UserGroupDeleted {
            dropped_subject_policies: 0,
        };
        assert_eq!(e.event_type(), "user_group_deleted");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["event_type"], "user_group_deleted");
    }

    #[test]
    fn user_group_owner_transferred_event_type_is_stable() {
        let e = AuditEvent::UserGroupOwnerTransferredToNobody {
            transferred_groups: 0,
        };
        assert_eq!(e.event_type(), "user_group_owner_transferred_to_nobody");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(
            json["event_type"],
            "user_group_owner_transferred_to_nobody"
        );
    }

    #[test]
    fn cover_tables_reconciled_event_type_is_stable() {
        let e = AuditEvent::CoverTablesReconciled {
            rows_processed: 0,
        };
        assert_eq!(e.event_type(), "cover_tables_reconciled");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["event_type"], "cover_tables_reconciled");
    }

    #[test]
    fn user_group_materialize_flags_recomputed_event_type_is_stable() {
        let e = AuditEvent::UserGroupMaterializeFlagsRecomputed {
            flags_flipped: 0,
        };
        assert_eq!(e.event_type(), "user_group_materialize_flags_recomputed");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(
            json["event_type"],
            "user_group_materialize_flags_recomputed"
        );
    }

    #[test]
    fn event_type_method_matches_serde_tag() {
        // The `event_type()` helper exists so handlers can read the
        // discriminator without round-tripping through serde. It
        // MUST match the serde tag exactly — otherwise the column
        // and the JSONB diverge.
        for event in [
            AuditEvent::UserGroupDeleted {
                dropped_subject_policies: 1,
            },
            AuditEvent::UserGroupOwnerTransferredToNobody {
                transferred_groups: 1,
            },
            AuditEvent::CoverTablesReconciled {
                rows_processed: 1,
            },
            AuditEvent::UserGroupMaterializeFlagsRecomputed {
                flags_flipped: 1,
            },
        ] {
            let serialised = serde_json::to_value(&event).unwrap();
            assert_eq!(
                event.event_type(),
                serialised["event_type"].as_str().unwrap(),
                "event_type() helper drifted from the serde tag",
            );
        }
    }
}

#[cfg(test)]
mod metadata_field_stability_guard {
    //! Metadata field names are part of the wire record too — a
    //! Phase-7 admin UI that reads `metadata.dropped_subject_policies`
    //! breaks silently if a refactor renames the struct field. Pin
    //! the JSON shape per variant.
    use super::*;

    #[test]
    fn user_group_deleted_metadata_shape() {
        let e = AuditEvent::UserGroupDeleted {
            dropped_subject_policies: 42,
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["dropped_subject_policies"], 42);
    }

    #[test]
    fn user_group_owner_transferred_metadata_shape() {
        let e = AuditEvent::UserGroupOwnerTransferredToNobody {
            transferred_groups: 7,
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["transferred_groups"], 7);
    }

    #[test]
    fn cover_tables_reconciled_metadata_shape() {
        let e = AuditEvent::CoverTablesReconciled {
            rows_processed: 12345,
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["rows_processed"], 12345);
    }

    #[test]
    fn user_group_materialize_flags_recomputed_metadata_shape() {
        let e = AuditEvent::UserGroupMaterializeFlagsRecomputed {
            flags_flipped: 42,
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["flags_flipped"], 42);
    }
}

// Re-export so `crate::models::audit_log::UserGroupId` etc. resolve
// for callers that don't already pull the typed ids.
#[allow(unused_imports)]
use UserGroupId as _;
