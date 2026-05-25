-- Pagination walk: cursor-paginate 10 pages of Public results.
-- Each page should be ~1ms regardless of position.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_app_id '\'' `echo -n "app-1" | md5sum | cut -d' ' -f1` '\''

DO $$
DECLARE
    cur_ts timestamp := NULL;
    cur_id uuid := NULL;
    app    uuid := md5('app-1')::uuid;
    nil    uuid := '00000000-0000-0000-0000-000000000000';
    pg_n   int := 1;
    t_ms   numeric;
    t_start timestamp;
    rec    record;
    last_ts timestamp;
    last_id uuid;
BEGIN
    FOR pg_n IN 1..10 LOOP
        t_start := clock_timestamp();
        last_ts := NULL;
        last_id := NULL;
        FOR rec IN SELECT * FROM list_visible(
            NULL::uuid, app, 0::smallint, 0::smallint, 1::smallint,
            cur_ts, cur_id, 50)
        LOOP
            last_ts := rec.sort_ts;
            last_id := rec.resource_id;
        END LOOP;
        t_ms := EXTRACT(EPOCH FROM (clock_timestamp() - t_start)) * 1000;
        RAISE NOTICE 'page %: % ms, last cursor (%, %)', pg_n, t_ms, last_ts, last_id;
        cur_ts := last_ts;
        cur_id := last_id;
        EXIT WHEN last_ts IS NULL;
    END LOOP;
END $$;

\timing off
