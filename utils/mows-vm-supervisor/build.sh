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
#
# NB: The final stage is hardcoded to `alpine` because the supervisor
# shells out to qemu-system-x86_64 + wireguard-tools at runtime, neither
# of which exists in `scratch`. There is no `APP_STAGE_IMAGE` flag.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Repo root drives the buildx fs.read allowlist below. We require git
# because `cargo-workspace-docker` already assumes a git worktree.
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# Regenerate the OpenAPI spec + TypeScript client from the live router
# graph. Cheap because cargo+docker layers are cached; can be skipped if you
# know the spec hasn't changed.
if [ "${SKIP_CODEGEN:-0}" != "1" ]; then
    bash "$SCRIPT_DIR/scripts/codegen.sh"
fi

# Build the web UI dist before the docker build so the supervisor's
# include_dir!() can bake `web/dist/` into the binary. Skipped if the user
# pre-built it (idempotent: pnpm build is fast on a warm cache anyway).
if [ "${SKIP_WEB_BUILD:-0}" != "1" ]; then
    pushd "$SCRIPT_DIR/web" > /dev/null
    if [ ! -d node_modules ]; then
        pnpm install
    fi
    pnpm build
    popd > /dev/null
fi

# Self-bootstrap: if `mows` isn't on PATH (fresh CI runner, new
# contributor) fall back to running the CLI straight out of the
# workspace. Mirrors utils/mows-cli/build.sh and avoids the cryptic
# shell error documented in DEVOPS-27.
if command -v mows >/dev/null 2>&1; then
    mows tools cargo-workspace-docker
elif command -v mpm >/dev/null 2>&1; then
    mpm tools cargo-workspace-docker
else
    cargo run --quiet --release --manifest-path "${REPO_ROOT}/utils/mows-cli/Cargo.toml" -- \
        tools cargo-workspace-docker
fi

export SERVICE_NAME="mows-vm-supervisor"
export IMAGE_TAG="${IMAGE_TAG:-dev}"
export BAKE_ARGS=("${BAKE_ARGS:-default}" "--allow=fs.read=${REPO_ROOT}" "--set" "*.args.APP_STAGE_IMAGE=alpine")
export BUILDKIT_PROGRESS="plain"

docker buildx bake "${BAKE_ARGS[@]}"

# Push only when an explicit registry is set; in that case also (re-)tag the
# already-built image for the registry. The default local build never touches
# any registry — including localhost:5000 — so a stray `localhost:5000/...`
# tag never gets created.
if [ -n "${REGISTRY:-}" ]; then
    docker tag "${SERVICE_NAME}:${IMAGE_TAG}" "${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
    docker push "${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
fi
