#!/bin/bash
# Build the Alpine VM image used by mows-vm-supervisor.
#
# Usage:
#   bash build.sh                 # build for host arch (amd64) into ./dist
#   TARGETARCH=arm64 bash build.sh
#
# Output:
#   dist/alpine-mows-agent-${TARGETARCH}.qcow2
#   dist/alpine-mows-agent-${TARGETARCH}.qcow2.sha256
#
# The build is performed entirely inside Docker, matching the rest of the
# repo's build conventions. Run `bash build.sh` twice in a row and the
# .sha256 files MUST match — that's the reproducibility contract.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

: "${TARGETARCH:=amd64}"
: "${SOURCE_DATE_EPOCH:=1735689600}"   # 2025-01-01 00:00:00 UTC
: "${IMAGE_TAG:=mows-agent-image-builder:dev}"
: "${OUT_DIR:=${SCRIPT_DIR}/dist}"

mkdir -p "${OUT_DIR}"

# Build a static `mows` binary and stage it next to this script so the
# Dockerfile can COPY it into the guest rootfs. We reuse mows-cli's own
# build.sh (static musl, UPX-compressed). Skip the rebuild if the binary is
# already present and the user explicitly opts out via SKIP_MOWS_BUILD=1.
MOWS_CLI_DIR="${SCRIPT_DIR}/../../mows-cli"
MOWS_BIN_STAGING="${SCRIPT_DIR}/dist-guest-bin/mows"
mkdir -p "$(dirname "${MOWS_BIN_STAGING}")"
if [ -z "${SKIP_MOWS_BUILD:-}" ]; then
    echo "==> building static mows binary for guest image..."
    (cd "${MOWS_CLI_DIR}" && TARGETARCH="${TARGETARCH}" PROFILE=release bash build.sh)
fi
if [ ! -x "${MOWS_CLI_DIR}/dist/mows" ]; then
    echo "ERROR: ${MOWS_CLI_DIR}/dist/mows not found — set SKIP_MOWS_BUILD only when the binary already exists" >&2
    exit 1
fi
cp "${MOWS_CLI_DIR}/dist/mows" "${MOWS_BIN_STAGING}"
chmod +x "${MOWS_BIN_STAGING}"

DOCKER_BUILDKIT=1 docker build \
    --build-arg "TARGETARCH=${TARGETARCH}" \
    --build-arg "SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}" \
    --target export \
    --output "type=local,dest=${OUT_DIR}" \
    -t "${IMAGE_TAG}" \
    .

echo
echo "image written to ${OUT_DIR}/alpine-mows-agent-${TARGETARCH}.qcow2"
echo "sha256: $(cat "${OUT_DIR}/alpine-mows-agent-${TARGETARCH}.qcow2.sha256")"
