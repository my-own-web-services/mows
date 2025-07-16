#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

bash $SCRIPT_DIR/create-local-net.sh

export BUILDKIT_PROGRESS="${BUILDKIT_PROGRESS:-plain}"


docker compose down mows-manager || true

# if skip build is not set or is false, build the manager image
if [ "${SKIP_BUILD:-false}" != "true" ]; then
  docker compose build mows-manager
fi

docker compose up mows-manager

