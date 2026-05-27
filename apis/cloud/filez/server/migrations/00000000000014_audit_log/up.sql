-- Durable audit trail.
--
-- Phase 4 multi-review MAJ-7: the §7.2 group-delete cascade and
-- §7.5 owner-deletion-transfer events were logged via
-- `tracing::info!`, which is ephemeral and may be sampled in
-- production. USER_GROUPS.md §7.2 ("the deletion is logged in the
-- audit table with the affected policy ids so an admin can restore
-- the shape if it was a mistake") and §7.5 ("a notification is
-- emitted to server admins; they can transfer the group manually")
-- both call for a queryable record.
--
-- Schema is deliberately generic so other lifecycle events
-- (Phase 5 cover-table-reconciler drift detections, future
-- consent-flow revocations, etc.) reuse the same table.
--
--   event_type     wire-stable string. Acts as both filter axis and
--                  hint for how to interpret `metadata`. Snake-case
--                  matches the spec section it implements
--                  (e.g. "user_group_deleted", "user_group_owner_transferred").
--   actor_id       FK to users.id; the user whose action produced
--                  the event. NULL for system-initiated events
--                  (cron jobs, reconcilers). FK is SET NULL on
--                  actor delete — the audit row outlives the user.
--   resource_type  references mows_auth_core::types::ResourceType-
--                  style integers via the engine registry. Lets the
--                  admin UI query "every event touching User X".
--   resource_id    NULL when the event is type-level
--                  (e.g. a bulk reconciler run).
--   ts             event time; defaults to `now()` for callers that
--                  don't need to specify a different time.
--   metadata       JSONB blob for event-specific fields. Schema is
--                  defined per event_type — see
--                  `models::audit_log::AuditEvent` in filez.

CREATE TABLE audit_log (
    id            UUID      PRIMARY KEY,
    event_type    TEXT      NOT NULL,
    actor_id      UUID      REFERENCES users(id) ON DELETE SET NULL,
    resource_type SMALLINT  NOT NULL,
    resource_id   UUID      NULL,
    ts            TIMESTAMP NOT NULL DEFAULT now(),
    metadata      JSONB     NOT NULL DEFAULT '{}'::jsonb
);

-- The two hot query shapes for the Phase-7 admin UI:
--   1. "show events touching this resource"  →  (resource_type, resource_id, ts DESC)
--   2. "show what user X has done"           →  (actor_id, ts DESC)
-- A third "timeline view" → (ts DESC) is served by the PK btree
-- in postgres via a sort over the time column, but the index
-- ensures cheap range scans.
CREATE INDEX audit_log_by_resource
    ON audit_log (resource_type, resource_id, ts DESC);
CREATE INDEX audit_log_by_actor
    ON audit_log (actor_id, ts DESC);
CREATE INDEX audit_log_by_event_type
    ON audit_log (event_type, ts DESC);
CREATE INDEX audit_log_by_ts
    ON audit_log (ts DESC);
