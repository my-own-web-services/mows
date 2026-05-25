-- Pathological scenario: a user is a member of "ug-1", the large
-- user-group that contains ~half the userbase. ug-1 has many shares
-- (resource-group on fg-1 which contains 10% of all files, plus
-- direct shares). The primitive must stay fast — the large-UG cover
-- exists exactly for this case.

\timing on
\set NIL_UUID '\'00000000-0000-0000-0000-000000000000\''
\set target_app_id '\'' `echo -n "app-1" | md5sum | cut -d' ' -f1` '\''

-- Pick a member of ug-1 — every even-numbered user (per seed).
\set ug1_member '\'' `echo -n "user-4" | md5sum | cut -d' ' -f1` '\''

\echo '== user-4 (in ug-1) — list everything they can see =='
SELECT count(*) FROM list_visible(
    :ug1_member ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);
SELECT count(*) FROM list_visible(
    :ug1_member ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);
SELECT count(*) FROM list_visible(
    :ug1_member ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);

EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM list_visible(
    :ug1_member ::uuid, :target_app_id ::uuid,
    0::smallint, 0::smallint, 1::smallint,
    NULL::timestamp, NULL::uuid, 50);

\timing off
