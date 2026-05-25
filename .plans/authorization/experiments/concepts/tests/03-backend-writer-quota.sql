-- Concept #3 (backend variant): on-behalf-of + per-policy quota for
-- a backend that creates files on Paul's behalf.

BEGIN;

DO $$ BEGIN RAISE NOTICE '======== Concept 3b: backend writer + filez quota ========'; END $$;

\set PAUL '\'' `echo -n "user-paul" | md5sum | cut -d' ' -f1` '\''
\set WEBGRAB '\'' `echo -n "app-webgrabber" | md5sum | cut -d' ' -f1` '\''
\set POLICY '\'2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb\''
\set FG '\'' `echo -n "fg-submissions" | md5sum | cut -d' ' -f1` '\''

-- Paul authorizes the backend with a quota
SET ROLE picker_role;
INSERT INTO mows_auth.access_policies (
    id, owner_id, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
) VALUES (
    :POLICY ::uuid,
    :PAUL ::uuid,
    0,                          -- User
    :PAUL ::uuid,               -- Paul (the on-behalf-of user)
    ARRAY[:WEBGRAB ::uuid],
    1,                          -- FileGroup
    :FG ::uuid,
    0,
    ARRAY[10::smallint],
    1
);
INSERT INTO filez.filez_policy_quotas (
    policy_id, max_bytes, max_files, max_per_file_bytes
) VALUES (
    :POLICY ::uuid,
    10000000,    -- 10 MB
    100,         -- 100 files
    5000000      -- 5 MB per file
);
RESET ROLE;

-- The middleware's on-behalf-of check: does any active policy
-- authorize the backend to act for Paul?
-- (Standalone validation; the real middleware runs this for every
-- request from the backend.)
SET ROLE filez_role;
DO $$
DECLARE has_auth bool;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM mows_auth.access_policies
        WHERE subject_type = 0
          AND subject_id = md5('user-paul')::uuid
          AND context_app_ids @> ARRAY[md5('app-webgrabber')::uuid]
          AND effect = 1                              -- CRIT-5: Allow only
          AND NOT revoked
          AND (expires_at IS NULL OR expires_at > now())
    ) INTO has_auth;
    IF NOT has_auth THEN
        RAISE EXCEPTION '[3b.0] FAIL — backend should be authorized';
    END IF;
    RAISE NOTICE '[3b.0] on-behalf-of check: backend authorized for Paul (OK)';
END $$;

-- Backend creates a 2 MB file
DO $$
DECLARE fid uuid;
BEGIN
    fid := filez.create_file_with_quota(
        md5('user-paul')::uuid,   -- p_uploader (the on-behalf-of user)
        md5('app-webgrabber')::uuid,
        md5('user-paul')::uuid,   -- owner
        md5('storage-default')::uuid,
        2000000,
        'grabbed-page-1.html',
        '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
        md5('fg-submissions')::uuid);
    RAISE NOTICE '[3b.1] Backend wrote 2MB → file=% (OK)', fid;
END $$;

-- A 9 MB file would overflow (2 + 9 > 10)
DO $$
BEGIN
    PERFORM filez.create_file_with_quota(
        md5('user-paul')::uuid,
        md5('app-webgrabber')::uuid,
        md5('user-paul')::uuid,
        md5('storage-default')::uuid,
        9000000,  -- 9 MB; total would be 11 MB
        'huge.bin',
        '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
        md5('fg-submissions')::uuid);
    RAISE EXCEPTION '[3b.2] FAIL — overflow should reject';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PolicyByteQuotaExceeded%' THEN
        RAISE NOTICE '[3b.2] 9MB rejected — PolicyByteQuotaExceeded (OK)';
    ELSE
        RAISE EXCEPTION '[3b.2] FAIL — wrong error: %', SQLERRM;
    END IF;
END $$;

-- A 6 MB file would exceed per-file cap (5 MB)
DO $$
BEGIN
    PERFORM filez.create_file_with_quota(
        md5('user-paul')::uuid,
        md5('app-webgrabber')::uuid,
        md5('user-paul')::uuid,
        md5('storage-default')::uuid,
        6000000,
        'oversize.bin',
        '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
        md5('fg-submissions')::uuid);
    RAISE EXCEPTION '[3b.3] FAIL — per-file > 5MB should reject';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PolicyPerFileSizeExceeded%' THEN
        RAISE NOTICE '[3b.3] 6MB single-file rejected — PolicyPerFileSizeExceeded (OK)';
    ELSE
        RAISE EXCEPTION '[3b.3] FAIL — wrong error: %', SQLERRM;
    END IF;
END $$;

-- Revoke the policy — middleware's on-behalf-of check now fails
RESET ROLE;
SET ROLE picker_role;
UPDATE mows_auth.access_policies SET revoked = TRUE
WHERE id = '2bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
RESET ROLE;
SET ROLE filez_role;

DO $$
DECLARE has_auth bool;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM mows_auth.access_policies
        WHERE subject_type = 0
          AND subject_id = md5('user-paul')::uuid
          AND context_app_ids @> ARRAY[md5('app-webgrabber')::uuid]
          AND effect = 1                              -- CRIT-5: Allow only
          AND NOT revoked
          AND (expires_at IS NULL OR expires_at > now())
    ) INTO has_auth;
    IF has_auth THEN
        RAISE EXCEPTION '[3b.4] FAIL — revoked policy should not authorize';
    END IF;
    RAISE NOTICE '[3b.4] After revoke: backend no longer authorized (OK)';
END $$;

RESET ROLE;

DO $$ BEGIN RAISE NOTICE '======== Concept 3b passed ========'; END $$;

ROLLBACK;
