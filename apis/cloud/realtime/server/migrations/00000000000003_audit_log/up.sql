-- Durable audit trail. Schema mirrors filez's
-- 00000000000014_audit_log so the cross-service authz admin UI
-- (Phase 7, `apis/cloud/authz-admin/`) can fan out the same
-- shape across consumers — the BFF stays translator-free, the
-- SPA renders one table for both.
--
-- The audit_log table is deliberately generic: any handler that
-- mutates a resource or grants/revokes access writes one row
-- with a typed AuditEvent variant in `event_type` + per-variant
-- fields in `metadata`. See `models::audit_log::AuditEvent` for
-- the realtime-side variants (ChannelCreated, ChannelUpdated,
-- ChannelDeleted, AccessPolicyCreated, AccessPolicyDeleted).
--
--   event_type     wire-stable snake_case string. Same axis the
--                  admin UI filters on; also names the metadata
--                  shape (a "channel_created" row's metadata is
--                  the ChannelCreated variant's JSON).
--   actor_id       FK to users.id; the caller whose request
--                  produced the event. NULL for system events
--                  (none today; reserved for future cron / WS
--                  drop reconcilers). FK is SET NULL on actor
--                  delete — the audit row outlives the user.
--   resource_type  AccessPolicyResourceType integer (Channel=0,
--                  User=1, AccessPolicy=2, MowsApp=3).
--   resource_id    NULL when the event is type-level (none today
--                  on the realtime side; reserved).
--   ts             event time; defaults to `now()`.
--   metadata       JSONB per-event fields. Schema lives in the
--                  AuditEvent enum's serde derivation.

CREATE TABLE "audit_log" (
    "id"            UUID      NOT NULL PRIMARY KEY,
    "event_type"    TEXT      NOT NULL,
    "actor_id"      UUID      REFERENCES "users"("id") ON DELETE SET NULL,
    "resource_type" SMALLINT  NOT NULL,
    "resource_id"   UUID      NULL,
    "ts"            TIMESTAMP NOT NULL DEFAULT now(),
    "metadata"      JSONB     NOT NULL DEFAULT '{}'::jsonb
);

-- The hot query shapes for the Phase-7 admin UI mirror filez's:
--   1. events on a specific resource → (resource_type, resource_id, ts DESC)
--   2. events by a specific actor    → (actor_id, ts DESC)
--   3. timeline / event-type filter  → (event_type, ts DESC)
--   4. global timeline               → (ts DESC)
CREATE INDEX "audit_log_by_resource"
    ON "audit_log" ("resource_type", "resource_id", "ts" DESC);
CREATE INDEX "audit_log_by_actor"
    ON "audit_log" ("actor_id", "ts" DESC);
CREATE INDEX "audit_log_by_event_type"
    ON "audit_log" ("event_type", "ts" DESC);
CREATE INDEX "audit_log_by_ts"
    ON "audit_log" ("ts" DESC);
