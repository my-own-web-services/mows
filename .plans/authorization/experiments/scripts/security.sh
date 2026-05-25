#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL="docker compose exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q"

# Helpers must persist outside the rollback in 10-cases.sql so we load
# them in a separate (committed) transaction first.
echo "loading helpers ..."
$PSQL -f /security/00-helpers.sql

echo "running security suite ..."
$PSQL -f /security/10-cases.sql
$PSQL -f /security/20-edge-cases.sql
$PSQL -f /security/30-multi-review-fixes.sql

echo "SECURITY SUITE: ALL CASES PASSED"
