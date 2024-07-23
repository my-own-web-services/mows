#!/bin/bash

set -euo pipefail

docker build -t mows-manager . -f docker/manager.Dockerfile
docker remove mows-manager-codegen-server --force
docker network create mows-codegen || true
docker run -d --rm -p 3001:3000 -v "./misc/internal-config.yml:/internal-config.yml" -v /etc/resolv.conf:/etc/host-resolv.conf:ro -e WEB_PORT=3000 --network=mows-codegen --name mows-manager-codegen-server mows-manager 

sleep 2

rm -f swagger.json
curl -o swagger.json http://localhost:3001/api-docs/openapi.json

docker build -t mows-manager-codegen . -f docker/codegen.Dockerfile
docker run --rm -v ./swagger.json:/app/swagger.json -v ./ui/src:/app/out mows-manager-codegen --name mows-manager-codegen

docker remove mows-manager-codegen-server --force
docker network remove mows-codegen