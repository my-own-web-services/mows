#!/usr/bin/env bash
# Main test runner for mpm e2e tests
# Runs all tests in parallel with isolated environments

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# Configuration
# ============================================================================

# Number of parallel jobs (default: number of CPU cores)
PARALLEL_JOBS="${PARALLEL_JOBS:-$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)}"

# Test output directory
OUTPUT_DIR="${OUTPUT_DIR:-$SCRIPT_DIR/output}"

# Test selection
TEST_FILTER="${1:-}"

# Options
VERBOSE="${VERBOSE:-0}"
KEEP_OUTPUT="${KEEP_OUTPUT:-0}"
FAIL_FAST="${FAIL_FAST:-0}"

# ============================================================================
# Functions
# ============================================================================

usage() {
    cat << EOF
Usage: $0 [OPTIONS] [TEST_FILTER]

Run mpm end-to-end tests.

Options:
    -h, --help          Show this help message
    -v, --verbose       Verbose output (show test output in real-time)
    -j, --jobs N        Number of parallel jobs (default: $PARALLEL_JOBS)
    -k, --keep-output   Keep test output directory after run
    -f, --fail-fast     Stop on first failure
    -s, --sequential    Run tests sequentially (same as -j 1)
    -l, --list          List available tests without running

Arguments:
    TEST_FILTER         Only run tests matching this pattern (e.g., "tools", "compose")

Environment Variables:
    PARALLEL_JOBS       Number of parallel jobs
    OUTPUT_DIR          Directory for test output
    VERBOSE             Set to 1 for verbose output
    KEEP_OUTPUT         Set to 1 to keep output directory
    FAIL_FAST           Set to 1 to stop on first failure
    MOWS_BIN            Path to mows binary (default: uses release build)
    MPM_BIN             Path to mpm symlink (default: alongside mows binary)
    DEBUG               Set to 1 for debug output in tests

Examples:
    $0                      Run all tests in parallel
    $0 tools                Run only tools tests
    $0 -v -j 1 compose      Run compose tests sequentially with verbose output
    $0 --list               List available tests

EOF
}

log_header() {
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}========================================${NC}\n"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get list of test files
get_test_files() {
    local filter="${1:-}"
    local files=()
    local skip_list="${SKIP_TESTS:-}"

    for f in "$SCRIPT_DIR"/test-*.sh; do
        [[ -f "$f" ]] || continue
        [[ -x "$f" ]] || continue
        local test_name=$(basename "$f" .sh)
        # Skip if filter is set and file doesn't match
        if [[ -n "$filter" ]] && [[ ! "$test_name" == *"$filter"* ]]; then
            continue
        fi
        # Skip if test is in SKIP_TESTS list
        if [[ -n "$skip_list" ]] && [[ ",$skip_list," == *",$test_name,"* ]]; then
            echo -e "${YELLOW}[WARN]${NC} Skipping $test_name (in SKIP_TESTS)" >&2
            continue
        fi
        files+=("$f")
    done

    echo "${files[@]}"
}

# Run a single test file
run_test() {
    local test_file="$1"
    local test_name=$(basename "$test_file" .sh)
    local output_file="$OUTPUT_DIR/${test_name}.log"
    local start_time=$(date +%s)

    # Create unique test ID for isolation
    local test_id="$(date +%s)-$$-$RANDOM"

    # Set up environment for test isolation
    export TEST_ID="$test_id"
    export FAIL_FAST="$FAIL_FAST"

    # Run the test
    if [[ "$VERBOSE" == "1" ]]; then
        echo -e "${BLUE}[RUN]${NC} $test_name"
        if "$test_file" 2>&1 | tee "$output_file"; then
            local exit_code=0
        else
            local exit_code=$?
        fi
    else
        if "$test_file" > "$output_file" 2>&1; then
            local exit_code=0
        else
            local exit_code=$?
        fi
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Write result file
    if [[ $exit_code -eq 0 ]]; then
        echo "PASS" > "$OUTPUT_DIR/${test_name}.result"
        echo -e "${GREEN}[PASS]${NC} $test_name (${duration}s)"
    else
        echo "FAIL" > "$OUTPUT_DIR/${test_name}.result"
        echo -e "${RED}[FAIL]${NC} $test_name (${duration}s)"
        if [[ "$VERBOSE" != "1" ]]; then
            echo -e "       Output: $output_file"
        fi
    fi

    return $exit_code
}

