#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export SERVICE_NAME="mpm"
export BUILDX_BAKE_ENTITLEMENTS_FS=0
export PROFILE="${PROFILE:-release}"

# Target architecture: amd64 (default) or arm64
TARGETARCH="${TARGETARCH:-amd64}"
PLATFORM="linux/${TARGETARCH}"

# Get git info for version embedding
GIT_HASH="${GIT_HASH:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
GIT_DATE="${GIT_DATE:-$(git log -1 --format=%cs 2>/dev/null || echo 'unknown')}"

# Create dist directory
mkdir -p dist

# Build and export the static binary directly to dist/
echo "Building mpm static binary (profile: ${PROFILE}, arch: ${TARGETARCH}, git: ${GIT_HASH})..."

# Check if docker buildx is available (required for multi-context builds)
if ! docker buildx version >/dev/null 2>&1; then
    echo "Error: docker buildx is required but not available." >&2
    echo "" >&2
    echo "To install buildx:" >&2
    echo "  - Docker Desktop: buildx is included by default" >&2
    echo "  - Linux: Install docker-buildx-plugin or use 'docker buildx install'" >&2
    echo "  - NixOS: Add 'docker-buildx' to environment.systemPackages" >&2
    echo "" >&2
    echo "Alternatively, use 'mpm self-update' (without --build) to download pre-built binaries." >&2
    exit 1
fi

# Cache options for CI (set BUILDX_CACHE_DIR to enable)
CACHE_ARGS=""
if [ -n "${BUILDX_CACHE_DIR:-}" ]; then
    CACHE_ARGS="--cache-from type=local,src=${BUILDX_CACHE_DIR} --cache-to type=local,dest=${BUILDX_CACHE_DIR}-new,mode=max"
fi

docker buildx build \
    --platform "${PLATFORM}" \
    --file Dockerfile \
    --target binary \
    --build-context mows-common-rust=../mows-common-rust \
    --build-context lock=../../ \
    --build-arg PROFILE="${PROFILE}" \
    --build-arg SERVICE_NAME="${SERVICE_NAME}" \
    --build-arg TARGETARCH="${TARGETARCH}" \
    --build-arg GIT_HASH="${GIT_HASH}" \
    --build-arg GIT_DATE="${GIT_DATE}" \
    --output type=local,dest=dist/ \
    ${CACHE_ARGS} \
    .

# Make binary executable
chmod +x dist/mpm

echo "Build complete: dist/mpm"
ls -lh dist/mpm
