#!/bin/bash

set -euo pipefail

docker compose -f dev-db.compose.yaml down

docker compose -f dev-db.compose.yaml up -d

sleep 5

rm -rf ./migrations

diesel setup

diesel migration generate --diff-schema init