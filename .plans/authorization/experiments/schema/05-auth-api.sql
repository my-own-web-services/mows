-- THE auth API. Two callables. No handler shall ever bypass these.
--
-- We compose the API from small LANGUAGE SQL functions because they
-- inline at planning time and let Postgres push the LIMITs into the
-- per-source scans. A monolithic LANGUAGE plpgsql function uses a
-- generic plan that doesn't push predicates, costing 150× in buffers
-- at medium scale (measured in benchmarks/05-investigate-plpgsql-overhead.sql).
--
-- The structure:
--   * `list_visible_owned`       — SQL function, OwnerOnly fast path
--   * `list_visible_anonymous`   — SQL function, anonymous Public-only
--   * `list_visible_merge`       — SQL function, the k-way merge
--   * `list_visible_superadmin`  — SQL function, unfiltered scan
--   * `list_visible`             — tiny PLPGSQL dispatcher
--
-- Plus the per-resource `check_access` (PLPGSQL — branches on policy
-- categories; complexity outweighs inlining benefit, and the function
-- is called ~once per request rather than per-row).
--
-- Every function carries `SET row_security = off` so RLS does not
-- recursively re-enter `check_access` from inside the primitive.
-- RLS still protects all OTHER code paths.

BEGIN;

DROP FUNCTION IF EXISTS auth_user_group_ids(uuid) CASCADE;
DROP FUNCTION IF EXISTS check_access(uuid, uuid, smallint, uuid, smallint) CASCADE;
DROP FUNCTION IF EXISTS list_visible(uuid, uuid, smallint, smallint, smallint, timestamp, uuid, int) CASCADE;
DROP FUNCTION IF EXISTS list_visible_owned(uuid, smallint, timestamp, uuid, int) CASCADE;
DROP FUNCTION IF EXISTS list_visible_anonymous(uuid, smallint, smallint, timestamp, uuid, int) CASCADE;
DROP FUNCTION IF EXISTS list_visible_merge(uuid, uuid, smallint, smallint, smallint, timestamp, uuid, int) CASCADE;
DROP FUNCTION IF EXISTS list_visible_superadmin(smallint, timestamp, uuid, int) CASCADE;

-- ---------- per-user group lookup ----------

CREATE OR REPLACE FUNCTION auth_user_group_ids(p_user uuid)
RETURNS uuid[] LANGUAGE sql STABLE PARALLEL SAFE AS $$
    SELECT coalesce(array_agg(user_group_id), '{}'::uuid[])
    FROM   user_user_group_members
    WHERE  user_id = p_user
$$;

-- ---------- check_access ----------

CREATE OR REPLACE FUNCTION check_access(
    p_user        uuid,
    p_app         uuid,
    p_resource_t  smallint,
    p_resource    uuid,
    p_action      smallint
) RETURNS text LANGUAGE plpgsql STABLE PARALLEL SAFE
SET row_security = off
AS $$
DECLARE
    v_user_type   smallint;
    v_app_trust   bool;
    v_owner       uuid;
    v_groups      uuid[];
    v_nil         uuid := '00000000-0000-0000-0000-000000000000';
    v_match_id    uuid;
