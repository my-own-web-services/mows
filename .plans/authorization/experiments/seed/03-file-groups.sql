-- Seed `file_groups` and their memberships.
--
-- Distribution:
--   * file_group 1: contains a *very* large fraction (10%) of all files
--     — represents the "all photos" pathological group
--   * file_groups 2–10: each contains ~1% of files
--   * the rest: small (10–100 files each)
--
-- Parameters: n_files, n_file_groups
--
-- ON CONFLICT removed: the deterministic generator does not produce
-- duplicates within a single INSERT (different g uses different
-- file_group_id, and within the small-groups CTE we DISTINCT). FKs
-- + secondary indexes are dropped during seed (see scripts/seed.sh)
-- so per-row validation overhead is gone.

BEGIN;

-- file_groups
INSERT INTO file_groups (id, owner_id, name)
SELECT
    md5('fg-' || s)::uuid                                          AS id,
    md5('user-' || ((s % 10) + 1))::uuid                           AS owner_id,
    'fg-' || s
FROM generate_series(1, :n_file_groups) s;

-- huge group 1: every 10th file (each (file_id, fg-1) is unique)
INSERT INTO file_file_group_members (file_id, file_group_id)
SELECT
    md5('file-' || f)::uuid,
    md5('fg-1')::uuid
FROM generate_series(1, :n_files) f
WHERE f % 10 = 0;

-- medium groups 2–10: each gets every 100th file at a different offset
-- (each (file_id, fg-g) pair is unique)
INSERT INTO file_file_group_members (file_id, file_group_id)
SELECT
    md5('file-' || f)::uuid,
    md5('fg-' || g)::uuid
FROM generate_series(2, 10) g,
     generate_series(1, :n_files) f
WHERE f % 100 = g;

-- small groups: each remaining group gets up to 50 files via hash
-- distribution. The generator can produce duplicates within a single
-- group (when (g * 53 + k1) and (g * 53 + k2) hash to the same file),
-- so we DISTINCT in a CTE to avoid conflicts without per-row ON
-- CONFLICT overhead.
WITH candidate AS (
    SELECT DISTINCT
        md5('file-' || (((g * 53 + k) % :n_files) + 1))::uuid AS file_id,
        md5('fg-' || g)::uuid                                  AS file_group_id
    FROM generate_series(11, :n_file_groups) g,
         generate_series(0, 49) k
)
INSERT INTO file_file_group_members (file_id, file_group_id)
SELECT file_id, file_group_id FROM candidate;

COMMIT;

SELECT
    fg.id AS file_group_id,
    fg.name,
    count(m.file_id) AS member_count
FROM file_groups fg
LEFT JOIN file_file_group_members m ON m.file_group_id = fg.id
GROUP BY fg.id, fg.name
ORDER BY member_count DESC
LIMIT 12;
