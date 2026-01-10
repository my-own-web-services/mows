#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export SERVICE_NAME="mpm"
export BUILDX_BAKE_ENTITLEMENTS_FS=0
export PROFILE="${PROFILE:-release}"

# Create dist directory
mkdir -p dist

# Build and export the static binary directly to dist/
echo "Building mpm static binary (profile: ${PROFILE})..."
docker buildx build \
    --file Dockerfile \
    --target binary \
    --build-context mows-common-rust=../mows-common-rust \
    --build-context lock=../../ \
    --build-arg PROFILE="${PROFILE}" \
    --build-arg SERVICE_NAME="${SERVICE_NAME}" \
    --output type=local,dest=dist/ \
    .

# Make binary executable
chmod +x dist/mpm

echo "Build complete: dist/mpm"
ls -lh dist/mpm
