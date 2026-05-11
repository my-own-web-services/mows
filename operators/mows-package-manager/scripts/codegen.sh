#!/bin/bash

set -euo pipefail

# OpenAPI is dumped at build time from the same `OpenApiRouter` graph the
# server uses, via the `openapi_dump` binary. No docker container, no
# running server, no curl — the spec is whatever the current source
# defines, before any deploy.

rm -f openapi.json swagger.json
cargo run -q --bin openapi_dump -- --output openapi.json
# Keep the legacy `swagger.json` name working for the downstream codegen
# images that mount it by path.
cp openapi.json swagger.json

if [ ! -s openapi.json ]; then
  echo "Error: openapi.json is empty or does not exist." >&2
  exit 1
fi


# generate clients

docker build -t mows-package-manager-codegen . -f docker/codegen.Dockerfile

rm -rf ./clients

docker run --rm -v ./swagger.json:/app/swagger.json -v ./clients/:/local/out/ mows-package-manager-codegen


docker build -t mows-package-manager-codegen-typescript . -f docker/ts-codegen.Dockerfile
docker run --rm -v ./swagger.json:/app/swagger.json -v ./ui/src:/app/out mows-package-manager-codegen-typescript --name mows-package-manager-codegen-typescript