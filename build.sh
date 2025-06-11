#!/bin/bash

set -euo pipefail

export BUILDX_BAKE_ENTITLEMENTS_FS=0
export BAKE_ARGS="--set *.args.PROFILE=dev --set *.args.APP_STAGE_IMAGE=scratch"
export REGISTRY="localhost:5000"

export MOWS_ROOT=$(pwd)


echo "Building all components..."

echo "Building zitadel-resource-controller..."
cd ./operators/zitadel-resource-controller && bash build.sh ; cd ../../

echo "Building pektin-resource-controller..."
cd ./operators/pektin-resource-controller && bash build.sh ; cd ../../

echo "Building vault-resource-controller..."
cd ./operators/vault-resource-controller && bash build.sh ; cd ../../

echo "Building mows-package-manager..."
cd ./operators/mows-package-manager && bash build.sh ; cd ../../

echo "Building mows-manager..."
cd ./manager/ && bash build.sh ; cd ../

echo "Building mows-manager-codegen..."
cd ./manager/ && bash scripts/codegen.sh ; cd ../


echo "Building pektin-api..."
cd ./apis/core/pektin/api && bash build.sh ; cd ../../../../

echo "Building pektin-feoco..."
cd ./apis/core/pektin/feoco && bash build.sh ; cd ../../../../

echo "Building pektin-server..."
cd ./apis/core/pektin/server && bash build.sh ; cd ../../../../

echo "Building pektin-zertificat..."
cd ./apis/core/pektin/zertificat && bash build.sh ; cd ../../../../

echo "Building filez-server..."
cd ./apis/cloud/filez/server && bash build.sh ; cd ../../../../
