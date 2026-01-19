#!/usr/bin/env bash
# Common test utilities for mpm e2e tests
# Source this file in your test scripts

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find the mpm binary - check multiple possible locations
if [[ -n "${MPM_BIN:-}" ]] && [[ -x "$MPM_BIN" ]]; then
    : # Use provided MPM_BIN
elif [[ -x "$PROJECT_ROOT/target/release/mpm" ]]; then
    MPM_BIN="$PROJECT_ROOT/target/release/mpm"
elif [[ -x "$PROJECT_ROOT/../target/release/mpm" ]]; then
    MPM_BIN="$PROJECT_ROOT/../target/release/mpm"
elif [[ -x "$PROJECT_ROOT/../../target/release/mpm" ]]; then
    MPM_BIN="$PROJECT_ROOT/../../target/release/mpm"
else
    # Default fallback - will be built later
    MPM_BIN="$PROJECT_ROOT/target/release/mpm"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Unique test ID for isolation
TEST_ID="${TEST_ID:-$(date +%s)-$$}"

# ============================================================================
# Logging Functions (defined early so they can be used in setup)
# ============================================================================

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
    echo -e "\n${BLUE}[TEST]${NC} $1"
}

log_debug() {
    if [[ "${DEBUG:-}" == "1" ]]; then
        echo -e "${YELLOW}[DEBUG]${NC} $1"
    fi
}

# ============================================================================
# Test Isolation Setup
# ============================================================================

# Set up isolated config path for tests
# This prevents tests from interfering with real deployments
setup_isolated_config() {
    local config_dir=$(mktemp -d "/tmp/mpm-test-config-${TEST_ID}-XXXXXX")
    export MPM_CONFIG_PATH="$config_dir/mpm.yaml"
    log_debug "Using isolated config: $MPM_CONFIG_PATH"
    echo "$config_dir"
}

# Automatically set up isolated config when sourcing this file
# unless MPM_CONFIG_PATH is already set (for nested test scenarios)
if [[ -z "${MPM_CONFIG_PATH:-}" ]]; then
    _CONFIG_DIR=$(mktemp -d "/tmp/mpm-test-config-${TEST_ID}-XXXXXX")
    export MPM_CONFIG_PATH="$_CONFIG_DIR/mpm.yaml"
    log_debug "Using isolated config: $MPM_CONFIG_PATH"
fi

# ============================================================================
# Test Result Functions
# ============================================================================

pass_test() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++)) || true
}

fail_test() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++)) || true
    if [[ "${FAIL_FAST:-}" == "1" ]]; then
        print_summary
        exit 1
    fi
}

skip_test() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((TESTS_SKIPPED++)) || true
}

# ============================================================================
# Assertion Functions
# ============================================================================

assert_eq() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Values should be equal}"

    if [[ "$expected" == "$actual" ]]; then
        return 0
    else
        log_error "Assertion failed: $message"
        log_error "  Expected: $expected"
        log_error "  Actual:   $actual"
        return 1
    fi
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-String should contain substring}"

    if [[ "$haystack" == *"$needle"* ]]; then
        return 0
    else
        log_error "Assertion failed: $message"
        log_error "  String: $haystack"
        log_error "  Should contain: $needle"
        return 1
    fi
}

assert_not_contains() {
    local haystack="$1"
    local needle="$2"
    local message="${3:-String should not contain substring}"

    if [[ "$haystack" != *"$needle"* ]]; then
        return 0
    else
        log_error "Assertion failed: $message"
        log_error "  String: $haystack"
        log_error "  Should NOT contain: $needle"
        return 1
    fi
}

assert_file_exists() {
    local file="$1"
    local message="${2:-File should exist}"

    if [[ -f "$file" ]]; then
        return 0
    else
        log_error "Assertion failed: $message"
        log_error "  File not found: $file"
        return 1
    fi
}

assert_dir_exists() {
    local dir="$1"
    local message="${2:-Directory should exist}"

    if [[ -d "$dir" ]]; then
        return 0
    else
        log_error "Assertion failed: $message"
        log_error "  Directory not found: $dir"
        return 1
    fi
}

assert_exit_code() {
    local expected="$1"
    local actual="$2"
    local message="${3:-Exit code should match}"

    if [[ "$expected" == "$actual" ]]; then
        return 0
    else
        log_error "Assertion failed: $message"
        log_error "  Expected exit code: $expected"
        log_error "  Actual exit code:   $actual"
        return 1
    fi
}

# ============================================================================
# Test Environment Functions
# ============================================================================

# Create an isolated temporary directory for a test
create_test_dir() {
    local name="${1:-test}"
    local dir=$(mktemp -d "/tmp/mpm-test-${name}-${TEST_ID}-XXXXXX")
    echo "$dir"
}

