#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose up -d
# Wait for healthcheck
for i in $(seq 1 60); do
    if docker compose ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
        break
    fi
    sleep 1
done

# Confirm
docker compose exec -T db psql -U bench -d bench -c '\conninfo'
echo "DB up on 127.0.0.1:55432, user/db/pass = bench"
