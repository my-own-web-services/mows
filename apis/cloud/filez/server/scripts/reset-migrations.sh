#!/bin/bash

set -euo pipefail

docker compose -f dev-db.compose.yaml down

docker compose -f dev-db.compose.yaml up -d

sleep 5

rm -rf ./migrations

diesel setup

diesel migration generate --diff-schema init

# replace SMALLINT NOT NULL[] with SMALLINT[] NOT NULL in the generated migration file
sed -i 's/SMALLINT NOT NULL\[\]/SMALLINT\[\] NOT NULL/g' ./migrations/*/up.sql