# Create a minimal git repository
create_git_repo() {
    local dir="$1"
    local name="${2:-test-repo}"

    mkdir -p "$dir"
    cd "$dir"
    git init -q
    git config user.email "test@example.com"
    git config user.name "Test User"
    # Disable commit signing for tests
    git config commit.gpgsign false

    # Create initial commit
    echo "# $name" > README.md
    git add README.md
    git commit -q -m "Initial commit" --no-gpg-sign

    cd - > /dev/null
}

# Create a minimal mpm project structure
create_mpm_project() {
    local dir="$1"
    local name="${2:-test-project}"

    mkdir -p "$dir/deployment/templates/config"
    mkdir -p "$dir/deployment/data"
    mkdir -p "$dir/deployment/results"

    # Create manifest
    cat > "$dir/deployment/mows-manifest.yaml" << EOF
manifestVersion: "0.1"
metadata:
  name: $name
  description: "Test project"
  version: "0.1"
spec:
  compose: {}
EOF

    # Create values.yaml
    cat > "$dir/deployment/values.yaml" << EOF
# Test values
hostname: test.example.com
port: 8080
EOF

    # Create docker-compose template
    cat > "$dir/deployment/templates/docker-compose.yaml" << EOF
services:
  web:
    image: nginx:alpine
    ports:
      - "{{ .port }}:80"
EOF
}

# ============================================================================
# Docker Helpers
# ============================================================================

# Check if Docker is available and running
docker_available() {
    if ! command -v docker &>/dev/null; then
        return 1
    fi
    if ! docker info &>/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# Run a command in a Docker container for isolation
run_in_docker() {
    local image="${1:-alpine:latest}"
    shift
    local cmd="$@"

    docker run --rm \
        -v "$PROJECT_ROOT:/mpm:ro" \
        -v "$MPM_BIN:/usr/local/bin/mpm:ro" \
        -w /workspace \
        "$image" \
        sh -c "$cmd"
}

# ============================================================================
# Build Helpers
# ============================================================================

# Ensure mpm binary is built
ensure_mpm_built() {
    if [[ ! -x "$MPM_BIN" ]]; then
        log_info "Building mpm..."
        cd "$PROJECT_ROOT"
        cargo build --release 2>&1 || {
            log_error "Failed to build mpm"
            exit 1
        }
        cd - > /dev/null
    fi

    if [[ ! -x "$MPM_BIN" ]]; then
        log_error "mpm binary not found at: $MPM_BIN"
        exit 1
    fi

    log_debug "Using mpm binary: $MPM_BIN"
}

# ============================================================================
# Cleanup
# ============================================================================

# Track Docker projects started during tests for cleanup
_DOCKER_PROJECTS_STARTED=()

# Register a Docker project for cleanup on exit
register_docker_project() {
    local project_name="$1"
    _DOCKER_PROJECTS_STARTED+=("$project_name")
}

# Cleanup Docker containers started during tests
cleanup_docker_containers() {
    for project in "${_DOCKER_PROJECTS_STARTED[@]}"; do
        log_debug "Cleaning up Docker project: $project"
        docker compose -p "$project" down --remove-orphans --timeout 5 2>/dev/null || true
    done

    # Also clean up any containers with test-related names
    # This catches containers that might have been started without registration
    if docker_available; then
        # Find and stop containers with test ID in their name
        local containers
        containers=$(docker ps -aq --filter "name=mpm-test-.*-${TEST_ID}" 2>/dev/null || true)
        if [[ -n "$containers" ]]; then
            log_debug "Removing orphaned test containers"
            echo "$containers" | xargs -r docker rm -f 2>/dev/null || true
        fi
    fi
}

# Cleanup function - call this in trap
cleanup_test_dirs() {
    # First clean up Docker containers
    cleanup_docker_containers

    if [[ "${KEEP_TEST_DIRS:-}" != "1" ]]; then
        rm -rf /tmp/mpm-test-*-${TEST_ID}-* 2>/dev/null || true
        # Also clean up config directory
        if [[ -n "${_CONFIG_DIR:-}" ]]; then
            rm -rf "$_CONFIG_DIR" 2>/dev/null || true
        fi
    fi
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    local test_name="${TEST_NAME:-Test}"
    echo ""
    echo "=============================================="
    echo "           $test_name SUMMARY"
    echo "=============================================="
    echo -e "Tests passed:  ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Tests failed:  ${RED}${TESTS_FAILED}${NC}"
    echo -e "Tests skipped: ${YELLOW}${TESTS_SKIPPED}${NC}"
    echo "=============================================="

    if [[ $TESTS_FAILED -gt 0 ]]; then
        return 1
    fi
    return 0
}

# Exit with appropriate code based on test results
exit_with_result() {
    print_summary
    if [[ $TESTS_FAILED -gt 0 ]]; then
        exit 1
    fi
    exit 0
}
