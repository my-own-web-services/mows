-- Pathological scenarios from LISTING.md §9.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''
\set page_size 50

\echo '=== P1: list inside the 10%-of-files file_group (fg-1) ==='
\echo '    — keyset paginate the 100k-member file_group'
\set fg1 '\'' `echo -n "fg-1" | md5sum | cut -d' ' -f1` '\''

EXPLAIN (ANALYZE, BUFFERS)
SELECT f.id, f.name, f.created_time
FROM   file_file_group_members ffgm
JOIN   files f ON f.id = ffgm.file_id
WHERE  ffgm.file_group_id = :fg1 ::uuid
ORDER  BY f.created_time DESC, f.id DESC
LIMIT  :page_size;

-- second run
SELECT count(*) FROM (
    SELECT f.id FROM file_file_group_members ffgm
    JOIN files f ON f.id = ffgm.file_id
    WHERE ffgm.file_group_id = :fg1 ::uuid
    ORDER BY f.created_time DESC, f.id DESC
    LIMIT :page_size
) t;

\echo '=== P2: user in user-group "ug-1" (the every-other-user group) ==='
\echo '    — list files shared with ug-1 from large-group cover'

\set ug1 '\'' `echo -n "ug-1" | md5sum | cut -d' ' -f1` '\''

EXPLAIN (ANALYZE, BUFFERS)
SELECT f.id, f.name, ugar.sort_created
FROM   user_group_accessible_resources ugar
JOIN   files f ON f.id = ugar.resource_id
WHERE  ugar.user_group_id = :ug1 ::uuid
  AND  ugar.resource_type = 0
  AND  ugar.app_ids && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
  AND  ugar.actions @> ARRAY[0::smallint]
ORDER  BY ugar.sort_created DESC, ugar.resource_id DESC
LIMIT  :page_size;

\echo '=== P3: AccessibleByOwner recursion ==='
\echo '    — user u has an AccessibleByOwner policy from policy.owner = v'
\echo '    — listing for u must inline-expand to "what v can see"'
\echo '    For benchmark: pick any AccessibleByOwner subject and list via the recursive plan'

DO $$
DECLARE
    v_subject uuid;
    v_owner   uuid;
    v_app     uuid := md5('app-1')::uuid;
BEGIN
    SELECT subject_id, owner_id INTO v_subject, v_owner
    FROM   access_policies
    WHERE  resource_scope = 2
    LIMIT  1;

    RAISE NOTICE 'AccessibleByOwner subject=%, policy.owner=%', v_subject, v_owner;
    -- The recursion: subject u wants "what owner v can see"
    -- Approximation: run an OwnerOnly list for v + everything shared
    -- directly with v (not nesting through another AccessibleByOwner
    -- per the cycle-break in POLICY_SEMANTICS.md §4).
END $$;

-- approximate the recursion: a stream-merge for the policy.owner
WITH abo AS (
    SELECT subject_id AS u, owner_id AS v
    FROM   access_policies
    WHERE  resource_scope = 2
    LIMIT  1
)
SELECT count(*)
FROM   (
    -- v's owned (page_size)
    SELECT f.id, f.created_time
    FROM   files f, abo
    WHERE  f.owner_id = abo.v
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  50
) recursive_set;

\timing off
