-- USER_GROUPS.md §7.5 sentinel: when a group owner deletes their
-- account, the group's owner_id is reassigned to this row so
-- admins can transfer ownership manually rather than silently
-- losing the group. The same pattern can later cover other
-- resource types that need an "orphan owner" target.
--
-- Wire-stable id mirrored from mows_auth_core::NOBODY_USER_ID.
-- The prefix `0000bad1` (no-body) is a mnemonic so a raw SELECT
-- makes the role of this row obvious at a glance.
--
-- Properties of this row:
--   * external_user_id NULL — no IdP subject ever resolves to it.
--   * idp_id set to the Zitadel sentinel only to satisfy the
--     NOT NULL FK on users.idp_id; no semantic Zitadel link.
--   * user_type = 1 (Regular). Not a SuperAdmin — an attacker who
--     somehow assumed this identity must NOT inherit admin powers.
--   * deleted = false. Soft-deleting it would re-orphan everything
--     it owns.
--
-- The application layer MUST refuse to delete or modify this row
-- (enforced in `FilezUser::soft_delete_one` and the user update
-- handlers).

INSERT INTO users (
    id,
    external_user_id,
    pre_identifier_email,
    display_name,
    created_time,
    modified_time,
    deleted,
    profile_picture,
    created_by,
    user_type,
    idp_id
) VALUES (
    '0000bad1-0000-0000-0000-000000000001',
    NULL,
    NULL,
    'nobody (system sentinel — USER_GROUPS.md §7.5)',
    now(),
    now(),
    false,
    NULL,
    NULL,
    1,
    '7a17ade1-0000-0000-0000-000000000001'
) ON CONFLICT (id) DO NOTHING;
