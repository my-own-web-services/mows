-- Scenario: list-my-own-files (the OwnerOnly fast path).
-- The handler computes this purely from `files`, no auth tables touched.
--
-- The benchmark runs the query 5 times to amortise plan caching;
-- timings show plan + execute for each run plus a final EXPLAIN.

\timing on

-- Pick a top-10% user (s in 1..N/10 owns ~half the files).
\set target_user_id '\'' `echo -n "user-3" | md5sum | cut -d' ' -f1` '\''

SELECT 'target user' AS info, :target_user_id ::uuid AS uid;
SELECT count(*) AS files_owned
FROM files WHERE owner_id = :target_user_id ::uuid;

-- Repeat to warm cache
SELECT id FROM files WHERE owner_id = :target_user_id ::uuid
ORDER BY created_time DESC, id DESC LIMIT 50;
SELECT id FROM files WHERE owner_id = :target_user_id ::uuid
ORDER BY created_time DESC, id DESC LIMIT 50;
SELECT id FROM files WHERE owner_id = :target_user_id ::uuid
ORDER BY created_time DESC, id DESC LIMIT 50;

\echo '--- EXPLAIN ANALYZE ---'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, name, created_time
FROM files
WHERE owner_id = :target_user_id ::uuid
ORDER BY created_time DESC, id DESC
LIMIT 50;

\timing off
