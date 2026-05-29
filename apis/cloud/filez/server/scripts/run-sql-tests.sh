#!/usr/bin/env bash
#
# Runs every SQL test under tests/sql against the dev DB. Exits
# non-zero on the first failure. Used by `cargo test` via the
# wrapper integration test in tests/sql_tests.rs, and runnable
# standalone for fast iteration.
#
# Expects the dev DB to be up — bring it up with:
#   bash scripts/start-dev-db.sh
#
# Reads DATABASE_URL from the environment, falling back to the
# dev-db.compose.yaml default if unset.

set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://filez:filez@127.0.0.1:5432/filez}"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
server_dir="$(dirname "$script_dir")"
sql_dir="$server_dir/tests/sql"

if [[ ! -d "$sql_dir" ]]; then
    echo "no tests/sql directory at $sql_dir" >&2
    exit 1
fi

shopt -s nullglob
sql_files=("$sql_dir"/*.sql)
shopt -u nullglob

if [[ ${#sql_files[@]} -eq 0 ]]; then
    echo "no .sql files under $sql_dir" >&2
    exit 1
fi

# Check connectivity up front so the first failure is a clear
# message, not a cryptic per-test connect error.
if ! psql -v ON_ERROR_STOP=1 -d "$DB_URL" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "cannot reach DATABASE_URL=$DB_URL — is dev-db up?" >&2
    echo "  bring it up with: bash scripts/start-dev-db.sh" >&2
    exit 2
fi

# Apply migrations via the project's own embedded-migrations
# runner (`cargo run --bin run_migrations`). We deliberately do
# NOT shell out to `diesel migration run` here: diesel.toml's
# [print_schema] section regenerates schema.rs from the live DB
# on every diesel-CLI invocation, and schema.rs is hand-curated.
# The embedded runner uses the same `MIGRATIONS` constant the
# server binary applies on boot.
echo "applying migrations via filez-server's embedded runner …"
(cd "$server_dir" && DATABASE_URL="$DB_URL" cargo run --quiet --bin run_migrations)

failures=0
for f in "${sql_files[@]}"; do
    name="$(basename "$f")"
    echo "=== $name ==="
    if psql -v ON_ERROR_STOP=1 -d "$DB_URL" -f "$f"; then
        echo "    PASS"
    else
        echo "    FAIL" >&2
        failures=$((failures + 1))
    fi
done

if [[ $failures -ne 0 ]]; then
    echo "$failures SQL test(s) failed" >&2
    exit 1
fi

echo "all ${#sql_files[@]} SQL test(s) passed"
