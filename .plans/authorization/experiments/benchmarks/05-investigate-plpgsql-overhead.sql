-- Investigate why list_visible(scope=All) is 20× slower than the
-- equivalent inline SQL. Compare: same query, parametric vs literal.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_user_id '\'' `echo -n "user-3" | md5sum | cut -d' ' -f1` '\''
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''
\set page_size 50

-- prefetch groups so EXPLAIN sees them
SELECT array_agg(user_group_id) AS groups
FROM   user_user_group_members
WHERE  user_id = :target_user_id ::uuid
\gset

\echo '== (a) inline literal SQL — should be fast =='
EXPLAIN (ANALYZE, BUFFERS)
WITH
owned AS (
    SELECT f.id AS rid, f.created_time AS ts FROM files f
    WHERE  f.owner_id = :target_user_id ::uuid
    ORDER  BY f.created_time DESC, f.id DESC LIMIT :page_size
),
direct_user AS (
    SELECT f.id AS rid, f.created_time AS ts
    FROM   access_policies ap JOIN files f ON f.id = ap.resource_id
    WHERE  ap.subject_type = 0 AND ap.subject_id = :target_user_id ::uuid
      AND  ap.resource_type = 0 AND ap.effect = 1 AND ap.resource_scope = 0
      AND  ap.actions @> ARRAY[0::smallint]
      AND  ap.context_app_ids && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
      AND  NOT ap.revoked
    ORDER BY f.created_time DESC, f.id DESC LIMIT :page_size
),
public_cover AS (
    SELECT pr.resource_id AS rid, pr.sort_created AS ts FROM public_resources pr
    WHERE  pr.resource_type = 0
      AND  pr.app_ids && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
      AND  pr.actions @> ARRAY[0::smallint]
    ORDER BY pr.sort_created DESC, pr.resource_id DESC LIMIT :page_size
),
sm_cover AS (
    SELECT smr.resource_id AS rid, smr.sort_created AS ts FROM server_member_resources smr
    WHERE  smr.resource_type = 0
      AND  smr.app_ids && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
      AND  smr.actions @> ARRAY[0::smallint]
    ORDER BY smr.sort_created DESC, smr.resource_id DESC LIMIT :page_size
),
candidates AS (
    SELECT DISTINCT ON (rid) rid, ts FROM (
        SELECT rid, ts FROM owned
        UNION ALL SELECT rid, ts FROM direct_user
        UNION ALL SELECT rid, ts FROM public_cover
        UNION ALL SELECT rid, ts FROM sm_cover
    ) all_sources ORDER BY rid, ts DESC
)
SELECT c.rid, c.ts FROM candidates c
ORDER BY c.ts DESC, c.rid DESC LIMIT :page_size;

\echo '== (b) calling list_visible(...) =='
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM list_visible(
    :target_user_id ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, :page_size);

\timing off
