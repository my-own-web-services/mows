#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL="docker compose exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q"

# Order matters: tables first, covers second, then indexes (which
# reference the cover tables), then FKs.
for f in schema/01-tables.sql schema/03-covers.sql schema/02-indexes.sql schema/04-fks.sql; do
    echo "applying $f ..."
    $PSQL -f "/$f"
done

echo "schema applied."
