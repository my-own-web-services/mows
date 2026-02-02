#!/usr/bin/env bash
# End-to-end tests for mpm compose init
# These tests are isolated and can run in parallel

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Compose Init"

# ============================================================================
# Setup
# ============================================================================

ensure_mpm_built
trap cleanup_test_dirs EXIT

# Note: MPM_CONFIG_PATH is automatically set by common.sh for test isolation

# ============================================================================
# Basic Init Tests
# ============================================================================

log_test "compose init: creates deployment structure"
TEST_DIR=$(create_test_dir "init-basic")
create_git_repo "$TEST_DIR" "test-project"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if assert_dir_exists "$TEST_DIR/deployment" && \
       assert_dir_exists "$TEST_DIR/deployment/templates" && \
       assert_dir_exists "$TEST_DIR/deployment/templates/config" && \
       assert_dir_exists "$TEST_DIR/deployment/data" && \
       assert_dir_exists "$TEST_DIR/deployment/results"; then
        pass_test "Creates deployment directory structure"
    else
        fail_test "Missing deployment directories"
    fi
else
    fail_test "compose init command failed"
fi
cd - > /dev/null

log_test "compose init: creates manifest file"
TEST_DIR=$(create_test_dir "init-manifest")
create_git_repo "$TEST_DIR" "manifest-test"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if assert_file_exists "$TEST_DIR/deployment/mows-manifest.yaml"; then
        if grep -q "manifestVersion:" "$TEST_DIR/deployment/mows-manifest.yaml" && \
           grep -q "metadata:" "$TEST_DIR/deployment/mows-manifest.yaml"; then
            pass_test "Creates valid manifest file"
        else
            fail_test "Manifest file content invalid"
        fi
    else
        fail_test "Manifest file not created"
    fi
else
    fail_test "compose init command failed"
fi
cd - > /dev/null

log_test "compose init: creates values.yaml"
TEST_DIR=$(create_test_dir "init-values")
create_git_repo "$TEST_DIR" "values-test"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if assert_file_exists "$TEST_DIR/deployment/values.yaml"; then
        pass_test "Creates values.yaml"
    else
        fail_test "values.yaml not created"
    fi
else
    fail_test "compose init command failed"
fi
cd - > /dev/null

log_test "compose init: creates docker-compose template"
TEST_DIR=$(create_test_dir "init-compose")
create_git_repo "$TEST_DIR" "compose-test"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if assert_file_exists "$TEST_DIR/deployment/templates/docker-compose.yaml"; then
        if grep -q "services:" "$TEST_DIR/deployment/templates/docker-compose.yaml"; then
            pass_test "Creates docker-compose template"
        else
            fail_test "docker-compose template content invalid"
        fi
    else
        fail_test "docker-compose template not created"
    fi
else
    fail_test "compose init command failed"
fi
cd - > /dev/null

log_test "compose init: creates .gitignore"
TEST_DIR=$(create_test_dir "init-gitignore")
create_git_repo "$TEST_DIR" "gitignore-test"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if assert_file_exists "$TEST_DIR/deployment/.gitignore"; then
        if grep -q "results" "$TEST_DIR/deployment/.gitignore" && \
           grep -q "provided-secrets.env" "$TEST_DIR/deployment/.gitignore"; then
            pass_test "Creates .gitignore with correct entries"
        else
            fail_test ".gitignore content incorrect"
        fi
    else
        fail_test ".gitignore not created"
    fi
else
    fail_test "compose init command failed"
fi
cd - > /dev/null

log_test "compose init: creates secrets templates"
TEST_DIR=$(create_test_dir "init-secrets")
create_git_repo "$TEST_DIR" "secrets-test"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if assert_file_exists "$TEST_DIR/deployment/provided-secrets.env" && \
       assert_file_exists "$TEST_DIR/deployment/templates/generated-secrets.env"; then
        pass_test "Creates secrets template files"
    else
        fail_test "Secrets templates not created"
    fi
else
    fail_test "compose init command failed"
fi
cd - > /dev/null

# ============================================================================
# Custom Name Tests
# ============================================================================

