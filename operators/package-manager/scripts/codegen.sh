#!/bin/bash

set -euo pipefail

rm -rf ./mows-common-temp

cp ../../utils/mows-common ./mows-common-temp -r

docker build -t mows-package-manager . -f docker/package-manager.Dockerfile

rm -rf ./mows-common-temp


docker remove mows-package-manager-codegen-server --force
docker network create mows-codegen || true
docker run -d --rm -p 3001:80  -e PRIMARY_ORIGIN="http://localhost:1234" --network=mows-codegen --name mows-package-manager-codegen-server mows-package-manager 

sleep 2

rm -f swagger.json
curl -o swagger.json http://localhost:3001/apidoc/openapi.json

docker build -t mows-package-manager-codegen . -f docker/codegen.Dockerfile
docker run --rm -v ./swagger.json:/app/swagger.json -v ./ui/src:/app/out mows-package-manager-codegen --name mows-package-manager-codegen

docker remove mows-package-manager-codegen-server --force
docker network remove mows-codegen