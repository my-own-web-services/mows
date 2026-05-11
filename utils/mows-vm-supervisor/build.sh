#!/bin/bash
# Build the mows-vm-supervisor container image.
#
# Mirrors the convention used by apis/cloud/filez/server: a thin shell
# wrapper around docker buildx bake, with cargo-workspace-docker generating
# a minimal workspace Cargo.toml for layer caching.
#
# Usage:
#   bash build.sh                 # release build, alpine final stage
#   PROFILE=dev bash build.sh     # faster dev build
#   APP_STAGE_IMAGE=alpine bash build.sh   # default; from-scratch is unsupported
#                                          # because we shell out to qemu/wg
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build the web UI dist before the docker build so the supervisor's
# include_dir!() can bake `web/dist/` into the binary. Skipped if the user
# pre-built it (idempotent: pnpm build is fast on a warm cache anyway).
if [ "${SKIP_WEB_BUILD:-0}" != "1" ]; then
    pushd "$SCRIPT_DIR/web" > /dev/null
    if [ ! -d node_modules ]; then
        pnpm install --frozen-lockfile=false
    fi
    pnpm build
    popd > /dev/null
fi

mows tools cargo-workspace-docker

export SERVICE_NAME="mows-vm-supervisor"
export IMAGE_TAG="${IMAGE_TAG:-dev}"
export BAKE_ARGS="${BAKE_ARGS:-default} --allow=fs.read=/home/paul/projects/mows --set *.args.APP_STAGE_IMAGE=alpine"
export BUILDKIT_PROGRESS="plain"

docker buildx bake ${BAKE_ARGS:-default}

# Push only when an explicit registry is set; in that case also (re-)tag the
# already-built image for the registry. The default local build never touches
# any registry — including localhost:5000 — so a stray `localhost:5000/...`
# tag never gets created.
if [ -n "${REGISTRY:-}" ]; then
    docker tag "${SERVICE_NAME}:${IMAGE_TAG}" "${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
    docker push "${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
fi
