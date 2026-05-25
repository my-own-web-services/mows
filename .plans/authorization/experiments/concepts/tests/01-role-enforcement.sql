-- Concept #1+#2: cross-schema separation + DB-role enforcement.
-- The filez_role can read mows_auth.access_policies but CANNOT
-- INSERT into it. The picker_role CAN.

BEGIN;

DO $$ BEGIN RAISE NOTICE '======== Concept 2: DB-role enforcement ========'; END $$;

-- Sanity: filez_role exists
DO $$ BEGIN
    PERFORM 1 FROM pg_roles WHERE rolname = 'filez_role';
    IF NOT FOUND THEN RAISE EXCEPTION 'fixture broken: no filez_role'; END IF;
END $$;

-- 1. filez_role can SELECT from mows_auth.access_policies (cross-schema read)
SET ROLE filez_role;
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM mows_auth.access_policies;
    RAISE NOTICE '[1.1] filez_role can SELECT mows_auth.access_policies — count=% (OK)', n;
END $$;

-- 2. filez_role attempting to INSERT into mows_auth.access_policies MUST fail
DO $$
BEGIN
    INSERT INTO mows_auth.access_policies (
        id, owner_id, subject_type, subject_id, context_app_ids,
        resource_type, actions, effect
    ) VALUES (
        gen_random_uuid(), md5('user-paul')::uuid, 3,
        '00000000-0000-0000-0000-000000000000'::uuid,
        ARRAY['00000000-0000-0000-0000-000000000000'::uuid],
        0, ARRAY[0::smallint], 1
    );
    RAISE EXCEPTION '[1.2] FAIL — filez_role was allowed to INSERT!';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '[1.2] filez_role rejected from INSERT mows_auth.access_policies (OK)';
END $$;

-- 3. filez_role attempting to UPDATE access_policies MUST fail
DO $$
BEGIN
    UPDATE mows_auth.access_policies SET revoked = TRUE WHERE TRUE;
    RAISE EXCEPTION '[1.3] FAIL — filez_role was allowed to UPDATE!';
EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '[1.3] filez_role rejected from UPDATE mows_auth.access_policies (OK)';
END $$;

RESET ROLE;

-- 4. picker_role CAN INSERT
SET ROLE picker_role;
DO $$
DECLARE pid uuid := gen_random_uuid();
BEGIN
    INSERT INTO mows_auth.access_policies (
        id, owner_id, subject_type, subject_id, context_app_ids,
        resource_type, actions, effect
    ) VALUES (
        pid, md5('user-paul')::uuid, 3,
        '00000000-0000-0000-0000-000000000000'::uuid,
        ARRAY['00000000-0000-0000-0000-000000000000'::uuid],
        0, ARRAY[0::smallint], 1
    );
    RAISE NOTICE '[1.4] picker_role can INSERT mows_auth.access_policies — id=% (OK)', pid;
END $$;

RESET ROLE;

DO $$ BEGIN RAISE NOTICE '======== Concept 2 passed ========'; END $$;

ROLLBACK;
