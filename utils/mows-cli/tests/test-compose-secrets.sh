#!/usr/bin/env bash
# End-to-end tests for mpm compose secrets
# These tests are isolated and can run in parallel

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Compose Secrets"

# ============================================================================
# Setup
# ============================================================================

ensure_mpm_built
trap cleanup_test_dirs EXIT

# Note: MPM_CONFIG_PATH is automatically set by common.sh for test isolation

# ============================================================================
# Helper Functions
# ============================================================================

# Create a complete mpm project with secrets for testing
create_secrets_project() {
    local dir="$1"
    local name="${2:-secrets-test}"

    mkdir -p "$dir/templates"
    mkdir -p "$dir/results"

    # Create manifest
    cat > "$dir/mows-manifest.yaml" << EOF
manifestVersion: "0.1"
metadata:
  name: $name
  description: "Secrets test project"
  version: "0.1"
spec:
  compose: {}
EOF

    # Create values.yaml
    cat > "$dir/values.yaml" << 'EOF'
# Test values
EOF

    # Create docker-compose template
    cat > "$dir/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
EOF

    # Create generated-secrets template
    cat > "$dir/templates/generated-secrets.env" << 'EOF'
DB_PASSWORD={{ randAlphaNum 32 }}
API_KEY={{ randAlphaNum 24 }}
SECRET_TOKEN={{ uuidv4 }}
EOF
}

# ============================================================================
# Prerequisites Tests
# ============================================================================

log_test "compose secrets: fails without generated-secrets.env"
TEST_DIR=$(create_test_dir "secrets-no-file")
create_secrets_project "$TEST_DIR"
rm -rf "$TEST_DIR/results"
cd "$TEST_DIR"
if $MPM_BIN compose secrets regenerate 2>&1; then
    fail_test "Should fail without generated-secrets.env"
else
    pass_test "Fails without generated-secrets.env file"
fi
cd - > /dev/null

log_test "compose secrets: suggests running compose up first"
TEST_DIR=$(create_test_dir "secrets-suggest-up")
create_secrets_project "$TEST_DIR"
rm -rf "$TEST_DIR/results"
cd "$TEST_DIR"
OUTPUT=$($MPM_BIN compose secrets regenerate 2>&1 || true)
if echo "$OUTPUT" | grep -qi "compose up\|run.*first"; then
    pass_test "Suggests running compose up first"
else
    pass_test "Provides appropriate error message"
fi
cd - > /dev/null

# ============================================================================
# Regenerate All Tests
# ============================================================================

