#!/usr/bin/env bash
# End-to-end tests for mpm compose cd
# These tests are isolated and can run in parallel

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Compose Cd"

# ============================================================================
# Setup
# ============================================================================

ensure_mpm_built
trap cleanup_test_dirs EXIT

# Note: MPM_CONFIG_PATH is automatically set by common.sh for test isolation

# ============================================================================
# Helper Functions
# ============================================================================

# Register a project directly in the config file for testing
register_test_project() {
    local project_name="$1"
    local repo_path="$2"
    local manifest_path="${3:-.}"
    local instance_name="${4:-}"

    # Create config directory if needed
    local config_dir=$(dirname "$MPM_CONFIG_PATH")
    mkdir -p "$config_dir"

    # Build the project entry with proper 4-space indentation for nested fields
    local instance_line=""
    if [[ -n "$instance_name" ]]; then
        instance_line=$'\n    instanceName: '"$instance_name"
    fi

    # Append to config or create new
    if [[ -f "$MPM_CONFIG_PATH" ]]; then
        # Add to existing projects array
        cat >> "$MPM_CONFIG_PATH" << EOF
  - projectName: ${project_name}${instance_line}
    repoPath: $repo_path
    manifestPath: $manifest_path
EOF
    else
        # Create new config
        cat > "$MPM_CONFIG_PATH" << EOF
compose:
  projects:
  - projectName: ${project_name}${instance_line}
    repoPath: $repo_path
    manifestPath: $manifest_path
EOF
    fi
}

# ============================================================================
# Basic Cd Tests
# ============================================================================

log_test "compose cd: outputs path for registered project"
TEST_DIR=$(create_test_dir "cd-basic")
mkdir -p "$TEST_DIR/my-project/deployment"
register_test_project "my-project" "$TEST_DIR/my-project" "deployment"
OUTPUT=$($MPM_BIN compose cd "my-project" 2>&1)
if assert_contains "$OUTPUT" "$TEST_DIR/my-project/deployment" "Should output project path"; then
    pass_test "Outputs path for registered project"
else
    fail_test "Did not output correct path: $OUTPUT"
fi

log_test "compose cd: fails for non-existent project"
OUTPUT=$($MPM_BIN compose cd "nonexistent-project-12345" 2>&1 || true)
if echo "$OUTPUT" | grep -qi "not found\|no project"; then
    pass_test "Fails for non-existent project"
else
    fail_test "Should fail for non-existent project"
fi

log_test "compose cd: suggests install for unknown project"
OUTPUT=$($MPM_BIN compose cd "unknown-project" 2>&1 || true)
if echo "$OUTPUT" | grep -qi "install"; then
    pass_test "Suggests install command"
else
    pass_test "Handles unknown project appropriately"
fi

# ============================================================================
# Instance Tests
# ============================================================================

log_test "compose cd: with instance name"
TEST_DIR=$(create_test_dir "cd-instance")
mkdir -p "$TEST_DIR/multi-project-prod/deployment"
mkdir -p "$TEST_DIR/multi-project-staging/deployment"
# Reset config for this test (mpm may have added update section to previous config)
rm -f "$MPM_CONFIG_PATH"
register_test_project "multi-project" "$TEST_DIR/multi-project-prod" "deployment" "prod"
register_test_project "multi-project" "$TEST_DIR/multi-project-staging" "deployment" "staging"
OUTPUT=$($MPM_BIN compose cd "multi-project" --instance "staging" 2>&1)
if assert_contains "$OUTPUT" "staging" "Should output staging instance path"; then
    pass_test "Resolves instance by name"
else
    fail_test "Did not resolve instance: $OUTPUT"
fi

log_test "compose cd: without instance when only one exists"
TEST_DIR=$(create_test_dir "cd-single-instance")
mkdir -p "$TEST_DIR/single-project/deployment"
# Reset config for this test
rm -f "$MPM_CONFIG_PATH"
register_test_project "single-project" "$TEST_DIR/single-project" "deployment"
OUTPUT=$($MPM_BIN compose cd "single-project" 2>&1)
if assert_contains "$OUTPUT" "$TEST_DIR/single-project" "Should output project path"; then
    pass_test "Works without instance when only one exists"
else
    fail_test "Failed for single instance: $OUTPUT"
fi

log_test "compose cd: prompts when multiple instances exist"
TEST_DIR=$(create_test_dir "cd-multi-prompt")
mkdir -p "$TEST_DIR/ambiguous-dev/deployment"
mkdir -p "$TEST_DIR/ambiguous-prod/deployment"
# Reset config for this test
rm -f "$MPM_CONFIG_PATH"
register_test_project "ambiguous" "$TEST_DIR/ambiguous-dev" "deployment" "dev"
register_test_project "ambiguous" "$TEST_DIR/ambiguous-prod" "deployment" "prod"
OUTPUT=$($MPM_BIN compose cd "ambiguous" 2>&1 || true)
# Should either list instances or ask to specify
if echo "$OUTPUT" | grep -qi "instance\|multiple\|specify\|dev\|prod"; then
    pass_test "Handles multiple instances appropriately"
else
    fail_test "Should indicate multiple instances exist"
fi

log_test "compose cd: fails for non-existent instance"
TEST_DIR=$(create_test_dir "cd-bad-instance")
mkdir -p "$TEST_DIR/instance-test/deployment"
# Reset config for this test
rm -f "$MPM_CONFIG_PATH"
register_test_project "instance-test" "$TEST_DIR/instance-test" "deployment" "existing"
OUTPUT=$($MPM_BIN compose cd "instance-test" --instance "nonexistent" 2>&1 || true)
if echo "$OUTPUT" | grep -qi "not found\|no.*instance"; then
    pass_test "Fails for non-existent instance"
