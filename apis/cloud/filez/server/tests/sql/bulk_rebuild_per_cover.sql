-- Phase 5 P5-4 — per-cover bulk-rebuild API consistency check.
--
-- The three `rebuild_*_cover()` functions are the targeted
-- complement to `reconcile_listing_cover_tables()`. They must
-- leave their cover surface in exactly the state the full
-- reconciler would produce for that surface; otherwise an
-- operator using the targeted call ends up with quietly
-- divergent state.
--
-- Strategy:
--   1. Seed a tiny fixture (one Public policy, one ServerMember
--      policy, two UserGroup-subject policies on the same group).
--   2. Snapshot every cover table (the trigger-maintained
--      reference state).
--   3. TRUNCATE the cover tables.
--   4. Call each `rebuild_*_cover()` function in turn.
--   5. Diff the rebuilt state against the snapshot — assert zero
--      drift.
--
-- ROLLBACKs at the end so nothing leaks into the dev DB.

\set ON_ERROR_STOP on

BEGIN;

DO $fixture$
DECLARE
    nobody UUID := '00000000-0000-0000-0000-000000000000';
    idp_id_v UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    owner_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    g_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    f_pub UUID := 'dddddddd-dddd-dddd-dddd-dddddddddd01';
    f_sm UUID := 'dddddddd-dddd-dddd-dddd-dddddddddd02';
    f_ug_a UUID := 'dddddddd-dddd-dddd-dddd-dddddddddd03';
    f_ug_b UUID := 'dddddddd-dddd-dddd-dddd-dddddddddd04';
    a_id UUID := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
