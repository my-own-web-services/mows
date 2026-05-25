-- Procedural k-way heap merge implemented in plpgsql.
-- This mirrors what the real Rust engine will do per LISTING.md §8:
-- each source has a cursor; we pop the largest sort_key from a
-- "heap"; check Deny; yield up to page_size resources.
--
-- plpgsql doesn't have an efficient binary heap, so we use a
-- temporary table with an index on sort_key DESC and `SELECT … FOR
-- UPDATE SKIP LOCKED` to simulate the heap pop. For k ≤ 10 this is
-- equivalent in cost to a real heap; the goal is to prove the
-- semantics work, not micro-benchmark the heap.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_user_id '\'' `echo -n "user-3" | md5sum | cut -d' ' -f1` '\''
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''
\set page_size 50

DROP FUNCTION IF EXISTS heap_merge_list(uuid, uuid, int);

CREATE OR REPLACE FUNCTION heap_merge_list(
    p_user uuid, p_app uuid, p_page int
) RETURNS TABLE(resource_id uuid, sort_key timestamp, source text)
LANGUAGE plpgsql AS $$
DECLARE
    v_nil       uuid := '00000000-0000-0000-0000-000000000000';
    v_groups    uuid[] := user_group_ids_of(p_user);
    v_yielded   int := 0;
    v_buffer    int := p_page;
    v_dedup     uuid[] := '{}';
    rec         record;
BEGIN
    -- Build per-source cursors as ordered buffers.
    -- We pre-fetch page_size from each so the heap-pop loop has data.

    CREATE TEMP TABLE IF NOT EXISTS heap_buf (
        sort_key timestamp,
        resource_id uuid,
        source text,
        PRIMARY KEY (resource_id, source)
    ) ON COMMIT DROP;
    TRUNCATE heap_buf;

    -- Owned
    INSERT INTO heap_buf
    SELECT f.created_time, f.id, 'owned'
    FROM   files f
    WHERE  f.owner_id = p_user
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  v_buffer
    ON CONFLICT DO NOTHING;

    -- Direct user
    INSERT INTO heap_buf
    SELECT f.created_time, f.id, 'direct_user'
    FROM   access_policies ap
    JOIN   files f ON f.id = ap.resource_id
    WHERE  ap.subject_type = 0 AND ap.subject_id = p_user
      AND  ap.resource_type = 0 AND ap.effect = 1
      AND  ap.actions @> ARRAY[0::smallint]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  ap.resource_scope = 0 AND NOT ap.revoked
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  v_buffer
    ON CONFLICT DO NOTHING;

    -- Direct group
    INSERT INTO heap_buf
    SELECT f.created_time, f.id, 'direct_group'
    FROM   access_policies ap
    JOIN   files f ON f.id = ap.resource_id
    WHERE  ap.subject_type = 1 AND ap.subject_id = ANY(v_groups)
      AND  ap.resource_type = 0 AND ap.effect = 1
      AND  ap.actions @> ARRAY[0::smallint]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  ap.resource_scope = 0 AND NOT ap.revoked
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  v_buffer
    ON CONFLICT DO NOTHING;

    -- Via resource-group
    INSERT INTO heap_buf
    SELECT f.created_time, f.id, 'via_rg'
    FROM   access_policies ap
    JOIN   file_file_group_members ffgm ON ffgm.file_group_id = ap.resource_id
    JOIN   files f ON f.id = ffgm.file_id
    WHERE  ap.resource_type = 1 AND ap.effect = 1
      AND  ap.actions @> ARRAY[10::smallint]
      AND  ap.context_app_ids && ARRAY[p_app, v_nil]
      AND  ap.resource_scope = 0 AND NOT ap.revoked
      AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
         OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups)))
    ORDER  BY f.created_time DESC, f.id DESC
    LIMIT  v_buffer
    ON CONFLICT DO NOTHING;

    -- Public cover
    INSERT INTO heap_buf
    SELECT pr.sort_created, pr.resource_id, 'public_cover'
    FROM   public_resources pr
    WHERE  pr.resource_type = 0
      AND  pr.app_ids && ARRAY[p_app, v_nil]
      AND  pr.actions @> ARRAY[0::smallint]
    ORDER  BY pr.sort_created DESC, pr.resource_id DESC
    LIMIT  v_buffer
    ON CONFLICT DO NOTHING;

    -- ServerMember cover (only meaningful if user is authenticated)
    IF p_user IS NOT NULL THEN
        INSERT INTO heap_buf
        SELECT smr.sort_created, smr.resource_id, 'sm_cover'
        FROM   server_member_resources smr
        WHERE  smr.resource_type = 0
          AND  smr.app_ids && ARRAY[p_app, v_nil]
          AND  smr.actions @> ARRAY[0::smallint]
        ORDER  BY smr.sort_created DESC, smr.resource_id DESC
        LIMIT  v_buffer
        ON CONFLICT DO NOTHING;
    END IF;

    CREATE INDEX IF NOT EXISTS heap_buf_sort_idx
        ON heap_buf (sort_key DESC, resource_id DESC);

    -- Pop the heap: highest sort_key first; dedup by resource_id;
    -- check Deny; yield. Stop at p_page.
    FOR rec IN
        SELECT sort_key, resource_id, source FROM heap_buf
        ORDER BY sort_key DESC, resource_id DESC
    LOOP
        IF v_yielded >= p_page THEN EXIT; END IF;
        IF rec.resource_id = ANY(v_dedup) THEN CONTINUE; END IF;
        v_dedup := array_append(v_dedup, rec.resource_id);

        -- Deny check (fast, indexed lookup)
        PERFORM 1 FROM access_policies ap
        WHERE  ap.resource_type = 0
          AND  ap.resource_id = rec.resource_id
          AND  ap.effect = 0
          AND  ap.actions @> ARRAY[0::smallint]
          AND  ap.context_app_ids && ARRAY[p_app, v_nil]
          AND  NOT ap.revoked
          AND  ((ap.subject_type = 0 AND ap.subject_id = p_user)
             OR (ap.subject_type = 1 AND ap.subject_id = ANY(v_groups))
             OR (ap.subject_type = 2 AND p_user IS NOT NULL)
             OR (ap.subject_type = 3))
        LIMIT 1;
        IF FOUND THEN CONTINUE; END IF;

        resource_id := rec.resource_id;
        sort_key   := rec.sort_key;
        source     := rec.source;
        v_yielded  := v_yielded + 1;
        RETURN NEXT;
    END LOOP;
END $$;

\echo '=== heap-merge list — 3 runs ==='

SELECT count(*) FROM heap_merge_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size);
SELECT count(*) FROM heap_merge_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size);
SELECT count(*) FROM heap_merge_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size);

\echo '=== sources contributing to the page ==='
SELECT source, count(*) FROM heap_merge_list(:target_user_id ::uuid, :target_app_id ::uuid, :page_size)
GROUP BY source ORDER BY count(*) DESC;

\timing off
