#!/bin/bash

set -euo pipefail

# OpenAPI is dumped at build time from the same `OpenApiRouter` graph the
# server uses, via the `openapi_dump` binary. No docker container, no
# running server, no curl — the spec is whatever the current source
# defines, before any deploy.

cd "$(dirname "$0")/.."

# DEVOPS-37: skip the cargo run entirely when openapi.json is already
# newer than every `*.rs` under src/. Saves ~3-5s on the inner dev loop
# for changes that don't touch the API surface.
need_dump=1
if [ -s openapi.json ] && [ "${FORCE_OPENAPI_DUMP:-0}" != "1" ]; then
    if [ -z "$(find src -name '*.rs' -newer openapi.json -print -quit 2>/dev/null)" ]; then
        echo "openapi.json up to date; skipping cargo run (set FORCE_OPENAPI_DUMP=1 to override)"
        need_dump=0
    fi
fi
if [ "${need_dump}" -eq 1 ]; then
    rm -f openapi.json
    cargo run -q --bin openapi_dump -- --output openapi.json
fi

if [ ! -s openapi.json ]; then
    echo "Error: openapi.json is empty or does not exist." >&2
    exit 1
fi

mkdir -p tmp

# TypeScript client — bake the generated file straight into the web app.
docker build -t mows-vm-supervisor-codegen ./codegen/typescript -f codegen/typescript/codegen.Dockerfile
docker run --rm \
    -v ./openapi.json:/app/openapi.json \
    -v ./tmp:/app/out \
    mows-vm-supervisor-codegen --name mows-vm-supervisor-codegen

mkdir -p web/src/api/generated
cp tmp/api-client.ts web/src/api/generated/api-client.ts

rm -rf tmp
