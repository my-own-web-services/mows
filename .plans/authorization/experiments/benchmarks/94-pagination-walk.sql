-- Pure Public-listing pagination scenario: most-recent N Public files,
-- then walk 5 pages forward via keyset cursor.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_app_id '\'' `echo -n "app-1" | md5sum | cut -d' ' -f1` '\''
\set page_size 50

\echo '=== page 1 ==='
EXPLAIN (ANALYZE, BUFFERS)
SELECT pr.resource_id, pr.sort_created
FROM   public_resources pr
WHERE  pr.resource_type = 0
  AND  pr.app_ids && ARRAY[:target_app_id ::uuid, :NIL_UUID ::uuid]
  AND  pr.actions @> ARRAY[0::smallint]
ORDER  BY pr.sort_created DESC, pr.resource_id DESC
LIMIT  :page_size;

\echo '=== keyset cursor walk: pages 2..5 ==='
DO $$
DECLARE
    cur_ts timestamp;
    cur_id uuid;
    pg_no  int := 1;
    nil    uuid := '00000000-0000-0000-0000-000000000000';
    app    uuid := md5('app-1')::uuid;
    rec    record;
BEGIN
    -- bootstrap cursor from last row of page 1
    SELECT sort_created, resource_id INTO cur_ts, cur_id
    FROM   public_resources
    WHERE  resource_type = 0
      AND  app_ids && ARRAY[app, nil]
      AND  actions @> ARRAY[0::smallint]
    ORDER  BY sort_created DESC, resource_id DESC
    OFFSET 49 LIMIT 1;

    FOR pg_no IN 2..5 LOOP
        FOR rec IN
            SELECT resource_id, sort_created
            FROM   public_resources
            WHERE  resource_type = 0
              AND  app_ids && ARRAY[app, nil]
              AND  actions @> ARRAY[0::smallint]
              AND  (sort_created, resource_id) < (cur_ts, cur_id)
            ORDER  BY sort_created DESC, resource_id DESC
            LIMIT  50
        LOOP
            cur_ts := rec.sort_created;
            cur_id := rec.resource_id;
        END LOOP;
        RAISE NOTICE 'page % cursor now %, %', pg_no, cur_ts, cur_id;
    END LOOP;
END $$;
\timing off
