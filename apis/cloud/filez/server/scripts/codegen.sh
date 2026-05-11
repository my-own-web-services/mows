#!/bin/bash

set -euo pipefail

# OpenAPI is dumped at build time from the same `OpenApiRouter` graph the
# server uses, via the `openapi_dump` binary. No docker container, no
# running server, no curl — the spec is whatever the current source
# defines, before any deploy.

rm -f openapi.json
cargo run -q --bin openapi_dump -- --output openapi.json

if [ ! -s openapi.json ]; then
  echo "Error: openapi.json is empty or does not exist." >&2
  exit 1
fi


mkdir -p tmp

# typescript

docker build -t filez-server-codegen ./codegen/typescript -f codegen/typescript/codegen.Dockerfile
docker run --rm -v ./openapi.json:/app/openapi.json -v ./tmp:/app/out filez-server-codegen --name filez-server-codegen

cp tmp/api-client.ts ../clients/typescript/src/

cd ../clients/typescript/ && yalc publish --push && cd -



rm -rf tmp

# rust

cargo run --bin clientgen
cd ../clients/rust/ && cargo fmt && cd -

