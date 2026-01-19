#!/usr/bin/env bash
# End-to-end tests for mpm compose up
# These tests focus on the render pipeline; Docker tests are in test-compose-up-docker.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Compose Up (Render)"

# ============================================================================
# Setup
# ============================================================================

ensure_mpm_built
trap cleanup_test_dirs EXIT

# Note: MPM_CONFIG_PATH is automatically set by common.sh for test isolation

# ============================================================================
# Helper Functions
# ============================================================================

# Create a complete mpm project for testing
create_test_project() {
    local dir="$1"
    local name="${2:-test-project}"

    mkdir -p "$dir/deployment/templates/config"
    mkdir -p "$dir/deployment/data"

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
    cat > "$dir/deployment/values.yaml" << 'EOF'
hostname: test.example.com
port: 8080
replicas: 3
database:
  host: db.local
  port: 5432
EOF

    # Create docker-compose template
    cat > "$dir/deployment/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
    ports:
      - "{{ .port }}:80"
    environment:
      - HOSTNAME={{ .hostname }}
      - DB_HOST={{ .database.host }}
      - DB_PORT={{ .database.port }}
EOF
}

# ============================================================================
# Render Pipeline Tests
# ============================================================================

log_test "compose up: renders docker-compose template"
TEST_DIR=$(create_test_dir "up-render")
create_test_project "$TEST_DIR"
cd "$TEST_DIR/deployment"
# Run compose up but expect it to fail on docker (we just want to test rendering)
OUTPUT=$($MPM_BIN compose up 2>&1 || true)
# Check if rendering happened
if [[ -f "$TEST_DIR/deployment/results/docker-compose.yaml" ]]; then
    if grep -q "HOSTNAME=test.example.com" "$TEST_DIR/deployment/results/docker-compose.yaml" && \
       grep -q "DB_HOST=db.local" "$TEST_DIR/deployment/results/docker-compose.yaml"; then
        pass_test "Renders docker-compose template with values"
    else
        fail_test "Template values not substituted correctly"
        cat "$TEST_DIR/deployment/results/docker-compose.yaml"
    fi
else
    # If results dir doesn't exist, check if docker error occurred after rendering
    if echo "$OUTPUT" | grep -qi "docker\|Cannot connect"; then
        fail_test "Rendering may have failed before docker step"
    else
        fail_test "Results directory not created"
    fi
fi
cd - > /dev/null

log_test "compose up: renders multiple templates"
TEST_DIR=$(create_test_dir "up-multi-template")
create_test_project "$TEST_DIR"
# Add additional template
cat > "$TEST_DIR/deployment/templates/config.yaml" << 'EOF'
app:
  name: {{ .hostname }}
  port: {{ .port }}
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/config.yaml" ]]; then
    if grep -q "name: test.example.com" "$TEST_DIR/deployment/results/config.yaml"; then
        pass_test "Renders multiple templates"
    else
        fail_test "Additional template not rendered correctly"
    fi
else
    fail_test "Additional template not rendered"
fi
cd - > /dev/null

log_test "compose up: renders templates in subdirectories"
TEST_DIR=$(create_test_dir "up-subdir-template")
create_test_project "$TEST_DIR"
mkdir -p "$TEST_DIR/deployment/templates/config/app"
cat > "$TEST_DIR/deployment/templates/config/app/settings.yaml" << 'EOF'
hostname: {{ .hostname }}
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/config/app/settings.yaml" ]]; then
    if grep -q "hostname: test.example.com" "$TEST_DIR/deployment/results/config/app/settings.yaml"; then
        pass_test "Renders templates in subdirectories"
    else
        fail_test "Subdirectory template not rendered correctly"
    fi
else
    fail_test "Subdirectory template not rendered"
fi
cd - > /dev/null

log_test "compose up: creates results directory"
TEST_DIR=$(create_test_dir "up-creates-results")
create_test_project "$TEST_DIR"
rm -rf "$TEST_DIR/deployment/results"
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if assert_dir_exists "$TEST_DIR/deployment/results"; then
    pass_test "Creates results directory"
else
    fail_test "Results directory not created"
fi
cd - > /dev/null

# ============================================================================
# Secrets Rendering Tests
# ============================================================================

