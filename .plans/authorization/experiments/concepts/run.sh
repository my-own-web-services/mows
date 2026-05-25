#!/usr/bin/env bash
# Tear down, build, seed, run all 5 concept tests.
# Exits non-zero on any test failure.

set -euo pipefail
cd "$(dirname "$0")"

PSQL="docker compose -f ../docker-compose.yaml exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q"

echo "================= 1. wipe + apply schemas ================="
$PSQL -f /benchmarks/../../concepts/schema/01-mows-auth.sql 2>&1 | tail -5 || true
# The volume mount in docker-compose.yaml only mounts schema/, seed/,
# benchmarks/, security/ — for concepts/ we pipe the SQL via stdin.
for f in schema/01-mows-auth.sql schema/02-filez.sql schema/03-functions.sql schema/04-roles.sql; do
    echo "    apply $f"
    docker compose -f ../docker-compose.yaml exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q < "$f" >/dev/null
done

echo "================= 2. seed fixture ================="
for f in seed/01-fixture.sql; do
    docker compose -f ../docker-compose.yaml exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q < "$f" >/dev/null
done

echo
echo "================= 3. concept tests ================="
PASS=0
FAIL=0
# CRIT-4: pass/fail is determined by the psql exit code with ON_ERROR_STOP=1,
# NOT by grepping output for words like ERROR/FAIL (which incorrectly counted
# error output as a pass and silent success as a fail). Tests use
# RAISE EXCEPTION on assertion failure; psql then exits non-zero.
for t in tests/*.sql; do
    name=$(basename "$t")
    echo "----- $name -----"
    set +e
    out=$(docker compose -f ../docker-compose.yaml exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q < "$t" 2>&1)
    rc=$?
    set -e
    echo "$out" | grep -E "(NOTICE|ERROR|EXCEPTION)" || true
    if [ "$rc" -eq 0 ]; then
        PASS=$((PASS+1))
    else
        FAIL=$((FAIL+1))
        echo "    >>> FAILED (exit $rc) <<<"
    fi
    echo
done

echo
echo "================= 4. truly-concurrent upload test ================="
# Set up a fresh quota policy committed (not rolled back this time so
# parallel clients see it).
docker compose -f ../docker-compose.yaml exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q <<'SQL'
DELETE FROM filez.filez_policy_quotas
    WHERE policy_id = '5eee0000-0000-0000-0000-000000000000'::uuid;
DELETE FROM mows_auth.access_policies
    WHERE id = '5eee0000-0000-0000-0000-000000000000'::uuid;

SET ROLE picker_role;
INSERT INTO mows_auth.access_policies (
    id, owner_id, subject_type, subject_id, context_app_ids,
    resource_type, resource_id, resource_scope, actions, effect
) VALUES (
    '5eee0000-0000-0000-0000-000000000000'::uuid,
    md5('user-paul')::uuid, 3,
    '00000000-0000-0000-0000-000000000000'::uuid,
    ARRAY[md5('app-upload-ui')::uuid],
    1, md5('fg-submissions')::uuid, 0,
    ARRAY[10::smallint], 1
);
INSERT INTO filez.filez_policy_quotas
    (policy_id, max_bytes, max_files, max_per_file_bytes)
VALUES ('5eee0000-0000-0000-0000-000000000000'::uuid,
        100000000, 1000, 1000000);
RESET ROLE;
SQL

# Launch 10 parallel uploaders, each posts 50 uploads of 100 KB.
# Expected final state: used_bytes = 10 * 50 * 100000 = 50_000_000.
echo "    launching 10 parallel uploaders × 50 uploads × 100 KB ..."
SECONDS=0
for client in $(seq 1 10); do
    (
        for i in $(seq 1 50); do
            docker compose -f ../docker-compose.yaml exec -T db psql -U bench -d bench -X -q -t -A <<SQL >/dev/null 2>&1
SET ROLE filez_role;
SELECT filez.create_file_with_quota(
    NULL, md5('app-upload-ui')::uuid, md5('user-paul')::uuid,
    md5('storage-default')::uuid, 100000, 'parallel-${client}-${i}.txt',
    '5eee0000-0000-0000-0000-000000000000'::uuid,
    md5('fg-submissions')::uuid);
SQL
        done
    ) &
done
wait
echo "    all clients finished in ${SECONDS}s"

# Verify exact counter
result=$(docker compose -f ../docker-compose.yaml exec -T db psql -U bench -d bench -X -q -t -A <<'SQL'
SELECT used_bytes, used_files FROM filez.filez_policy_quotas
WHERE policy_id = '5eee0000-0000-0000-0000-000000000000'::uuid;
SQL
)
echo "    final counters: $result"

expected_bytes=50000000
expected_files=500
actual_bytes=$(echo "$result" | cut -d'|' -f1)
actual_files=$(echo "$result" | cut -d'|' -f2)

if [ "$actual_bytes" = "$expected_bytes" ] && [ "$actual_files" = "$expected_files" ]; then
    echo "    [4.2] CONCURRENT counters EXACT: bytes=$actual_bytes files=$actual_files (OK)"
    PASS=$((PASS+1))
else
    echo "    [4.2] FAIL — drift: expected ($expected_bytes, $expected_files), got ($actual_bytes, $actual_files)"
    FAIL=$((FAIL+1))
fi

echo
echo "================= summary ================="
echo "tests passed: $PASS"
echo "tests failed: $FAIL"
[ $FAIL -eq 0 ] || exit 1
echo "ALL CONCEPTS VALIDATED"