BEGIN
    IF p_user IS NOT NULL THEN
        SELECT user_type INTO v_user_type FROM users WHERE id = p_user;
        IF v_user_type = 0 THEN RETURN 'SuperAdmin'; END IF;
    END IF;

    IF p_resource_t = 0 THEN
        SELECT owner_id INTO v_owner FROM files WHERE id = p_resource;
    ELSIF p_resource_t = 1 THEN
        SELECT owner_id INTO v_owner FROM file_groups WHERE id = p_resource;
    END IF;
    IF v_owner IS NULL THEN RETURN 'ResourceNotFound'; END IF;

    SELECT trusted INTO v_app_trust FROM apps WHERE id = p_app;
    IF coalesce(v_app_trust, false) AND p_user IS NOT NULL AND v_owner = p_user THEN
        RETURN 'TrustedAppOwned';
    END IF;

    v_groups := CASE WHEN p_user IS NOT NULL THEN auth_user_group_ids(p_user) ELSE '{}'::uuid[] END;

    -- DENY direct
    SELECT ap.id INTO v_match_id
    FROM   access_policies ap
    WHERE  ap.resource_type = p_resource_t
      AND  ap.resource_id   = p_resource
      AND  ap.effect        = 0
      AND  ap.actions       @> ARRAY[p_action]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  NOT ap.revoked
      AND  (ap.expires_at IS NULL OR ap.expires_at > now())
      AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
         OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups))
         OR (ap.subject_type = 2 AND p_user IS NOT NULL)
         OR (ap.subject_type = 3))
    LIMIT 1;
    IF v_match_id IS NOT NULL THEN RETURN 'DeniedByPolicy'; END IF;

    -- DENY via resource-group (CRIT-1: expires_at must be filtered here too)
    SELECT ap.id INTO v_match_id
    FROM   access_policies ap
    JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
    WHERE  ap.resource_type = 1
      AND  ap.effect        = 0
      AND  ap.actions       @> ARRAY[p_action]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  NOT ap.revoked
      AND  (ap.expires_at IS NULL OR ap.expires_at > now())
      AND  ffgm.file_id     = p_resource
      AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
         OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups))
         OR (ap.subject_type = 2 AND p_user IS NOT NULL)
         OR (ap.subject_type = 3))
    LIMIT 1;
    IF v_match_id IS NOT NULL THEN RETURN 'DeniedByResourceGroup'; END IF;

    IF p_user IS NOT NULL AND v_owner = p_user THEN RETURN 'Owned'; END IF;

    -- ALLOW direct
    SELECT ap.id INTO v_match_id
    FROM   access_policies ap
    WHERE  ap.resource_type = p_resource_t
      AND  ap.resource_id   = p_resource
      AND  ap.effect        = 1
      AND  ap.actions       @> ARRAY[p_action]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  NOT ap.revoked
      AND  (ap.expires_at IS NULL OR ap.expires_at > now())
      AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
         OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups))
         OR (ap.subject_type = 2 AND p_user IS NOT NULL)
         OR (ap.subject_type = 3))
    LIMIT 1;
    IF v_match_id IS NOT NULL THEN RETURN 'AllowedByPolicy'; END IF;

    -- ALLOW via resource-group (CRIT-1: expires_at must be filtered here too)
    SELECT ap.id INTO v_match_id
    FROM   access_policies ap
    JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
    WHERE  ap.resource_type = 1
      AND  ap.effect        = 1
      AND  ap.actions       @> ARRAY[p_action]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  NOT ap.revoked
      AND  (ap.expires_at IS NULL OR ap.expires_at > now())
      AND  ffgm.file_id     = p_resource
      AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
         OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups))
         OR (ap.subject_type = 2 AND p_user IS NOT NULL)
         OR (ap.subject_type = 3))
    LIMIT 1;
    IF v_match_id IS NOT NULL THEN RETURN 'AllowedByResourceGroup'; END IF;

    RETURN 'DefaultDeny';
END $$;

-- ---------- Listing — SQL functions that inline ----------

