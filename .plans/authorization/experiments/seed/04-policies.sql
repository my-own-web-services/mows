-- Seed `access_policies` covering the realistic mix.
--
-- Per LISTING.md §1 target shape:
--   * n_public_shares           Public Allow policies on random files
--   * n_server_member_shares    ServerMember Allow policies on random files
--   * n_direct_user_shares      User → User direct shares
--   * n_direct_group_shares     User → UserGroup direct shares (on files)
--   * n_resource_group_shares   policies on file_groups (granting access to the group's files)
--   * n_deny_overrides          Deny rows carving out specific files (the security test)
--   * n_owned_by_owner          OwnedByOwner scope rows
--   * n_accessible_by_owner     AccessibleByOwner scope rows
--
-- The nil UUID is used for ServerMember/Public subject_id and for
-- the "any app" context sentinel.

\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''

BEGIN;

-- ---- Public shares ----
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-public-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,
    'public-' || s,
    3, -- Public
    :NIL_UUID::uuid,
    ARRAY[:NIL_UUID::uuid],                    -- any app
    0, -- File
    md5('file-' || (((s * 7) % :n_files) + 1))::uuid,
    0, -- Single
    ARRAY[0::smallint],                        -- FilesGet
    1  -- Allow
FROM generate_series(1, :n_public_shares) s
;

-- ---- ServerMember shares ----
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-sm-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,
    'sm-' || s,
    2, -- ServerMember
    :NIL_UUID::uuid,
    ARRAY[:NIL_UUID::uuid],
    0,
    md5('file-' || (((s * 11) % :n_files) + 1))::uuid,
    0,
    ARRAY[0::smallint],
    1
FROM generate_series(1, :n_server_member_shares) s
;

-- ---- Direct User shares ----
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-du-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,                   -- owner
    'du-' || s,
    0, -- User
    md5('user-' || (((s * 13) % :n_users) + 1))::uuid,            -- subject
    ARRAY[:NIL_UUID::uuid],
    0,
    md5('file-' || (((s * 19) % :n_files) + 1))::uuid,
    0,
    ARRAY[0::smallint],
    1
FROM generate_series(1, :n_direct_user_shares) s
;

-- ---- Direct UserGroup shares (on files) ----
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-dg-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,
    'dg-' || s,
    1, -- UserGroup
    md5('ug-' || (((s * 23) % :n_user_groups) + 1))::uuid,
    ARRAY[:NIL_UUID::uuid],
    0,
    md5('file-' || (((s * 29) % :n_files) + 1))::uuid,
    0,
    ARRAY[0::smallint],
    1
FROM generate_series(1, :n_direct_group_shares) s
;

-- ---- Resource-group shares (UserGroup → FileGroup) ----
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-rg-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,
    'rg-' || s,
    1,
    md5('ug-' || (((s * 31) % :n_user_groups) + 1))::uuid,
    ARRAY[:NIL_UUID::uuid],
    1, -- FileGroup
    md5('fg-' || (((s * 37) % :n_file_groups) + 1))::uuid,
    0,
    ARRAY[10::smallint],                       -- FileGroupsListFiles
    1
FROM generate_series(1, :n_resource_group_shares) s
;

-- ---- Deny overrides ----
-- Each deny carves out a specific file from a previously-public share.
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-deny-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,
    'deny-' || s,
    0,
    md5('user-' || (((s * 41) % :n_users) + 1))::uuid,
    ARRAY[:NIL_UUID::uuid],
    0,
    md5('file-' || (((s * 7) % :n_files) + 1))::uuid,             -- collides with public-share files
    0,
    ARRAY[0::smallint],
    0  -- Deny
FROM generate_series(1, :n_deny_overrides) s
;

-- ---- OwnedByOwner scope ----
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-obo-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,
    'obo-' || s,
    0,
    md5('user-' || (((s * 43) % :n_users) + 1))::uuid,
    ARRAY[md5('app-1')::uuid],
    0,
    NULL,
    1, -- OwnedByOwner
    ARRAY[0::smallint],
    1
FROM generate_series(1, :n_owned_by_owner) s
;

-- ---- AccessibleByOwner scope ----
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
)
SELECT
    md5('pol-abo-' || s)::uuid,
    md5('user-' || ((s % :n_users) + 1))::uuid,
    'abo-' || s,
    0,
    md5('user-' || (((s * 47) % :n_users) + 1))::uuid,
    ARRAY[md5('app-1')::uuid],
    0,
    NULL,
    2, -- AccessibleByOwner
    ARRAY[0::smallint],
    1
FROM generate_series(1, :n_accessible_by_owner) s
;

ANALYZE access_policies;

COMMIT;

SELECT
    CASE subject_type
        WHEN 0 THEN 'User'
        WHEN 1 THEN 'UserGroup'
        WHEN 2 THEN 'ServerMember'
        WHEN 3 THEN 'Public'
    END AS subject_type,
    CASE effect WHEN 0 THEN 'Deny' ELSE 'Allow' END AS effect,
    resource_scope,
    count(*) AS n
FROM access_policies
GROUP BY subject_type, effect, resource_scope
ORDER BY subject_type, effect, resource_scope;
