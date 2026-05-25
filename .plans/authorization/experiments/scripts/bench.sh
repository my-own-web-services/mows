#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL="docker compose exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X"

RESULTS_DIR="results"
STAMP="$(date +%Y%m%d-%H%M%S)"
SCALE="${SCALE:-unknown}"
OUT="${RESULTS_DIR}/${SCALE}-${STAMP}.md"
mkdir -p "$RESULTS_DIR"

# Helpers (heap_merge_list etc. need user_group_ids_of)
$PSQL -q -f /security/00-helpers.sql >/dev/null

{
    echo "# Benchmark run: scale=${SCALE}, ${STAMP}"
    echo
    echo '## Database sizes'
    echo
    echo '```'
    $PSQL -c "SELECT relname, pg_size_pretty(pg_relation_size(relid)) AS heap,
                     pg_size_pretty(pg_indexes_size(relid)) AS indexes,
                     n_live_tup
              FROM pg_stat_user_tables
              ORDER BY pg_relation_size(relid) DESC;"
    echo '```'

    for bench in benchmarks/*.sql; do
        echo
        echo "## $(basename "$bench")"
        echo
        echo '```'
        $PSQL -f "/${bench}" 2>&1
        echo '```'
    done
} | tee "$OUT"

echo
echo "wrote: $OUT"
