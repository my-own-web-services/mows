-- Bench: list_visible called by an anonymous (logged-out) request.
-- Should walk only Public, via the cover.

\timing on
\set target_app_id  '\'' `echo -n "app-1"  | md5sum | cut -d' ' -f1` '\''

\echo '== anonymous list — Public only via cover =='

SELECT count(*) FROM list_visible(
    NULL::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);
SELECT count(*) FROM list_visible(
    NULL::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);
SELECT count(*) FROM list_visible(
    NULL::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM list_visible(
    NULL::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);

\timing off
