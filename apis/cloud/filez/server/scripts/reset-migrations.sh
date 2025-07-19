#!/bin/bash

set -euo pipefail

docker compose -f dev-db.compose.yaml down

docker compose -f dev-db.compose.yaml up -d

sleep 5

rm -rf ./migrations

diesel setup

diesel migration generate --diff-schema init


sed -i 's/SMALLINT NOT NULL\[\]/SMALLINT\[\] NOT NULL/g' ./migrations/*/up.sql


# sed -i -e '/FOREIGN KEY/s/)$/) ON DELETE CASCADE/' ./migrations/*/up.sql