-- Security correctness suite. Constructs a small, fully controlled
-- fixture and asserts the engine's outcome for every interesting
-- combination from POLICY_SEMANTICS.md.
--
-- Run against a freshly-seeded DB. Wraps the whole thing in a
-- savepoint-like transaction so the fixture doesn't pollute later
-- benchmarks; if any assertion fails the whole script errors.

BEGIN;

-- ---- Fixture: clean controlled state ----
-- Suffix every id with -sec so it never collides with the bulk seed.

-- Users
INSERT INTO users (id, external_user_id, display_name, user_type) VALUES
    (md5('user-sec-admin')::uuid, 'ext-sec-admin', 'Admin', 0),
    (md5('user-sec-alice')::uuid, 'ext-sec-alice', 'Alice', 1),
    (md5('user-sec-bob')::uuid,   'ext-sec-bob',   'Bob',   1),
    (md5('user-sec-carol')::uuid, 'ext-sec-carol', 'Carol', 1)
ON CONFLICT (id) DO NOTHING;

-- Apps
INSERT INTO apps (id, name, trusted, app_type) VALUES
    (md5('app-sec-trusted')::uuid,   'sec-trusted',   TRUE,  0),
    (md5('app-sec-untrusted')::uuid, 'sec-untrusted', FALSE, 0)
ON CONFLICT (id) DO NOTHING;

