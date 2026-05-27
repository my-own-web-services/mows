#!/usr/bin/env bash
# End-to-end tree-shake test runner.
#
# 1. Build @mows/react-components (skipped if `dist/` already exists and
#    `--rebuild` was not passed)
# 2. Pack the lib into a tarball
# 3. Build the treeshake docker image (consumer skeleton + pnpm deps)
# 4. Run the container, bind-mounting the tarball + an output directory
# 5. Invoke verify.mjs on the resulting sizes.json
#
# Usage: bash e2e/treeshake/run.sh [--rebuild]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
LIB_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
REBUILD=0
for arg in "$@"; do
    case "$arg" in
        --rebuild) REBUILD=1 ;;
        *) echo "treeshake: unknown arg '$arg'" >&2; exit 64 ;;
    esac
done

if [[ ! -d "$LIB_ROOT/dist" || $REBUILD -eq 1 ]]; then
    echo "treeshake: building @mows/react-components"
    (cd "$LIB_ROOT" && pnpm run build)
else
    echo "treeshake: reusing existing dist/ (pass --rebuild to force)"
fi

WORK=$(mktemp -d -t treeshake-XXXXXX)
trap 'rm -rf "$WORK"' EXIT

echo "treeshake: packing lib into $WORK"
(cd "$LIB_ROOT" && npm pack --pack-destination "$WORK" >/dev/null)
TARBALL=$(ls "$WORK"/mows-react-components-*.tgz | head -n1)
if [[ -z "$TARBALL" ]]; then
    echo "treeshake: npm pack produced no tarball" >&2
    exit 4
fi
echo "treeshake: tarball at $TARBALL"

IMAGE="mows-treeshake-e2e:latest"
echo "treeshake: building docker image $IMAGE"
docker build -q -t "$IMAGE" "$SCRIPT_DIR" >/dev/null

mkdir -p "$WORK/out"
echo "treeshake: running scenarios in docker"
docker run --rm \
    -v "$TARBALL":/lib/tarball.tgz:ro \
    -v "$WORK/out":/out \
    "$IMAGE"

SIZES="$WORK/out/sizes.json"
if [[ ! -f "$SIZES" ]]; then
    echo "treeshake: container did not produce sizes.json" >&2
    exit 5
fi

# Copy the artifact next to this script for inspection on failure or
# when running locally — the temp directory itself disappears on EXIT.
cp "$SIZES" "$SCRIPT_DIR/last-run-sizes.json"
echo "treeshake: sizes.json preserved at $SCRIPT_DIR/last-run-sizes.json"

node "$SCRIPT_DIR/verify.mjs" "$SCRIPT_DIR/last-run-sizes.json"
