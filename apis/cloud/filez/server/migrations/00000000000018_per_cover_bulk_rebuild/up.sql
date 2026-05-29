-- Per-cover bulk-rebuild API (Phase 5 P5-4 / ROADMAP §Phase 5).
--
-- Triggers and the hourly reconciler keep the three cover tables
-- (public_resources, server_member_resources,
-- user_group_accessible_resources) consistent across the whole
-- access_policies surface. There are two cases where that's too
-- much work:
--
--   1. A `user_group` flips from `materialize_uga = false` to
--      `true` (crosses the LISTING.md §6.2 threshold). The Phase-3
--      read-path consumer needs cover rows for THAT group only;
--      walking every distinct (subject, resource) pair across the
--      whole table is overkill.
--
--   2. An operator observes drift on one cover and wants to force
--      a rebuild without paying the full sweep cost (which holds a
--      connection for O(distinct pairs) iterations).
--
-- These functions are the targeted complement to
-- `reconcile_listing_cover_tables()` — same idempotent
-- `refresh_listing_cover_row` machinery, scoped to one cover at a
-- time. Each returns the row count it processed so the caller can
-- emit a single audit row with the number.

-- Rebuild every cover row for one user-group. Walks every distinct
-- (resource_type, resource_id) pair the group has an active
-- contributing Allow Single policy on, and recomputes the matching
-- `user_group_accessible_resources` row via the shared helper.
--
-- Also handles drift in the other direction: existing cover rows
-- for the group whose underlying policies are all gone are
-- DELETEd by the helper's empty-array branch.
CREATE OR REPLACE FUNCTION rebuild_user_group_cover(p_user_group_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    r           RECORD;
    n_processed INTEGER := 0;
BEGIN
    -- Pass 1: every contributing (resource_type, resource_id) for
    -- this group.
    FOR r IN
        SELECT DISTINCT resource_type, resource_id
        FROM   access_policies
        WHERE  subject_type    = 1
          AND  subject_id      = p_user_group_id
          AND  resource_id IS NOT NULL
          AND  access_policy_contributes_to_cover(
                  effect, resource_id, resource_scope, revoked, expires_at)
    LOOP
        PERFORM refresh_listing_cover_row(
            1::SMALLINT, p_user_group_id,
            r.resource_type::SMALLINT, r.resource_id
        );
        n_processed := n_processed + 1;
    END LOOP;

    -- Pass 2: existing cover rows whose policies are gone. The
    -- helper takes the same decision the trigger would
    -- (UPSERT if any policies remain, DELETE if none do).
    FOR r IN
        SELECT resource_type, resource_id
        FROM   user_group_accessible_resources
        WHERE  user_group_id = p_user_group_id
    LOOP
        PERFORM refresh_listing_cover_row(
            1::SMALLINT, p_user_group_id,
            r.resource_type::SMALLINT, r.resource_id
        );
        -- Don't double-count: pass 1 already incremented if the
        -- row has live policies. Pass 2 only fixes pure orphans.
    END LOOP;

    RETURN n_processed;
END;
$$;

-- Rebuild the entire `public_resources` cover table. Same shape
-- as the user-group function, but with no group_id filter — the
-- Public subject has a single sentinel subject_id so the walk is
-- over `(resource_type, resource_id)` pairs across all Public
-- policies.
CREATE OR REPLACE FUNCTION rebuild_public_cover()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    r           RECORD;
    n_processed INTEGER := 0;
BEGIN
    FOR r IN
        SELECT DISTINCT resource_type, resource_id
        FROM   access_policies
        WHERE  subject_type    = 3
          AND  resource_id IS NOT NULL
          AND  access_policy_contributes_to_cover(
                  effect, resource_id, resource_scope, revoked, expires_at)
    LOOP
        PERFORM refresh_listing_cover_row(
            3::SMALLINT,
            '00000000-0000-0000-0000-000000000000'::UUID,
            r.resource_type::SMALLINT, r.resource_id
        );
        n_processed := n_processed + 1;
    END LOOP;

    FOR r IN
        SELECT resource_type, resource_id
        FROM   public_resources
    LOOP
        PERFORM refresh_listing_cover_row(
            3::SMALLINT,
            '00000000-0000-0000-0000-000000000000'::UUID,
            r.resource_type::SMALLINT, r.resource_id
        );
    END LOOP;

    RETURN n_processed;
END;
$$;

-- Rebuild the entire `server_member_resources` cover table.
-- Mirrors `rebuild_public_cover()` with subject_type = 2.
CREATE OR REPLACE FUNCTION rebuild_server_member_cover()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    r           RECORD;
    n_processed INTEGER := 0;
BEGIN
    FOR r IN
        SELECT DISTINCT resource_type, resource_id
        FROM   access_policies
        WHERE  subject_type    = 2
          AND  resource_id IS NOT NULL
          AND  access_policy_contributes_to_cover(
                  effect, resource_id, resource_scope, revoked, expires_at)
    LOOP
        PERFORM refresh_listing_cover_row(
            2::SMALLINT,
            '00000000-0000-0000-0000-000000000000'::UUID,
            r.resource_type::SMALLINT, r.resource_id
        );
        n_processed := n_processed + 1;
    END LOOP;

    FOR r IN
        SELECT resource_type, resource_id
        FROM   server_member_resources
    LOOP
        PERFORM refresh_listing_cover_row(
            2::SMALLINT,
            '00000000-0000-0000-0000-000000000000'::UUID,
            r.resource_type::SMALLINT, r.resource_id
        );
    END LOOP;

    RETURN n_processed;
END;
$$;

-- Extend `recompute_user_group_materialize_flags()` so that every
-- group whose flag flipped from FALSE to TRUE in this sweep also
-- gets its cover bulk-rebuilt. This is the LISTING.md §6.2
-- crossing-the-threshold path: today the trigger maintains the
-- cover unconditionally, but once Phase 3 lands the trigger may
-- skip non-materialised groups — when a group then crosses the
-- threshold the cover needs a backfill.
--
-- Returns the count of flags flipped (same as before). The
-- bulk-rebuild cost is paid synchronously inside this function;
-- the caller's audit row already captures the flip count.
CREATE OR REPLACE FUNCTION recompute_user_group_materialize_flags() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    threshold INTEGER := user_group_materialize_threshold();
    n_changed INTEGER;
    promoted_id UUID;
BEGIN
    -- Same body as migration 00017, with one addition: capture the
    -- ids of groups that flipped from FALSE to TRUE so we can
    -- bulk-rebuild their covers.
    CREATE TEMP TABLE IF NOT EXISTS _materialize_promotions(
        user_group_id UUID PRIMARY KEY
    ) ON COMMIT DROP;
    TRUNCATE _materialize_promotions;

    WITH counts AS (
        SELECT ug.id,
               COALESCE(COUNT(m.user_id), 0)::INTEGER AS member_count,
               ug.materialize_uga AS current_flag
        FROM   user_groups ug
        LEFT JOIN user_user_group_members m
               ON m.user_group_id = ug.id
        GROUP BY ug.id, ug.materialize_uga
    ),
    next AS (
        SELECT id,
               (member_count >= threshold) AS new_flag,
               current_flag
        FROM counts
    ),
    updates AS (
        UPDATE user_groups ug
        SET    materialize_uga = next.new_flag
        FROM   next
        WHERE  ug.id = next.id
          AND  ug.materialize_uga IS DISTINCT FROM next.new_flag
        RETURNING ug.id, next.current_flag AS old_flag, next.new_flag
    ),
    captured_promotions AS (
        INSERT INTO _materialize_promotions(user_group_id)
        SELECT id FROM updates WHERE old_flag = FALSE AND new_flag = TRUE
        RETURNING 1
    )
    SELECT count(*)::INTEGER INTO n_changed FROM updates;

    -- Bulk-rebuild every promoted group's cover. Synchronous so the
    -- audit-log row the caller writes reflects post-rebuild state.
    FOR promoted_id IN
        SELECT user_group_id FROM _materialize_promotions
    LOOP
        PERFORM rebuild_user_group_cover(promoted_id);
    END LOOP;

    RETURN n_changed;
END;
$$;