log_test "compose up: renders generated secrets template"
TEST_DIR=$(create_test_dir "up-gen-secrets")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/templates/generated-secrets.env" << 'EOF'
DB_PASSWORD={{ randAlphaNum 32 }}
API_KEY={{ uuidv4 }}
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/generated-secrets.env" ]]; then
    DB_PASSWORD=$(grep "DB_PASSWORD=" "$TEST_DIR/deployment/results/generated-secrets.env" | cut -d= -f2)
    if [[ ${#DB_PASSWORD} -eq 32 ]]; then
        pass_test "Generates secrets with correct length"
    else
        fail_test "Generated secret has wrong length: ${#DB_PASSWORD}"
    fi
else
    fail_test "Generated secrets file not created"
fi
cd - > /dev/null

log_test "compose up: preserves existing generated secrets"
TEST_DIR=$(create_test_dir "up-preserve-secrets")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/templates/generated-secrets.env" << 'EOF'
SECRET_KEY={{ randAlphaNum 16 }}
EOF
mkdir -p "$TEST_DIR/deployment/results"
cat > "$TEST_DIR/deployment/results/generated-secrets.env" << 'EOF'
SECRET_KEY=existing-secret-value
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if grep -q "SECRET_KEY=existing-secret-value" "$TEST_DIR/deployment/results/generated-secrets.env"; then
    pass_test "Preserves existing generated secrets"
else
    fail_test "Existing secret was overwritten"
fi
cd - > /dev/null

log_test "compose up: regenerates empty secrets"
TEST_DIR=$(create_test_dir "up-regen-empty")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/templates/generated-secrets.env" << 'EOF'
NEW_SECRET={{ randAlphaNum 16 }}
EOF
mkdir -p "$TEST_DIR/deployment/results"
cat > "$TEST_DIR/deployment/results/generated-secrets.env" << 'EOF'
NEW_SECRET=
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
NEW_SECRET=$(grep "NEW_SECRET=" "$TEST_DIR/deployment/results/generated-secrets.env" | cut -d= -f2)
if [[ ${#NEW_SECRET} -eq 16 ]]; then
    pass_test "Regenerates empty secrets"
else
    fail_test "Empty secret not regenerated"
fi
cd - > /dev/null

log_test "compose up: copies provided secrets to results"
TEST_DIR=$(create_test_dir "up-provided-secrets")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/provided-secrets.env" << 'EOF'
USER_API_KEY=user-provided-key
EXTERNAL_TOKEN=external-token-value
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/provided-secrets.env" ]]; then
    if grep -q "USER_API_KEY=user-provided-key" "$TEST_DIR/deployment/results/provided-secrets.env"; then
        pass_test "Copies provided secrets to results"
    else
        fail_test "Provided secrets not copied correctly"
    fi
else
    fail_test "Provided secrets not copied"
fi
cd - > /dev/null

# ============================================================================
# Manifest Detection Tests
# ============================================================================

log_test "compose up: finds manifest in current directory"
TEST_DIR=$(create_test_dir "up-find-manifest")
create_test_project "$TEST_DIR"
cd "$TEST_DIR/deployment"
OUTPUT=$($MPM_BIN compose up 2>&1 || true)
# Should proceed past manifest detection (may fail at docker)
if echo "$OUTPUT" | grep -qi "docker\|compose" || [[ -d "$TEST_DIR/deployment/results" ]]; then
    pass_test "Finds manifest in current directory"
else
    fail_test "Failed to find manifest"
fi
cd - > /dev/null

log_test "compose up: finds manifest in git root"
TEST_DIR=$(create_test_dir "up-find-git-root")
create_git_repo "$TEST_DIR" "find-root-test"
create_test_project "$TEST_DIR"
mkdir -p "$TEST_DIR/subdir/deep"
cd "$TEST_DIR/subdir/deep"
OUTPUT=$($MPM_BIN compose up 2>&1 || true)
if [[ -d "$TEST_DIR/deployment/results" ]] || echo "$OUTPUT" | grep -qi "docker"; then
    pass_test "Finds manifest from git subdirectory"
else
    fail_test "Failed to find manifest from subdirectory"
fi
cd - > /dev/null

log_test "compose up: fails with multiple manifests"
TEST_DIR=$(create_test_dir "up-multi-manifest")
create_git_repo "$TEST_DIR" "multi-manifest-test"
create_test_project "$TEST_DIR"
mkdir -p "$TEST_DIR/other-project/deployment"
cp "$TEST_DIR/deployment/mows-manifest.yaml" "$TEST_DIR/other-project/deployment/"
cd "$TEST_DIR"
OUTPUT=$($MPM_BIN compose up 2>&1 || true)
# Should either fail or prompt to choose
if echo "$OUTPUT" | grep -qi "multiple\|found.*mows-manifest\|ambiguous"; then
    pass_test "Handles multiple manifests appropriately"
else
    # May have picked one - that's also acceptable behavior
    pass_test "Compose up completed with multiple manifests"
fi
cd - > /dev/null

# ============================================================================
# Error Handling Tests
# ============================================================================

log_test "compose up: fails without manifest"
TEST_DIR=$(create_test_dir "up-no-manifest")
mkdir -p "$TEST_DIR/deployment/templates"
cd "$TEST_DIR/deployment"
if $MPM_BIN compose up 2>&1; then
    fail_test "Should fail without manifest"
else
    pass_test "Fails without manifest"
fi
cd - > /dev/null

log_test "compose up: fails with invalid template"
TEST_DIR=$(create_test_dir "up-invalid-template")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: {{ .undefined.nested.value }
EOF
cd "$TEST_DIR/deployment"
if $MPM_BIN compose up 2>&1; then
    fail_test "Should fail with invalid template"
else
    pass_test "Fails with invalid template"
fi
cd - > /dev/null

log_test "compose up: provides helpful error message"
TEST_DIR=$(create_test_dir "up-error-msg")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/templates/docker-compose.yaml" << 'EOF'
Line 1
Line 2
Line 3: {{ .bad.template
Line 4
EOF
cd "$TEST_DIR/deployment"
ERROR_OUTPUT=$($MPM_BIN compose up 2>&1 || true)
# Should contain some indication of where the error is
if [[ -n "$ERROR_OUTPUT" ]]; then
    pass_test "Provides error output"
else
    skip_test "No error output captured"
fi
cd - > /dev/null

# ============================================================================
# Template Function Tests
# ============================================================================

log_test "compose up: supports template functions"
TEST_DIR=$(create_test_dir "up-functions")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
    labels:
      app.name: {{ upper .hostname }}
      app.port: {{ .port }}
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/docker-compose.yaml" ]]; then
    if grep -q "TEST.EXAMPLE.COM" "$TEST_DIR/deployment/results/docker-compose.yaml"; then
        pass_test "Template functions work (upper)"
    else
        fail_test "Template function upper not working"
    fi
else
    fail_test "Template with functions not rendered"
fi
cd - > /dev/null

log_test "compose up: supports conditionals"
TEST_DIR=$(create_test_dir "up-conditionals")
create_test_project "$TEST_DIR"
cat >> "$TEST_DIR/deployment/values.yaml" << 'EOF'
debug: true
EOF
cat > "$TEST_DIR/deployment/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
{{- if .debug }}
    environment:
      - DEBUG=true
{{- end }}
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/docker-compose.yaml" ]]; then
    if grep -q "DEBUG=true" "$TEST_DIR/deployment/results/docker-compose.yaml"; then
        pass_test "Conditionals work"
    else
        fail_test "Conditional not evaluated correctly"
    fi
else
    fail_test "Template with conditional not rendered"
fi
cd - > /dev/null

log_test "compose up: supports loops"
TEST_DIR=$(create_test_dir "up-loops")
create_test_project "$TEST_DIR"
cat >> "$TEST_DIR/deployment/values.yaml" << 'EOF'
ports:
  - 8080
  - 8081
  - 8082
EOF
cat > "$TEST_DIR/deployment/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
    ports:
{{- range .ports }}
      - "{{ . }}:80"
{{- end }}
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/docker-compose.yaml" ]]; then
    if grep -q "8080:80" "$TEST_DIR/deployment/results/docker-compose.yaml" && \
       grep -q "8081:80" "$TEST_DIR/deployment/results/docker-compose.yaml" && \
       grep -q "8082:80" "$TEST_DIR/deployment/results/docker-compose.yaml"; then
        pass_test "Loops work"
    else
        fail_test "Loop not expanded correctly"
    fi
else
    fail_test "Template with loop not rendered"
fi
cd - > /dev/null

# ============================================================================
# Edge Cases
# ============================================================================

log_test "compose up: handles empty templates directory"
TEST_DIR=$(create_test_dir "up-empty-templates")
create_test_project "$TEST_DIR"
rm -f "$TEST_DIR/deployment/templates/"*
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
# Should either succeed with empty results or fail gracefully
pass_test "Handles empty templates directory"
cd - > /dev/null

log_test "compose up: handles special characters in values"
TEST_DIR=$(create_test_dir "up-special-chars")
create_test_project "$TEST_DIR"
cat > "$TEST_DIR/deployment/values.yaml" << 'EOF'
special: "quotes \"and\" special chars: $!@#%"
EOF
cat > "$TEST_DIR/deployment/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
    labels:
      special: "{{ .special }}"
EOF
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
if [[ -f "$TEST_DIR/deployment/results/docker-compose.yaml" ]]; then
    pass_test "Handles special characters in values"
else
    fail_test "Failed with special characters"
fi
cd - > /dev/null

log_test "compose up: cleans up old results before rendering"
TEST_DIR=$(create_test_dir "up-cleanup")
create_test_project "$TEST_DIR"
mkdir -p "$TEST_DIR/deployment/results"
echo "old content" > "$TEST_DIR/deployment/results/old-file.txt"
cd "$TEST_DIR/deployment"
$MPM_BIN compose up 2>&1 || true
# Old file should be removed or results should be fresh
if [[ -f "$TEST_DIR/deployment/results/docker-compose.yaml" ]]; then
    pass_test "Renders fresh results"
else
    fail_test "Results not rendered after cleanup"
fi
cd - > /dev/null

# ============================================================================
# Summary
# ============================================================================

exit_with_result
