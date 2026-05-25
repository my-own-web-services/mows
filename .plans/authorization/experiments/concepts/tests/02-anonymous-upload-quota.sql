-- Concept #3: per-policy storage quota for an anonymous Public link.
-- Paul creates a policy: Public can upload up to 5 MB / 5 files / 2 MB per file.
-- Anonymous uploader hits each cap in turn.

BEGIN;

DO $$ BEGIN RAISE NOTICE '======== Concept 3: anonymous upload + filez quota ========'; END $$;

-- 1. Picker creates the policy + the filez_policy_quotas row atomically
SET ROLE picker_role;
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set FG '\'' `echo -n "fg-submissions" | md5sum | cut -d' ' -f1` '\''
\set UPLOAD_APP '\'' `echo -n "app-upload-ui" | md5sum | cut -d' ' -f1` '\''
\set PAUL '\'' `echo -n "user-paul" | md5sum | cut -d' ' -f1` '\''
\set POLICY_ID '\'1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa\''

INSERT INTO mows_auth.access_policies (
    id, owner_id, name, subject_type, subject_id,
    context_app_ids, resource_type, resource_id, resource_scope,
    actions, effect
) VALUES (
    :POLICY_ID ::uuid,
    :PAUL ::uuid,
    'anon-upload',
    3,                                  -- Public
    :NIL_UUID ::uuid,
    ARRAY[:UPLOAD_APP ::uuid],
    1,                                  -- FileGroup (target)
    :FG ::uuid,
    0,
    ARRAY[10::smallint],                -- FilesCreate via FileGroupsAddFiles=10
    1                                   -- Allow
);

INSERT INTO filez.filez_policy_quotas (
    policy_id, max_bytes, max_files, max_per_file_bytes
) VALUES (
    :POLICY_ID ::uuid,
    5000000,    -- 5 MB
    5,          -- 5 files
    2000000     -- 2 MB per file
);

RESET ROLE;

-- 2. As filez_role, simulate anonymous uploads via create_file_with_quota
SET ROLE filez_role;
\set STORAGE '\'' `echo -n "storage-default" | md5sum | cut -d' ' -f1` '\''

-- 2.1 First upload of 1 MB — should succeed
DO $$
DECLARE fid uuid;
BEGIN
    fid := filez.create_file_with_quota(
        NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
        md5('storage-default')::uuid, 1000000, 'anon-1.txt',
        '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        md5('fg-submissions')::uuid);
    RAISE NOTICE '[2.1] Anonymous upload 1MB → file=% (OK)', fid;
END $$;

-- 2.2 Another 1 MB upload — should succeed (1+1 = 2 MB used)
DO $$
DECLARE fid uuid;
BEGIN
    fid := filez.create_file_with_quota(
        NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
        md5('storage-default')::uuid, 1000000, 'anon-2.txt',
        '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        md5('fg-submissions')::uuid);
    RAISE NOTICE '[2.2] Anonymous upload 1MB → file=% (OK)', fid;
END $$;

-- 2.3 A 2 MB upload (at the per-file cap) — total becomes 4 MB; should SUCCEED
DO $$
DECLARE fid uuid;
BEGIN
    fid := filez.create_file_with_quota(
        NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
        md5('storage-default')::uuid, 2000000, 'anon-3.txt',
        '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        md5('fg-submissions')::uuid);
    RAISE NOTICE '[2.3] Anonymous upload 2MB → file=% (OK, totals 4MB)', fid;
END $$;

-- 2.4 Another 2 MB upload would push to 6 MB > 5 MB cap. Bytes-cap rejection.
DO $$
BEGIN
    PERFORM filez.create_file_with_quota(
        NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
        md5('storage-default')::uuid, 2000000, 'anon-4.txt',
        '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        md5('fg-submissions')::uuid);
    RAISE EXCEPTION '[2.4] FAIL — should have rejected with PolicyByteQuotaExceeded';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PolicyByteQuotaExceeded%' THEN
        RAISE NOTICE '[2.4] 4th upload rejected — PolicyByteQuotaExceeded (OK)';
    ELSE
        RAISE EXCEPTION '[2.4] FAIL — wrong error: %', SQLERRM;
    END IF;
END $$;

-- 2.5 Reset bytes counter to test per-file size cap
RESET ROLE;
SET ROLE picker_role;
UPDATE filez.filez_policy_quotas SET used_bytes = 0, used_files = 0
WHERE policy_id = '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
RESET ROLE;
SET ROLE filez_role;

DO $$
BEGIN
    PERFORM filez.create_file_with_quota(
        NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
        md5('storage-default')::uuid, 3000000, 'big.txt',
        '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        md5('fg-submissions')::uuid);
    RAISE EXCEPTION '[2.5] FAIL — 3MB > 2MB cap should reject';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PolicyPerFileSizeExceeded%' THEN
        RAISE NOTICE '[2.5] 3MB rejected — PolicyPerFileSizeExceeded (OK)';
    ELSE
        RAISE EXCEPTION '[2.5] FAIL — wrong error: %', SQLERRM;
    END IF;
END $$;

-- 2.6 6 small files exhaust the max_files cap
RESET ROLE;
SET ROLE picker_role;
UPDATE filez.filez_policy_quotas SET used_bytes = 0, used_files = 0
WHERE policy_id = '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
RESET ROLE;
SET ROLE filez_role;

DO $$
DECLARE i int;
BEGIN
    FOR i IN 1..5 LOOP
        PERFORM filez.create_file_with_quota(
            NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
            md5('storage-default')::uuid, 100000, format('small-%s.txt', i),
            '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
            md5('fg-submissions')::uuid);
    END LOOP;
    -- The 6th must fail
    BEGIN
        PERFORM filez.create_file_with_quota(
            NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
            md5('storage-default')::uuid, 100000, 'small-6.txt',
            '1aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
            md5('fg-submissions')::uuid);
        RAISE EXCEPTION '[2.6] FAIL — 6th upload should reject';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'PolicyFileQuotaExceeded%' THEN
            RAISE NOTICE '[2.6] 6th file rejected — PolicyFileQuotaExceeded (OK)';
        ELSE
            RAISE EXCEPTION '[2.6] FAIL — wrong error: %', SQLERRM;
        END IF;
    END;
END $$;

RESET ROLE;

DO $$ BEGIN RAISE NOTICE '======== Concept 3 passed ========'; END $$;

ROLLBACK;
