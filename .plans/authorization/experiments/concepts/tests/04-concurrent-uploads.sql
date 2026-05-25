-- Concept #4: atomicity under concurrent uploaders.
-- We can't truly run concurrent transactions inside a single psql
-- session, but we can verify the FOR UPDATE lock prevents
-- over-commit by running many small uploads in a tight loop and
-- asserting the final counter equals the sum of accepted uploads.
-- Real-concurrency test runs in run.sh via parallel psql clients.

BEGIN;

DO $$ BEGIN RAISE NOTICE '======== Concept 4: serial upload counter integrity ========'; END $$;

\set POLICY '\'4dddcccc-cccc-cccc-cccc-cccccccccccc\''

SET ROLE picker_role;
INSERT INTO mows_auth.access_policies (
    id, owner_id, subject_type, subject_id, context_app_ids,
    resource_type, resource_id, resource_scope, actions, effect
) VALUES (
    :POLICY ::uuid, md5('user-paul')::uuid, 3,
    '00000000-0000-0000-0000-000000000000'::uuid,
    ARRAY[md5('app-upload-ui')::uuid],
    1, md5('fg-submissions')::uuid, 0,
    ARRAY[10::smallint], 1
);
INSERT INTO filez.filez_policy_quotas (
    policy_id, max_bytes, max_files, max_per_file_bytes
) VALUES (:POLICY ::uuid, 50000000, 1000, 1000000);
RESET ROLE;

SET ROLE filez_role;

-- Run 100 uploads of 100 KB each. After: used_bytes must be 10 MB exactly.
DO $$
DECLARE
    i        int;
    expected_bytes bigint := 0;
    expected_files int    := 0;
    actual_bytes   bigint;
    actual_files   int;
BEGIN
    FOR i IN 1..100 LOOP
        PERFORM filez.create_file_with_quota(
            NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
            md5('storage-default')::uuid, 100000, format('serial-%s.txt', i),
            '4dddcccc-cccc-cccc-cccc-cccccccccccc'::uuid,
            md5('fg-submissions')::uuid);
        expected_bytes := expected_bytes + 100000;
        expected_files := expected_files + 1;
    END LOOP;

    SELECT used_bytes, used_files INTO actual_bytes, actual_files
    FROM filez.filez_policy_quotas
    WHERE policy_id = '4dddcccc-cccc-cccc-cccc-cccccccccccc'::uuid;

    IF actual_bytes <> expected_bytes THEN
        RAISE EXCEPTION '[4.1] FAIL — counter drift: expected=% actual=%',
            expected_bytes, actual_bytes;
    END IF;
    IF actual_files <> expected_files THEN
        RAISE EXCEPTION '[4.1] FAIL — file count drift: expected=% actual=%',
            expected_files, actual_files;
    END IF;
    RAISE NOTICE '[4.1] 100 serial uploads → bytes=% files=% (exact, OK)',
        actual_bytes, actual_files;
END $$;

RESET ROLE;

-- The truly concurrent variant runs from run.sh as separate psql
-- processes against the same policy. See [4.2] in the run report.

DO $$ BEGIN RAISE NOTICE '======== Concept 4 (serial) passed ========'; END $$;

ROLLBACK;
