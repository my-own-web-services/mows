#!/bin/bash
#
# Bring up the local realtime-server Postgres on host port 5433.
# Port intentionally differs from filez's 5432 so both can run
# side-by-side during cross-service Phase-6 work.

set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
server_dir="$(dirname "$script_dir")"

docker compose -f "$server_dir/dev-db.compose.yaml" up -d
