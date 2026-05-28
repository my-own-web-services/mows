#!/bin/bash
# Build a VM image variant for mows-vm-supervisor.
#
# Each (distro, flavor) tuple maps to its own Dockerfile-or-flake under this
# directory. Output filename is `<distro>-<flavor>-mows-agent-<arch>.qcow2`,
# matching the path the supervisor's `locate_image()` looks up.
#
# Usage:
#   bash build.sh                                 # alpine, headless, host arch
#   bash build.sh --distro debian --flavor headless
#   bash build.sh --distro debian --flavor desktop
#   bash build.sh --distro alpine --flavor desktop
#   TARGETARCH=arm64 bash build.sh --distro debian --flavor desktop
#
# Output (per invocation):
#   dist/<distro>-<flavor>-mows-agent-<arch>.qcow2
#   dist/<distro>-<flavor>-mows-agent-<arch>.qcow2.sha256
#
# The build is performed entirely inside Docker (NixOS uses nixos-generators
# in a buildx container). Run twice in a row and the .sha256 files MUST
# match — that's the reproducibility contract.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# Defaults.
: "${TARGETARCH:=amd64}"
: "${SOURCE_DATE_EPOCH:=1735689600}"   # 2025-01-01 00:00:00 UTC
: "${OUT_DIR:=${SCRIPT_DIR}/dist}"

# Heredoc instead of line-range `sed` so a future doc-header restructure
# can't silently break --help (DEVOPS-26).
usage() {
    cat <<'EOF'
Build a VM image variant for mows-vm-supervisor.

Each (distro, flavor) tuple maps to its own Dockerfile-or-flake under
this directory. Output filename is `<distro>-<flavor>-mows-agent-<arch>.qcow2`,
matching the path the supervisor's `locate_image()` looks up.

Usage:
  bash build.sh                                 # alpine, headless, host arch
  bash build.sh --distro debian --flavor headless
  bash build.sh --distro debian --flavor desktop
  bash build.sh --distro alpine --flavor desktop
  TARGETARCH=arm64 bash build.sh --distro debian --flavor desktop

Output (per invocation):
  dist/<distro>-<flavor>-mows-agent-<arch>.qcow2
  dist/<distro>-<flavor>-mows-agent-<arch>.qcow2.sha256

The build is performed entirely inside Docker (NixOS uses
nixos-generators in a buildx container). Run twice in a row and the
.sha256 files MUST match — that's the reproducibility contract.
EOF
}

DISTRO="alpine"
FLAVOR="headless"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --distro)
            [[ $# -ge 2 ]] || { echo "ERROR: --distro requires a value" >&2; exit 2; }
            DISTRO="$2"; shift 2 ;;
        --flavor)
            [[ $# -ge 2 ]] || { echo "ERROR: --flavor requires a value" >&2; exit 2; }
            FLAVOR="$2"; shift 2 ;;
        --distro=*) DISTRO="${1#--distro=}"; shift ;;
        --flavor=*) FLAVOR="${1#--flavor=}"; shift ;;
        -h|--help)
            usage
            exit 0 ;;
        *)
            echo "unknown argument: $1" >&2
            exit 2 ;;
    esac
done

case "${DISTRO}" in
    alpine|debian|ubuntu|nixos) ;;
    *)
        echo "ERROR: unknown --distro '${DISTRO}' (expected: alpine|debian|ubuntu|nixos)" >&2
        exit 2 ;;
esac

case "${FLAVOR}" in
    headless|desktop) ;;
    *)
        echo "ERROR: unknown --flavor '${FLAVOR}' (expected: headless|desktop)" >&2
        exit 2 ;;
esac

DOCKERFILE="${SCRIPT_DIR}/${DISTRO}.Dockerfile"
if [ ! -f "${DOCKERFILE}" ]; then
    echo "ERROR: ${DOCKERFILE} missing — distro '${DISTRO}' not implemented yet." >&2
    exit 4
fi

mkdir -p "${OUT_DIR}"

# Build a static `mows` binary and stage it next to this script so the
# Dockerfile can COPY it into the guest rootfs.
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

IMAGE_TAG="mows-agent-image-builder-${DISTRO}-${FLAVOR}:dev"

# Optional pinned-package overrides. The Dockerfile ships sensible
# defaults; setting any of these env vars before invoking build.sh lets
# you roll forward a single dependency without editing the Dockerfile.
# Each maps 1:1 to a Dockerfile ARG (MIN-16: keep the lock surface in
# one place).
PINNED_ARGS=()
for arg in CHROMIUM_VERSION NSS_VERSION FREETYPE_VERSION HARFBUZZ_VERSION \
           FONT_FREEFONT_VERSION FONT_NOTO_EMOJI_VERSION \
           CHROME_DEVTOOLS_MCP_VERSION CLAUDE_CODE_VERSION PNPM_VERSION \
           RUST_TOOLCHAIN; do
    if [ -n "${!arg:-}" ]; then
        PINNED_ARGS+=(--build-arg "${arg}=${!arg}")
    fi
done

DOCKER_BUILDKIT=1 docker build \
    --build-arg "TARGETARCH=${TARGETARCH}" \
    --build-arg "SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}" \
    --build-arg "FLAVOR=${FLAVOR}" \
    --build-arg "DISTRO=${DISTRO}" \
    "${PINNED_ARGS[@]}" \
    --target export \
    --output "type=local,dest=${OUT_DIR}" \
    -t "${IMAGE_TAG}" \
    -f "${DOCKERFILE}" \
    .

# Each Dockerfile writes `<DISTRO>-mows-agent-<arch>.{qcow2,vmlinuz,initramfs}`;
# normalise to the distro-flavor-keyed paths the supervisor's locate_image()
# expects.
PREFIX_SRC="${OUT_DIR}/${DISTRO}-mows-agent-${TARGETARCH}"
PREFIX_DST="${OUT_DIR}/${DISTRO}-${FLAVOR}-mows-agent-${TARGETARCH}"
# Glob over every file pack.sh emitted (DEVOPS-36) instead of an
# enum of extensions — new artifacts (e.g. a future `.cpio.gz`) get
# renamed without needing this script touched.
for src in "${PREFIX_SRC}".*; do
    [ -f "${src}" ] || continue
    suffix="${src#${PREFIX_SRC}.}"
    dst="${PREFIX_DST}.${suffix}"
    if [ "${src}" != "${dst}" ]; then
        mv "${src}" "${dst}"
    fi
done

ARTIFACT="${PREFIX_DST}.qcow2"
echo
echo "image written to ${ARTIFACT}"
if [ -f "${ARTIFACT}.sha256" ]; then
    echo "sha256: $(cat "${ARTIFACT}.sha256")"
fi
