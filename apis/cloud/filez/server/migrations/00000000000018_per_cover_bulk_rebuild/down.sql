-- Drop the per-cover bulk-rebuild functions and restore the
-- migration-00017 form of recompute_user_group_materialize_flags.

DROP FUNCTION IF EXISTS rebuild_user_group_cover(UUID);
DROP FUNCTION IF EXISTS rebuild_public_cover();
DROP FUNCTION IF EXISTS rebuild_server_member_cover();

CREATE OR REPLACE FUNCTION recompute_user_group_materialize_flags() RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    threshold INTEGER := user_group_materialize_threshold();
    n_changed INTEGER;
BEGIN
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
        RETURNING ug.id
    )
    SELECT count(*)::INTEGER INTO n_changed FROM updates;

    RETURN n_changed;
END;
$$;
