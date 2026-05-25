-- Edge-case security tests beyond the basic precedence rules.
-- Each catches a category of bug we want CI to catch.
--
-- Run after 10-cases.sql. Like 10-cases.sql, wraps in a transaction
-- so the fixture is rolled back at the end.

BEGIN;

\i /security/00-helpers.sql

\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''

-- Fixture
INSERT INTO users (id, external_user_id, display_name, user_type) VALUES
    (md5('u-edge-1')::uuid, 'edge-1', 'Edge1', 1),
    (md5('u-edge-2')::uuid, 'edge-2', 'Edge2', 1),
    (md5('u-edge-admin')::uuid, 'edge-admin', 'Edge Admin', 0)
ON CONFLICT DO NOTHING;
INSERT INTO apps (id, name, trusted) VALUES
    (md5('a-edge')::uuid, 'edge-app', FALSE)
ON CONFLICT DO NOTHING;
INSERT INTO files (id, owner_id, name) VALUES
    (md5('f-edge-1')::uuid, md5('u-edge-1')::uuid, 'edge1')
ON CONFLICT DO NOTHING;

\set U1 '\'' `echo -n "u-edge-1" | md5sum | cut -d' ' -f1` '\''
\set U2 '\'' `echo -n "u-edge-2" | md5sum | cut -d' ' -f1` '\''
\set ADM '\'' `echo -n "u-edge-admin" | md5sum | cut -d' ' -f1` '\''
\set APP '\'' `echo -n "a-edge"     | md5sum | cut -d' ' -f1` '\''
\set FID '\'' `echo -n "f-edge-1"   | md5sum | cut -d' ' -f1` '\''
\set GHOST_USER '\'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\''
\set GHOST_APP  '\'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\''

DO $$ BEGIN RAISE NOTICE '======== E1: app does not exist ========'; END $$;

-- Ghost app — owner of resource still passes (Owned)
SELECT assert_access('E1.1 owner can still access via non-existent app',
    :U1 ::uuid, :GHOST_APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'Owned', TRUE);

-- Non-owner via ghost app — no policy can match (app filter)
INSERT INTO access_policies (id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope, actions, effect)
VALUES (md5('p-edge-1')::uuid, :U1 ::uuid, 'edge-allow-u2',
    0, :U2 ::uuid, ARRAY[:APP ::uuid],
    0, :FID ::uuid, 0, ARRAY[0::smallint], 1);

SELECT assert_access('E1.2 U2 via real APP gets Allow',
    :U2 ::uuid, :APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'AllowedByPolicy', TRUE);