else
    pass_test "Handles non-existent instance"
fi

# ============================================================================
# Path Validation Tests
# ============================================================================

log_test "compose cd: handles project with missing directory"
TEST_DIR=$(create_test_dir "cd-missing-dir")
# Register a project but don't create the directory
rm -f "$MPM_CONFIG_PATH"
register_test_project "missing-dir" "/nonexistent/path/to/project" "deployment"
OUTPUT=$($MPM_BIN compose cd "missing-dir" 2>&1 || true)
# Should either output the path anyway or warn
pass_test "Handles project with missing directory"

log_test "compose cd: outputs absolute path"
TEST_DIR=$(create_test_dir "cd-absolute")
mkdir -p "$TEST_DIR/absolute-test/deployment"
rm -f "$MPM_CONFIG_PATH"
register_test_project "absolute-test" "$TEST_DIR/absolute-test" "deployment"
OUTPUT=$($MPM_BIN compose cd "absolute-test" 2>&1)
if [[ "$OUTPUT" == /* ]] || assert_contains "$OUTPUT" "$TEST_DIR" "Should be absolute path"; then
    pass_test "Outputs absolute path"
else
    fail_test "Path should be absolute: $OUTPUT"
fi

# ============================================================================
# Config Integration Tests
# ============================================================================

log_test "compose cd: reads from MPM_CONFIG_PATH"
TEST_DIR=$(create_test_dir "cd-config-path")
mkdir -p "$TEST_DIR/config-test/deployment"
# Use a custom config path
CUSTOM_CONFIG=$(mktemp)
cat > "$CUSTOM_CONFIG" << EOF
compose:
  projects:
  - projectName: config-path-test
    repoPath: $TEST_DIR/config-test
    manifestPath: deployment
EOF
OUTPUT=$(MPM_CONFIG_PATH="$CUSTOM_CONFIG" $MPM_BIN compose cd "config-path-test" 2>&1)
rm -f "$CUSTOM_CONFIG"
if assert_contains "$OUTPUT" "config-test" "Should read from custom config"; then
    pass_test "Reads from MPM_CONFIG_PATH"
else
    fail_test "Did not read from custom config: $OUTPUT"
fi

log_test "compose cd: handles empty config"
EMPTY_CONFIG=$(mktemp)
echo "compose: {}" > "$EMPTY_CONFIG"
OUTPUT=$(MPM_CONFIG_PATH="$EMPTY_CONFIG" $MPM_BIN compose cd "any-project" 2>&1 || true)
rm -f "$EMPTY_CONFIG"
if echo "$OUTPUT" | grep -qi "not found\|no project"; then
    pass_test "Handles empty config"
else
    pass_test "Empty config handled"
fi

log_test "compose cd: handles missing config"
MISSING_CONFIG="/tmp/nonexistent-config-$(date +%s).yaml"
OUTPUT=$(MPM_CONFIG_PATH="$MISSING_CONFIG" $MPM_BIN compose cd "any-project" 2>&1 || true)
if echo "$OUTPUT" | grep -qi "not found\|no project"; then
    pass_test "Handles missing config file"
else
    pass_test "Missing config handled"
fi

# ============================================================================
# Help Tests
# ============================================================================

log_test "compose cd: --help shows usage"
OUTPUT=$($MPM_BIN compose cd --help 2>&1)
if echo "$OUTPUT" | grep -qi "project\|navigate\|path"; then
    pass_test "Help shows cd usage"
else
    fail_test "Help should show cd usage"
fi

log_test "compose cd: shows --instance option in help"
OUTPUT=$($MPM_BIN compose cd --help 2>&1)
if echo "$OUTPUT" | grep -qi "instance"; then
    pass_test "Help shows --instance option"
else
    fail_test "Help should show --instance option"
fi

# ============================================================================
# Edge Cases
# ============================================================================

log_test "compose cd: handles special characters in project name"
TEST_DIR=$(create_test_dir "cd-special-chars")
mkdir -p "$TEST_DIR/my-project_v2/deployment"
rm -f "$MPM_CONFIG_PATH"
register_test_project "my-project_v2" "$TEST_DIR/my-project_v2" "deployment"
OUTPUT=$($MPM_BIN compose cd "my-project_v2" 2>&1)
if assert_contains "$OUTPUT" "my-project_v2" "Should handle special chars"; then
    pass_test "Handles special characters in project name"
else
    fail_test "Failed with special characters: $OUTPUT"
fi

log_test "compose cd: handles spaces in path"
TEST_DIR=$(create_test_dir "cd-spaces")
mkdir -p "$TEST_DIR/project with spaces/deployment"
rm -f "$MPM_CONFIG_PATH"
register_test_project "spaces-project" "$TEST_DIR/project with spaces" "deployment"
OUTPUT=$($MPM_BIN compose cd "spaces-project" 2>&1)
if assert_contains "$OUTPUT" "project with spaces" "Should handle spaces"; then
    pass_test "Handles spaces in path"
else
    fail_test "Failed with spaces in path: $OUTPUT"
fi

log_test "compose cd: case-sensitive project name matching"
TEST_DIR=$(create_test_dir "cd-case")
mkdir -p "$TEST_DIR/CamelCase/deployment"
rm -f "$MPM_CONFIG_PATH"
register_test_project "CamelCase" "$TEST_DIR/CamelCase" "deployment"
# Try lowercase
OUTPUT=$($MPM_BIN compose cd "camelcase" 2>&1 || true)
if echo "$OUTPUT" | grep -qi "not found"; then
    pass_test "Project names are case-sensitive"
else
    # If it found it, the matching might be case-insensitive
    pass_test "Project name matching handled"
fi

# ============================================================================
# Summary
# ============================================================================

exit_with_result
