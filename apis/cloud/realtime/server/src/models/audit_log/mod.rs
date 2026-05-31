//! Durable audit trail (migration 00000000000003). Sibling of
//! filez's `audit_log` (filez migration 14) — same column shape so
//! the cross-service authz admin UI (Phase 7,
//! `apis/cloud/authz-admin/`) can fan the same wire shape across
//! both consumers without a per-service adapter.
//!
//! Two-layer API mirrors filez exactly:
//!
//!   * [`AuditEvent`] — typed enum, one variant per realtime event.
//!     Encodes the per-event metadata in the type system so callers
//!     can't omit fields. Currently: ChannelCreated / ChannelUpdated /
//!     ChannelDeleted / AccessPolicyCreated / AccessPolicyDeleted.
//!   * [`AuditLog::insert`] — single insert that takes any
//!     `AuditEvent` plus the actor/resource context. Handlers call
//!     this; nothing else writes to `audit_log` directly.
//!
//! The `metadata` JSONB column is always serialised through
//! `AuditEvent`'s serde impl, never built ad-hoc; renaming a variant
//! or a field would corrupt every stored row, so we pin both the
//! `event_type` discriminator and the per-variant field names with
//! dedicated wire-stability tests.

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
    errors::RealtimeError,
    impl_typed_uuid,
    models::{access_policies::AccessPolicyResourceType, users::UserId},
    schema,
    utils::get_current_timestamp,
};

impl_typed_uuid!(AuditLogId);

/// One row in the audit_log table. Wire-stable — every column maps
/// 1:1 to the migration. See [`AuditEvent`] for the typed metadata.
#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug, Insertable)]
#[diesel(table_name = schema::audit_log)]
#[diesel(check_for_backend(Pg))]
pub struct AuditLog {
    pub id: AuditLogId,
    pub event_type: String,
    pub actor_id: Option<UserId>,
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Option<Uuid>,
    pub ts: chrono::NaiveDateTime,
    /// JSONB blob carrying the per-event_type fields (see
    /// `AuditEvent`). Typed as `Object` in OpenAPI rather than a
    /// per-variant schema because utoipa's default for a bare
    /// `serde_json::Value` is an empty schema, which the
    /// swagger-rs Rust client generator rejects with a `RefOr`
    /// parse error. The trade-off: TypeScript + Rust clients see
    /// `metadata: object` (or `Value` / unknown) and lose IDE
    /// autocomplete on the per-event field names — consumers must
    /// unwrap defensively (the SPA's `unwrapAuditLog` is the
    /// canonical example). Review R13 / SLOP-7.
    #[schema(value_type = Object)]
    pub metadata: serde_json::Value,
}

/// Typed payload for an [`AuditLog`] row. `event_type` is the serde
/// discriminator; the JSONB column's tag matches the variant name
/// exactly (snake_case — e.g. `"channel_created"`).
///
/// Wire-stable: variants and field names are part of the durable
/// audit record. Add new variants; never rename or remove an
/// existing one without a migration to rewrite stored rows.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "event_type", rename_all = "snake_case")]
pub enum AuditEvent {
    /// A channel was created via POST /api/channels/create.
    /// `name` is the channel's display name at creation time —
    /// useful when the channel was later deleted and the admin
    /// wants to see what it used to be called without resurrecting
    /// it.
    ChannelCreated {
        name: String,
    },
    /// A channel's name or topic was updated via
    /// PATCH /api/channels/update/{id}. `name` is the new name;
    /// the previous values aren't recorded here (use the audit
    /// timeline for that — earlier rows have the previous name).
    ChannelUpdated {
        name: String,
    },
    /// A channel was deleted via DELETE /api/channels/delete/{id}.
    /// `name` is its display name at deletion time so the audit
    /// row stays readable after the channels row is gone.
    /// `dropped_subject_policies` is the count of access_policies
    /// rows that referenced this channel and were dropped in the
    /// same transaction (cascade) — lets an admin estimate blast
    /// radius without re-querying.
    ChannelDeleted {
        name: String,
        dropped_subject_policies: usize,
    },
    /// A user created an access policy via
    /// POST /api/access_policies/create. Captures the policy's
    /// subject + actions so the audit timeline shows who got what
    /// without joining back to the (possibly-revoked) policy row.
    AccessPolicyCreated {
        policy_id: Uuid,
        /// Subject the policy targets — User / UserGroup / Public
        /// / ServerMember (mirrors mows_auth_core::SubjectType).
        /// Stored as a snake_case string so a future engine-side
        /// enum extension doesn't crater old rows.
        subject_type: String,
        subject_id: Uuid,
        actions: Vec<String>,
    },
    /// A policy was deleted via
    /// DELETE /api/access_policies/delete/{id}. `policy_id`
    /// references the now-gone row; `subject_type` + `subject_id`
    /// + `actions` are duplicated here so the admin doesn't need
    /// to recover the deleted policy to read its shape.
    AccessPolicyDeleted {
        policy_id: Uuid,
        subject_type: String,
        subject_id: Uuid,
        actions: Vec<String>,
    },
}

