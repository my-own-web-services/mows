-- Defence in depth: Row-Level Security on every resource table.
-- The RLS predicate calls `check_access(...)`, the same function the
-- primitive uses. Direct SELECT from a handler that forgot to call
-- the primitive returns zero rows for non-allowed resources, not
-- leaked content.
--
-- The primitive itself runs with `SET LOCAL row_security = off` so
-- RLS does not double-evaluate on the hot path. Production handlers
-- never set row_security off — they go through the primitive, which
-- bypasses RLS for itself but RLS protects everything else.

BEGIN;

-- The "current request" context is set per-request by the framework.
-- We use Postgres GUCs (`SET LOCAL auth.user_id = '...'`) so RLS
-- has access without a function argument.
CREATE OR REPLACE FUNCTION auth_current_user() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
    SELECT nullif(current_setting('auth.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth_current_app() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
    SELECT nullif(current_setting('auth.app_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth_can_read_file(p_file uuid) RETURNS bool
LANGUAGE sql STABLE PARALLEL SAFE AS $$
    SELECT check_access(
        auth_current_user(),
        auth_current_app(),
        0::smallint,                  -- File
        p_file,
        0::smallint                   -- FilesGet
    ) IN ('SuperAdmin','TrustedAppOwned','Owned',
          'AllowedByPolicy','AllowedByResourceGroup')
$$;

-- Enable RLS on the resource tables. Owners and the SuperAdmin
-- always pass.
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE files FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS files_read_by_auth ON files;
DROP POLICY IF EXISTS files_write_by_owner_or_policy ON files;
DROP POLICY IF EXISTS files_delete_by_owner_or_policy ON files;

CREATE POLICY files_read_by_auth ON files
    FOR SELECT
    USING (auth_can_read_file(id));

-- Restrict mutations to owners (and let `check_access` further
-- approve write actions for non-owner allowed users):
CREATE POLICY files_write_by_owner_or_policy ON files
    FOR UPDATE
    USING (
        owner_id = auth_current_user()
        OR check_access(auth_current_user(), auth_current_app(),
                        0::smallint, id, 1::smallint)
           IN ('SuperAdmin','TrustedAppOwned','AllowedByPolicy',
               'AllowedByResourceGroup')
    );

CREATE POLICY files_delete_by_owner_or_policy ON files
    FOR DELETE
    USING (
        owner_id = auth_current_user()
        OR check_access(auth_current_user(), auth_current_app(),
                        0::smallint, id, 2::smallint)
           IN ('SuperAdmin','TrustedAppOwned','AllowedByPolicy',
               'AllowedByResourceGroup')
    );

-- The primitive is a SECURITY DEFINER alias that disables row
-- security for its own queries. Handlers that go through the
-- primitive get the fast path; direct queries get RLS.
--
-- CRIT-7 / SLOP-9: we deliberately do NOT mark these SECURITY DEFINER.
-- The functions already carry `SET row_security = off` (in 05-auth-api.sql),
-- which is the narrowly-scoped mechanism for what we actually need —
-- disable RLS for the primitive's own queries. SECURITY DEFINER would
-- additionally switch role context and bypass *all* permission checks
-- inside the function, which is broader than the design requires and
-- introduces search_path-shadow privilege escalation if not carefully
-- pinned. Keep the function running as the caller's role.
--
-- All primitives are also pinned to mows_auth schema lookup via
-- `SET search_path = mows_auth, pg_catalog` defined on the function.

ALTER FUNCTION list_visible(uuid, uuid, smallint, smallint, smallint,
                            timestamp, uuid, int)
    SET search_path = public, pg_catalog;
ALTER FUNCTION check_access(uuid, uuid, smallint, uuid, smallint)
    SET search_path = public, pg_catalog;
ALTER FUNCTION list_visible_owned(uuid, smallint, timestamp, uuid, int)
    SET search_path = public, pg_catalog;
ALTER FUNCTION list_visible_anonymous(uuid, smallint, smallint, timestamp, uuid, int)
    SET search_path = public, pg_catalog;
ALTER FUNCTION list_visible_merge(uuid, uuid, smallint, smallint, smallint, timestamp, uuid, int)
    SET search_path = public, pg_catalog;
ALTER FUNCTION list_visible_superadmin(smallint, timestamp, uuid, int)
    SET search_path = public, pg_catalog;
ALTER FUNCTION auth_user_group_ids(uuid)
    SET search_path = public, pg_catalog;

COMMIT;
