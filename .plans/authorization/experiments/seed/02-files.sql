-- Seed `files`. Distribution: most resources are owned by the user
-- listing them (Paul's framing). Each user owns approximately
-- n_files / n_users files, with a small heavy-tail (10% of users own
-- 50% of files).
--
-- Parameters:
--   n_users
--   n_files
--   start_time           — base timestamp (so files have monotonic created_time)

BEGIN;

-- We bulk-insert with deterministic IDs. Owner is picked from a
-- mildly skewed distribution: user u with probability ~ 1/u
-- (Zipf-ish). To stay cheap we approximate with:
--   * 50% of files go to users 1 .. (n_users / 10)   (top 10%)
--   * 50% go to the rest

INSERT INTO files (id, owner_id, name, created_time, modified_time)
SELECT
    md5('file-' || s)::uuid                                       AS id,
    md5('user-' || CASE
        WHEN s % 2 = 0
            THEN ((s % GREATEST(:n_users / 10, 1)) + 1)
        ELSE
            (((s * 17) % :n_users) + 1)
    END)::uuid                                                     AS owner_id,
    'file-' || s                                                   AS name,
    -- created_time monotonically increasing; smaller s = older
    :'start_time'::timestamp + (s || ' seconds')::interval         AS created_time,
    :'start_time'::timestamp + (s || ' seconds')::interval         AS modified_time
FROM generate_series(1, :n_files) s;

-- ANALYZE so the planner gets fresh stats before benchmarks run
ANALYZE files;

COMMIT;

SELECT 'files' AS table, count(*) FROM files;
SELECT 'owner-distribution sample (top 10)' AS info, owner_id, count(*) AS file_count
FROM files
GROUP BY owner_id
ORDER BY file_count DESC
LIMIT 10;
