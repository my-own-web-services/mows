#!/bin/bash

set -euo pipefail

docker build -t mows-manager . -f manager.Dockerfile

docker run --net=host -d --rm --name mows-manager-codegen-server mows-manager 

sleep 2

curl -o swagger.json http://localhost:3000/api-docs/openapi.json

docker build -t mows-manager-codegen . -f ./codegen.Dockerfile
docker run --rm -v ./swagger.json:/app/swagger.json -v ./ui/src:/app/out mows-manager-codegen --name mows-manager-codegen

docker remove mows-manager-codegen-server --force