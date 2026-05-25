-- Scenario: full "what can user U see" via the rejected
-- UNION + EXCEPT approach (LISTING.md §2 — kept here as the
-- baseline we are proving we beat).

\timing on

\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_user_id '\'' `echo -n "user-3" | md5sum | cut -d' ' -f1` '\''
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''

\echo 'subject + app:'
SELECT :target_user_id ::uuid AS user, :target_app_id ::uuid AS app;

-- Pre-compute the user-group membership list for the subject.
-- (In the real engine this is one per-request lookup; here we
-- inline it via CTE so the planner sees the small set.)

PREPARE naive_list(uuid, uuid) AS
WITH user_groups_of_subject AS (
    SELECT user_group_id
    FROM   user_user_group_members
    WHERE  user_id = $1
),
owned AS (
    SELECT id AS resource_id
    FROM   files
    WHERE  owner_id = $1
),
direct AS (
    SELECT ap.resource_id, ap.effect
    FROM   access_policies ap
    WHERE  ap.resource_type = 0
      AND  ap.actions @> ARRAY[0::smallint]
      AND  ap.context_app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  ap.resource_scope = 0
      AND  ap.resource_id IS NOT NULL
      AND  NOT ap.revoked
      AND  ((ap.subject_type = 0 AND ap.subject_id = $1)
            OR (ap.subject_type = 1
                AND ap.subject_id IN (SELECT user_group_id FROM user_groups_of_subject))
            OR ap.subject_type = 2
            OR ap.subject_type = 3)
),
via_group AS (
    SELECT ffgm.file_id AS resource_id, ap.effect
    FROM   file_file_group_members ffgm
    JOIN   access_policies ap ON ap.resource_id = ffgm.file_group_id
                              AND ap.resource_type = 1
    WHERE  ap.actions @> ARRAY[0::smallint, 10::smallint]
      AND  ap.context_app_ids && ARRAY[$2, '00000000-0000-0000-0000-000000000000'::uuid]
      AND  ap.resource_scope = 0
      AND  NOT ap.revoked
      AND  ((ap.subject_type = 0 AND ap.subject_id = $1)
            OR (ap.subject_type = 1
                AND ap.subject_id IN (SELECT user_group_id FROM user_groups_of_subject))
            OR ap.subject_type = 2
            OR ap.subject_type = 3)
),
all_allow AS (
    SELECT resource_id FROM owned
    UNION SELECT resource_id FROM direct    WHERE effect = 1
    UNION SELECT resource_id FROM via_group WHERE effect = 1
),
all_deny AS (
    SELECT resource_id FROM direct    WHERE effect = 0
    UNION SELECT resource_id FROM via_group WHERE effect = 0
)
SELECT f.id, f.name, f.created_time
FROM files f
WHERE f.id IN (SELECT resource_id FROM all_allow
               EXCEPT
               SELECT resource_id FROM all_deny)
ORDER BY f.created_time DESC, f.id DESC
LIMIT 50;

EXECUTE naive_list(:target_user_id ::uuid, :target_app_id ::uuid);
EXECUTE naive_list(:target_user_id ::uuid, :target_app_id ::uuid);
EXECUTE naive_list(:target_user_id ::uuid, :target_app_id ::uuid);

\echo '--- EXPLAIN ANALYZE ---'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
EXECUTE naive_list(:target_user_id ::uuid, :target_app_id ::uuid);

DEALLOCATE naive_list;

\timing off
