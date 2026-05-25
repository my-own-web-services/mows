#!/usr/bin/env bash
# Fast bulk seed: drops secondary indexes and FKs, bulk inserts,
# then recreates everything. 10× faster than insert-with-indexes at
# target scale.

set -euo pipefail
cd "$(dirname "$0")/.."

SCALE="${1:-tiny}"
. ./scripts/scales.sh
set_scale "$SCALE"

PSQL="docker compose exec -T db psql -U bench -d bench -v ON_ERROR_STOP=1 -X -q"

PSQL_VARS=(
    -v "n_users=$N_USERS"
    -v "n_apps=$N_APPS"
    -v "n_user_groups=$N_USER_GROUPS"
    -v "ug_membership_avg=5"
    -v "n_files=$N_FILES"
    -v "n_file_groups=$N_FILE_GROUPS"
    -v "n_public_shares=$N_PUBLIC_SHARES"
    -v "n_server_member_shares=$N_SERVER_MEMBER_SHARES"
    -v "n_direct_user_shares=$N_DIRECT_USER_SHARES"
    -v "n_direct_group_shares=$N_DIRECT_GROUP_SHARES"
    -v "n_resource_group_shares=$N_RESOURCE_GROUP_SHARES"
    -v "n_deny_overrides=$N_DENY_OVERRIDES"
    -v "n_owned_by_owner=$N_OWNED_BY_OWNER"
    -v "n_accessible_by_owner=$N_ACCESSIBLE_BY_OWNER"
    -v "start_time=2025-01-01 00:00:00"
)

echo "================= wipe + drop indexes/FKs ================="
# Wipe everything by dropping + recreating the public schema.
$PSQL -f /schema/01-tables.sql
$PSQL -f /schema/03-covers.sql
# Indexes + FKs are NOT applied yet. They come back at the end.

echo
echo "================= bulk seed ================="
for f in seed/01-users-apps-groups.sql seed/02-files.sql seed/03-file-groups.sql seed/04-policies.sql seed/05-covers.sql; do
    echo "-- $f (scale=$SCALE)"
    time $PSQL "${PSQL_VARS[@]}" -f "/$f"
done

echo
echo "================= create indexes + FKs ================="
time $PSQL -f /schema/02-indexes.sql
time $PSQL -f /schema/04-fks.sql

echo
echo "================= install auth API + RLS ================="
$PSQL -f /schema/05-auth-api.sql
$PSQL -f /schema/06-rls.sql

echo
echo "================= final ANALYZE ================="
$PSQL -c "ANALYZE;"

echo
echo "================= sizes ================="
$PSQL <<'SQL'
SELECT relname, pg_size_pretty(pg_relation_size(relid)) AS heap,
       pg_size_pretty(pg_indexes_size(relid)) AS indexes,
       n_live_tup
FROM pg_stat_user_tables
ORDER BY pg_relation_size(relid) DESC;
SQL
