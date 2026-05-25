-- Scenario: paginate the most-recent N Public-shared files.
-- Compares (A) direct query against access_policies and (B) the
-- cover-table path.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_app_id '\'' `echo -n "app-1" | md5sum | cut -d' ' -f1` '\''

\echo '=== (A) without cover — JOIN access_policies + files ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT f.id, f.name, f.created_time
FROM   files f
JOIN   access_policies ap
    ON ap.resource_id = f.id
   AND ap.resource_type = 0
WHERE  ap.subject_type = 3
  AND  ap.effect = 1
  AND  ap.actions @> ARRAY[0::smallint]
  AND  ap.context_app_ids && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
  AND  NOT ap.revoked
ORDER BY f.created_time DESC, f.id DESC
LIMIT 50;

-- A second run (warm cache)
SELECT f.id FROM   files f
JOIN   access_policies ap ON ap.resource_id = f.id AND ap.resource_type = 0
WHERE  ap.subject_type = 3 AND ap.effect = 1
  AND  ap.actions @> ARRAY[0::smallint]
  AND  ap.context_app_ids && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
ORDER BY f.created_time DESC, f.id DESC LIMIT 50;

\echo '=== (B) using public_resources cover ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT f.id, f.name, pr.sort_created
FROM   public_resources pr
JOIN   files f ON f.id = pr.resource_id
WHERE  pr.resource_type = 0
  AND  pr.app_ids   && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
  AND  pr.actions   @> ARRAY[0::smallint]
ORDER BY pr.sort_created DESC, pr.resource_id DESC
LIMIT 50;

SELECT f.id FROM   public_resources pr
JOIN   files f ON f.id = pr.resource_id
WHERE  pr.resource_type = 0
  AND  pr.app_ids   && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
  AND  pr.actions   @> ARRAY[0::smallint]
ORDER BY pr.sort_created DESC, pr.resource_id DESC LIMIT 50;

\timing off
