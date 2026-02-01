#!/bin/bash
#
# mows installer - https://github.com/my-own-web-services/mows
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/my-own-web-services/mows/main/utils/mpm/scripts/install.sh | bash
#
# Options (via environment variables):
#   MOWS_INSTALL_DIR  - Installation directory (default: /usr/local/bin or ~/.local/bin)
#   MOWS_VERSION      - Specific version to install (default: latest)
#
set -euo pipefail

REPO="my-own-web-services/mows"
BINARY_NAME="mows"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

info() { echo -e "${BLUE}==>${NC} $*"; }
success() { echo -e "${GREEN}==>${NC} $*"; }
warn() { echo -e "${YELLOW}==>${NC} $*"; }
error() { echo -e "${RED}error:${NC} $*" >&2; exit 1; }

# Setup shell completions
setup_completions() {
    info "Installing shell completions..."
    if mows shell-init --install 2>&1; then
        success "Shell completions installed"
    else
        warn "Failed to install shell completions automatically"
        echo "  Run manually: mows shell-init --install"
    fi
}

# Setup man pages
setup_manpages() {
    info "Installing man pages..."
    if mows manpage --install 2>&1; then
        success "Man pages installed"
    else
        warn "Failed to install man pages automatically"
        echo "  Run manually: mows manpage --install"
    fi
}

# Detect architecture
detect_arch() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64|amd64) echo "amd64" ;;
        aarch64|arm64) echo "arm64" ;;
        *) error "Unsupported architecture: $arch (supported: x86_64, aarch64)" ;;
    esac
}

# Detect OS
detect_os() {
    local os
    os=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$os" in
        linux) echo "linux" ;;
        darwin) error "macOS is not yet supported. Build from source: cargo install --path ." ;;
        *) error "Unsupported OS: $os (supported: linux)" ;;
    esac
}

# Get latest version from GitHub API
get_latest_version() {
    local version
    version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | \
        grep -oP '"tag_name":\s*"mows-cli-v\K[0-9]+\.[0-9]+\.[0-9]+' || true)

    if [ -z "$version" ]; then
        error "Failed to fetch latest version from GitHub. Check your internet connection."
    fi
    echo "$version"
}

# Determine install directory
get_install_dir() {
    if [ -n "${MOWS_INSTALL_DIR:-}" ]; then
        echo "$MOWS_INSTALL_DIR"
    elif [ -w "/usr/local/bin" ]; then
        echo "/usr/local/bin"
    elif [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
        echo "$HOME/.local/bin"
    else
        error "Cannot determine install directory. Set MOWS_INSTALL_DIR or ensure ~/.local/bin exists."
    fi
}

# Check if command exists
has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Main installation
main() {
    info "Installing mows..."

    # Check dependencies
    if ! has_cmd curl; then
        error "curl is required but not installed"
    fi
    if ! has_cmd sha256sum; then
        error "sha256sum is required but not installed"
    fi

    local arch os version install_dir binary_name download_url checksum_url

    arch=$(detect_arch)
    os=$(detect_os)
    version="${MOWS_VERSION:-$(get_latest_version)}"
    install_dir=$(get_install_dir)

    binary_name="mows-${version}-${os}-${arch}"
    download_url="https://github.com/${REPO}/releases/download/mows-cli-v${version}/${binary_name}"
    checksum_url="${download_url}-checksum-sha256.txt"

    info "Version: ${version}"
    info "Architecture: ${os}/${arch}"
    info "Install directory: ${install_dir}"

    # Create temp directory
    local tmpdir
    tmpdir=$(mktemp -d)
    trap 'rm -rf "$tmpdir"' EXIT

    # Download binary
    info "Downloading ${binary_name}..."
    if ! curl -fsSL "$download_url" -o "$tmpdir/mows"; then
        error "Failed to download binary from: $download_url"
    fi

    # Download checksum
    info "Verifying checksum..."
    if ! curl -fsSL "$checksum_url" -o "$tmpdir/checksum.txt"; then
        error "Failed to download checksum from: $checksum_url"
    fi

    # Verify checksum
    cd "$tmpdir"
    # Checksum file contains: <hash>  <filename>
    # We need to verify against our downloaded file named 'mows'
    local expected_hash
    expected_hash=$(cut -d' ' -f1 "$tmpdir/checksum.txt")
    local actual_hash
    actual_hash=$(sha256sum "$tmpdir/mows" | cut -d' ' -f1)

    if [ "$expected_hash" != "$actual_hash" ]; then
        error "Checksum verification failed!\nExpected: $expected_hash\nActual: $actual_hash"
    fi
    success "Checksum verified"

    # Install binary
    chmod +x "$tmpdir/mows"

    if [ -w "$install_dir" ]; then
        mv "$tmpdir/mows" "$install_dir/mows"
        # Create mpm symlink for backward compatibility
        ln -sf mows "$install_dir/mpm"
    else
        info "Requesting sudo to install to ${install_dir}..."
        sudo mv "$tmpdir/mows" "$install_dir/mows"
        sudo ln -sf mows "$install_dir/mpm"
    fi

    success "Installed mows ${version} to ${install_dir}/mows"
    info "Created mpm symlink: ${install_dir}/mpm -> mows"

    # Check if install dir is in PATH
    if ! has_cmd mows; then
        warn "${install_dir} is not in your PATH"
        echo
        echo "Add it to your shell profile:"
        echo "  echo 'export PATH=\"${install_dir}:\$PATH\"' >> ~/.bashrc"
        echo
        # Export for current session so shell-init works
        export PATH="${install_dir}:$PATH"
    fi

    # Verify installed version matches expected
    local installed_version
    installed_version=$(mows version 2>/dev/null | grep -oP '^mows \K[0-9]+\.[0-9]+\.[0-9]+' || true)
    if [ -z "$installed_version" ]; then
        error "Failed to verify installed version. 'mows version' did not return expected output."
    fi
    if [ "$installed_version" != "$version" ]; then
        error "Version mismatch! Expected: ${version}, Installed: ${installed_version}"
    fi

    # Setup shell completions and man pages
    setup_completions
    setup_manpages

    echo
    success "Installation complete!"
    echo
    mows version
    echo
    info "Restart your shell or run: exec \$SHELL"
    info "Then run 'mows --help' to get started."
    info "Use 'mpm' as a shorthand for 'mows package-manager' (package manager commands)."
}

main "$@"