-- 1. Owner-only: pure index walk
CREATE OR REPLACE FUNCTION list_visible_owned(
    p_user      uuid,
    p_resource_t smallint,
    p_cursor_ts timestamp,
    p_cursor_id uuid,
    p_page_size int
)
RETURNS TABLE(resource_id uuid, sort_ts timestamp)
LANGUAGE sql STABLE PARALLEL SAFE
SET row_security = off
AS $$
    SELECT f.id, f.created_time
    FROM   files f
    WHERE  f.owner_id = p_user
      AND  (f.created_time, f.id) <
           (coalesce(p_cursor_ts, 'infinity'::timestamp),
            coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  p_page_size
$$;

-- 2. SuperAdmin: unfiltered (still sorted + paginated)
CREATE OR REPLACE FUNCTION list_visible_superadmin(
    p_resource_t smallint,
    p_cursor_ts timestamp,
    p_cursor_id uuid,
    p_page_size int
)
RETURNS TABLE(resource_id uuid, sort_ts timestamp)
LANGUAGE sql STABLE PARALLEL SAFE
SET row_security = off
AS $$
    SELECT f.id, f.created_time
    FROM   files f
    WHERE  (f.created_time, f.id) <
           (coalesce(p_cursor_ts, 'infinity'::timestamp),
            coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  p_page_size
$$;

-- 3. Anonymous: walk only Public cover. Uses EXECUTE format() so the
--    planner sees literal values and can push the subject_type=3
--    filter through ap_lookup_idx instead of scanning all 100k
--    Public policies (measured 60× speedup vs bound-param plan).
CREATE OR REPLACE FUNCTION list_visible_anonymous(
    p_app       uuid,
    p_resource_t smallint,
    p_action    smallint,
    p_cursor_ts timestamp,
    p_cursor_id uuid,
    p_page_size int
)
RETURNS TABLE(resource_id uuid, sort_ts timestamp)
LANGUAGE plpgsql STABLE PARALLEL SAFE
SET row_security = off
AS $$
DECLARE
    v_nil    uuid := '00000000-0000-0000-0000-000000000000';
    v_cur_ts timestamp := coalesce(p_cursor_ts, 'infinity'::timestamp);
    v_cur_id uuid := coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
BEGIN
    RETURN QUERY EXECUTE format($Q$
        WITH page AS (
            SELECT pr.resource_id AS rid, pr.sort_created AS ts
            FROM   public_resources pr
            WHERE  pr.resource_type = %1$L::smallint
              AND  pr.app_ids && ARRAY[%2$L::uuid, %3$L::uuid]
              AND  pr.actions @> ARRAY[%4$L::smallint]
              AND  (pr.sort_created, pr.resource_id) < (%5$L::timestamp, %6$L::uuid)
            ORDER  BY pr.sort_created DESC, pr.resource_id DESC
            LIMIT  %7$L::int
        )
        SELECT page.rid, page.ts
        FROM   page
        WHERE NOT EXISTS (
            SELECT 1 FROM access_policies ap
            WHERE  ap.resource_type = %1$L::smallint
              AND  ap.resource_id   = page.rid
              AND  ap.effect = 0
              AND  ap.actions @> ARRAY[%4$L::smallint]
              AND  ap.context_app_ids && ARRAY[%2$L::uuid, %3$L::uuid]
              AND  NOT ap.revoked
              AND  (ap.expires_at IS NULL OR ap.expires_at > now())
              AND  ap.subject_type = 3
        )
          AND NOT EXISTS (
            SELECT 1 FROM access_policies ap
            JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
            WHERE  ap.resource_type = 1
              AND  ap.effect = 0
              AND  ap.actions @> ARRAY[%4$L::smallint]
              AND  ap.context_app_ids && ARRAY[%2$L::uuid, %3$L::uuid]
              AND  NOT ap.revoked
              AND  (ap.expires_at IS NULL OR ap.expires_at > now())
              AND  ap.subject_type = 3
              AND  ffgm.file_id = page.rid
        )
        ORDER BY ts DESC, rid DESC
    $Q$,
        p_resource_t, p_app, v_nil, p_action, v_cur_ts, v_cur_id, p_page_size
    );
END $$;

-- 4. The k-way merge for authenticated users with scope=All|Shared.
--
-- IMPORTANT: implemented as PLPGSQL EXECUTE format() so each call
-- gets a fresh plan with literal parameter values. The CTE-based
-- merge cannot inline into a SQL function (Postgres only inlines
-- single-SELECT bodies). Bound-parameter plans pick generic shapes
-- that miss the per-source LIMIT pushdown — measured 250× slowdown
-- in benchmarks/05-investigate-plpgsql-overhead.sql. EXECUTE format
-- substitutes literals so the planner sees real values and pushes
-- predicates correctly.
--
-- Security note: every interpolated value is either a known-safe
-- integer (smallint, int) or a UUID. None can carry SQL. The format
-- specifiers %L and %s used below are correct for each type.
CREATE OR REPLACE FUNCTION list_visible_merge_sql_inlining_attempt(
    p_user      uuid,
    p_app       uuid,
    p_resource_t smallint,
    p_action    smallint,
    p_scope     smallint,           -- 1=All, 2=Shared (non-owned)
    p_cursor_ts timestamp,
    p_cursor_id uuid,
    p_page_size int
)
RETURNS TABLE(resource_id uuid, sort_ts timestamp)
LANGUAGE sql STABLE PARALLEL SAFE
SET row_security = off
AS $$
    WITH
    g AS (SELECT auth_user_group_ids(p_user) AS arr),
    cur AS (
        SELECT coalesce(p_cursor_ts, 'infinity'::timestamp) AS ts,
               coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid) AS id
    ),
    owned AS (
        SELECT f.id AS rid, f.created_time AS ts
        FROM   files f, cur
        WHERE  p_scope = 1
          AND  f.owner_id = p_user
          AND  (f.created_time, f.id) < (cur.ts, cur.id)
        ORDER  BY f.created_time DESC, f.id DESC
        LIMIT  p_page_size
    ),
    direct_user AS (
        SELECT f.id AS rid, f.created_time AS ts
        FROM   access_policies ap
        JOIN   files f ON f.id = ap.resource_id, cur
        WHERE  ap.subject_type = 0 AND ap.subject_id = p_user
          AND  ap.resource_type = p_resource_t
          AND  ap.effect = 1
          AND  ap.resource_scope = 0
          AND  ap.actions @> ARRAY[p_action]
          AND  ap.context_app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  NOT ap.revoked
          AND  (f.created_time, f.id) < (cur.ts, cur.id)
        ORDER  BY f.created_time DESC, f.id DESC
        LIMIT  p_page_size
    ),
    direct_group AS (
        SELECT f.id AS rid, f.created_time AS ts
        FROM   access_policies ap
        JOIN   files f ON f.id = ap.resource_id, cur, g
        WHERE  ap.subject_type = 1 AND ap.subject_id = ANY(g.arr)
          AND  ap.resource_type = p_resource_t
          AND  ap.effect = 1
          AND  ap.resource_scope = 0
          AND  ap.actions @> ARRAY[p_action]
          AND  ap.context_app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  NOT ap.revoked
          AND  (f.created_time, f.id) < (cur.ts, cur.id)
        ORDER  BY f.created_time DESC, f.id DESC
        LIMIT  p_page_size
    ),
    via_rg AS (
        SELECT f.id AS rid, f.created_time AS ts
        FROM   access_policies ap
        JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
        JOIN   files f ON f.id = ffgm.file_id, cur, g
        WHERE  ap.resource_type = 1 AND ap.effect = 1
          AND  ap.actions @> ARRAY[10::smallint]
          AND  ap.context_app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  ap.resource_scope = 0
          AND  NOT ap.revoked
          AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
             OR (ap.subject_type = 1 AND ap.subject_id = ANY(g.arr)))
          AND  (f.created_time, f.id) < (cur.ts, cur.id)
        ORDER  BY f.created_time DESC, f.id DESC
        LIMIT  p_page_size
    ),
    public_cover AS (
        SELECT pr.resource_id AS rid, pr.sort_created AS ts
        FROM   public_resources pr, cur
        WHERE  pr.resource_type = p_resource_t
          AND  pr.app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  pr.actions @> ARRAY[p_action]
          AND  (pr.sort_created, pr.resource_id) < (cur.ts, cur.id)
        ORDER  BY pr.sort_created DESC, pr.resource_id DESC
        LIMIT  p_page_size
    ),
    sm_cover AS (
        SELECT smr.resource_id AS rid, smr.sort_created AS ts
        FROM   server_member_resources smr, cur
        WHERE  smr.resource_type = p_resource_t
          AND  smr.app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  smr.actions @> ARRAY[p_action]
          AND  (smr.sort_created, smr.resource_id) < (cur.ts, cur.id)
        ORDER  BY smr.sort_created DESC, smr.resource_id DESC
        LIMIT  p_page_size
    ),
    large_ug_cover AS (
        SELECT ugar.resource_id AS rid, ugar.sort_created AS ts
        FROM   user_group_accessible_resources ugar, cur, g
        WHERE  ugar.user_group_id = ANY(g.arr)
          AND  ugar.resource_type = p_resource_t
          AND  ugar.app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  ugar.actions @> ARRAY[p_action]
          AND  (ugar.sort_created, ugar.resource_id) < (cur.ts, cur.id)
        ORDER  BY ugar.sort_created DESC, ugar.resource_id DESC
        LIMIT  p_page_size
    ),
    candidates AS (
        SELECT DISTINCT ON (rid) rid, ts FROM (
            SELECT rid, ts FROM owned
            UNION ALL SELECT rid, ts FROM direct_user
            UNION ALL SELECT rid, ts FROM direct_group
            UNION ALL SELECT rid, ts FROM via_rg
            UNION ALL SELECT rid, ts FROM public_cover
            UNION ALL SELECT rid, ts FROM sm_cover
            UNION ALL SELECT rid, ts FROM large_ug_cover
        ) all_sources
        ORDER BY rid, ts DESC
    )
    SELECT c.rid, c.ts
    FROM   candidates c, g
    -- Direct Deny on the resource
    WHERE  NOT EXISTS (
        SELECT 1 FROM access_policies ap
        WHERE  ap.resource_type = p_resource_t
          AND  ap.resource_id   = c.rid
          AND  ap.effect = 0
          AND  ap.actions @> ARRAY[p_action]
          AND  ap.context_app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  NOT ap.revoked
          AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
             OR (ap.subject_type = 1 AND ap.subject_id = ANY(g.arr))
             OR (ap.subject_type = 2)
             OR (ap.subject_type = 3))
    )
    -- Resource-group Deny
      AND NOT EXISTS (
        SELECT 1 FROM access_policies ap
        JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
        WHERE  ap.resource_type = 1
          AND  ap.effect = 0
          AND  ap.actions @> ARRAY[p_action]
          AND  ap.context_app_ids && ARRAY[p_app, '00000000-0000-0000-0000-000000000000'::uuid]
          AND  NOT ap.revoked
          AND  ffgm.file_id = c.rid
          AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
             OR (ap.subject_type = 1 AND ap.subject_id = ANY(g.arr))
             OR (ap.subject_type = 2)
             OR (ap.subject_type = 3))
    )
    ORDER  BY c.ts DESC, c.rid DESC
    LIMIT  p_page_size
