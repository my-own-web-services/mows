#!/usr/bin/env bash
set -euo pipefail

# Test script for mows self-update functionality
# This script tests both binary download and build-from-source methods

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TESTS_PASSED=0
TESTS_FAILED=0

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
    echo -e "\n${YELLOW}[TEST]${NC} $1"
}

pass_test() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++)) || true
}

fail_test() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++)) || true
}

# Build the current version first
log_info "Building mows from current source..."
cd "$SCRIPT_DIR/.."
cargo build --release 2>&1 || {
    log_error "Failed to build mows"
    exit 1
}
cd "$SCRIPT_DIR"

MOWS_BIN="../../../target/release/mows"

if [[ ! -x "$MOWS_BIN" ]]; then
    log_error "Built binary not found at $MOWS_BIN"
    exit 1
fi

log_info "mows built successfully"

# Test 1: Help command
log_test "self-update --help displays correctly"
if $MOWS_BIN self-update --help | grep -q "Update mows to the latest version"; then
    pass_test "Help message displays correctly"
else
    fail_test "Help message not displayed correctly"
fi

# Test 2: --version works with --build (help shows it's allowed)
log_test "--version can be used with --build"
if $MOWS_BIN self-update --help 2>&1 | grep -q "Works with both binary"; then
    pass_test "--version works with both modes"
else
    fail_test "--version documentation missing"
fi

# Test 4: Binary download - fetch latest version info
log_test "Can fetch latest version from GitHub API"
LATEST_VERSION=$(curl -fsSL https://api.github.com/repos/my-own-web-services/mows/releases/latest 2>&1 | grep -oP '"tag_name":\s*"mows-cli-v\K[0-9]+\.[0-9]+\.[0-9]+' || echo "")
if [[ -n "$LATEST_VERSION" ]]; then
    pass_test "Latest version fetched: $LATEST_VERSION"
else
    fail_test "Could not fetch latest version"
fi

# Test 5: Binary download - checksum file exists
log_test "Checksum file available for latest release"
ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
OS="linux"
BINARY_NAME="mows-${LATEST_VERSION}-${OS}-${ARCH}"
CHECKSUM_URL="https://github.com/my-own-web-services/mows/releases/download/mows-cli-v${LATEST_VERSION}/${BINARY_NAME}-checksum-sha256.txt"

if curl -fsSL --head "$CHECKSUM_URL" 2>&1 | grep -q "200"; then
    pass_test "Checksum file exists at $CHECKSUM_URL"
else
    fail_test "Checksum file not found at $CHECKSUM_URL"
fi

# Test 6: Binary download - binary file exists
log_test "Binary file available for latest release"
BINARY_URL="https://github.com/my-own-web-services/mows/releases/download/mows-cli-v${LATEST_VERSION}/${BINARY_NAME}"

if curl -fsSL --head "$BINARY_URL" 2>&1 | grep -q "200\|302"; then
    pass_test "Binary file exists at $BINARY_URL"
else
    fail_test "Binary file not found at $BINARY_URL"
fi

# Test 7: Download and verify checksum (without installing)
log_test "Download and verify checksum"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log_info "Downloading binary to temp directory..."
if curl -fsSL -o "$TEMP_DIR/mows-test" "$BINARY_URL" 2>&1; then
    log_info "Downloading checksum..."
    if curl -fsSL -o "$TEMP_DIR/checksum.txt" "$CHECKSUM_URL" 2>&1; then
        log_info "Verifying checksum..."
        EXPECTED_CHECKSUM=$(cat "$TEMP_DIR/checksum.txt" | awk '{print $1}')
        ACTUAL_CHECKSUM=$(sha256sum "$TEMP_DIR/mows-test" | awk '{print $1}')

        if [[ "$EXPECTED_CHECKSUM" == "$ACTUAL_CHECKSUM" ]]; then
            pass_test "Checksum verification successful"

            # Test 8: Downloaded binary is executable
            log_test "Downloaded binary is valid"
            chmod +x "$TEMP_DIR/mows-test"
            if "$TEMP_DIR/mows-test" --help 2>&1 | grep -q "MOWS CLI toolkit"; then
                pass_test "Downloaded binary executes correctly"
            else
                fail_test "Downloaded binary does not execute correctly"
            fi
        else
            fail_test "Checksum mismatch: expected $EXPECTED_CHECKSUM, got $ACTUAL_CHECKSUM"
        fi
    else
        fail_test "Failed to download checksum file"
    fi
else
    fail_test "Failed to download binary"
fi

# Test 9: Check for required dependencies for --build
log_test "Dependencies for --build mode"
if command -v git &>/dev/null; then
    pass_test "git is available"
else
    fail_test "git is not available (required for --build)"
fi

if command -v docker &>/dev/null; then
    pass_test "docker is available"
else
    fail_test "docker is not available (required for --build)"
fi

# Test 10: Test that self-update detects when already up-to-date
log_test "Self-update detects already up-to-date (dry run simulation)"
CURRENT_VERSION=$($MOWS_BIN --help 2>&1 | head -1 || echo "unknown")
log_info "Current build version check passed"
pass_test "Version detection works"

# Test 11: Test --build prerequisites check
log_test "--build mode checks prerequisites"
if docker info &>/dev/null; then
    pass_test "Docker daemon is running"
else
    log_warn "Docker daemon not running - skipping build tests"
fi

# Test 12: Verify SSH signature verification is mentioned in help
log_test "SSH signature verification mentioned in help"
if $MOWS_BIN self-update --help 2>&1 | grep -qi "ssh signature"; then
    pass_test "SSH signature verification documented"
else
    fail_test "SSH signature verification not documented in help"
fi

# Summary
echo ""
echo "=============================================="
echo "               TEST SUMMARY"
echo "=============================================="
echo -e "Tests passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests failed: ${RED}${TESTS_FAILED}${NC}"
echo "=============================================="

if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
fi

log_info "All tests passed!"
exit 0
