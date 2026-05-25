#!/usr/bin/env bash
# Full validation: schema, seed, security suite, benchmarks, RLS defence,
# pathological cases, throughput mix. The end-to-end gate.

set -euo pipefail
cd "$(dirname "$0")/.."

SCALE="${1:-small}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="results/full-${SCALE}-${STAMP}.md"
mkdir -p results

PSQL="docker compose exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X"

echo "# Full validation run: scale=${SCALE}, ${STAMP}" > "$OUT"

echo "" >> "$OUT"
echo "## 1. Security suite (correctness gate)" >> "$OUT"
echo "" >> "$OUT"
echo '```' >> "$OUT"
# CRIT-3: security suite is the correctness gate; its exit code must propagate.
# Capture full output to a tmp file, tail-truncate into $OUT, then exit non-zero
# if security failed (set -e + pipefail are active).
SEC_TMP="$(mktemp)"
if ! bash scripts/security.sh 2>&1 | tee "$SEC_TMP"; then
    tail -50 "$SEC_TMP" >> "$OUT"
    echo '```' >> "$OUT"
    echo "" >> "$OUT"
    echo "**FAIL: security suite did not pass — aborting full validation.**" >> "$OUT"
    rm -f "$SEC_TMP"
    exit 1
fi
tail -50 "$SEC_TMP" >> "$OUT"
rm -f "$SEC_TMP"
echo '```' >> "$OUT"

echo "" >> "$OUT"
echo "## 2. Database sizes" >> "$OUT"
echo "" >> "$OUT"
echo '```' >> "$OUT"
$PSQL -c "SELECT relname, pg_size_pretty(pg_relation_size(relid)) AS heap,
                 pg_size_pretty(pg_indexes_size(relid)) AS indexes,
                 n_live_tup
          FROM pg_stat_user_tables
          ORDER BY pg_relation_size(relid) DESC;" >> "$OUT"
echo '```' >> "$OUT"

# Helpers (heap_merge / user_group_ids_of)
$PSQL -q -f /security/00-helpers.sql >/dev/null

for bench in benchmarks/*.sql; do
    echo "" >> "$OUT"
    echo "## $(basename "$bench")" >> "$OUT"
    echo "" >> "$OUT"
    echo '```' >> "$OUT"
    $PSQL -f "/${bench}" 2>&1 >> "$OUT"
    echo '```' >> "$OUT"
done

# Tidy summary at the end
echo "" >> "$OUT"
echo "## Summary" >> "$OUT"
echo "" >> "$OUT"
echo '```' >> "$OUT"
# CRIT-3 (continued): if summarising fails, that's a real signal the bench
# output format changed — should not be silenced.
bash scripts/summarize-results.sh "$OUT" 2>&1 >> "$OUT"
echo '```' >> "$OUT"

echo "wrote $OUT"
