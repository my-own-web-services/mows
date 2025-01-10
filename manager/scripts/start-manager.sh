#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

bash $SCRIPT_DIR/create-local-net.sh
rm -rf ./mows-package-manager-client-temp || true
cp -r ../operators/package-manager/clients/rust ./mows-package-manager-client-temp

docker compose down mows-manager || true


docker compose up mows-manager --build



