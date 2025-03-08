#!/bin/bash

set -euo pipefail

export BAKE_ARGS="--set *.args.PROFILE=release --set *.args.APP_STAGE_IMAGE=scratch"
export REGISTRY="localhost:5000"


cd ./operators/zitadel-resource-controller && bash build.sh ; cd ../../

cd ./operators/pektin-resource-controller && bash build.sh ; cd ../../

cd ./operators/vault-resource-controller && bash build.sh ; cd ../../

cd ./operators/mows-package-manager && bash build.sh ; cd ../../

cd ./manager/ && bash build.sh ; cd ../

cd ./apis/core/pektin/api && bash build.sh ; cd ../../../../

cd ./apis/core/pektin/feoco && bash build.sh ; cd ../../../../

cd ./apis/core/pektin/server && bash build.sh ; cd ../../../../

cd ./apis/core/pektin/zertificat && bash build.sh ; cd ../../../../