$$;

-- 4b. The EXECUTE-format merge — fresh plan with literal values
--     each call. This is the one the dispatcher actually uses.
CREATE OR REPLACE FUNCTION list_visible_merge(
    p_user      uuid,
    p_app       uuid,
    p_resource_t smallint,
    p_action    smallint,
    p_scope     smallint,
    p_cursor_ts timestamp,
    p_cursor_id uuid,
    p_page_size int
)
RETURNS TABLE(resource_id uuid, sort_ts timestamp)
LANGUAGE plpgsql STABLE PARALLEL SAFE
SET row_security = off
AS $$
DECLARE
    v_nil       uuid := '00000000-0000-0000-0000-000000000000';
    v_groups    uuid[] := auth_user_group_ids(p_user);
    v_cur_ts    timestamp := coalesce(p_cursor_ts, 'infinity'::timestamp);
    v_cur_id    uuid := coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid);
    v_sql       text;
BEGIN
    v_sql := format($Q$
        WITH
        owned AS (
            SELECT f.id AS rid, f.created_time AS ts
            FROM   files f
            WHERE  %1$L::int = 1   -- scope=All only
              AND  f.owner_id = %2$L::uuid
              AND  (f.created_time, f.id) < (%3$L::timestamp, %4$L::uuid)
            ORDER  BY f.created_time DESC, f.id DESC
            LIMIT  %5$L::int
        ),
        direct_user AS (
            SELECT f.id AS rid, f.created_time AS ts
            FROM   access_policies ap
            JOIN   files f ON f.id = ap.resource_id
            WHERE  ap.subject_type = 0 AND ap.subject_id = %2$L::uuid
              AND  ap.resource_type = %6$L::smallint
              AND  ap.effect = 1 AND ap.resource_scope = 0
              AND  ap.actions @> ARRAY[%7$L::smallint]
              AND  ap.context_app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  NOT ap.revoked
              AND  (f.created_time, f.id) < (%3$L::timestamp, %4$L::uuid)
            ORDER  BY f.created_time DESC, f.id DESC
            LIMIT  %5$L::int
        ),
        direct_group AS (
            SELECT f.id AS rid, f.created_time AS ts
            FROM   access_policies ap
            JOIN   files f ON f.id = ap.resource_id
            WHERE  ap.subject_type = 1
              AND  ap.subject_id = ANY(%10$L::uuid[])
              AND  ap.resource_type = %6$L::smallint
              AND  ap.effect = 1 AND ap.resource_scope = 0
              AND  ap.actions @> ARRAY[%7$L::smallint]
              AND  ap.context_app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  NOT ap.revoked
              AND  (f.created_time, f.id) < (%3$L::timestamp, %4$L::uuid)
            ORDER  BY f.created_time DESC, f.id DESC
            LIMIT  %5$L::int
        ),
        via_rg AS (
            -- CRIT-2: use caller-supplied p_action (%7$L), not hardcoded 10.
            SELECT f.id AS rid, f.created_time AS ts
            FROM   access_policies ap
            JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
            JOIN   files f ON f.id = ffgm.file_id
            WHERE  ap.resource_type = 1 AND ap.effect = 1
              AND  ap.actions @> ARRAY[%7$L::smallint]
              AND  ap.context_app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  ap.resource_scope = 0
              AND  NOT ap.revoked
              AND  (ap.expires_at IS NULL OR ap.expires_at > now())
              AND  ((ap.subject_type = 0 AND ap.subject_id = %2$L::uuid)
                 OR (ap.subject_type = 1 AND ap.subject_id = ANY(%10$L::uuid[])))
              AND  (f.created_time, f.id) < (%3$L::timestamp, %4$L::uuid)
            ORDER  BY f.created_time DESC, f.id DESC
            LIMIT  %5$L::int
        ),
        public_cover AS (
            SELECT pr.resource_id AS rid, pr.sort_created AS ts
            FROM   public_resources pr
            WHERE  pr.resource_type = %6$L::smallint
              AND  pr.app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  pr.actions @> ARRAY[%7$L::smallint]
              AND  (pr.sort_created, pr.resource_id) < (%3$L::timestamp, %4$L::uuid)
            ORDER  BY pr.sort_created DESC, pr.resource_id DESC
            LIMIT  %5$L::int
        ),
        sm_cover AS (
            SELECT smr.resource_id AS rid, smr.sort_created AS ts
            FROM   server_member_resources smr
            WHERE  smr.resource_type = %6$L::smallint
              AND  smr.app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  smr.actions @> ARRAY[%7$L::smallint]
              AND  (smr.sort_created, smr.resource_id) < (%3$L::timestamp, %4$L::uuid)
            ORDER  BY smr.sort_created DESC, smr.resource_id DESC
            LIMIT  %5$L::int
        ),
        large_ug_cover AS (
            SELECT ugar.resource_id AS rid, ugar.sort_created AS ts
            FROM   user_group_accessible_resources ugar
            WHERE  ugar.user_group_id = ANY(%10$L::uuid[])
              AND  ugar.resource_type = %6$L::smallint
              AND  ugar.app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  ugar.actions @> ARRAY[%7$L::smallint]
              AND  (ugar.sort_created, ugar.resource_id) < (%3$L::timestamp, %4$L::uuid)
            ORDER  BY ugar.sort_created DESC, ugar.resource_id DESC
            LIMIT  %5$L::int
        ),
        candidates AS (
            SELECT DISTINCT ON (rid) rid, ts FROM (
                SELECT rid, ts FROM owned
                UNION ALL SELECT rid, ts FROM direct_user
                UNION ALL SELECT rid, ts FROM direct_group
                UNION ALL SELECT rid, ts FROM via_rg
                UNION ALL SELECT rid, ts FROM public_cover
                UNION ALL SELECT rid, ts FROM sm_cover
                UNION ALL SELECT rid, ts FROM large_ug_cover
            ) all_sources
            ORDER BY rid, ts DESC
        )
        SELECT c.rid, c.ts
        FROM   candidates c
        WHERE  NOT EXISTS (
            -- CRIT-1: expires_at must filter Deny in listing path too,
            -- otherwise list_visible and check_access diverge on expired policies.
            SELECT 1 FROM access_policies ap
            WHERE  ap.resource_type = %6$L::smallint
              AND  ap.resource_id   = c.rid
              AND  ap.effect = 0
              AND  ap.actions @> ARRAY[%7$L::smallint]
              AND  ap.context_app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  NOT ap.revoked
              AND  (ap.expires_at IS NULL OR ap.expires_at > now())
              AND  ((ap.subject_type = 0 AND ap.subject_id = %2$L::uuid)
                 OR (ap.subject_type = 1 AND ap.subject_id = ANY(%10$L::uuid[]))
                 OR (ap.subject_type = 2)
                 OR (ap.subject_type = 3))
        )
          AND NOT EXISTS (
            SELECT 1 FROM access_policies ap
            JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
            WHERE  ap.resource_type = 1
              AND  ap.effect = 0
              AND  ap.actions @> ARRAY[%7$L::smallint]
              AND  ap.context_app_ids && ARRAY[%8$L::uuid, %9$L::uuid]
              AND  NOT ap.revoked
              AND  (ap.expires_at IS NULL OR ap.expires_at > now())
              AND  ffgm.file_id = c.rid
              AND  ((ap.subject_type = 0 AND ap.subject_id = %2$L::uuid)
                 OR (ap.subject_type = 1 AND ap.subject_id = ANY(%10$L::uuid[]))
                 OR (ap.subject_type = 2)
                 OR (ap.subject_type = 3))
        )
        ORDER  BY c.ts DESC, c.rid DESC
        LIMIT  %5$L::int
    $Q$,
        p_scope,         -- 1
        p_user,          -- 2
        v_cur_ts,        -- 3
        v_cur_id,        -- 4
        p_page_size,     -- 5
        p_resource_t,    -- 6
        p_action,        -- 7
        p_app,           -- 8
        v_nil,           -- 9
        v_groups         -- 10
    );

    RETURN QUERY EXECUTE v_sql;
