#!/bin/bash

set -euo pipefail

rm -rf ./mows-common-rust-temp

cp ../../utils/mows-common-rust ./mows-common-rust-temp -r

docker build -t mows-package-manager . -f docker/package-manager.Dockerfile

rm -rf ./mows-common-rust-temp

# generate openapi.json

docker remove mows-package-manager-codegen-server --force
docker network create mows-codegen || true
docker run -d --rm -p 3001:80  -e PRIMARY_ORIGIN="http://localhost:1234" --network=mows-codegen --name mows-package-manager-codegen-server mows-package-manager 

sleep 2

rm -f swagger.json
curl -o swagger.json http://localhost:3001/apidoc/openapi.json


# generate clients

docker build -t mows-package-manager-codegen . -f docker/codegen.Dockerfile

rm -rf ./clients

docker run --rm -v ./swagger.json:/app/swagger.json -v ./clients/:/local/out/ mows-package-manager-codegen


docker build -t mows-package-manager-codegen-typescript . -f docker/ts-codegen.Dockerfile
docker run --rm -v ./swagger.json:/app/swagger.json -v ./ui/src:/app/out mows-package-manager-codegen-typescript --name mows-package-manager-codegen-typescript


docker remove mows-package-manager-codegen-server --force
docker network remove mows-codegen