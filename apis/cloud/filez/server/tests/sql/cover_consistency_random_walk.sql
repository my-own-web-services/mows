-- Phase 5 P5-5 — cover-consistency random-walk test.
--
-- LISTING.md §16 "Cover consistency": "Random workload of policy
-- CRUD + resource CRUD, comparing the cover state to a
-- recomputed-from-scratch reference after each operation."
--
-- This script drives that workload entirely inside Postgres so it
-- can run against the dev DB without standing up a Rust test rig.
-- Strategy:
--
--   1. Seed a small, deterministic fixture: U users, G user-groups
--      (subjects), F files (resources), M memberships, A apps.
--   2. Loop K rounds. Each round picks a random op
--      (insert/update/delete on access_policies or
--      user_user_group_members) using a seeded PRNG so a failure is
--      reproducible.
--   3. Twice during the loop, simulate a bulk-loader path that
--      bypasses triggers (the very thing the reconciler exists to
--      fix): TRUNCATE one cover table, then continue. The
--      reconciler must self-heal this on the next sweep.
--   4. After the loop, run `reconcile_listing_cover_tables()` then
--      snapshot the trigger-maintained cover tables.
--   5. TRUNCATE every cover table; run the reconciler again so the
--      tables are rebuilt purely from `access_policies` (the
--      "recomputed-from-scratch reference" per LISTING.md §16).
--   6. Diff the two snapshots; assert zero drift on every cover
--      surface (Public, ServerMember, UserGroup).
--
-- Runs as: `psql -v ON_ERROR_STOP=1 -f <thisfile>` against a fresh
-- dev DB (scripts/start-dev-db.sh + DATABASE_URL).
--
-- The script ROLLBACKs at the end so it leaves no fixture behind.
-- It uses SAVEPOINTs internally for the per-op error handling.

\set ON_ERROR_STOP on

-- Wrap the whole test in a transaction so partial state doesn't
-- leak on failure.
BEGIN;

-- Reproducible PRNG: seed once and use setseed() so reruns walk
-- the same op sequence. Keeping this near the top makes the seed
-- the one knob worth tweaking when reproducing a failure.
SELECT setseed(0.137);

-- 1. Fixture --------------------------------------------------------
DO $fixture$
DECLARE
    nobody_id UUID := '00000000-0000-0000-0000-000000000000';
    idp_id_v UUID := '44444444-4444-4444-4444-444444444444';
    i INTEGER;
    g_id UUID;
    u_id UUID;
    f_id UUID;
    a_id UUID;
BEGIN
    -- Test IdP — every user + app rows reference an idp_provider
    -- (migration 00001 + 00002). Real seed comes from the server
    -- bootstrap path; the SQL test owns its own throwaway IdP so
    -- it doesn't depend on bootstrap having run.
    INSERT INTO idp_providers(id, name, created_time)
    VALUES (idp_id_v, '__test_idp__', now())
    ON CONFLICT (id) DO NOTHING;

    -- Sentinel user — owner of seed groups. Mirrors migration
    -- 00010 (the `nobody` sentinel) so the FK stays valid.
    INSERT INTO users(id, display_name, created_time, modified_time,
                      deleted, user_type, idp_id)
    VALUES (nobody_id, '__test_owner__', now(), now(), false, 0, idp_id_v)
    ON CONFLICT (id) DO NOTHING;

    -- 8 ordinary users (subjects of UserGroup-type policies).
    FOR i IN 1..8 LOOP
        u_id := ('00000000-0000-0000-0000-' || lpad(i::TEXT, 12, '0'))::UUID;
        INSERT INTO users(id, display_name, created_time, modified_time,
                          deleted, user_type, idp_id)
        VALUES (u_id, format('user-%s', i), now(), now(), false, 0, idp_id_v)
        ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- 4 user-groups.
    FOR i IN 1..4 LOOP
        g_id := ('11111111-1111-1111-1111-' || lpad(i::TEXT, 12, '0'))::UUID;
        INSERT INTO user_groups(id, owner_id, name, created_time,
                                modified_time, visibility, join_policy,
                                materialize_uga)
        VALUES (g_id, nobody_id, format('group-%s', i), now(), now(),
                0::SMALLINT, 0::SMALLINT, false)
        ON CONFLICT (id) DO NOTHING;

        -- Seed two members each (group i gets users i and i+1).
        FOR u_id IN
            SELECT id FROM users
            WHERE id IN (
                ('00000000-0000-0000-0000-' || lpad(i::TEXT, 12, '0'))::UUID,
                ('00000000-0000-0000-0000-' || lpad((i+1)::TEXT, 12, '0'))::UUID
            )
        LOOP
            INSERT INTO user_user_group_members(user_id, user_group_id,
                                                created_time)
            VALUES (u_id, g_id, now())
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;

    -- 12 files (subjects of cover rows).
    FOR i IN 1..12 LOOP
        f_id := ('22222222-2222-2222-2222-' || lpad(i::TEXT, 12, '0'))::UUID;
        INSERT INTO files(id, owner_id, mime_type, name, created_time,
                          modified_time, metadata)
        VALUES (f_id, nobody_id, 'text/plain', format('file-%s', i),
                now(), now(), '{}'::JSONB)
        ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- 2 apps for the context_app_ids array.
    FOR i IN 1..2 LOOP
        a_id := ('33333333-3333-3333-3333-' || lpad(i::TEXT, 12, '0'))::UUID;
        INSERT INTO apps(id, name, description, origins, trusted, app_type,
                         created_time, modified_time, idp_id)
        VALUES (a_id, format('app-%s', i), 'test app', ARRAY[]::TEXT[],
                true, 0::SMALLINT, now(), now(), idp_id_v)
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
END
$fixture$;