# Run tests in parallel using xargs
run_tests_parallel() {
    local test_files=("$@")
    local pids=()
    local results=()

    log_info "Running ${#test_files[@]} tests with $PARALLEL_JOBS parallel jobs"
    echo ""

    # Use a simple approach: run jobs in batches
    local batch_size=$PARALLEL_JOBS
    local i=0

    while [[ $i -lt ${#test_files[@]} ]]; do
        local batch_pids=()

        # Start a batch of tests
        for ((j=0; j < batch_size && i < ${#test_files[@]}; j++, i++)); do
            local test_file="${test_files[$i]}"
            run_test "$test_file" &
            batch_pids+=($!)
        done

        # Wait for batch to complete
        for pid in "${batch_pids[@]}"; do
            wait $pid || true
        done

        # Check for fail-fast
        if [[ "$FAIL_FAST" == "1" ]]; then
            for result_file in "$OUTPUT_DIR"/*.result; do
                [[ -f "$result_file" ]] || continue
                if [[ "$(cat "$result_file")" == "FAIL" ]]; then
                    log_error "Stopping due to failure (fail-fast mode)"
                    return 1
                fi
            done
        fi
    done

    return 0
}

# Run tests sequentially
run_tests_sequential() {
    local test_files=("$@")
    local failed=0

    log_info "Running ${#test_files[@]} tests sequentially"
    echo ""

    for test_file in "${test_files[@]}"; do
        if ! run_test "$test_file"; then
            ((failed++)) || true
            if [[ "$FAIL_FAST" == "1" ]]; then
                log_error "Stopping due to failure (fail-fast mode)"
                return 1
            fi
        fi
    done

    return 0
}

# Print summary
print_summary() {
    echo ""
    log_header "TEST SUMMARY"

    local passed=0
    local failed=0
    local failed_tests=()

    for result_file in "$OUTPUT_DIR"/*.result; do
        [[ -f "$result_file" ]] || continue
        local test_name=$(basename "$result_file" .result)
        local result=$(cat "$result_file")

        if [[ "$result" == "PASS" ]]; then
            ((passed++)) || true
        else
            ((failed++)) || true
            failed_tests+=("$test_name")
        fi
    done

    local total=$((passed + failed))

    echo -e "Total tests: ${BLUE}$total${NC}"
    echo -e "Passed:      ${GREEN}$passed${NC}"
    echo -e "Failed:      ${RED}$failed${NC}"

    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}Failed tests:${NC}"
        for test in "${failed_tests[@]}"; do
            echo "  - $test"
            echo "    Log: $OUTPUT_DIR/${test}.log"
        done
    fi

    echo ""

    if [[ $failed -gt 0 ]]; then
        return 1
    fi
    return 0
}

# Cleanup
cleanup() {
    if [[ "$KEEP_OUTPUT" != "1" ]] && [[ -d "$OUTPUT_DIR" ]]; then
        rm -rf "$OUTPUT_DIR"
    fi
}

# ============================================================================
# Main
# ============================================================================

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=1
            shift
            ;;
        -j|--jobs)
            PARALLEL_JOBS="$2"
            shift 2
            ;;
        -k|--keep-output)
            KEEP_OUTPUT=1
            shift
            ;;
        -f|--fail-fast)
            FAIL_FAST=1
            shift
            ;;
        -s|--sequential)
            PARALLEL_JOBS=1
            shift
            ;;
        -l|--list)
            echo "Available tests:"
            for f in $(get_test_files); do
                echo "  - $(basename "$f" .sh)"
            done
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
        *)
            TEST_FILTER="$1"
            shift
            ;;
    esac
done

log_header "MOWS End-to-End Tests"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Ensure mows is built
log_info "Ensuring mows is built..."
cd "$PROJECT_ROOT"
if ! cargo build --release 2>&1 | tail -1; then
    log_error "Failed to build mows"
    exit 1
fi
cd "$SCRIPT_DIR"

export MOWS_BIN="${MOWS_BIN:-$PROJECT_ROOT/../../../target/release/mows}"
log_info "Using mows binary: $MOWS_BIN"

# Ensure mpm symlink exists
MPM_SYMLINK="$(dirname "$MOWS_BIN")/mpm"
if [[ ! -e "$MPM_SYMLINK" ]]; then
    ln -sf mows "$MPM_SYMLINK" 2>/dev/null || true
fi
export MPM_BIN="${MPM_BIN:-$MPM_SYMLINK}"
log_info "Using mpm symlink: $MPM_BIN"

# Get test files
IFS=' ' read -ra TEST_FILES <<< "$(get_test_files "$TEST_FILTER")"

if [[ ${#TEST_FILES[@]} -eq 0 ]]; then
    log_error "No tests found matching filter: $TEST_FILTER"
    exit 1
fi

log_info "Found ${#TEST_FILES[@]} test files"

# Run tests
if [[ "$PARALLEL_JOBS" -eq 1 ]]; then
    run_tests_sequential "${TEST_FILES[@]}" || true
else
    run_tests_parallel "${TEST_FILES[@]}" || true
fi

# Print summary
if print_summary; then
    log_info "All tests passed!"
    cleanup
    exit 0
else
    log_error "Some tests failed"
    if [[ "$KEEP_OUTPUT" != "1" ]]; then
        log_info "Output kept at: $OUTPUT_DIR"
        log_info "Use -k to always keep output"
    fi
    KEEP_OUTPUT=1  # Keep output on failure
    exit 1
fi
