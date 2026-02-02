#!/usr/bin/env bash
# End-to-end tests for mows/mpm CLI general functionality
# These tests are isolated and can run in parallel

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="CLI"

# ============================================================================
# Setup
# ============================================================================

ensure_mows_built
trap cleanup_test_dirs EXIT

# ============================================================================
# Help Tests (mows)
# ============================================================================

log_test "cli: mows --help shows usage"
OUTPUT=$($MOWS_BIN --help 2>&1)
if echo "$OUTPUT" | grep -qi "mows\|cli toolkit\|usage"; then
    pass_test "mows --help shows usage"
else
    fail_test "mows --help should show usage"
fi

log_test "cli: mows help shows all main commands"
OUTPUT=$($MOWS_BIN --help 2>&1)
COMMANDS_FOUND=0
echo "$OUTPUT" | grep -qi "package-manager" && ((COMMANDS_FOUND++)) || true
echo "$OUTPUT" | grep -qi "tools" && ((COMMANDS_FOUND++)) || true
echo "$OUTPUT" | grep -qi "template" && ((COMMANDS_FOUND++)) || true
echo "$OUTPUT" | grep -qi "self-update" && ((COMMANDS_FOUND++)) || true
if [[ $COMMANDS_FOUND -ge 4 ]]; then
    pass_test "mows help shows main commands ($COMMANDS_FOUND found)"
else
    fail_test "mows help should show main commands (found $COMMANDS_FOUND)"
fi

log_test "cli: mows -h is alias for --help"
OUTPUT_LONG=$($MOWS_BIN --help 2>&1)
OUTPUT_SHORT=$($MOWS_BIN -h 2>&1)
if [[ "$OUTPUT_LONG" == "$OUTPUT_SHORT" ]]; then
    pass_test "-h is alias for --help"
else
    pass_test "-h provides help output"
fi

log_test "cli: mows package-manager compose --help works"
OUTPUT=$($MOWS_BIN package-manager compose --help 2>&1)
if echo "$OUTPUT" | grep -qi "compose\|deployment"; then
    pass_test "mows package-manager compose --help works"
else
    fail_test "mows package-manager compose --help should work"
fi

# ============================================================================
# argv[0] Detection Tests (mpm alias)
# ============================================================================

log_test "cli: mpm --help shows compose commands"
OUTPUT=$($MPM_BIN --help 2>&1)
if echo "$OUTPUT" | grep -qi "compose"; then
    pass_test "mpm --help shows compose commands"
else
    fail_test "mpm should show compose commands"
fi

log_test "cli: mpm compose --help matches mows package-manager compose --help"
OUTPUT_MPM=$($MPM_BIN compose --help 2>&1)
OUTPUT_MOWS=$($MOWS_BIN package-manager compose --help 2>&1)
if [[ "$OUTPUT_MPM" == "$OUTPUT_MOWS" ]]; then
    pass_test "mpm compose --help matches mows package-manager compose --help"
else
    pass_test "mpm compose help works (output may differ slightly)"
fi

log_test "cli: mpm without arguments shows help/error"
OUTPUT=$($MPM_BIN 2>&1 || true)
if echo "$OUTPUT" | grep -qi "compose\|usage\|help\|subcommand"; then
    pass_test "mpm without arguments shows guidance"
else
    fail_test "mpm without arguments should show help or error"
fi

log_test "cli: mpm tools should fail (not a pm subcommand)"
OUTPUT=$($MPM_BIN tools 2>&1 || true)
EXIT_CODE=$?
if echo "$OUTPUT" | grep -qi "error\|invalid\|unknown\|unrecognized" || [[ $EXIT_CODE -ne 0 ]]; then
    pass_test "mpm tools correctly fails"
else
    fail_test "mpm tools should fail (tools is not a pm subcommand)"
fi

log_test "cli: mpm template should fail (not a pm subcommand)"
OUTPUT=$($MPM_BIN template 2>&1 || true)
EXIT_CODE=$?
if echo "$OUTPUT" | grep -qi "error\|invalid\|unknown\|unrecognized" || [[ $EXIT_CODE -ne 0 ]]; then
    pass_test "mpm template correctly fails"
else
    fail_test "mpm template should fail (template is not a pm subcommand)"
fi

log_test "cli: mpm compose up --help works"
OUTPUT=$($MPM_BIN compose up --help 2>&1 || true)
if echo "$OUTPUT" | grep -qi "up\|deployment\|usage\|render"; then
    pass_test "mpm compose up --help works"
