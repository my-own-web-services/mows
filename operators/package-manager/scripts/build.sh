#!/bin/bash

set -euo pipefail


rm -rf ./mows-common-temp

cp ../../utils/mows-common ./mows-common-temp -r

docker build . -t localhost:5000/mows-package-manager -t mows-package-manager -f docker/package-manager.Dockerfile

rm -rf ./mows-common-temp

docker push localhost:5000/mows-package-manager