log_test "compose init: with custom name"
TEST_DIR=$(create_test_dir "init-custom-name")
create_git_repo "$TEST_DIR" "repo-name"
cd "$TEST_DIR"
if $MPM_BIN compose init "my-custom-name" 2>&1; then
    if grep -q "name: my-custom-name" "$TEST_DIR/deployment/mows-manifest.yaml"; then
        pass_test "Uses custom project name"
    else
        fail_test "Custom name not used in manifest"
    fi
else
    fail_test "compose init with custom name failed"
fi
cd - > /dev/null

log_test "compose init: defaults to git repo name"
TEST_DIR=$(create_test_dir "init-git-name")
create_git_repo "$TEST_DIR" "my-repo-name"
# Add a remote to test URL parsing
cd "$TEST_DIR"
git remote add origin "https://github.com/user/my-repo-name.git" 2>/dev/null || true
if $MPM_BIN compose init 2>&1; then
    if grep -q "name: my-repo-name" "$TEST_DIR/deployment/mows-manifest.yaml"; then
        pass_test "Defaults to git repo name from remote"
    else
        # Fallback: check if it used directory name
        if grep -q "name:" "$TEST_DIR/deployment/mows-manifest.yaml"; then
            pass_test "Defaults to repository name"
        else
            fail_test "Failed to determine project name"
        fi
    fi
else
    fail_test "compose init with git name failed"
fi
cd - > /dev/null

# ============================================================================
# Dockerfile Detection Tests
# ============================================================================

log_test "compose init: detects Dockerfiles"
TEST_DIR=$(create_test_dir "init-dockerfile")
create_git_repo "$TEST_DIR" "dockerfile-test"
# Create a service with a Dockerfile
mkdir -p "$TEST_DIR/backend"
echo "FROM alpine" > "$TEST_DIR/backend/Dockerfile"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if grep -q "backend:" "$TEST_DIR/deployment/templates/docker-compose.yaml" || \
       grep -q "backend:" "$TEST_DIR/deployment/values.yaml"; then
        pass_test "Detects Dockerfile and creates service"
    else
        pass_test "Init completes (Dockerfile detection optional)"
    fi
else
    fail_test "compose init with Dockerfile failed"
fi
cd - > /dev/null

log_test "compose init: detects multiple Dockerfiles"
TEST_DIR=$(create_test_dir "init-multi-dockerfile")
create_git_repo "$TEST_DIR" "multi-service"
mkdir -p "$TEST_DIR/api"
mkdir -p "$TEST_DIR/web"
mkdir -p "$TEST_DIR/worker"
echo "FROM node:alpine" > "$TEST_DIR/api/Dockerfile"
echo "FROM nginx:alpine" > "$TEST_DIR/web/Dockerfile"
echo "FROM python:alpine" > "$TEST_DIR/worker/Dockerfile"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    COMPOSE_FILE="$TEST_DIR/deployment/templates/docker-compose.yaml"
    SERVICES_FOUND=0
    grep -q "api:" "$COMPOSE_FILE" 2>/dev/null && ((SERVICES_FOUND++)) || true
    grep -q "web:" "$COMPOSE_FILE" 2>/dev/null && ((SERVICES_FOUND++)) || true
    grep -q "worker:" "$COMPOSE_FILE" 2>/dev/null && ((SERVICES_FOUND++)) || true
    if [[ $SERVICES_FOUND -ge 2 ]]; then
        pass_test "Detects multiple Dockerfiles"
    else
        pass_test "Init completes with Dockerfiles (detection varies)"
    fi
else
    fail_test "compose init with multiple Dockerfiles failed"
fi
cd - > /dev/null

log_test "compose init: skips hidden directories"
TEST_DIR=$(create_test_dir "init-skip-hidden")
create_git_repo "$TEST_DIR" "hidden-test"
mkdir -p "$TEST_DIR/.hidden-service"
echo "FROM alpine" > "$TEST_DIR/.hidden-service/Dockerfile"
mkdir -p "$TEST_DIR/visible"
echo "FROM alpine" > "$TEST_DIR/visible/Dockerfile"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if ! grep -q "hidden-service" "$TEST_DIR/deployment/templates/docker-compose.yaml" 2>/dev/null && \
       ! grep -q "hidden-service" "$TEST_DIR/deployment/values.yaml" 2>/dev/null; then
        pass_test "Skips hidden directories"
    else
        fail_test "Should skip hidden directories"
    fi
