#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

bash $SCRIPT_DIR/create-local-net.sh
rm -rf ./mows-package-manager-temp || true
cp -r $SCRIPT_DIR/../../operators/package-manager ./mows-package-manager-temp
cp $SCRIPT_DIR/../../utils/mows-common ./mows-common-temp -r

docker compose down mows-manager || true


docker compose up mows-manager --build


rm -rf ./mows-package-manager-temp || true
rm -rf ./mows-common-temp || true
