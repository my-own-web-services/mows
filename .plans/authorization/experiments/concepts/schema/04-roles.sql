-- DB-level separation. The picker_role is the ONLY role with INSERT
-- on mows_auth.access_policies. filez_role gets SELECT only.
-- Postgres rejects writes from the wrong role — independent of
-- application code.

BEGIN;

-- Idempotent role creation
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'picker_role') THEN
        CREATE ROLE picker_role;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'filez_role') THEN
        CREATE ROLE filez_role;
    END IF;
END $$;

-- Picker — minimum privilege. CRIT-6: the previous grant of
-- "SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mows_auth"
-- allowed a compromised Picker to self-promote via UPDATE users SET
-- user_type = 0 or trust any app via UPDATE apps SET trusted = TRUE.
-- The Picker only needs:
--   * SELECT on identity tables (to render consent dialogs);
--   * SELECT + INSERT + UPDATE on access_policies (UPDATE for revoke);
--     no DELETE — revocation is the `revoked` flag, preserving audit;
--   * INSERT/UPDATE on the side tables it must commit alongside a policy.
-- DELETE on access_policies is denied explicitly: deletion would erase
-- audit history. Use revoked=TRUE instead.
GRANT USAGE  ON SCHEMA mows_auth TO picker_role;
GRANT USAGE  ON SCHEMA filez     TO picker_role;

GRANT SELECT
    ON  mows_auth.users,
        mows_auth.apps,
        mows_auth.user_groups,
        mows_auth.user_user_group_members
    TO  picker_role;

GRANT SELECT, INSERT, UPDATE
    ON  mows_auth.access_policies
    TO  picker_role;
-- No DELETE — soft delete via `revoked` only.
REVOKE DELETE ON mows_auth.access_policies FROM picker_role;

GRANT INSERT, UPDATE, SELECT, DELETE
    ON filez.filez_policy_quotas TO picker_role;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mows_auth TO picker_role;

-- Filez — read mows_auth, full access to its own schema. DEVOPS-13:
-- the role separation must be active (explicit REVOKE), not passive
-- (absence of grant). A future blanket `GRANT ALL` migration in
-- mows_auth would otherwise silently elevate filez_role.
GRANT USAGE  ON SCHEMA mows_auth TO filez_role;
GRANT USAGE  ON SCHEMA filez     TO filez_role;
GRANT SELECT ON ALL TABLES IN SCHEMA mows_auth TO filez_role;
-- Explicit REVOKE of write privileges on the policy table:
REVOKE INSERT, UPDATE, DELETE ON mows_auth.access_policies FROM filez_role;
-- And on the identity tables — services don't manage identities.
REVOKE INSERT, UPDATE, DELETE ON mows_auth.users, mows_auth.apps,
                                 mows_auth.user_groups,
                                 mows_auth.user_user_group_members
    FROM filez_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA filez TO filez_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mows_auth TO filez_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA filez     TO filez_role;

-- DEVOPS-13: also lock down DEFAULT PRIVILEGES so future tables added
-- to mows_auth inherit the right posture automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA mows_auth
    REVOKE INSERT, UPDATE, DELETE ON TABLES FROM filez_role;

COMMIT;