impl AuditEvent {
    /// Stable snake_case discriminator written to the
    /// `audit_log.event_type` column. Derived from the serde tag
    /// — the helper exists so handlers don't need to round-trip
    /// through serde to filter by type.
    pub fn event_type(&self) -> &'static str {
        match self {
            AuditEvent::ChannelCreated { .. } => "channel_created",
            AuditEvent::ChannelUpdated { .. } => "channel_updated",
            AuditEvent::ChannelDeleted { .. } => "channel_deleted",
            AuditEvent::AccessPolicyCreated { .. } => "access_policy_created",
            AuditEvent::AccessPolicyDeleted { .. } => "access_policy_deleted",
        }
    }
}

impl AuditLog {
    /// Write one audit row. Callers compose typed events at the
    /// call site so a missed field is a compile error, not a
    /// silently empty JSON object.
    ///
    /// `actor_id` is `None` for system-initiated events
    /// (reserved — no realtime cron / reconciler exists today).
    /// Per the table contract, the FK is `ON DELETE SET NULL`
    /// so the audit row survives the actor's account deletion.
    #[tracing::instrument(level = "trace", skip(database, event))]
    pub async fn insert(
        database: &Database,
        event: AuditEvent,
        actor_id: Option<&UserId>,
        resource_type: AccessPolicyResourceType,
        resource_id: Option<Uuid>,
    ) -> Result<(), RealtimeError> {
        let mut connection = database.get_connection().await?;
        let event_type = event.event_type().to_string();
        let metadata = serde_json::to_value(&event)?;
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
    /// resource_id), newest first. Used by the Phase-7 admin UI's
    /// "what happened on this resource?" panel.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_by_resource(
        database: &Database,
        resource_type: AccessPolicyResourceType,
        resource_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditLog>, RealtimeError> {
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

    /// Recent events the given actor caused, newest first. Backs
    /// the admin UI's "what has user X done?" view.
    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn list_by_actor(
        database: &Database,
        actor_id: &UserId,
        limit: i64,
    ) -> Result<Vec<AuditLog>, RealtimeError> {
        let mut connection = database.get_connection().await?;
        let rows = schema::audit_log::table
            .filter(schema::audit_log::actor_id.eq(actor_id))
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
    //! row's discriminator. Same defence filez's audit_log carries
    //! verbatim — sibling guards make a typo trip in both crates.
    use super::*;
    use uuid::Uuid;

    #[test]
    fn channel_created_event_type_is_stable() {
        let e = AuditEvent::ChannelCreated {
            name: "team-room".into(),
        };
        assert_eq!(e.event_type(), "channel_created");
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["event_type"], "channel_created");
    }

    #[test]
    fn channel_updated_event_type_is_stable() {
        let e = AuditEvent::ChannelUpdated {
            name: "renamed".into(),
        };
        assert_eq!(e.event_type(), "channel_updated");
        assert_eq!(serde_json::to_value(&e).unwrap()["event_type"], "channel_updated");
    }

    #[test]
    fn channel_deleted_event_type_is_stable() {
        let e = AuditEvent::ChannelDeleted {
            name: "team-room".into(),
            dropped_subject_policies: 0,
        };
        assert_eq!(e.event_type(), "channel_deleted");
        assert_eq!(serde_json::to_value(&e).unwrap()["event_type"], "channel_deleted");
    }

    #[test]
    fn access_policy_created_event_type_is_stable() {
        let e = AuditEvent::AccessPolicyCreated {
            policy_id: Uuid::nil(),
            subject_type: "User".into(),
            subject_id: Uuid::nil(),
            actions: vec!["ChannelsRead".into()],
        };
        assert_eq!(e.event_type(), "access_policy_created");
        assert_eq!(
            serde_json::to_value(&e).unwrap()["event_type"],
            "access_policy_created"
        );
    }

    #[test]
    fn access_policy_deleted_event_type_is_stable() {
        let e = AuditEvent::AccessPolicyDeleted {
            policy_id: Uuid::nil(),
            subject_type: "User".into(),
            subject_id: Uuid::nil(),
            actions: vec!["ChannelsRead".into()],
        };
        assert_eq!(e.event_type(), "access_policy_deleted");
        assert_eq!(
            serde_json::to_value(&e).unwrap()["event_type"],
            "access_policy_deleted"
        );
    }

    #[test]
    fn event_type_helper_matches_serde_tag() {
        // The `event_type()` method must agree with the serde
        // discriminator for every variant — otherwise the
        // `event_type` column and the JSONB tag diverge.
        for event in [
            AuditEvent::ChannelCreated { name: "x".into() },
            AuditEvent::ChannelUpdated { name: "x".into() },
            AuditEvent::ChannelDeleted {
                name: "x".into(),
                dropped_subject_policies: 1,
            },
            AuditEvent::AccessPolicyCreated {
                policy_id: Uuid::nil(),
                subject_type: "User".into(),
                subject_id: Uuid::nil(),
                actions: vec![],
            },
            AuditEvent::AccessPolicyDeleted {
                policy_id: Uuid::nil(),
                subject_type: "User".into(),
                subject_id: Uuid::nil(),
                actions: vec![],
            },
        ] {
            let serialised = serde_json::to_value(&event).unwrap();
            assert_eq!(
                event.event_type(),
                serialised["event_type"].as_str().unwrap(),
                "event_type() drifted from the serde tag",
            );
        }
    }
}

#[cfg(test)]
mod metadata_field_stability_guard {
    //! Per-variant field names are also wire-stable — the admin
    //! UI reads `metadata.dropped_subject_policies` etc. by name.
    use super::*;

    #[test]
    fn channel_created_metadata_shape() {
        let e = AuditEvent::ChannelCreated {
            name: "team-room".into(),
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["name"], "team-room");
    }

    #[test]
    fn channel_deleted_metadata_shape() {
        let e = AuditEvent::ChannelDeleted {
            name: "old".into(),
            dropped_subject_policies: 3,
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["name"], "old");
        assert_eq!(json["dropped_subject_policies"], 3);
    }

    #[test]
    fn access_policy_created_metadata_shape() {
        let e = AuditEvent::AccessPolicyCreated {
            policy_id: uuid::uuid!("11111111-1111-1111-1111-111111111111"),
            subject_type: "UserGroup".into(),
            subject_id: uuid::uuid!("22222222-2222-2222-2222-222222222222"),
            actions: vec!["ChannelsRead".into(), "ChannelsList".into()],
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["policy_id"], "11111111-1111-1111-1111-111111111111");
        assert_eq!(json["subject_type"], "UserGroup");
        assert_eq!(json["subject_id"], "22222222-2222-2222-2222-222222222222");
        assert_eq!(json["actions"][0], "ChannelsRead");
        assert_eq!(json["actions"][1], "ChannelsList");
    }

    #[test]
    fn access_policy_deleted_metadata_shape() {
        // Review R4 / QA-7 — the Deleted variant carries the same
        // field set as Created; a refactor that renames one half
        // (e.g. `actions` → `action_list` only on the Deleted
        // variant) would silently break audit-log readers that
        // expect a uniform shape across the two events.
        let e = AuditEvent::AccessPolicyDeleted {
            policy_id: uuid::uuid!("33333333-3333-3333-3333-333333333333"),
            subject_type: "Public".into(),
            subject_id: uuid::Uuid::nil(),
            actions: vec!["ChannelsRead".into()],
        };
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["policy_id"], "33333333-3333-3333-3333-333333333333");
        assert_eq!(json["subject_type"], "Public");
        assert_eq!(json["subject_id"], "00000000-0000-0000-0000-000000000000");
        assert_eq!(json["actions"][0], "ChannelsRead");
        assert_eq!(json["event_type"], "access_policy_deleted");
    }
}