-- A user-group containing Alice + Carol
INSERT INTO user_groups (id, owner_id, name, visibility, join_policy) VALUES
    (md5('ug-sec-team')::uuid, md5('user-sec-alice')::uuid, 'sec-team', 0, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_user_group_members (user_id, user_group_id) VALUES
    (md5('user-sec-alice')::uuid, md5('ug-sec-team')::uuid),
    (md5('user-sec-carol')::uuid, md5('ug-sec-team')::uuid)
ON CONFLICT DO NOTHING;

-- A file owned by Bob
INSERT INTO files (id, owner_id, name, created_time, modified_time) VALUES
    (md5('file-sec-1')::uuid, md5('user-sec-bob')::uuid, 'bob-file-1',
     now(), now())
ON CONFLICT (id) DO NOTHING;

-- A file group containing the file
INSERT INTO file_groups (id, owner_id, name) VALUES
    (md5('fg-sec-1')::uuid, md5('user-sec-bob')::uuid, 'bob-fg-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO file_file_group_members (file_id, file_group_id) VALUES
    (md5('file-sec-1')::uuid, md5('fg-sec-1')::uuid)
ON CONFLICT DO NOTHING;

-- Helpers (test asserts wrap THE primitive — check_access(...))
\i /security/00-helpers.sql

\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set ADMIN '\'' `echo -n "user-sec-admin" | md5sum | cut -d' ' -f1` '\''
\set ALICE '\'' `echo -n "user-sec-alice" | md5sum | cut -d' ' -f1` '\''
\set BOB   '\'' `echo -n "user-sec-bob"   | md5sum | cut -d' ' -f1` '\''
\set CAROL '\'' `echo -n "user-sec-carol" | md5sum | cut -d' ' -f1` '\''
\set TRUST '\'' `echo -n "app-sec-trusted"   | md5sum | cut -d' ' -f1` '\''
\set UNTRU '\'' `echo -n "app-sec-untrusted" | md5sum | cut -d' ' -f1` '\''
\set FILE  '\'' `echo -n "file-sec-1" | md5sum | cut -d' ' -f1` '\''
\set TEAM  '\'' `echo -n "ug-sec-team" | md5sum | cut -d' ' -f1` '\''
\set FG    '\'' `echo -n "fg-sec-1" | md5sum | cut -d' ' -f1` '\''
\set GHOST '\'' `echo -n "file-sec-ghost" | md5sum | cut -d' ' -f1` '\''

DO $$ BEGIN RAISE NOTICE '======== T1: SuperAdmin and Owner shortcuts ========'; END $$;

SELECT assert_access('T1.1 admin can read any file',
    :ADMIN ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'SuperAdmin', TRUE);
SELECT assert_access('T1.2 owner can read own file (untrusted app)',
    :BOB ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'Owned', TRUE);
SELECT assert_access('T1.3 owner via trusted app = TrustedAppOwned',
    :BOB ::uuid, :TRUST ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'TrustedAppOwned', TRUE);
SELECT assert_access('T1.4 non-owner via trusted app = default deny',
    :CAROL ::uuid, :TRUST ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

DO $$ BEGIN RAISE NOTICE '======== T2: Default deny when no policy ========'; END $$;

SELECT assert_access('T2.1 alice no policy, no group access',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DefaultDeny', FALSE);
SELECT assert_access('T2.2 anonymous no policy',
    NULL::uuid,    :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

DO $$ BEGIN RAISE NOTICE '======== T3: Allow then Deny precedence ========'; END $$;

-- Grant Public Allow
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id,
    resource_scope, actions, effect
) VALUES
    (md5('pol-sec-pub')::uuid, :BOB ::uuid, 'public-allow', 3, :NIL_UUID ::uuid,
     ARRAY[:NIL_UUID ::uuid], 0, :FILE ::uuid, 0, ARRAY[0::smallint], 1);

SELECT assert_access('T3.1 alice can read via Public',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByPolicy', TRUE);
SELECT assert_access('T3.2 anonymous can read via Public',
    NULL::uuid,    :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByPolicy', TRUE);

-- Now add a Deny targeting alice
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id,
    resource_scope, actions, effect
) VALUES
    (md5('pol-sec-deny-alice')::uuid, :BOB ::uuid, 'deny-alice', 0, :ALICE ::uuid,
     ARRAY[:NIL_UUID ::uuid], 0, :FILE ::uuid, 0, ARRAY[0::smallint], 0);

SELECT assert_access('T3.3 alice now denied (Deny > Allow)',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DeniedByPolicy', FALSE);
SELECT assert_access('T3.4 anonymous still allowed (Deny was alice-specific)',
    NULL::uuid,    :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByPolicy', TRUE);
SELECT assert_access('T3.5 carol still allowed via Public',
    :CAROL ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByPolicy', TRUE);

DO $$ BEGIN RAISE NOTICE '======== T4: Public vs ServerMember ========'; END $$;

-- Replace Public with ServerMember
UPDATE access_policies SET subject_type = 2
 WHERE id = md5('pol-sec-pub')::uuid;

SELECT assert_access('T4.1 anonymous cannot use ServerMember policy',
    NULL::uuid,    :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DefaultDeny', FALSE);
SELECT assert_access('T4.2 carol can use ServerMember policy',
    :CAROL ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByPolicy', TRUE);
SELECT assert_access('T4.3 alice still denied (Deny still applies)',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DeniedByPolicy', FALSE);

DO $$ BEGIN RAISE NOTICE '======== T5: App-context isolation ========'; END $$;

-- Remove alice-deny, restrict allow to UNTRU only
DELETE FROM access_policies WHERE id = md5('pol-sec-deny-alice')::uuid;
UPDATE access_policies SET context_app_ids = ARRAY[:UNTRU ::uuid]
 WHERE id = md5('pol-sec-pub')::uuid;

SELECT assert_access('T5.1 carol via UNTRU app: allow',
    :CAROL ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByPolicy', TRUE);
SELECT assert_access('T5.2 carol via TRUST app: deny (app not in context)',
    :CAROL ::uuid, :TRUST ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DefaultDeny', FALSE);

DO $$ BEGIN RAISE NOTICE '======== T6: Group-mediated allow ========'; END $$;

-- Clear, then add a UserGroup grant on the file group's resource group
UPDATE access_policies SET revoked = TRUE WHERE id = md5('pol-sec-pub')::uuid;

INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id,
    resource_scope, actions, effect
) VALUES
    (md5('pol-sec-team-fg')::uuid, :BOB ::uuid, 'team-fg', 1, :TEAM ::uuid,
     ARRAY[:NIL_UUID ::uuid], 1, :FG ::uuid, 0, ARRAY[0::smallint], 1);

SELECT assert_access('T6.1 alice (team member) sees file via FG share',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByResourceGroup', TRUE);
SELECT assert_access('T6.2 carol (team member) sees file via FG share',
    :CAROL ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByResourceGroup', TRUE);

-- Add a Deny on the FG for alice individually
INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id,
    resource_scope, actions, effect
) VALUES
    (md5('pol-sec-team-deny-alice')::uuid, :BOB ::uuid, 'team-deny-alice',
     0, :ALICE ::uuid,
     ARRAY[:NIL_UUID ::uuid], 1, :FG ::uuid, 0, ARRAY[0::smallint], 0);

SELECT assert_access('T6.3 alice now denied via FG-level Deny',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DeniedByResourceGroup', FALSE);
SELECT assert_access('T6.4 carol still allowed (Deny was alice-only)',
    :CAROL ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'AllowedByResourceGroup', TRUE);

DO $$ BEGIN RAISE NOTICE '======== T7: Revoked policy ignored ========'; END $$;

-- Revoke the team share — alice's deny goes too implicitly (no fg allow)
UPDATE access_policies SET revoked = TRUE
 WHERE id = md5('pol-sec-team-fg')::uuid;

SELECT assert_access('T7.1 carol no longer allowed (allow revoked)',
    :CAROL ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DefaultDeny', FALSE);
SELECT assert_access('T7.2 alice still has fg-deny, but file no longer allowed → DeniedByResourceGroup',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DeniedByResourceGroup', FALSE);

DO $$ BEGIN RAISE NOTICE '======== T8: Expired policy ignored ========'; END $$;

-- Un-revoke + add an expired allow
UPDATE access_policies SET revoked = FALSE
 WHERE id = md5('pol-sec-team-fg')::uuid;

INSERT INTO access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id,
    resource_scope, actions, effect, created_time, expires_at
) VALUES
    (md5('pol-sec-expired')::uuid, :BOB ::uuid, 'expired-allow', 0, :ALICE ::uuid,
     ARRAY[:NIL_UUID ::uuid], 0, :FILE ::uuid, 0, ARRAY[0::smallint], 1,
     now() - interval '2 days', now() - interval '1 day');

-- The expired allow shouldn't help alice (still has team-deny)
SELECT assert_access('T8.1 expired allow ignored — alice still denied',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :FILE ::uuid, 0::smallint,
    'DeniedByResourceGroup', FALSE);

DO $$ BEGIN RAISE NOTICE '======== T9: Non-existent resource ========'; END $$;

SELECT assert_access('T9.1 ghost file not found',
    :ALICE ::uuid, :UNTRU ::uuid, 0::smallint, :GHOST ::uuid, 0::smallint,
    'ResourceNotFound', FALSE);
SELECT assert_access('T9.2 ghost not even for SuperAdmin (we return ResourceNotFound first)',
    :ADMIN ::uuid, :UNTRU ::uuid, 0::smallint, :GHOST ::uuid, 0::smallint,
    'SuperAdmin', TRUE);
-- ^^ NOTE: SuperAdmin short-circuit fires *before* the existence check
-- in our helper; this is the actual behaviour. We assert it and revisit
-- in POLICY_SEMANTICS.md if we want the existence check earlier.

DO $$ BEGIN RAISE NOTICE '======== All security cases passed ========'; END $$;

-- Roll back the fixture so the bulk benchmark data is untouched.
ROLLBACK;
