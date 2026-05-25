-- Throughput-mix bench: simulate a realistic production workload.
-- 1000 mixed calls in a tight loop, 70% list_visible(scope=Owned),
-- 20% list_visible(scope=All), 10% check_access. Total wall-clock
-- gives us an effective ops/sec number for the engine.

\timing on

DO $$
DECLARE
    n_iter   int := 1000;
    n_users  int := 0;
    rand_u   uuid;
    rand_f   uuid;
    app      uuid := md5('app-1')::uuid;
    op_choice int;
    i        int;
    t_start  timestamp;
    t_ms     numeric;
    ignored  record;
BEGIN
    SELECT count(*) INTO n_users FROM users WHERE user_type <> 0;

    t_start := clock_timestamp();

    FOR i IN 1..n_iter LOOP
        rand_u := md5('user-' || (1 + (random() * (n_users - 1))::int))::uuid;
        op_choice := (random() * 10)::int;

        IF op_choice < 7 THEN
            -- 70% scope=Owned
            FOR ignored IN SELECT * FROM list_visible(
                rand_u, app, 0::smallint, 0::smallint, 0::smallint,
                NULL::timestamp, NULL::uuid, 50) LOOP
                NULL;
            END LOOP;
        ELSIF op_choice < 9 THEN
            -- 20% scope=All
            FOR ignored IN SELECT * FROM list_visible(
                rand_u, app, 0::smallint, 0::smallint, 1::smallint,
                NULL::timestamp, NULL::uuid, 50) LOOP
                NULL;
            END LOOP;
        ELSE
            -- 10% check_access on a random file
            SELECT id INTO rand_f FROM files OFFSET (random() * 100)::int LIMIT 1;
            PERFORM check_access(rand_u, app, 0::smallint, rand_f, 0::smallint);
        END IF;
    END LOOP;

    t_ms := EXTRACT(EPOCH FROM (clock_timestamp() - t_start)) * 1000;
    RAISE NOTICE 'mixed workload: % ops in % ms (%.0f ops/sec, %.3f ms/op avg)',
        n_iter, t_ms, n_iter * 1000.0 / t_ms, t_ms / n_iter;
END $$;

\timing off
