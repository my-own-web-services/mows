#!/bin/bash

set -euo pipefail

export BUILDX_BAKE_ENTITLEMENTS_FS=0
export SERVICE_NAME="filez-server"

docker buildx bake --set "*.args.PROFILE=dev" --set "*.tags=filez-server-codegen"
docker remove filez-server-codegen-server --force
docker run -d --rm -p 8088:8080 --name filez-server-codegen-server filez-server-codegen 

sleep 2

rm -f openapi.json
curl -o openapi.json http://localhost:8088/apidoc/openapi.json

docker build -t filez-server-codegen ./codegen -f codegen/codegen.Dockerfile
mkdir -p tmp
docker run --rm -v ./openapi.json:/app/openapi.json -v ./tmp:/app/out filez-server-codegen --name filez-server-codegen

cp tmp/api-client.ts ../web/src/

rm -rf tmp

docker remove filez-server-codegen-server --force
