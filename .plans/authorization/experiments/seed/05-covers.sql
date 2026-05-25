-- Populate the cover tables from the live access_policies + resource
-- state. Uses aggregating JOINs (not correlated subqueries) so this
-- stays linear in policy count, not quadratic.

BEGIN;

TRUNCATE public_resources;
TRUNCATE server_member_resources;
TRUNCATE user_group_accessible_resources;

-- ---- public_resources ----
-- For each Public Allow policy, unnest its app_ids and actions, then
-- aggregate per resource. This is one scan of access_policies and
-- one scan of files.

INSERT INTO public_resources (
    resource_type, resource_id,
    sort_created, sort_modified, sort_name,
    app_ids, actions
)
SELECT
    0::smallint AS resource_type,
    f.id        AS resource_id,
    f.created_time, f.modified_time, f.name,
    agg.app_ids, agg.actions
FROM   files f
JOIN (
    SELECT
        ap.resource_id,
        array_agg(DISTINCT app_id  ORDER BY app_id)  FILTER (WHERE app_id  IS NOT NULL) AS app_ids,
        array_agg(DISTINCT action  ORDER BY action)  FILTER (WHERE action  IS NOT NULL) AS actions
    FROM   access_policies ap
    LEFT  JOIN LATERAL unnest(ap.context_app_ids) app_id ON TRUE
    LEFT  JOIN LATERAL unnest(ap.actions)         action ON TRUE
    WHERE  ap.subject_type = 3
      AND  ap.resource_type = 0
      AND  ap.effect = 1
      AND  NOT ap.revoked
      AND  ap.resource_id IS NOT NULL
    GROUP BY ap.resource_id
) agg ON agg.resource_id = f.id;

-- ---- server_member_resources ----

INSERT INTO server_member_resources (
    resource_type, resource_id,
    sort_created, sort_modified, sort_name,
    app_ids, actions
)
SELECT
    0::smallint, f.id,
    f.created_time, f.modified_time, f.name,
    agg.app_ids, agg.actions
FROM   files f
JOIN (
    SELECT
        ap.resource_id,
        array_agg(DISTINCT app_id  ORDER BY app_id)  FILTER (WHERE app_id  IS NOT NULL) AS app_ids,
        array_agg(DISTINCT action  ORDER BY action)  FILTER (WHERE action  IS NOT NULL) AS actions
    FROM   access_policies ap
    LEFT  JOIN LATERAL unnest(ap.context_app_ids) app_id ON TRUE
    LEFT  JOIN LATERAL unnest(ap.actions)         action ON TRUE
    WHERE  ap.subject_type = 2
      AND  ap.resource_type = 0
      AND  ap.effect = 1
      AND  NOT ap.revoked
      AND  ap.resource_id IS NOT NULL
    GROUP BY ap.resource_id
) agg ON agg.resource_id = f.id;

-- ---- user_group_accessible_resources ----
-- Populated for groups with > 1000 members. Direct allows and
-- resource-group allows both contribute.

WITH large_groups AS (
    SELECT user_group_id
    FROM   user_user_group_members
    GROUP  BY user_group_id
    HAVING count(*) >= 1000
),
direct_allows AS (
    SELECT
        ap.subject_id        AS user_group_id,
        ap.resource_id       AS resource_id,
        ap.context_app_ids   AS app_ids,
        ap.actions
    FROM   access_policies ap
    JOIN   large_groups lg ON lg.user_group_id = ap.subject_id
    WHERE  ap.subject_type = 1
      AND  ap.resource_type = 0
      AND  ap.effect = 1
      AND  NOT ap.revoked
      AND  ap.resource_id IS NOT NULL
),
rg_allows AS (
    SELECT
        ap.subject_id        AS user_group_id,
        ffgm.file_id         AS resource_id,
        ap.context_app_ids   AS app_ids,
        ap.actions
    FROM   access_policies ap
    JOIN   large_groups lg ON lg.user_group_id = ap.subject_id
    JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
    WHERE  ap.subject_type = 1
      AND  ap.resource_type = 1
      AND  ap.effect = 1
      AND  NOT ap.revoked
),
all_allows AS (
    SELECT * FROM direct_allows
    UNION ALL
    SELECT * FROM rg_allows
),
agg AS (
    SELECT
        user_group_id,
        resource_id,
        array_agg(DISTINCT app_id ORDER BY app_id)
            FILTER (WHERE app_id IS NOT NULL) AS app_ids,
        array_agg(DISTINCT action ORDER BY action)
            FILTER (WHERE action IS NOT NULL) AS actions
    FROM   all_allows
    LEFT  JOIN LATERAL unnest(app_ids) app_id ON TRUE
    LEFT  JOIN LATERAL unnest(actions) action ON TRUE
    GROUP BY user_group_id, resource_id
)
INSERT INTO user_group_accessible_resources (
    user_group_id, resource_type, resource_id,
    sort_created, sort_modified, sort_name,
    app_ids, actions
)
SELECT
    a.user_group_id,
    0::smallint,
    f.id,
    f.created_time, f.modified_time, f.name,
    a.app_ids, a.actions
FROM   agg a
JOIN   files f ON f.id = a.resource_id;

COMMIT;

SELECT 'public_resources'                   AS cover, count(*) FROM public_resources
UNION ALL
SELECT 'server_member_resources',           count(*) FROM server_member_resources
UNION ALL
SELECT 'user_group_accessible_resources',   count(*) FROM user_group_accessible_resources;
