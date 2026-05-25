-- Seed users, apps, user_groups, memberships.
-- Parameters (psql -v):
--   n_users           — total users
--   n_apps            — total apps (small, e.g. 5–20)
--   n_user_groups     — total user-groups
--   ug_membership_avg — average user-groups per user (skewed distribution)
--
-- Deterministic IDs from md5(seed) so subsequent seeds reference the
-- same rows when we rerun a single script.

BEGIN;

-- ---- users ----

INSERT INTO users (id, external_user_id, display_name, user_type)
SELECT
    md5('user-' || s)::uuid                 AS id,
    'ext-user-' || s                        AS external_user_id,
    'User ' || s                            AS display_name,
    CASE WHEN s = 1 THEN 0 ELSE 1 END       AS user_type
        -- user 1 is the SuperAdmin
FROM generate_series(1, :n_users) s;

-- ---- apps ----

INSERT INTO apps (id, name, trusted, app_type)
SELECT
    md5('app-' || s)::uuid                          AS id,
    'app-' || s                                     AS name,
    CASE WHEN s <= 2 THEN TRUE ELSE FALSE END       AS trusted,
        -- apps 1–2 are trusted first-party UIs
    0                                                AS app_type
FROM generate_series(1, :n_apps) s;

-- ---- user_groups ----
-- Owner picked deterministically. Skewed group sizes via the "shape"
-- column below: groups indexed early are very large; later groups are
-- small.

INSERT INTO user_groups (id, owner_id, name, visibility, join_policy)
SELECT
    md5('ug-' || s)::uuid                                     AS id,
    md5('user-' || ((s % :n_users) + 1))::uuid                AS owner_id,
    'Group ' || s                                              AS name,
    CASE WHEN s % 3 = 0 THEN 2
         WHEN s % 3 = 1 THEN 1
         ELSE 0
    END                                                        AS visibility,
    CASE WHEN s % 3 = 0 THEN 2
         WHEN s % 3 = 1 THEN 1
         ELSE 0
    END                                                        AS join_policy
FROM generate_series(1, :n_user_groups) s;

-- ---- user_user_group_members ----
-- We want a skewed distribution:
--   * group_index 1: ~50% of all users are members (the "everyone" group)
--   * group_index 2: ~25%
--   * group_index ≤ 5: a few hundred members
--   * the rest: small (3–10 members) or empty
--
-- Implementation via series + modular arithmetic.

-- huge group 1: every other user
INSERT INTO user_user_group_members (user_id, user_group_id)
SELECT
    md5('user-' || u)::uuid,
    md5('ug-1')::uuid
FROM generate_series(1, :n_users) u
WHERE u % 2 = 0
ON CONFLICT DO NOTHING;

-- huge group 2: every fourth user
INSERT INTO user_user_group_members (user_id, user_group_id)
SELECT
    md5('user-' || u)::uuid,
    md5('ug-2')::uuid
FROM generate_series(1, :n_users) u
WHERE u % 4 = 0
ON CONFLICT DO NOTHING;

-- medium groups 3–5: every 10th, 20th, 50th
INSERT INTO user_user_group_members (user_id, user_group_id)
SELECT md5('user-' || u)::uuid, md5('ug-3')::uuid
FROM generate_series(1, :n_users) u WHERE u % 10  = 0
ON CONFLICT DO NOTHING;
INSERT INTO user_user_group_members (user_id, user_group_id)
SELECT md5('user-' || u)::uuid, md5('ug-4')::uuid
FROM generate_series(1, :n_users) u WHERE u % 20  = 0
ON CONFLICT DO NOTHING;
INSERT INTO user_user_group_members (user_id, user_group_id)
SELECT md5('user-' || u)::uuid, md5('ug-5')::uuid
FROM generate_series(1, :n_users) u WHERE u % 50  = 0
ON CONFLICT DO NOTHING;

-- many small groups: each remaining group gets 3–10 members drawn
-- pseudo-randomly via hash modulo.
INSERT INTO user_user_group_members (user_id, user_group_id)
SELECT
    md5('user-' || (((g * 31 + k) % :n_users) + 1))::uuid AS user_id,
    md5('ug-' || g)::uuid                                       AS user_group_id
FROM generate_series(6, :n_user_groups) g,
     generate_series(0, 6) k
ON CONFLICT DO NOTHING;

COMMIT;

-- Report
SELECT 'users'   AS table, count(*) FROM users
UNION ALL
SELECT 'apps',                count(*) FROM apps
UNION ALL
SELECT 'user_groups',         count(*) FROM user_groups
UNION ALL
SELECT 'uugm',                count(*) FROM user_user_group_members;
