#!/usr/bin/env bash
# Install `mows` (and the `mpm` alias symlink) into ~/.cargo/bin.
#
# Uses `cargo install --path` against this crate so the binary picks up the
# current source tree, not whatever's published. Idempotent.
#
# Usage:
#   bash install.sh                 # release build, install to ~/.cargo/bin
#   PROFILE=dev bash install.sh     # debug build (faster, larger binary)
#   PREFIX=$HOME/.local bash install.sh   # install into $PREFIX/bin instead

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${PROFILE:-release}"
# `cargo install` always writes to $CARGO_INSTALL_ROOT/bin or ~/.cargo/bin.
# We honor PREFIX by overriding CARGO_INSTALL_ROOT for this run.
PREFIX="${PREFIX:-$HOME/.cargo}"
BIN_DIR="$PREFIX/bin"

mkdir -p "$BIN_DIR"

cargo_install_args=(
    install
    --path "$SCRIPT_DIR"
    --locked
    --force
    --root "$PREFIX"
)
if [[ "$PROFILE" == "dev" ]]; then
    cargo_install_args+=(--debug)
fi

echo "▶ installing mows from $SCRIPT_DIR ($PROFILE) → $BIN_DIR"
cargo "${cargo_install_args[@]}"

# `cargo install` only emits `mows`; the `mpm` alias is set up here to mirror
# the layout build.sh produces. Re-create unconditionally so it always points
# at the freshly installed binary.
ln -sf mows "$BIN_DIR/mpm"

echo
echo "✓ installed:"
ls -l "$BIN_DIR/mows" "$BIN_DIR/mpm"
echo
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        echo "⚠  $BIN_DIR is not on \$PATH — add it to your shell profile:"
        echo "    export PATH=\"$BIN_DIR:\$PATH\""
        ;;
esac