SELECT assert_access('E1.3 U2 via GHOST_APP — denied (app context mismatch)',
    :U2 ::uuid, :GHOST_APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

DO $$ BEGIN RAISE NOTICE '======== E2: ghost user id (not in users table) ========'; END $$;

-- A request with a user_id that doesn't exist in users — should be
-- safe: not SuperAdmin (no row), not owner (no row), groups empty,
-- no policy subject_id matches it (no row).
SELECT assert_access('E2.1 ghost user cannot read',
    :GHOST_USER ::uuid, :APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

DO $$ BEGIN RAISE NOTICE '======== E3: revoked + expired combinations ========'; END $$;

-- Mark policy revoked
UPDATE access_policies SET revoked = TRUE WHERE id = md5('p-edge-1')::uuid;
SELECT assert_access('E3.1 U2 — revoked allow → DefaultDeny',
    :U2 ::uuid, :APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

-- Un-revoke; set created_time in the past and expires_at also in the
-- past (but after created_time so the CHECK constraint passes).
UPDATE access_policies
   SET revoked = FALSE,
       created_time = now() - interval '2 hours',
       expires_at   = now() - interval '1 hour'
 WHERE id = md5('p-edge-1')::uuid;
SELECT assert_access('E3.2 U2 — expired allow → DefaultDeny',
    :U2 ::uuid, :APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

-- Both revoked AND expired → still denied
UPDATE access_policies SET revoked = TRUE
 WHERE id = md5('p-edge-1')::uuid;
SELECT assert_access('E3.3 U2 — revoked+expired allow → DefaultDeny',
    :U2 ::uuid, :APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

DO $$ BEGIN RAISE NOTICE '======== E4: CHECK constraint enforcement ========'; END $$;

-- Try to insert a policy with empty actions — must error
DO $$ BEGIN
    INSERT INTO access_policies (id, owner_id, name, subject_type, subject_id,
        context_app_ids, resource_type, resource_id, resource_scope, actions, effect)
    VALUES (gen_random_uuid(), md5('u-edge-1')::uuid, 'bad', 3,
        '00000000-0000-0000-0000-000000000000'::uuid,
        ARRAY['00000000-0000-0000-0000-000000000000'::uuid],
        0, md5('f-edge-1')::uuid, 0, ARRAY[]::smallint[], 1);
    RAISE EXCEPTION '[E4.1 empty actions] FAIL — INSERT was accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[E4.1 empty actions] OK (CHECK fired)';
END $$;

-- Try empty context_app_ids — must error
DO $$ BEGIN
    INSERT INTO access_policies (id, owner_id, name, subject_type, subject_id,
        context_app_ids, resource_type, resource_id, resource_scope, actions, effect)
    VALUES (gen_random_uuid(), md5('u-edge-1')::uuid, 'bad', 3,
        '00000000-0000-0000-0000-000000000000'::uuid,
        ARRAY[]::uuid[],
        0, md5('f-edge-1')::uuid, 0, ARRAY[0::smallint], 1);
    RAISE EXCEPTION '[E4.2 empty context_app_ids] FAIL — INSERT was accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[E4.2 empty context_app_ids] OK (CHECK fired)';
END $$;

-- scope=1 (OwnedByOwner) with non-null resource_id — must error
DO $$ BEGIN
    INSERT INTO access_policies (id, owner_id, name, subject_type, subject_id,
        context_app_ids, resource_type, resource_id, resource_scope, actions, effect)
    VALUES (gen_random_uuid(), md5('u-edge-1')::uuid, 'bad', 0, md5('u-edge-2')::uuid,
        ARRAY['00000000-0000-0000-0000-000000000000'::uuid],
        0, md5('f-edge-1')::uuid, 1,  -- OwnedByOwner with resource_id set
        ARRAY[0::smallint], 1);
    RAISE EXCEPTION '[E4.3 scoped policy + resource_id] FAIL — INSERT was accepted';
EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '[E4.3 scoped policy + resource_id] OK (CHECK fired)';
END $$;

DO $$ BEGIN RAISE NOTICE '======== E5: subject_type = User with a group id (cross-type spoof) ========'; END $$;

-- A user-group ID accidentally used as a subject_id with subject_type=User
-- shouldn't grant: the user_id won't match it (different ID space).
INSERT INTO user_groups (id, owner_id, name)
VALUES (md5('ug-edge')::uuid, md5('u-edge-1')::uuid, 'edge-team')
ON CONFLICT DO NOTHING;

UPDATE access_policies SET revoked = FALSE, expires_at = NULL,
    subject_id = md5('ug-edge')::uuid, subject_type = 0  -- User type but a UG id
 WHERE id = md5('p-edge-1')::uuid;

SELECT assert_access('E5.1 cross-type spoof gives no access',
    :U2 ::uuid, :APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

DO $$ BEGIN RAISE NOTICE '======== E6: SuperAdmin status truly overrides ========'; END $$;

-- An admin can still access even with an active deny targeting them
UPDATE access_policies SET subject_type = 0, subject_id = :ADM ::uuid, effect = 0
 WHERE id = md5('p-edge-1')::uuid;
SELECT assert_access('E6.1 SuperAdmin sees through Deny',
    :ADM ::uuid, :APP ::uuid, 0::smallint, :FID ::uuid, 0::smallint,
    'SuperAdmin', TRUE);

DO $$ BEGIN RAISE NOTICE '======== All edge cases passed ========'; END $$;

ROLLBACK;
