#!/usr/bin/env bash
# Development install: builds and installs mows + creates mpm symlink.
# Usage:
#   bash scripts/dev-install.sh
#   cargo watch -s "bash scripts/dev-install.sh"
set -euo pipefail

cargo install --path=.

INSTALL_DIR="${CARGO_HOME:-$HOME/.cargo}/bin"
MOWS="$INSTALL_DIR/mows"
MPM="$INSTALL_DIR/mpm"

if [[ ! -x "$MOWS" ]]; then
    echo "error: mows binary not found at $MOWS" >&2
    exit 1
fi

# Create or update mpm symlink
if [[ -L "$MPM" ]]; then
    rm -f "$MPM"
elif [[ -e "$MPM" ]]; then
    echo "error: $MPM exists and is not a symlink, refusing to overwrite" >&2
    exit 1
fi

ln -sf mows "$MPM"
echo "Created mpm symlink: $MPM -> mows"