BEGIN
    INSERT INTO idp_providers(id, name, created_time)
    VALUES (idp_id_v, '__bulk_rebuild_test_idp__', now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO users(id, display_name, created_time, modified_time,
                      deleted, user_type, idp_id)
    VALUES (owner_id, '__rebuild_owner__', now(), now(), false, 0, idp_id_v)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO user_groups(id, owner_id, name, created_time,
                            modified_time, visibility, join_policy,
                            materialize_uga)
    VALUES (g_id, owner_id, 'rebuild-group', now(), now(),
            0::SMALLINT, 0::SMALLINT, false)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO apps(id, name, description, origins, trusted, app_type,
                     created_time, modified_time, idp_id)
    VALUES (a_id, 'rebuild-app', 'test', ARRAY[]::TEXT[],
            true, 0::SMALLINT, now(), now(), idp_id_v)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO files(id, owner_id, mime_type, name, created_time,
                      modified_time, metadata)
    VALUES
        (f_pub, owner_id, 'text/plain', 'public-file', now(), now(), '{}'),
        (f_sm, owner_id, 'text/plain', 'sm-file', now(), now(), '{}'),
        (f_ug_a, owner_id, 'text/plain', 'ug-file-a', now(), now(), '{}'),
        (f_ug_b, owner_id, 'text/plain', 'ug-file-b', now(), now(), '{}')
    ON CONFLICT (id) DO NOTHING;

    -- Public Allow policy on f_pub.
    INSERT INTO access_policies(
        id, owner_id, name, created_time, modified_time,
        subject_type, subject_id, context_app_ids, resource_type,
        resource_id, actions, effect, resource_scope, revoked
    ) VALUES (
        gen_random_uuid(), owner_id, 'pub-policy', now(), now(),
        3::SMALLINT,
        '00000000-0000-0000-0000-000000000000'::UUID,
        ARRAY[a_id], 0::SMALLINT, f_pub,
        ARRAY[0::SMALLINT], 1::SMALLINT, 0::SMALLINT, false
    );

    -- ServerMember Allow policy on f_sm.
    INSERT INTO access_policies(
        id, owner_id, name, created_time, modified_time,
        subject_type, subject_id, context_app_ids, resource_type,
        resource_id, actions, effect, resource_scope, revoked
    ) VALUES (
        gen_random_uuid(), owner_id, 'sm-policy', now(), now(),
        2::SMALLINT,
        '00000000-0000-0000-0000-000000000000'::UUID,
        ARRAY[a_id], 0::SMALLINT, f_sm,
        ARRAY[0::SMALLINT], 1::SMALLINT, 0::SMALLINT, false
    );

    -- UserGroup Allow policies on f_ug_a and f_ug_b (same group).
    INSERT INTO access_policies(
        id, owner_id, name, created_time, modified_time,
        subject_type, subject_id, context_app_ids, resource_type,
        resource_id, actions, effect, resource_scope, revoked
    ) VALUES
        (gen_random_uuid(), owner_id, 'ug-a', now(), now(),
         1::SMALLINT, g_id, ARRAY[a_id], 0::SMALLINT, f_ug_a,
         ARRAY[0::SMALLINT], 1::SMALLINT, 0::SMALLINT, false),
        (gen_random_uuid(), owner_id, 'ug-b', now(), now(),
         1::SMALLINT, g_id, ARRAY[a_id], 0::SMALLINT, f_ug_b,
         ARRAY[0::SMALLINT], 1::SMALLINT, 0::SMALLINT, false);
END
$fixture$;

-- Snapshot the trigger-maintained reference state.
CREATE TEMP TABLE _ref_public AS
    SELECT resource_type, resource_id, sort_created, sort_modified,
           sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM public_resources;

CREATE TEMP TABLE _ref_sm AS
    SELECT resource_type, resource_id, sort_created, sort_modified,
           sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM server_member_resources;

CREATE TEMP TABLE _ref_uga AS
    SELECT user_group_id, resource_type, resource_id, sort_created,
           sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM user_group_accessible_resources;

-- Zap all three covers + rebuild via the targeted API.
TRUNCATE public_resources, server_member_resources,
         user_group_accessible_resources;

DO $rebuild$
DECLARE
    n_pub INTEGER;
    n_sm INTEGER;
    n_ug INTEGER;
    g_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
BEGIN
    SELECT rebuild_public_cover() INTO n_pub;
    SELECT rebuild_server_member_cover() INTO n_sm;
    SELECT rebuild_user_group_cover(g_id) INTO n_ug;

    -- Each surface had exactly the policies seeded above; assert
    -- the row counts from the rebuild functions match.
    IF n_pub <> 1 THEN
        RAISE EXCEPTION 'rebuild_public_cover returned % (expected 1)', n_pub;
    END IF;
    IF n_sm <> 1 THEN
        RAISE EXCEPTION 'rebuild_server_member_cover returned % (expected 1)', n_sm;
    END IF;
    IF n_ug <> 2 THEN
        RAISE EXCEPTION 'rebuild_user_group_cover returned % (expected 2)', n_ug;
    END IF;
END
$rebuild$;

-- Snapshot the rebuilt state + diff against the reference.
CREATE TEMP TABLE _rebuilt_public AS
    SELECT resource_type, resource_id, sort_created, sort_modified,
           sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM public_resources;

CREATE TEMP TABLE _rebuilt_sm AS
    SELECT resource_type, resource_id, sort_created, sort_modified,
           sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM server_member_resources;

CREATE TEMP TABLE _rebuilt_uga AS
    SELECT user_group_id, resource_type, resource_id, sort_created,
           sort_modified, sort_name,
           (SELECT array_agg(x ORDER BY x) FROM unnest(app_ids) AS x) AS app_ids,
           (SELECT array_agg(x ORDER BY x) FROM unnest(actions) AS x) AS actions
    FROM user_group_accessible_resources;

DO $assert$
DECLARE
    drift_pub INTEGER;
    drift_sm INTEGER;
    drift_ug INTEGER;
BEGIN
    SELECT count(*) INTO drift_pub FROM (
        SELECT * FROM _ref_public EXCEPT SELECT * FROM _rebuilt_public
        UNION ALL
        SELECT * FROM _rebuilt_public EXCEPT SELECT * FROM _ref_public
    ) d;
    SELECT count(*) INTO drift_sm FROM (
        SELECT * FROM _ref_sm EXCEPT SELECT * FROM _rebuilt_sm
        UNION ALL
        SELECT * FROM _rebuilt_sm EXCEPT SELECT * FROM _ref_sm
    ) d;
    SELECT count(*) INTO drift_ug FROM (
        SELECT * FROM _ref_uga EXCEPT SELECT * FROM _rebuilt_uga
        UNION ALL
        SELECT * FROM _rebuilt_uga EXCEPT SELECT * FROM _ref_uga
    ) d;

    IF drift_pub <> 0 OR drift_sm <> 0 OR drift_ug <> 0 THEN
        RAISE EXCEPTION
            'bulk-rebuild drift: public=% server_member=% user_group=%',
            drift_pub, drift_sm, drift_ug;
    END IF;

    RAISE NOTICE
        '[bulk-rebuild] OK — drift=0 across all three covers';
END
$assert$;

-- Threshold-flip promotion path. When
-- recompute_user_group_materialize_flags() flips a group from
-- false → true, it must call rebuild_user_group_cover(group_id)
-- synchronously. We can't easily generate 1000 members per group
-- in a fast test, so we lower the threshold to 1 with a
-- temporary override, then verify the rebuild happened.
DO $promotion$
DECLARE
    g_id UUID := 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    n_flipped INTEGER;
BEGIN
    -- Stub the threshold to 1 for the duration of this block so
    -- our 1-member group qualifies. The user_user_group_members
    -- table is empty in this test, so we also add one member.
    INSERT INTO user_user_group_members(user_id, user_group_id, created_time)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', g_id, now())
    ON CONFLICT DO NOTHING;

    CREATE OR REPLACE FUNCTION user_group_materialize_threshold()
    RETURNS INTEGER LANGUAGE sql IMMUTABLE AS 'SELECT 1';

    -- Force the flag back to false so the recompute observes a
    -- promotion (false → true) rather than a no-op.
    UPDATE user_groups SET materialize_uga = false WHERE id = g_id;

    -- Zap the group's cover rows so we can prove the rebuild
    -- inside the recompute actually fired.
    DELETE FROM user_group_accessible_resources WHERE user_group_id = g_id;

    SELECT recompute_user_group_materialize_flags() INTO n_flipped;
    IF n_flipped < 1 THEN
        RAISE EXCEPTION
            'recompute_user_group_materialize_flags returned % (expected ≥1)',
            n_flipped;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM user_group_accessible_resources
        WHERE user_group_id = g_id
    ) THEN
        RAISE EXCEPTION
            'threshold-flip promotion did NOT rebuild cover for %', g_id;
    END IF;

    -- Restore the canonical threshold so the dev DB is left
    -- consistent (we ROLLBACK anyway, but defensive).
    CREATE OR REPLACE FUNCTION user_group_materialize_threshold()
    RETURNS INTEGER LANGUAGE sql IMMUTABLE AS 'SELECT 1000';

    RAISE NOTICE '[promotion] OK — flag flipped + cover rebuilt';
END
$promotion$;

ROLLBACK;
