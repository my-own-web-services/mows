-- Listing cover-table reconciler.
--
-- Phase 5 P5-2: the per-row triggers from migration 00007 maintain
-- public_resources / server_member_resources /
-- user_group_accessible_resources on every access_policies INSERT
-- / UPDATE / DELETE. But triggers don't fire for:
--
--   * Bulk-loader paths that target the table directly
--     (e.g. `COPY access_policies FROM …` for one-shot imports,
--     `TRUNCATE access_policies` for test fixtures).
--   * Future migrations that mass-update policy rows without
--     touching the trigger (e.g. a schema change to `subject_id`).
--   * Trigger function bugs introduced by a future migration.
--   * Manual SQL the operator runs to fix something.
--
-- The reconciler is the safety net. It re-derives every cover row
-- from the current state of `access_policies` and lets the existing
-- `refresh_listing_cover_row` PL/pgSQL function (migration 00007)
-- self-heal each one. Cost: O(distinct subject × resource pairs);
-- at the USER_GROUPS.md §1 scale target it's a few hundred
-- thousand rows in postgres-side memory.
--
-- Returns the number of (subject, resource) pairs processed. The
-- Rust scheduler writes this to `audit_log` with event_type =
-- `cover_tables_reconciled` so an admin can spot anomalies (e.g.
-- the count suddenly halves, suggesting active policies were
-- silently dropped).

CREATE OR REPLACE FUNCTION reconcile_listing_cover_tables() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    r           RECORD;
    n_processed INTEGER := 0;
BEGIN
    -- Tombstone every contributing (subject, resource) pair via
    -- the same refresh function the triggers use. Idempotent
    -- UPSERTs; if the row already matches the re-derived state
    -- the upsert is a no-op cost-wise.
    FOR r IN
        SELECT DISTINCT subject_type, subject_id, resource_type, resource_id
        FROM   access_policies
        WHERE  subject_type IN (1, 2, 3)        -- UserGroup / ServerMember / Public
          AND  resource_id IS NOT NULL
          AND  access_policy_contributes_to_cover(
                  effect, resource_id, resource_scope, revoked, expires_at)
    LOOP
        PERFORM refresh_listing_cover_row(
            r.subject_type::SMALLINT, r.subject_id,
            r.resource_type::SMALLINT, r.resource_id
        );
        n_processed := n_processed + 1;
    END LOOP;

    -- Second pass: zap any cover rows whose underlying policies are
    -- ALL gone (the trigger's DELETE-when-empty branch handles
    -- per-row deletes, but a bulk-delete that bypassed the trigger
    -- leaves orphan cover rows behind). For each existing cover
    -- row, the refresh function takes the same decision the trigger
    -- would — INSERT/UPDATE if policies remain, DELETE if none do.
    FOR r IN
        SELECT 3::SMALLINT AS subject_type,
               '00000000-0000-0000-0000-000000000000'::UUID AS subject_id,
               resource_type, resource_id
        FROM   public_resources
        UNION ALL
        SELECT 2::SMALLINT AS subject_type,
               '00000000-0000-0000-0000-000000000000'::UUID AS subject_id,
               resource_type, resource_id
        FROM   server_member_resources
        UNION ALL
        SELECT 1::SMALLINT AS subject_type,
               user_group_id AS subject_id,
               resource_type, resource_id
        FROM   user_group_accessible_resources
    LOOP
        PERFORM refresh_listing_cover_row(
            r.subject_type, r.subject_id, r.resource_type, r.resource_id
        );
        -- Don't double-count rows already handled in pass 1 —
        -- but cheap to call refresh_listing_cover_row twice
        -- (idempotent), so we just don't increment here.
    END LOOP;

    RETURN n_processed;
END;
$$;
