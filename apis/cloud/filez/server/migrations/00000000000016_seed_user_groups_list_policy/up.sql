-- Phase 4 P4-10: server-wide seed policy.
--
-- USER_GROUPS.md §6 + USER_GROUPS.md §3 imply that any
-- authenticated user can call the group directory
-- (POST /api/user_groups/list with the default AccessGranted
-- filter). Today the handler gates with
-- `AccessPolicy::check(UserGroupsList)` at type-level
-- (resource_id IS NULL), so non-admin callers receive 403 until
-- some policy grants them UserGroupsList — and without this seed,
-- no such policy exists.
--
-- One row, deterministic id, idempotent on re-run. Subject =
-- ServerMember (sentinel = nil_uuid), context_app_ids =
-- ARRAY[nil_uuid] ("any app"), resource_type = UserGroup,
-- resource_id NULL (type-level), action = UserGroupsList (300).
--
-- The owner_id field is required NOT NULL on access_policies; we
-- use the `nobody` sentinel (USER_GROUPS.md §7.5) so the row
-- doesn't pretend to be authored by a real human and so
-- ON DELETE CASCADE from users does not delete the seed.

INSERT INTO access_policies (
    id,
    owner_id,
    name,
    created_time,
    modified_time,
    subject_type,
    subject_id,
    context_app_ids,
    resource_type,
    resource_id,
    actions,
    effect,
    expires_at,
    revoked,
    resource_scope
) VALUES (
    -- Deterministic UUID. The `5eed` prefix flags it as a seed row.
    '5eed0001-0000-0000-0000-000000000001',
    '0000bad1-0000-0000-0000-000000000001',           -- owned by `nobody`
    'seed: ServerMember can list user groups',
    now(),
    now(),
    2,                                                -- SubjectType::ServerMember
    '00000000-0000-0000-0000-000000000000',           -- sentinel; ignored for ServerMember
    ARRAY['00000000-0000-0000-0000-000000000000']::UUID[], -- any app
    1,                                                -- AccessPolicyResourceType::UserGroup
    NULL,                                             -- type-level
    ARRAY[300]::SMALLINT[],                           -- UserGroupsList
    1,                                                -- Effect::Allow
    NULL,
    false,
    0                                                 -- ResourceScope::Single
) ON CONFLICT (id) DO NOTHING;
