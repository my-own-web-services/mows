#!/bin/bash

set -euo pipefail

docker buildx bake --set "*.args.PROFILE=dev" --set "*.args.SKIP_UI_BUILD=true" --set "*.tags=mows-manager-codegen"
docker remove mows-manager-codegen-server --force
docker network create mows-codegen || true
docker run -d --rm -p 3001:3000 -v "./misc/internal-config.yml:/internal-config.yml" -v /etc/resolv.conf:/etc/host-resolv.conf:ro -e WEB_PORT=3000 --network=mows-codegen --name mows-manager-codegen-server mows-manager-codegen 

sleep 2

rm -f openapi.json
curl -o openapi.json http://localhost:3001/apidoc/openapi.json

docker build -t mows-manager-codegen . -f docker/codegen.Dockerfile
docker run --rm -v ./openapi.json:/app/openapi.json -v ./ui/src:/app/out mows-manager-codegen --name mows-manager-codegen

docker remove mows-manager-codegen-server --force
docker network remove mows-codegen