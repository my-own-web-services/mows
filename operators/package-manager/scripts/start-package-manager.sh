#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )


rm -rf ./mows-common-temp

cp $SCRIPT_DIR/../../../utils/mows-common ./mows-common-temp -r

docker build . -t mows-package-manager -f docker/package-manager.Dockerfile

docker compose down mows-package-manager || true

rm -rf ./mows-common-temp



docker compose up mows-package-manager