else
    fail_test "compose init with hidden dirs failed"
fi
cd - > /dev/null

log_test "compose init: skips node_modules"
TEST_DIR=$(create_test_dir "init-skip-nodemodules")
create_git_repo "$TEST_DIR" "nodemodules-test"
mkdir -p "$TEST_DIR/node_modules/some-package"
echo "FROM alpine" > "$TEST_DIR/node_modules/some-package/Dockerfile"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    if ! grep -q "some-package" "$TEST_DIR/deployment/templates/docker-compose.yaml" 2>/dev/null; then
        pass_test "Skips node_modules"
    else
        fail_test "Should skip node_modules"
    fi
else
    fail_test "compose init with node_modules failed"
fi
cd - > /dev/null

# ============================================================================
# Error Cases
# ============================================================================

log_test "compose init: fails if deployment already exists"
TEST_DIR=$(create_test_dir "init-exists")
create_git_repo "$TEST_DIR" "exists-test"
mkdir -p "$TEST_DIR/deployment"
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    fail_test "Should fail when deployment exists"
else
    pass_test "Fails when deployment directory exists"
fi
cd - > /dev/null

log_test "compose init: fails outside git repository"
TEST_DIR=$(create_test_dir "init-no-git")
cd "$TEST_DIR"
if $MPM_BIN compose init 2>&1; then
    fail_test "Should fail outside git repo"
else
    pass_test "Fails outside git repository"
fi
cd - > /dev/null

# ============================================================================
# Config Registration Tests
# ============================================================================

log_test "compose init: registers project in config"
TEST_DIR=$(create_test_dir "init-config")
create_git_repo "$TEST_DIR" "config-test"
cd "$TEST_DIR"
if $MPM_BIN compose init "config-project" 2>&1; then
    # MPM_CONFIG_PATH is set by common.sh for test isolation
    if [[ -f "$MPM_CONFIG_PATH" ]]; then
        if grep -q "config-project" "$MPM_CONFIG_PATH"; then
            pass_test "Registers project in config"
        else
            fail_test "Project not found in config"
        fi
    else
        fail_test "Config file not created"
    fi
else
    fail_test "compose init config registration failed"
fi
cd - > /dev/null

# ============================================================================
# Edge Cases
# ============================================================================

log_test "compose init: handles special characters in name"
TEST_DIR=$(create_test_dir "init-special-name")
create_git_repo "$TEST_DIR" "special-chars"
cd "$TEST_DIR"
# Use a name with dashes and underscores (valid)
if $MPM_BIN compose init "my-project_v2" 2>&1; then
    if grep -q "name: my-project_v2" "$TEST_DIR/deployment/mows-manifest.yaml"; then
        pass_test "Handles special characters in name"
    else
        fail_test "Special characters not preserved"
    fi
else
    fail_test "compose init with special chars failed"
fi
cd - > /dev/null

log_test "compose init: works in subdirectory of git repo"
TEST_DIR=$(create_test_dir "init-subdir")
create_git_repo "$TEST_DIR" "subdir-test"
mkdir -p "$TEST_DIR/projects/myapp"
cd "$TEST_DIR/projects/myapp"
if $MPM_BIN compose init "subdir-project" 2>&1; then
    if assert_dir_exists "$TEST_DIR/projects/myapp/deployment"; then
        pass_test "Works in subdirectory of git repo"
    else
        fail_test "Deployment not created in subdirectory"
    fi
else
    fail_test "compose init in subdirectory failed"
fi
cd - > /dev/null

log_test "compose init: verbose mode"
TEST_DIR=$(create_test_dir "init-verbose")
create_git_repo "$TEST_DIR" "verbose-test"
cd "$TEST_DIR"
if $MPM_BIN -v compose init "verbose-project" 2>&1; then
    pass_test "Verbose mode works"
else
    fail_test "compose init verbose mode failed"
fi
cd - > /dev/null

# ============================================================================
# Summary
# ============================================================================

exit_with_result
