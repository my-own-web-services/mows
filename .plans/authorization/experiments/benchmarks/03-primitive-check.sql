-- Bench: check_access per-resource. The cost of a single "is X
-- allowed to do Y on Z" call.

\timing on
\set target_user_id '\'' `echo -n "user-3" | md5sum | cut -d' ' -f1` '\''
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''

-- Pick three categories of resource:
-- (1) one owned by the target user
-- (2) one shared via a Public policy (should hit access_policies)
-- (3) one not accessible (default deny)
SELECT id AS owned_id
FROM   files WHERE owner_id = :target_user_id ::uuid LIMIT 1
\gset

SELECT resource_id AS public_id FROM public_resources LIMIT 1
\gset

SELECT id AS unrelated_id
FROM   files WHERE owner_id <> :target_user_id ::uuid
  AND  id NOT IN (SELECT resource_id FROM public_resources)
  AND  id NOT IN (SELECT resource_id FROM server_member_resources)
LIMIT 1
\gset

\echo '== owned (fast path) =='
SELECT check_access(:target_user_id ::uuid, :target_app_id ::uuid,
                    0::smallint, :'owned_id'::uuid, 0::smallint);
EXPLAIN (ANALYZE, BUFFERS)
SELECT check_access(:target_user_id ::uuid, :target_app_id ::uuid,
                    0::smallint, :'owned_id'::uuid, 0::smallint);

\echo '== public (via access_policies allow path) =='
SELECT check_access(:target_user_id ::uuid, :target_app_id ::uuid,
                    0::smallint, :'public_id'::uuid, 0::smallint);
EXPLAIN (ANALYZE, BUFFERS)
SELECT check_access(:target_user_id ::uuid, :target_app_id ::uuid,
                    0::smallint, :'public_id'::uuid, 0::smallint);

\echo '== unrelated (default deny) =='
SELECT check_access(:target_user_id ::uuid, :target_app_id ::uuid,
                    0::smallint, :'unrelated_id'::uuid, 0::smallint);
EXPLAIN (ANALYZE, BUFFERS)
SELECT check_access(:target_user_id ::uuid, :target_app_id ::uuid,
                    0::smallint, :'unrelated_id'::uuid, 0::smallint);

\timing off
