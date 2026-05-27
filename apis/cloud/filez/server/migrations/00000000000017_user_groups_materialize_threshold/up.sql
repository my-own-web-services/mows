-- Phase 5 P5-3: adaptive materialisation threshold.
--
-- LISTING.md §6.2: small user-groups should NOT be materialised in
-- `user_group_accessible_resources` — the per-page live join over
-- a group with 10 members is cheaper than a cover-table scan, and
-- the trigger maintenance cost on every access_policies write is
-- pure overhead. Above the cardinality threshold (1000 members,
-- per the spec) the trade-off inverts: the materialised path
-- dominates and the trigger cost is amortised across many reads.
--
-- This migration lands the persistent flag + the per-group
-- recompute function. The Phase-3 read path (still pending) is
-- what consumes the flag; today it's metadata that a background
-- job keeps in sync.
--
-- The trigger that maintains `user_group_accessible_resources`
-- (migration 00000000000007) is NOT changed by this migration —
-- materialisation continues unconditionally. Phase 3 will modify
-- the trigger to skip groups with `materialize_uga = false` once
-- the read path can fall back to the live-join.

ALTER TABLE user_groups
    ADD COLUMN materialize_uga BOOLEAN NOT NULL DEFAULT false;

-- Threshold at which materialisation flips on. Constant per the
-- spec; future tuning lives in this one literal. A function lets
-- the recompute job and any future read-path consumer agree.
CREATE OR REPLACE FUNCTION user_group_materialize_threshold() RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
    SELECT 1000
$$;

-- Recompute every group's `materialize_uga` flag from the current
-- member count. Returns the count of groups whose flag actually
-- changed (so the scheduler can emit a single audit row with the
-- churn number; a sudden spike means the threshold is misaligned
-- with the group-size distribution).
--
-- Cost: one COUNT per user_groups row. At the
-- USER_GROUPS.md §1 scale target (100k groups) this is fine for
-- a once-daily sweep; faster if needed via a single GROUP BY
-- against user_user_group_members.
CREATE OR REPLACE FUNCTION recompute_user_group_materialize_flags() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    threshold INTEGER := user_group_materialize_threshold();
    n_changed INTEGER;
BEGIN
    WITH counts AS (
        SELECT ug.id,
               COALESCE(
                   (SELECT count(*)::INTEGER
                      FROM user_user_group_members m
                      WHERE m.user_group_id = ug.id),
                   0
               ) AS member_count,
               ug.materialize_uga AS current_flag
        FROM user_groups ug
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
        RETURNING ug.id
    )
    SELECT count(*)::INTEGER INTO n_changed FROM updates;

    RETURN n_changed;
END;
$$;

-- Partial index: only the materialised groups. Tiny — the spec
-- targets 100k total groups with only the >1000-member ones
-- materialised, so this index covers the cheap "which groups are
-- on the materialised path?" query Phase 3 will need.
CREATE INDEX user_groups_materialized
    ON user_groups (id)
    WHERE materialize_uga;