END $$;

-- 5. The tiny PLPGSQL dispatcher — branches once, calls the right
--    inlining SQL function.
CREATE OR REPLACE FUNCTION list_visible(
    p_user        uuid,
    p_app         uuid,
    p_resource_t  smallint,
    p_action      smallint,
    p_scope       smallint,
    p_cursor_ts   timestamp,
    p_cursor_id   uuid,
    p_page_size   int
)
RETURNS TABLE(resource_id uuid, sort_ts timestamp)
LANGUAGE plpgsql STABLE PARALLEL SAFE
SET row_security = off
AS $$
DECLARE
    v_user_type smallint;
BEGIN
    -- SuperAdmin?
    IF p_user IS NOT NULL THEN
        SELECT user_type INTO v_user_type FROM users WHERE id = p_user;
        IF v_user_type = 0 THEN
            RETURN QUERY SELECT * FROM list_visible_superadmin(
                p_resource_t, p_cursor_ts, p_cursor_id, p_page_size);
            RETURN;
        END IF;
    END IF;

    -- Anonymous?
    IF p_user IS NULL THEN
        RETURN QUERY SELECT * FROM list_visible_anonymous(
            p_app, p_resource_t, p_action, p_cursor_ts, p_cursor_id, p_page_size);
        RETURN;
    END IF;

    -- Scope=Owned fast path
    IF p_scope = 0 THEN
        RETURN QUERY SELECT * FROM list_visible_owned(
            p_user, p_resource_t, p_cursor_ts, p_cursor_id, p_page_size);
        RETURN;
    END IF;

    -- General case: k-way merge
    RETURN QUERY SELECT * FROM list_visible_merge(
        p_user, p_app, p_resource_t, p_action, p_scope,
        p_cursor_ts, p_cursor_id, p_page_size);
END $$;

COMMIT;
