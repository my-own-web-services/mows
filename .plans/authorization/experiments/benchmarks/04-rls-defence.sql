-- Bench: prove RLS catches direct queries that bypass the primitive.
-- A handler that runs `SELECT * FROM files` without going through
-- list_visible() must return only what the requesting user can see.

\timing on
\set target_user_id '\'' `echo -n "user-3" | md5sum | cut -d' ' -f1` '\''
\set other_user_id  '\'' `echo -n "user-7" | md5sum | cut -d' ' -f1` '\''
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''

-- Establish a non-admin role with RLS active. Postgres bypasses RLS
-- for superusers, so we need a regular role. Idempotent: GRANT only
-- if the role already exists from a prior run.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bench_handler') THEN
        CREATE ROLE bench_handler;
    END IF;
END $$;
GRANT USAGE ON SCHEMA public TO bench_handler;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bench_handler;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO bench_handler;

\echo '== as superuser: raw SELECT sees all files =='
SELECT count(*) AS rows_visible_to_superuser FROM files;

\echo '== as bench_handler with target_user context: RLS limits the result =='
SET ROLE bench_handler;
SET LOCAL auth.user_id = :target_user_id;
SET LOCAL auth.app_id  = :target_app_id;
SET LOCAL row_security = on;

-- Naive direct query — RLS applies the auth_can_read_file predicate.
-- This will be SLOW (per-row eval) — that is the point: don't write
-- direct queries. But the count must be correct.
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) AS rows_visible_via_rls_only FROM files;

RESET ROLE;

\echo '== as bench_handler, going through the primitive instead =='
SET ROLE bench_handler;
SET LOCAL auth.user_id = :target_user_id;
SET LOCAL auth.app_id  = :target_app_id;

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM list_visible(
    :target_user_id ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 0::smallint,
    NULL::timestamp, NULL::uuid, 50);

RESET ROLE;

\timing off
