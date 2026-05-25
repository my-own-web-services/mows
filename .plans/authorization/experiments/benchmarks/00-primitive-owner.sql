-- Bench: list_visible with scope=Owned for a typical owner.
-- This is the dominant workload — "list my files, sorted by recency".
-- Single primitive call. Handler-side query is just a display fetch.

\timing on
\set target_user_id '\'' `echo -n "user-3" | md5sum | cut -d' ' -f1` '\''
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''

\echo '== scope=Owned (the OwnerOnly fast path inside the primitive) =='

SELECT count(*) FROM list_visible(
    :target_user_id ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 0::smallint,
    NULL::timestamp, NULL::uuid, 50);
SELECT count(*) FROM list_visible(
    :target_user_id ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 0::smallint,
    NULL::timestamp, NULL::uuid, 50);
SELECT count(*) FROM list_visible(
    :target_user_id ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 0::smallint,
    NULL::timestamp, NULL::uuid, 50);

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM list_visible(
    :target_user_id ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 0::smallint,
    NULL::timestamp, NULL::uuid, 50);

\timing off