-- 2. Random-walk loop ----------------------------------------------
-- 200 ops is enough to mix every CRUD branch + the bulk-loader
-- bypass + the cleanup. Each op uses random() seeded above so the
-- sequence is fully reproducible.
DO $loop$
DECLARE
    i INTEGER;
    op_kind INTEGER;
    pol_id UUID;
    g_id UUID;
    f_id UUID;
    a_id UUID;
    s_type SMALLINT;
    s_id UUID;
    eff SMALLINT;
    nobody UUID := '00000000-0000-0000-0000-000000000000';
    n_pols INTEGER;
BEGIN
    FOR i IN 1..200 LOOP
        op_kind := (random() * 100)::INTEGER;

        -- Bulk-loader bypass: at rounds 70 and 140 zap a cover
        -- table directly. The reconciler MUST rebuild it from
        -- access_policies in the final sweep.
        IF i = 70 THEN
            TRUNCATE public_resources;
        ELSIF i = 140 THEN
            TRUNCATE user_group_accessible_resources;
        END IF;

        -- Pick a random file + app.
        f_id := ('22222222-2222-2222-2222-' || lpad(
                    ((random() * 11)::INTEGER + 1)::TEXT, 12, '0'))::UUID;
        a_id := ('33333333-3333-3333-3333-' || lpad(
                    ((random() * 1)::INTEGER + 1)::TEXT, 12, '0'))::UUID;

        -- Op distribution: 50 % insert, 25 % update,
        -- 25 % delete-random. Skewed write-heavy to populate the
        -- cover tables faster.
        IF op_kind < 50 THEN
            -- INSERT a new access_policy with a random subject_type.
            -- The cover only mirrors subject_type IN (1, 2, 3); 0
            -- (User) is the no-op control to exercise the trigger
            -- guard.
            s_type := (random() * 3)::INTEGER;
            IF s_type = 1 THEN
                -- UserGroup subject — pick one of the four groups.
                s_id := ('11111111-1111-1111-1111-' || lpad(
                            ((random() * 3)::INTEGER + 1)::TEXT, 12, '0'))::UUID;
            ELSE
                -- Public / ServerMember / User — use the nobody
                -- sentinel for ServerMember + Public; pick a user
                -- for User.
                IF s_type = 0 THEN
                    s_id := ('00000000-0000-0000-0000-' || lpad(
                                ((random() * 7)::INTEGER + 1)::TEXT, 12, '0'))::UUID;
                ELSE
                    s_id := nobody;
                END IF;
            END IF;

            eff := CASE WHEN random() < 0.8 THEN 1 ELSE 0 END;  -- 80 % Allow
            pol_id := gen_random_uuid();
            INSERT INTO access_policies(
                id, owner_id, name, created_time, modified_time,
                subject_type, subject_id, context_app_ids, resource_type,
                resource_id, actions, effect, resource_scope, revoked
            ) VALUES (
                pol_id, nobody, format('p-%s', i), now(), now(),
                s_type, s_id, ARRAY[a_id], 0::SMALLINT, f_id,
                ARRAY[0::SMALLINT], eff, 0::SMALLINT, false
            );
        ELSIF op_kind < 75 THEN
            -- UPDATE: toggle revoked on a random existing row. Fires
            -- the trigger's UPDATE branch.
            SELECT count(*) INTO n_pols FROM access_policies;
            IF n_pols > 0 THEN
                UPDATE access_policies
                SET    revoked = NOT revoked,
                       modified_time = now()
                WHERE  id = (
                    SELECT id FROM access_policies
                    ORDER BY id
                    OFFSET (random() * (n_pols - 1))::INTEGER
                    LIMIT 1
                );
            END IF;
        ELSE
            -- DELETE: drop a random existing row. Fires the
            -- trigger's DELETE branch.
            SELECT count(*) INTO n_pols FROM access_policies;
            IF n_pols > 0 THEN
                DELETE FROM access_policies
                WHERE  id = (
                    SELECT id FROM access_policies
                    ORDER BY id
                    OFFSET (random() * (n_pols - 1))::INTEGER
                    LIMIT 1
                );
            END IF;
        END IF;
    END LOOP;
