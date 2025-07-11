#!/bin/bash

set -euo pipefail

docker compose -f dev-db.compose.yaml down

docker compose -f dev-db.compose.yaml up -d

sleep 5

rm -rf ./migrations

diesel setup

diesel migration generate --diff-schema init

# replace TEXT NOT NULL[] with TEXT[] NOT NULL in the generated migration file
sed -i 's/TEXT NOT NULL\[\]/TEXT\[\] NOT NULL/g' ./migrations/*/up.sql