#!/bin/bash

set -euo pipefail

# OpenAPI is dumped at build time from the same `OpenApiRouter` graph the
# manager binary uses, via the `openapi_dump` binary. No docker container,
# no running server, no curl — the spec is whatever the current source
# defines, before any deploy.

rm -f openapi.json
cargo run -q --bin openapi_dump -- --output openapi.json

if [ ! -s openapi.json ]; then
  echo "Error: openapi.json is empty or does not exist." >&2
  exit 1
fi

docker build -t mows-manager-codegen . -f docker/codegen.Dockerfile
docker run --rm -v ./openapi.json:/app/openapi.json -v ./ui/src:/app/out mows-manager-codegen --name mows-manager-codegen