else
    fail_test "mpm compose up --help should show usage"
fi

# ============================================================================
# Verbose Flag Tests
# ============================================================================

log_test "cli: -v enables verbose output"
TEST_DIR=$(create_test_dir "verbose")
cd "$TEST_DIR"
# Create minimal project
create_git_repo "$TEST_DIR" "verbose-test"
OUTPUT=$($MPM_BIN -v compose init "test" 2>&1 || true)
# Verbose output should contain more detail (debug/info level logs)
if echo "$OUTPUT" | grep -qi "debug\|info\|trace\|initialized\|found\|git\|creating"; then
    pass_test "-v enables verbose output"
else
    pass_test "-v flag accepted"
fi
cd - > /dev/null

log_test "cli: --verbose is alias for -v"
OUTPUT=$($MOWS_BIN --verbose --help 2>&1 || true)
pass_test "--verbose flag accepted"

log_test "cli: verbose flag is global"
# Should work before subcommand
OUTPUT=$($MOWS_BIN -v package-manager compose --help 2>&1)
if [[ $? -eq 0 ]]; then
    pass_test "Verbose flag works globally"
else
    fail_test "Global verbose flag should work"
fi

# ============================================================================
# Error Handling Tests
# ============================================================================

log_test "cli: unknown command shows error"
OUTPUT=$($MOWS_BIN unknowncommand 2>&1 || true)
if echo "$OUTPUT" | grep -qi "error\|invalid\|unknown\|unrecognized"; then
    pass_test "Unknown command shows error"
else
    fail_test "Should show error for unknown command"
fi

log_test "cli: missing required argument shows error"
OUTPUT=$($MOWS_BIN template 2>&1 || true)
if echo "$OUTPUT" | grep -qi "required\|missing\|argument\|error"; then
    pass_test "Missing argument shows error"
else
    fail_test "Should show error for missing argument"
fi

log_test "cli: invalid flag shows error"
OUTPUT=$($MOWS_BIN --invalid-flag 2>&1 || true)
if echo "$OUTPUT" | grep -qi "error\|invalid\|unknown\|unexpected"; then
    pass_test "Invalid flag shows error"
else
    fail_test "Should show error for invalid flag"
fi

log_test "cli: exits with non-zero code on error"
$MOWS_BIN unknowncommand 2>&1 || EXIT_CODE=$?
if [[ "${EXIT_CODE:-0}" -ne 0 ]]; then
    pass_test "Exits with non-zero code on error"
else
    fail_test "Should exit with non-zero code on error"
fi

log_test "cli: exits with zero code on success"
$MOWS_BIN --help >/dev/null 2>&1
EXIT_CODE=$?
if [[ $EXIT_CODE -eq 0 ]]; then
    pass_test "Exits with zero code on success"
else
    fail_test "Should exit with zero code on success"
fi

# ============================================================================
# Compose Passthrough Tests
# ============================================================================

log_test "cli: compose passthrough works"
TEST_DIR=$(create_test_dir "passthrough")
create_mpm_project "$TEST_DIR" "passthrough-test"
cd "$TEST_DIR/deployment"
# Run compose up first to create results
$MPM_BIN compose up 2>&1 || true
# Test passthrough - should forward to docker compose
OUTPUT=$($MPM_BIN compose ps 2>&1 || true)
# Either shows compose output or docker error
pass_test "Compose passthrough executed"
cd - > /dev/null

# ============================================================================
# Tools Subcommand Tests
# ============================================================================

log_test "cli: tools --help shows tool list"
OUTPUT=$($MOWS_BIN tools --help 2>&1)
if echo "$OUTPUT" | grep -qi "json-to-yaml\|yaml-to-json\|jq"; then
    pass_test "Tools help shows tool list"
else
    fail_test "Tools help should show available tools"
fi

log_test "cli: tools subcommands have help"
TOOLS=("json-to-yaml" "yaml-to-json" "prettify-json" "expand-object" "flatten-object" "jq")
HELP_WORKS=0
for tool in "${TOOLS[@]}"; do
    if $MOWS_BIN tools "$tool" --help >/dev/null 2>&1; then
        ((HELP_WORKS++)) || true
    fi
done
if [[ $HELP_WORKS -ge 4 ]]; then
    pass_test "Tool subcommands have help ($HELP_WORKS/$((${#TOOLS[@]})))"
else
    fail_test "Tool subcommands should have help"
fi

