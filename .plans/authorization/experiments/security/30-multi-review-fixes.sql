-- Regression tests for issues found in the multi-review pass.
-- Each test guards a specific CRIT-N or major finding so it cannot regress.

BEGIN;

\i /security/00-helpers.sql

\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''

-- Fixture (suffix -mr so no collision with the bulk seed)
INSERT INTO users (id, external_user_id, display_name, user_type) VALUES
    (md5('user-mr-admin')::uuid, 'ext-mr-admin', 'Admin', 0),
    (md5('user-mr-alice')::uuid, 'ext-mr-alice', 'Alice', 1),
    (md5('user-mr-bob')::uuid,   'ext-mr-bob',   'Bob',   1),
    (md5('user-mr-carol')::uuid, 'ext-mr-carol', 'Carol', 1)
ON CONFLICT (id) DO NOTHING;
INSERT INTO apps (id, name, trusted, app_type) VALUES
    (md5('app-mr')::uuid, 'mr-app', FALSE, 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO user_groups (id, owner_id, name, visibility, join_policy) VALUES
    (md5('ug-mr-team')::uuid, md5('user-mr-bob')::uuid, 'mr-team', 0, 0)
ON CONFLICT (id) DO NOTHING;
INSERT INTO user_user_group_members (user_id, user_group_id) VALUES
    (md5('user-mr-alice')::uuid, md5('ug-mr-team')::uuid)
ON CONFLICT DO NOTHING;
INSERT INTO files (id, owner_id, name) VALUES
    (md5('file-mr-1')::uuid, md5('user-mr-bob')::uuid, 'mr-file-1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO file_groups (id, owner_id, name) VALUES
    (md5('fg-mr-1')::uuid, md5('user-mr-bob')::uuid, 'mr-fg-1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO file_file_group_members (file_id, file_group_id) VALUES
    (md5('file-mr-1')::uuid, md5('fg-mr-1')::uuid)
ON CONFLICT DO NOTHING;

\set BOB   '\'' `echo -n "user-mr-bob"   | md5sum | cut -d' ' -f1` '\''
\set ALICE '\'' `echo -n "user-mr-alice" | md5sum | cut -d' ' -f1` '\''
\set CAROL '\'' `echo -n "user-mr-carol" | md5sum | cut -d' ' -f1` '\''
\set ADMIN '\'' `echo -n "user-mr-admin" | md5sum | cut -d' ' -f1` '\''
\set APP   '\'' `echo -n "app-mr"        | md5sum | cut -d' ' -f1` '\''
\set FILE  '\'' `echo -n "file-mr-1"     | md5sum | cut -d' ' -f1` '\''
\set FG    '\'' `echo -n "fg-mr-1"       | md5sum | cut -d' ' -f1` '\''
\set TEAM  '\'' `echo -n "ug-mr-team"    | md5sum | cut -d' ' -f1` '\''


DO $$ BEGIN RAISE NOTICE '======== R1 (CRIT-1): expired Deny on resource-group must NOT block ========'; END $$;

-- Add an active Allow on the file-group + an EXPIRED Deny on the same group
-- targeting Alice. The Deny is expired, so Alice should be Allowed.
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect, created_time, expires_at
) VALUES
    (md5('pol-mr-allow-team')::uuid, :BOB ::uuid, 'allow-team',
     1, :TEAM ::uuid, ARRAY[:NIL_UUID ::uuid],
     1, :FG ::uuid, 0, ARRAY[0::smallint], 1, now(), NULL),
    (md5('pol-mr-expired-fg-deny')::uuid, :BOB ::uuid, 'expired-deny',
     0, :ALICE ::uuid, ARRAY[:NIL_UUID ::uuid],
     1, :FG ::uuid, 0, ARRAY[0::smallint], 0,
     now() - interval '2 hours', now() - interval '1 hour');

SELECT assert_access('R1.1 expired group-Deny is ignored, Allow wins',
    :ALICE ::uuid, :APP ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByResourceGroup', TRUE);


DO $$ BEGIN RAISE NOTICE '======== R2 (CRIT-1): expired Allow on resource-group must NOT grant ========'; END $$;

-- Replace the active Allow with an EXPIRED Allow on the group. Alice's
-- expired Deny is still there; both should be ignored, default-deny.
UPDATE access_policies
   SET created_time = now() - interval '3 hours',
       expires_at   = now() - interval '1 hour'
 WHERE id = md5('pol-mr-allow-team')::uuid;

SELECT assert_access('R2.1 expired group-Allow is ignored, default deny',
    :CAROL ::uuid, :APP ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DefaultDeny', FALSE);


DO $$ BEGIN RAISE NOTICE '======== R3 (CRIT-8): cannot insert ServerMember/Public with non-nil subject_id ========'; END $$;

DO $$
BEGIN
    INSERT INTO access_policies (
        id, owner_id, name, subject_type, subject_id,
        context_app_ids, resource_type, resource_id, resource_scope,
        actions, effect
    ) VALUES (
        gen_random_uuid(), md5('user-mr-bob')::uuid, 'bad-sm',
        2,                                              -- ServerMember
        md5('user-mr-alice')::uuid,                     -- not nil — invalid!
        ARRAY['00000000-0000-0000-0000-000000000000'::uuid],
        0, md5('file-mr-1')::uuid, 0, ARRAY[0::smallint], 1);
    RAISE EXCEPTION '[R3.1] FAIL — non-nil subject_id for ServerMember was accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[R3.1] ServerMember + non-nil subject_id rejected by CHECK (OK)';
END $$;

DO $$
BEGIN
    INSERT INTO access_policies (
        id, owner_id, name, subject_type, subject_id,
        context_app_ids, resource_type, resource_id, resource_scope,
        actions, effect
    ) VALUES (
        gen_random_uuid(), md5('user-mr-bob')::uuid, 'bad-pub',
        3,                                              -- Public
        md5('user-mr-alice')::uuid,                     -- not nil — invalid!
        ARRAY['00000000-0000-0000-0000-000000000000'::uuid],
        0, md5('file-mr-1')::uuid, 0, ARRAY[0::smallint], 1);
    RAISE EXCEPTION '[R3.2] FAIL — non-nil subject_id for Public was accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[R3.2] Public + non-nil subject_id rejected by CHECK (OK)';
END $$;


DO $$ BEGIN RAISE NOTICE '======== R4 (SLOP-15): enum-domain CHECK constraints reject out-of-range ========'; END $$;

DO $$ BEGIN
    INSERT INTO access_policies (
        id, owner_id, name, subject_type, subject_id, context_app_ids,
        resource_type, resource_id, resource_scope, actions, effect
    ) VALUES (
        gen_random_uuid(), md5('user-mr-bob')::uuid, 'bad-effect',
        3, '00000000-0000-0000-0000-000000000000'::uuid,
        ARRAY['00000000-0000-0000-0000-000000000000'::uuid],
        0, md5('file-mr-1')::uuid, 0, ARRAY[0::smallint], 99);   -- effect out of range
    RAISE EXCEPTION '[R4.1] FAIL — effect=99 was accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[R4.1] effect out of {0,1} rejected by CHECK (OK)';
END $$;


DO $$ BEGIN RAISE NOTICE '======== R5 (QA-2): owner with Deny on own file is DENIED ========'; END $$;

-- Add a direct Deny on Bob's own file targeting Bob.
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
) VALUES (
    md5('pol-mr-self-deny')::uuid, :BOB ::uuid, 'self-deny',
    0, :BOB ::uuid, ARRAY[:NIL_UUID ::uuid],
    0, :FILE ::uuid, 0, ARRAY[0::smallint], 0);

SELECT assert_access('R5.1 owner denied via direct Deny → DeniedByPolicy not Owned',
    :BOB ::uuid, :APP ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DeniedByPolicy', FALSE);


DO $$ BEGIN RAISE NOTICE '======== R6 (QA-7): expired DIRECT Deny is ignored ========'; END $$;

-- Re-revoke the self-deny + add an expired-deny on Bob.
UPDATE access_policies SET revoked = TRUE
 WHERE id = md5('pol-mr-self-deny')::uuid;

INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect, created_time, expires_at
) VALUES (
    md5('pol-mr-expired-direct-deny')::uuid, :BOB ::uuid, 'expired-self-deny',
    0, :BOB ::uuid, ARRAY[:NIL_UUID ::uuid],
    0, :FILE ::uuid, 0, ARRAY[0::smallint], 0,
    now() - interval '2 hours', now() - interval '1 hour');

SELECT assert_access('R6.1 expired direct Deny ignored, owner regains access',
    :BOB ::uuid, :APP ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'Owned', TRUE);


DO $$ BEGIN RAISE NOTICE '======== All multi-review regression cases passed ========'; END $$;

ROLLBACK;