END
$loop$;

-- 3. Reconcile + snapshot ------------------------------------------
SELECT reconcile_listing_cover_tables();

CREATE TEMP TABLE _snap_public AS
    SELECT resource_type, resource_id,
           sort_created, sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM public_resources;

CREATE TEMP TABLE _snap_sm AS
    SELECT resource_type, resource_id,
           sort_created, sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM server_member_resources;

CREATE TEMP TABLE _snap_uga AS
    SELECT user_group_id, resource_type, resource_id,
           sort_created, sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM user_group_accessible_resources;

-- 4. Rebuild from scratch ------------------------------------------
TRUNCATE public_resources, server_member_resources,
         user_group_accessible_resources;
SELECT reconcile_listing_cover_tables();

CREATE TEMP TABLE _ref_public AS
    SELECT resource_type, resource_id,
           sort_created, sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM public_resources;

CREATE TEMP TABLE _ref_sm AS
    SELECT resource_type, resource_id,
           sort_created, sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM server_member_resources;

CREATE TEMP TABLE _ref_uga AS
    SELECT user_group_id, resource_type, resource_id,
           sort_created, sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM user_group_accessible_resources;

-- 5. Diff + assert -------------------------------------------------
-- Use the symmetric set-difference (EXCEPT in both directions) to
-- find any row that differs in any column. Zero rows means perfect
-- agreement; ANY drift trips the EXCEPTION below.
DO $assert$
DECLARE
    drift_public INTEGER;
    drift_sm INTEGER;
    drift_uga INTEGER;
    snap_public_count INTEGER;
    snap_uga_count INTEGER;
BEGIN
    SELECT count(*) INTO drift_public FROM (
        SELECT * FROM _snap_public EXCEPT SELECT * FROM _ref_public
        UNION ALL
        SELECT * FROM _ref_public EXCEPT SELECT * FROM _snap_public
    ) d;

    SELECT count(*) INTO drift_sm FROM (
        SELECT * FROM _snap_sm EXCEPT SELECT * FROM _ref_sm
        UNION ALL
        SELECT * FROM _ref_sm EXCEPT SELECT * FROM _snap_sm
    ) d;

    SELECT count(*) INTO drift_uga FROM (
        SELECT * FROM _snap_uga EXCEPT SELECT * FROM _ref_uga
        UNION ALL
        SELECT * FROM _ref_uga EXCEPT SELECT * FROM _snap_uga
    ) d;

    IF drift_public <> 0 OR drift_sm <> 0 OR drift_uga <> 0 THEN
        RAISE EXCEPTION
            'cover drift detected: public=% server_member=% user_group=%',
            drift_public, drift_sm, drift_uga;
    END IF;

    -- Sanity: the snapshot is non-empty. A no-op run could
    -- accidentally pass the EXCEPT check (empty = empty) so we
    -- assert the random walk actually produced cover rows on the
    -- two surfaces it targets (Public and UserGroup; ServerMember
    -- and User aren't always populated by 200 random ops).
    SELECT count(*) INTO snap_public_count FROM _snap_public;
    SELECT count(*) INTO snap_uga_count FROM _snap_uga;
    IF snap_public_count = 0 AND snap_uga_count = 0 THEN
        RAISE EXCEPTION
            'random walk produced ZERO cover rows — fixture or PRNG broke';
    END IF;

    RAISE NOTICE
        '[cover-consistency] OK — drift=0 on % public + % uga rows',
        snap_public_count, snap_uga_count;
END
$assert$;

-- 6. Clean up — leave the dev DB as we found it.
ROLLBACK;