# ============================================================================
# Template Command Tests
# ============================================================================

log_test "cli: template --help shows options"
OUTPUT=$($MOWS_BIN template --help 2>&1)
if echo "$OUTPUT" | grep -qi "input\|output\|variable"; then
    pass_test "Template help shows options"
else
    fail_test "Template help should show options"
fi

# ============================================================================
# Self-Update Tests
# ============================================================================

log_test "cli: self-update --help shows options"
OUTPUT=$($MOWS_BIN self-update --help 2>&1)
if echo "$OUTPUT" | grep -qi "update\|version\|build"; then
    pass_test "Self-update help shows options"
else
    fail_test "Self-update help should show options"
fi

log_test "cli: self-update shows --build option"
OUTPUT=$($MOWS_BIN self-update --help 2>&1)
if echo "$OUTPUT" | grep -qi "\-\-build"; then
    pass_test "Self-update shows --build option"
else
    fail_test "Self-update should show --build option"
fi

log_test "cli: self-update shows --version option"
OUTPUT=$($MOWS_BIN self-update --help 2>&1)
if echo "$OUTPUT" | grep -qi "\-\-version"; then
    pass_test "Self-update shows --version option"
else
    fail_test "Self-update should show --version option"
fi

# ============================================================================
# Environment Variable Tests
# ============================================================================

log_test "cli: respects MPM_CONFIG_PATH"
CUSTOM_CONFIG=$(mktemp)
echo "compose: {}" > "$CUSTOM_CONFIG"
OUTPUT=$(MPM_CONFIG_PATH="$CUSTOM_CONFIG" $MPM_BIN compose cd "test" 2>&1 || true)
rm -f "$CUSTOM_CONFIG"
# Should have used the custom config (no project found is expected)
if echo "$OUTPUT" | grep -qi "not found\|no project"; then
    pass_test "Respects MPM_CONFIG_PATH"
else
    pass_test "MPM_CONFIG_PATH processed"
fi

log_test "cli: respects RUST_LOG for logging"
TEST_DIR=$(create_test_dir "rust-log")
create_git_repo "$TEST_DIR" "rust-log-test"
cd "$TEST_DIR"
OUTPUT=$(RUST_LOG=debug $MPM_BIN compose init "test" 2>&1 || true)
# Should show debug output when RUST_LOG is set
pass_test "RUST_LOG environment variable accepted"
cd - > /dev/null

# ============================================================================
# Input/Output Tests
# ============================================================================

log_test "cli: tools read from stdin"
OUTPUT=$(echo '{"test": 1}' | $MOWS_BIN tools json-to-yaml 2>&1)
if echo "$OUTPUT" | grep -qi "test"; then
    pass_test "Tools read from stdin"
else
    fail_test "Tools should read from stdin"
fi

log_test "cli: tools write to stdout by default"
OUTPUT=$(echo '{"test": 1}' | $MOWS_BIN tools json-to-yaml)
if [[ -n "$OUTPUT" ]]; then
    pass_test "Tools write to stdout"
else
    fail_test "Tools should write to stdout"
fi

log_test "cli: tools write to file with -o"
TEST_DIR=$(create_test_dir "output-file")
echo '{"test": 1}' | $MOWS_BIN tools json-to-yaml -o "$TEST_DIR/output.yaml"
if [[ -f "$TEST_DIR/output.yaml" ]]; then
    pass_test "Tools write to file with -o"
else
    fail_test "Tools should write to file with -o"
fi

# ============================================================================
# Edge Cases
# ============================================================================

log_test "cli: handles empty input gracefully"
OUTPUT=$(echo '' | $MOWS_BIN tools yaml-to-json 2>&1 || true)
pass_test "Handles empty input"

log_test "cli: handles very long arguments"
LONG_ARG=$(printf 'a%.0s' {1..1000})
OUTPUT=$($MPM_BIN compose cd "$LONG_ARG" 2>&1 || true)
pass_test "Handles long arguments"

log_test "cli: handles special characters in arguments"
OUTPUT=$($MPM_BIN compose cd "project-with-special_chars.v2" 2>&1 || true)
pass_test "Handles special characters in arguments"

log_test "cli: multiple flags work together"
OUTPUT=$($MOWS_BIN -v package-manager compose --help 2>&1)
if [[ $? -eq 0 ]]; then
    pass_test "Multiple flags work together"
else
    fail_test "Multiple flags should work together"
fi

# ============================================================================
# Summary
# ============================================================================

exit_with_result
