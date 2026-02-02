#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export SERVICE_NAME="mows"
export BUILDX_BAKE_ENTITLEMENTS_FS=0
export PROFILE="${PROFILE:-release}"

# Target architecture: amd64 (default) or arm64
# Cross-compilation is used for arm64, so we always build on amd64
TARGETARCH="${TARGETARCH:-amd64}"

# Get git info for version embedding
GIT_HASH="${GIT_HASH:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
GIT_DATE="${GIT_DATE:-$(git log -1 --format=%cs 2>/dev/null || echo 'unknown')}"

# Extract version from Cargo.toml
SERVICE_VERSION="${SERVICE_VERSION:-$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)"/\1/')}"

# Create dist directory
mkdir -p dist

# Regenerate cargo-workspace-docker.toml to ensure correct version and dependencies
echo "Regenerating cargo-workspace-docker.toml..."
if command -v mows >/dev/null 2>&1; then
    mows tools cargo-workspace-docker
elif command -v mpm >/dev/null 2>&1; then
    mpm tools cargo-workspace-docker
else
    # Fallback: use cargo to run from source (slower but works without mows installed)
    cargo run --quiet --release -- tools cargo-workspace-docker
fi

# Build and export the static binary directly to dist/
echo "Building mows static binary (v${SERVICE_VERSION}, profile: ${PROFILE}, arch: ${TARGETARCH}, git: ${GIT_HASH})..."

# Check if docker buildx is available (required for multi-context builds)
if ! docker buildx version >/dev/null 2>&1; then
    echo "Error: docker buildx is required but not available." >&2
    echo "" >&2
    echo "To install buildx:" >&2
    echo "  - Docker Desktop: buildx is included by default" >&2
    echo "  - Linux: Install docker-buildx-plugin or use 'docker buildx install'" >&2
    echo "  - NixOS: Add 'docker-buildx' to environment.systemPackages" >&2
    echo "" >&2
    echo "Alternatively, use 'mows self-update' (without --build) to download pre-built binaries." >&2
    exit 1
fi

# Cache options for CI
# Set BUILDX_CACHE=gha for GitHub Actions cache backend (recommended for CI)
# Set BUILDX_CACHE_DIR for local directory cache
CACHE_ARGS=""
if [ "${BUILDX_CACHE:-}" = "gha" ]; then
    # GitHub Actions cache backend - optimized for GHA, supports cross-job caching
    # Use branch-aware scope to prevent PRs from corrupting main branch caches
    BRANCH_NAME="${GITHUB_REF_NAME:-main}"
    CACHE_SCOPE="${BRANCH_NAME}-${TARGETARCH}"
    MAIN_CACHE_SCOPE="main-${TARGETARCH}"

    # Read from both branch cache and main cache (fallback for new branches)
    # Write only to branch-specific cache to prevent PRs from polluting main
    if [ "$BRANCH_NAME" = "main" ]; then
        # Main branch: read and write to main cache only
        CACHE_ARGS="--cache-from type=gha,scope=${CACHE_SCOPE} --cache-to type=gha,scope=${CACHE_SCOPE},mode=max"
    else
        # Feature branches: read from branch cache first, then fall back to main cache
        CACHE_ARGS="--cache-from type=gha,scope=${CACHE_SCOPE} --cache-from type=gha,scope=${MAIN_CACHE_SCOPE} --cache-to type=gha,scope=${CACHE_SCOPE},mode=max"
    fi
elif [ -n "${BUILDX_CACHE_DIR:-}" ]; then
    # Local directory cache
    CACHE_ARGS="--cache-from type=local,src=${BUILDX_CACHE_DIR} --cache-to type=local,dest=${BUILDX_CACHE_DIR}-new,mode=max"
fi

docker buildx build \
    --file Dockerfile \
    --target binary \
    --build-context mows-common-rust=../mows-common-rust \
    --build-context lock=../../ \
    --build-arg PROFILE="${PROFILE}" \
    --build-arg SERVICE_NAME="${SERVICE_NAME}" \
    --build-arg SERVICE_VERSION="${SERVICE_VERSION}" \
    --build-arg TARGETARCH="${TARGETARCH}" \
    --build-arg GIT_HASH="${GIT_HASH}" \
    --build-arg GIT_DATE="${GIT_DATE}" \
    --output type=local,dest=dist/ \
    ${CACHE_ARGS} \
    .

# Make binary executable
chmod +x dist/mows

# Create mpm symlink for backward compatibility
ln -sf mows dist/mpm

echo "Build complete: dist/mows (with mpm symlink)"
ls -lh dist/mows dist/mpm