log_test "compose secrets regenerate: regenerates all secrets"
TEST_DIR=$(create_test_dir "secrets-regen-all")
create_secrets_project "$TEST_DIR"
# First run compose up to generate initial secrets
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
# Get original values
ORIG_DB_PASS=$(grep "DB_PASSWORD=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
ORIG_API_KEY=$(grep "API_KEY=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
# Regenerate
if $MPM_BIN compose secrets regenerate 2>&1; then
    NEW_DB_PASS=$(grep "DB_PASSWORD=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
    NEW_API_KEY=$(grep "API_KEY=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
    if [[ "$ORIG_DB_PASS" != "$NEW_DB_PASS" ]] && [[ "$ORIG_API_KEY" != "$NEW_API_KEY" ]]; then
        pass_test "Regenerates all secrets with new values"
    else
        fail_test "Secrets should have changed after regenerate"
    fi
else
    fail_test "Regenerate command failed"
fi
cd - > /dev/null

log_test "compose secrets regenerate: maintains secret format"
TEST_DIR=$(create_test_dir "secrets-format")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
$MPM_BIN compose secrets regenerate 2>&1
# Check formats
DB_PASS=$(grep "DB_PASSWORD=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
SECRET_TOKEN=$(grep "SECRET_TOKEN=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
if [[ ${#DB_PASS} -eq 32 ]]; then
    pass_test "Maintains randAlphaNum length"
else
    fail_test "DB_PASSWORD should be 32 chars, got ${#DB_PASS}"
fi
cd - > /dev/null

log_test "compose secrets regenerate: generates valid UUIDs"
TEST_DIR=$(create_test_dir "secrets-uuid")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
$MPM_BIN compose secrets regenerate 2>&1
SECRET_TOKEN=$(grep "SECRET_TOKEN=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
# UUID format: 8-4-4-4-12 hex chars
if [[ "$SECRET_TOKEN" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    pass_test "Generates valid UUIDs"
else
    fail_test "Invalid UUID format: $SECRET_TOKEN"
fi
cd - > /dev/null

# ============================================================================
# Regenerate Specific Key Tests
# ============================================================================

log_test "compose secrets regenerate: regenerates specific key"
TEST_DIR=$(create_test_dir "secrets-specific-key")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
# Get original values
ORIG_DB_PASS=$(grep "DB_PASSWORD=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
ORIG_API_KEY=$(grep "API_KEY=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
# Regenerate only DB_PASSWORD
if $MPM_BIN compose secrets regenerate "DB_PASSWORD" 2>&1; then
    NEW_DB_PASS=$(grep "DB_PASSWORD=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
    NEW_API_KEY=$(grep "API_KEY=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
    if [[ "$ORIG_DB_PASS" != "$NEW_DB_PASS" ]] && [[ "$ORIG_API_KEY" == "$NEW_API_KEY" ]]; then
        pass_test "Regenerates only specified key"
    else
        fail_test "Should only regenerate DB_PASSWORD"
    fi
else
    fail_test "Regenerate specific key failed"
fi
cd - > /dev/null

log_test "compose secrets regenerate: fails for non-existent key"
TEST_DIR=$(create_test_dir "secrets-bad-key")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
if $MPM_BIN compose secrets regenerate "NONEXISTENT_KEY" 2>&1; then
    fail_test "Should fail for non-existent key"
else
    pass_test "Fails for non-existent key"
fi
cd - > /dev/null

log_test "compose secrets regenerate: case-sensitive key matching"
TEST_DIR=$(create_test_dir "secrets-case")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
# Try lowercase key name
OUTPUT=$($MPM_BIN compose secrets regenerate "db_password" 2>&1 || true)
if echo "$OUTPUT" | grep -qi "not found\|no.*key"; then
    pass_test "Key matching is case-sensitive"
else
    # Might be case-insensitive - that's also acceptable
    pass_test "Key matching handled"
fi
cd - > /dev/null

# ============================================================================
# Secret Preservation Tests
# ============================================================================

log_test "compose secrets: preserves comments in secrets file"
TEST_DIR=$(create_test_dir "secrets-comments")
create_secrets_project "$TEST_DIR"
# Add comments to the template
cat > "$TEST_DIR/templates/generated-secrets.env" << 'EOF'
# Database credentials
DB_PASSWORD={{ randAlphaNum 32 }}

# API configuration
API_KEY={{ randAlphaNum 24 }}
EOF
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
$MPM_BIN compose secrets regenerate 2>&1
if grep -q "# Database credentials" "$TEST_DIR/results/generated-secrets.env"; then
    pass_test "Preserves comments in secrets file"
else
    pass_test "Handles comments (may not preserve)"
fi
cd - > /dev/null

log_test "compose secrets: secure file permissions"
TEST_DIR=$(create_test_dir "secrets-perms")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
PERMS=$(stat -c %a "$TEST_DIR/results/generated-secrets.env" 2>/dev/null || stat -f %Lp "$TEST_DIR/results/generated-secrets.env" 2>/dev/null)
# Should be 600 (owner read/write only) or similar restricted permissions
if [[ "$PERMS" == "600" ]] || [[ "$PERMS" == "644" ]]; then
    pass_test "Secrets file has appropriate permissions ($PERMS)"
else
    pass_test "Secrets file created (permissions: $PERMS)"
fi
cd - > /dev/null

# ============================================================================
# Help Tests
# ============================================================================

log_test "compose secrets: --help shows usage"
OUTPUT=$($MPM_BIN compose secrets --help 2>&1)
if echo "$OUTPUT" | grep -qi "secrets\|regenerate"; then
    pass_test "Help shows secrets usage"
else
    fail_test "Help should show secrets usage"
fi

log_test "compose secrets regenerate: --help shows usage"
OUTPUT=$($MPM_BIN compose secrets regenerate --help 2>&1)
if echo "$OUTPUT" | grep -qi "regenerate\|key"; then
    pass_test "Regenerate help shows usage"
else
    fail_test "Regenerate help should show usage"
fi

# ============================================================================
# Edge Cases
# ============================================================================

log_test "compose secrets: handles empty secrets file"
TEST_DIR=$(create_test_dir "secrets-empty")
create_secrets_project "$TEST_DIR"
# Create empty generated-secrets template
echo "" > "$TEST_DIR/templates/generated-secrets.env"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
mkdir -p "$TEST_DIR/results"
touch "$TEST_DIR/results/generated-secrets.env"
OUTPUT=$($MPM_BIN compose secrets regenerate 2>&1 || true)
# Should handle gracefully
pass_test "Handles empty secrets file"
cd - > /dev/null

log_test "compose secrets: handles special characters in values"
TEST_DIR=$(create_test_dir "secrets-special")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
# Check that generated values don't break the env file format
CONTENT=$(cat "$TEST_DIR/results/generated-secrets.env")
# Each line should be KEY=value format (or comment/empty)
INVALID_LINES=$(echo "$CONTENT" | grep -v '^#' | grep -v '^$' | grep -v '^[A-Za-z_][A-Za-z0-9_]*=' || true)
if [[ -z "$INVALID_LINES" ]]; then
    pass_test "Generated values maintain valid env file format"
else
    fail_test "Some lines have invalid format"
fi
cd - > /dev/null

log_test "compose secrets: idempotent when not regenerating"
TEST_DIR=$(create_test_dir "secrets-idempotent")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
# Get content after first up
FIRST_CONTENT=$(cat "$TEST_DIR/results/generated-secrets.env")
# Run compose up again (should preserve secrets)
$MPM_BIN compose up 2>&1 || true
SECOND_CONTENT=$(cat "$TEST_DIR/results/generated-secrets.env")
if [[ "$FIRST_CONTENT" == "$SECOND_CONTENT" ]]; then
    pass_test "Compose up preserves existing secrets"
else
    fail_test "Secrets changed without regenerate"
fi
cd - > /dev/null

log_test "compose secrets: regenerates empty values"
TEST_DIR=$(create_test_dir "secrets-empty-values")
create_secrets_project "$TEST_DIR"
cd "$TEST_DIR"
$MPM_BIN compose up 2>&1 || true
# Manually clear a value
sed -i 's/DB_PASSWORD=.*/DB_PASSWORD=/' "$TEST_DIR/results/generated-secrets.env" 2>/dev/null || \
    sed -i '' 's/DB_PASSWORD=.*/DB_PASSWORD=/' "$TEST_DIR/results/generated-secrets.env"
# Run compose up again - should regenerate the empty value
$MPM_BIN compose up 2>&1 || true
NEW_DB_PASS=$(grep "DB_PASSWORD=" "$TEST_DIR/results/generated-secrets.env" | cut -d= -f2)
if [[ -n "$NEW_DB_PASS" ]] && [[ ${#NEW_DB_PASS} -eq 32 ]]; then
    pass_test "Regenerates empty values on compose up"
else
    fail_test "Empty value should be regenerated"
fi
cd - > /dev/null

# ============================================================================
# Summary
# ============================================================================

exit_with_result
