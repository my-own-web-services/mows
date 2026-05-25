-- Scenario: list everything user U can see using the stream-merge
-- approach, expressed as a single SQL query for benchmarking.
-- (The real engine merges in Rust; this is the "what the engine
-- pushes down per source" sanity check.)
--
-- The trick: instead of UNION+EXCEPT then ORDER+LIMIT, we use a
-- single LATERAL union with per-source ordering, then ORDER+LIMIT
-- the outer set, letting Postgres push the keyset filter into each
-- source. Each source is bounded by LIMIT page_size from the start.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_user_id '\'' `echo -n "user-3"  | md5sum | cut -d' ' -f1` '\''
\set target_app_id  '\'' `echo -n "app-1"   | md5sum | cut -d' ' -f1` '\''
\set page_size 50

\echo '=== sorted-stream merge (single SQL) ==='

PREPARE stream_list(uuid, uuid, int) AS
WITH user_groups_of_subject AS (
    SELECT user_group_id FROM user_user_group_members WHERE user_id = $1
),
owned AS (
    SELECT f.id AS resource_id, f.created_time AS sort_key
    FROM   files f
    WHERE  f.owner_id = $1
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  $3
),
direct_user AS (
    SELECT f.id AS resource_id, f.created_time AS sort_key
    FROM   access_policies ap
    JOIN   files f ON f.id = ap.resource_id
    WHERE  ap.subject_type = 0 AND ap.subject_id = $1
      AND  ap.resource_type = 0
      AND  ap.effect = 1
      AND  ap.actions @> ARRAY[0::smallint]
      AND  ap.context_app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  ap.resource_scope = 0
      AND  NOT ap.revoked
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  $3
),
direct_group AS (
    SELECT f.id AS resource_id, f.created_time AS sort_key
    FROM   access_policies ap
    JOIN   files f ON f.id = ap.resource_id
    WHERE  ap.subject_type = 1
      AND  ap.subject_id IN (SELECT user_group_id FROM user_groups_of_subject)
      AND  ap.resource_type = 0
      AND  ap.effect = 1
      AND  ap.actions @> ARRAY[0::smallint]
      AND  ap.context_app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  ap.resource_scope = 0
      AND  NOT ap.revoked
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  $3
),
via_resource_group AS (
    SELECT f.id AS resource_id, f.created_time AS sort_key
    FROM   access_policies ap
    JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
    JOIN   files f ON f.id = ffgm.file_id
    WHERE  ap.resource_type = 1
      AND  ap.effect = 1
      AND  ap.actions @> ARRAY[10::smallint]
      AND  ap.context_app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  ap.resource_scope = 0
      AND  NOT ap.revoked
      AND  ((ap.subject_type = 0 AND ap.subject_id = $1)
         OR (ap.subject_type = 1
             AND ap.subject_id IN (SELECT user_group_id FROM user_groups_of_subject)))
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  $3
),
public_cover AS (
    SELECT pr.resource_id, pr.sort_created AS sort_key
    FROM   public_resources pr
    WHERE  pr.resource_type = 0
      AND  pr.app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  pr.actions @> ARRAY[0::smallint]
    ORDER  BY pr.sort_created DESC, pr.resource_id DESC
    LIMIT  $3
),
server_member_cover AS (
    SELECT smr.resource_id, smr.sort_created AS sort_key
    FROM   server_member_resources smr
    WHERE  smr.resource_type = 0
      AND  smr.app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  smr.actions @> ARRAY[0::smallint]
    ORDER  BY smr.sort_created DESC, smr.resource_id DESC
    LIMIT  $3
),
candidates AS (
    SELECT DISTINCT ON (resource_id) resource_id, sort_key FROM (
        SELECT resource_id, sort_key FROM owned
        UNION ALL
        SELECT resource_id, sort_key FROM direct_user
        UNION ALL
        SELECT resource_id, sort_key FROM direct_group
        UNION ALL
        SELECT resource_id, sort_key FROM via_resource_group
        UNION ALL
        SELECT resource_id, sort_key FROM public_cover
        UNION ALL
        SELECT resource_id, sort_key FROM server_member_cover
    ) all_sources
    ORDER BY resource_id, sort_key DESC
)
SELECT f.id, f.name, f.created_time
FROM   candidates c
JOIN   files f ON f.id = c.resource_id
-- Deny check per candidate
WHERE  NOT EXISTS (
    SELECT 1
    FROM   access_policies ap
    WHERE  ap.resource_type = 0 AND ap.resource_id = f.id
      AND  ap.effect = 0
      AND  ap.actions @> ARRAY[0::smallint]
      AND  ap.context_app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  NOT ap.revoked
      AND  ((ap.subject_type = 0 AND ap.subject_id = $1)
         OR (ap.subject_type = 1
             AND ap.subject_id IN (SELECT user_group_id FROM user_user_group_members WHERE user_id = $1))
         OR ap.subject_type = 2
         OR ap.subject_type = 3)
)
ORDER BY f.created_time DESC, f.id DESC
LIMIT $3;

EXECUTE stream_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size);
EXECUTE stream_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size);
EXECUTE stream_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size);

\echo '--- EXPLAIN ANALYZE ---'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
EXECUTE stream_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size);

DEALLOCATE stream_list;
\timing off
