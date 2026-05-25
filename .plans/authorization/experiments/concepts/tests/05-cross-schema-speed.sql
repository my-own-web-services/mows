-- Concept #5: cross-schema query is as fast as same-schema.
-- Compares EXPLAIN ANALYZE for two equivalent shapes.

\timing on

\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set PAUL '\'' `echo -n "user-paul" | md5sum | cut -d' ' -f1` '\''
\set APP '\'' `echo -n "app-upload-ui" | md5sum | cut -d' ' -f1` '\''

DO $$ BEGIN RAISE NOTICE '======== Concept 5: cross-schema cost ========'; END $$;

-- Seed a fast file-list scenario: 1k files for Paul (as filez_role,
-- which owns its schema) and 100 direct-share policies for Alice
-- (as picker_role, the only writer of access_policies).

SET ROLE filez_role;
INSERT INTO filez.files (id, owner_id, name, size_bytes, storage_location_id)
SELECT
    md5('cross-' || s)::uuid,
    md5('user-paul')::uuid,
    'cross-' || s,
    1000,
    md5('storage-default')::uuid
FROM generate_series(1, 1000) s;
RESET ROLE;

SET ROLE picker_role;
INSERT INTO mows_auth.access_policies (
    id, owner_id, subject_type, subject_id, context_app_ids,
    resource_type, resource_id, resource_scope, actions, effect
)
SELECT
    md5('xpol-' || s)::uuid,
    md5('user-paul')::uuid,
    0,
    md5('user-alice')::uuid,
    ARRAY[md5('app-upload-ui')::uuid],
    0,
    md5('cross-' || s)::uuid,
    0,
    ARRAY[0::smallint],
    1
FROM generate_series(1, 100) s;
RESET ROLE;

ANALYZE filez.files;
ANALYZE mows_auth.access_policies;

SET ROLE filez_role;

\echo '== Same-schema: file lookup by id =='
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, created_time
FROM   filez.files
WHERE  owner_id = :PAUL ::uuid
ORDER  BY created_time DESC, id DESC
LIMIT  50;

\echo '== Cross-schema: file lookup JOINing mows_auth.access_policies =='
EXPLAIN (ANALYZE, BUFFERS)
SELECT f.id, f.name, f.created_time
FROM   mows_auth.access_policies ap
JOIN   filez.files f ON f.id = ap.resource_id
WHERE  ap.subject_type = 0
  AND  ap.subject_id   = md5('user-alice')::uuid
  AND  ap.resource_type = 0
  AND  ap.effect = 1
  AND  ap.context_app_ids && ARRAY[:APP ::uuid, :NIL_UUID ::uuid]
  AND  NOT ap.revoked
ORDER  BY f.created_time DESC, f.id DESC
LIMIT  50;

\echo '== The filez_list_visible function (cross-schema merge inside one call) =='
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM filez.check_access(
    md5('user-alice')::uuid, md5('app-upload-ui')::uuid,
    md5('cross-7')::uuid, 0::smallint);

RESET ROLE;

\timing off
