#!/bin/bash
#
# mpm installer - https://github.com/my-own-web-services/mows
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/my-own-web-services/mows/main/utils/mpm/scripts/install.sh | bash
#
# Options (via environment variables):
#   MPM_INSTALL_DIR  - Installation directory (default: /usr/local/bin or ~/.local/bin)
#   MPM_VERSION      - Specific version to install (default: latest)
#
set -euo pipefail

REPO="my-own-web-services/mows"
BINARY_NAME="mpm"

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
    if mpm shell-init --install 2>&1; then
        success "Shell completions installed"
    else
        warn "Failed to install shell completions automatically"
        echo "  Run manually: mpm shell-init --install"
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
        grep -oP '"tag_name":\s*"mpm-v\K[0-9]+\.[0-9]+\.[0-9]+' || true)

    if [ -z "$version" ]; then
        error "Failed to fetch latest version from GitHub. Check your internet connection."
    fi
    echo "$version"
}

# Determine install directory
get_install_dir() {
    if [ -n "${MPM_INSTALL_DIR:-}" ]; then
        echo "$MPM_INSTALL_DIR"
    elif [ -w "/usr/local/bin" ]; then
        echo "/usr/local/bin"
    elif [ -d "$HOME/.local/bin" ] || mkdir -p "$HOME/.local/bin" 2>/dev/null; then
        echo "$HOME/.local/bin"
    else
        error "Cannot determine install directory. Set MPM_INSTALL_DIR or ensure ~/.local/bin exists."
    fi
}

# Check if command exists
has_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# Main installation
main() {
    info "Installing mpm..."

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
    version="${MPM_VERSION:-$(get_latest_version)}"
    install_dir=$(get_install_dir)

    binary_name="mpm-${version}-${os}-${arch}"
    download_url="https://github.com/${REPO}/releases/download/mpm-v${version}/${binary_name}"
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
    if ! curl -fsSL "$download_url" -o "$tmpdir/mpm"; then
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
    # We need to verify against our downloaded file named 'mpm'
    local expected_hash
    expected_hash=$(cut -d' ' -f1 "$tmpdir/checksum.txt")
    local actual_hash
    actual_hash=$(sha256sum "$tmpdir/mpm" | cut -d' ' -f1)

    if [ "$expected_hash" != "$actual_hash" ]; then
        error "Checksum verification failed!\nExpected: $expected_hash\nActual: $actual_hash"
    fi
    success "Checksum verified"

    # Install binary
    chmod +x "$tmpdir/mpm"

    if [ -w "$install_dir" ]; then
        mv "$tmpdir/mpm" "$install_dir/mpm"
    else
        info "Requesting sudo to install to ${install_dir}..."
        sudo mv "$tmpdir/mpm" "$install_dir/mpm"
    fi

    success "Installed mpm ${version} to ${install_dir}/mpm"

    # Check if install dir is in PATH
    if ! has_cmd mpm; then
        warn "${install_dir} is not in your PATH"
        echo
        echo "Add it to your shell profile:"
        echo "  echo 'export PATH=\"${install_dir}:\$PATH\"' >> ~/.bashrc"
        echo
        # Export for current session so shell-init works
        export PATH="${install_dir}:$PATH"
    fi

    # Setup shell completions
    setup_completions

    echo
    success "Installation complete!"
    echo
    mpm --version
    echo
    info "Restart your shell or run: exec \$SHELL"
    info "Then run 'mpm --help' to get started."
}

main "$@"
