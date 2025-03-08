#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

bash $SCRIPT_DIR/create-local-net.sh

export BUILDKIT_PROGRESS="plain"


docker compose down mows-manager || true

docker compose up mows-manager --build

