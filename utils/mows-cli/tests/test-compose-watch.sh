#!/usr/bin/env bash
# End-to-end tests for mpm compose up --watch

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Compose Watch"

# ============================================================================
# Setup
# ============================================================================

ensure_mpm_built
trap cleanup_test_dirs EXIT

# Watch tests require mock docker
export MPM_MOCK_DOCKER=1

# ============================================================================
# Helper Functions
# ============================================================================

create_watch_project() {
    local dir="$1"

    mkdir -p "$dir/templates"

    cat > "$dir/mows-manifest.yaml" << 'EOF'
manifestVersion: "0.1"
metadata:
  name: watch-test
spec:
  compose: {}
EOF

    cat > "$dir/values.yaml" << 'EOF'
hostname: original.example.com
port: 8080
EOF

    cat > "$dir/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
    environment:
      - HOSTNAME={{ .hostname }}
      - PORT={{ .port }}
EOF
}

# Poll until FILE matches PATTERN (grep -q), up to TIMEOUT seconds (default 20).
# Robust against slow initial deploys / re-deploys under parallel CI load, where
# a fixed `sleep` races the watcher. Returns 0 on match, 1 on timeout.
wait_for_content() {
    local file="$1" pattern="$2" timeout="${3:-20}" i=0
    while [ "$i" -lt "$((timeout * 2))" ]; do
        grep -q "$pattern" "$file" 2>/dev/null && return 0
        sleep 0.5
        i=$((i + 1))
    done
    return 1
}

# Wait until the watcher finished its initial deploy and is armed
# ("waiting for changes" appears in its output) before modifying files.
wait_for_watch_ready() {
    wait_for_content "$1" "waiting for changes" "${2:-20}"
}

# Poll until FILE contains at least MIN lines matching PATTERN, up to TIMEOUT
# seconds (default 20). Returns 0 once the count is reached, 1 on timeout.
wait_for_count() {
    local file="$1" pattern="$2" min="$3" timeout="${4:-20}" i=0
    while [ "$i" -lt "$((timeout * 2))" ]; do
        [ "$(grep -c "$pattern" "$file" 2>/dev/null)" -ge "$min" ] && return 0
        sleep 0.5
        i=$((i + 1))
    done
    return 1
}

# ============================================================================
# Tests
# ============================================================================

log_test "compose up --watch: initial deploy renders templates"
TEST_DIR=$(create_test_dir "watch-initial")
create_watch_project "$TEST_DIR"
cd "$TEST_DIR"

# Start watch in background, capturing output
WATCH_OUTPUT="$TEST_DIR/watch.log"
$MPM_BIN compose up --watch --debounce-ms 200 > "$WATCH_OUTPUT" 2>&1 &
WATCH_PID=$!

# Wait for the initial deploy to finish and the watcher to arm
wait_for_watch_ready "$WATCH_OUTPUT"

# Verify initial render happened
if wait_for_content "$TEST_DIR/.results/docker-compose.yaml" "HOSTNAME=original.example.com" 20; then
    pass_test "Initial deploy renders templates correctly"
elif [[ -f "$TEST_DIR/.results/docker-compose.yaml" ]]; then
    fail_test "Template values not substituted correctly in initial deploy"
else
    fail_test "Results directory not created by initial deploy"
fi

# Kill the watch process
kill "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true
cd - > /dev/null


log_test "compose up --watch: re-deploys on values.yaml change"
TEST_DIR=$(create_test_dir "watch-redeploy")
create_watch_project "$TEST_DIR"
cd "$TEST_DIR"

WATCH_OUTPUT="$TEST_DIR/watch.log"
$MPM_BIN compose up --watch --debounce-ms 200 > "$WATCH_OUTPUT" 2>&1 &
WATCH_PID=$!

# Wait for the initial deploy to finish and the watcher to arm
wait_for_watch_ready "$WATCH_OUTPUT"

# Verify initial render
if ! wait_for_content "$TEST_DIR/.results/docker-compose.yaml" "HOSTNAME=original.example.com" 20; then
    kill "$WATCH_PID" 2>/dev/null || true
    wait "$WATCH_PID" 2>/dev/null || true
    fail_test "Initial deploy failed, cannot test re-deploy"
    cd - > /dev/null
else
    # Modify values.yaml
    cat > "$TEST_DIR/values.yaml" << 'EOF'
hostname: changed.example.com
port: 9090
EOF

    # Wait for debounce + re-deploy to render the new value
    if wait_for_content "$TEST_DIR/.results/docker-compose.yaml" "HOSTNAME=changed.example.com" 20; then
        pass_test "Re-deploys on values.yaml change with updated values"
    else
        fail_test "Values not updated after file change"
        log_error "Expected HOSTNAME=changed.example.com in results"
        if [[ -f "$TEST_DIR/.results/docker-compose.yaml" ]]; then
            grep "HOSTNAME=" "$TEST_DIR/.results/docker-compose.yaml" || true
        fi
    fi

    kill "$WATCH_PID" 2>/dev/null || true
    wait "$WATCH_PID" 2>/dev/null || true
    cd - > /dev/null
fi


log_test "compose up --watch: re-deploys on template change"
TEST_DIR=$(create_test_dir "watch-template-change")
create_watch_project "$TEST_DIR"
cd "$TEST_DIR"

WATCH_OUTPUT="$TEST_DIR/watch.log"
$MPM_BIN compose up --watch --debounce-ms 200 > "$WATCH_OUTPUT" 2>&1 &
WATCH_PID=$!

# Wait for the initial deploy to finish and the watcher to arm
wait_for_watch_ready "$WATCH_OUTPUT"

# Modify the template itself
cat > "$TEST_DIR/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
    environment:
      - HOSTNAME={{ .hostname }}
      - PORT={{ .port }}
      - NEW_VAR=added_by_template_change
EOF

# Wait for debounce + re-deploy to pick up the template change
if wait_for_content "$TEST_DIR/.results/docker-compose.yaml" "NEW_VAR=added_by_template_change" 20; then
    pass_test "Re-deploys on template file change"
else
    fail_test "Template change not picked up"
fi

kill "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true
cd - > /dev/null


log_test "compose up --watch: survives template error and recovers"
TEST_DIR=$(create_test_dir "watch-error-recovery")
create_watch_project "$TEST_DIR"
cd "$TEST_DIR"

WATCH_OUTPUT="$TEST_DIR/watch.log"
$MPM_BIN compose up --watch --debounce-ms 200 > "$WATCH_OUTPUT" 2>&1 &
WATCH_PID=$!

# Wait for the initial deploy to finish and the watcher to arm
wait_for_watch_ready "$WATCH_OUTPUT"

# Introduce a template syntax error
cat > "$TEST_DIR/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: {{ .broken.undefined.value }
EOF

# Wait for the watcher to attempt (and fail) the re-deploy
wait_for_content "$WATCH_OUTPUT" "Deploy failed" 20

# Verify the process is still alive after the error
if kill -0 "$WATCH_PID" 2>/dev/null; then
    # Fix the template
    cat > "$TEST_DIR/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: nginx:alpine
    environment:
      - RECOVERED=true
      - HOSTNAME={{ .hostname }}
EOF

    # Wait for recovery re-deploy to render the fixed template
    if wait_for_content "$TEST_DIR/.results/docker-compose.yaml" "RECOVERED=true" 20; then
        pass_test "Watcher survives template error and recovers on fix"
    else
        fail_test "Watcher stayed alive but did not render the recovery template"
    fi
else
    fail_test "Watcher process died after template error"
fi

kill "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true
cd - > /dev/null


log_test "compose up --watch: exits cleanly on SIGINT"
TEST_DIR=$(create_test_dir "watch-sigint")
create_watch_project "$TEST_DIR"
cd "$TEST_DIR"

WATCH_OUTPUT="$TEST_DIR/watch.log"
$MPM_BIN compose up --watch --debounce-ms 200 > "$WATCH_OUTPUT" 2>&1 &
WATCH_PID=$!

# Wait for watch to start
sleep 3

# Send SIGINT (like Ctrl+C)
kill -INT "$WATCH_PID" 2>/dev/null || true

# Wait briefly for clean shutdown
sleep 2

# Check process exited
if kill -0 "$WATCH_PID" 2>/dev/null; then
    fail_test "Process did not exit after SIGINT"
    kill -9 "$WATCH_PID" 2>/dev/null || true
else
    pass_test "Exits cleanly on SIGINT"
fi

wait "$WATCH_PID" 2>/dev/null || true
cd - > /dev/null


log_test "compose up --watch: build context change triggers a CACHED re-deploy (cache preserved)"
TEST_DIR=$(create_test_dir "watch-build-context")
mkdir -p "$TEST_DIR/templates" "$TEST_DIR/app/src"

# Create a source file inside the build context
echo 'fn main() {}' > "$TEST_DIR/app/src/main.rs"

cat > "$TEST_DIR/mows-manifest.yaml" << 'EOF'
manifestVersion: "0.1"
metadata:
  name: watch-build-ctx
spec:
  compose: {}
EOF

# Template references the build context directory (absolute path)
cat > "$TEST_DIR/templates/docker-compose.yaml" << EOF
services:
  web:
    build: $TEST_DIR/app
    image: myapp:latest
EOF

cd "$TEST_DIR"

WATCH_OUTPUT="$TEST_DIR/watch.log"
$MPM_BIN compose up --watch --debounce-ms 200 > "$WATCH_OUTPUT" 2>&1 &
WATCH_PID=$!

# Wait for the initial deploy to finish and the watcher to arm
wait_for_watch_ready "$WATCH_OUTPUT"

# Modify a source file inside the build context
echo 'fn main() { println!("changed"); }' > "$TEST_DIR/app/src/main.rs"

# Wait for the build-context change to trigger a re-deploy AND for its build
# line to be written (the "Re-deploying" marker is printed before the build, so
# poll for the second cached build line — the final artifact — to avoid a race).
wait_for_content "$WATCH_OUTPUT" "Re-deploying" 20
wait_for_count "$WATCH_OUTPUT" "compose_build.*no_cache=false" 2 20

# New contract: a change inside a build context triggers a normal re-deploy
# that KEEPS the Docker layer cache (no_cache=false). Container recreation is
# driven by the image-ID comparison, not by --no-cache. So we expect:
#   - the watcher to re-deploy ("Re-deploying...")
#   - at least two cached builds (initial deploy + re-deploy), and
#   - never a --no-cache build.
REDEPLOYED=0
grep -q "Re-deploying" "$WATCH_OUTPUT" && REDEPLOYED=1
CACHED_BUILDS=$(grep -c "compose_build.*no_cache=false" "$WATCH_OUTPUT" || true)

if [ "$REDEPLOYED" -eq 1 ] && [ "$CACHED_BUILDS" -ge 2 ] \
    && ! grep -q "compose_build.*no_cache=true" "$WATCH_OUTPUT"; then
    pass_test "Build context change re-deploys with the cache preserved (no --no-cache)"
else
    fail_test "Expected a cached re-deploy on build context change (re-deployed=$REDEPLOYED, cached builds=$CACHED_BUILDS, must have no no_cache=true)"
    log_error "Watch output:"
    cat "$WATCH_OUTPUT" || true
fi

kill "$WATCH_PID" 2>/dev/null || true
wait "$WATCH_PID" 2>/dev/null || true
cd - > /dev/null


# ============================================================================
# Summary
# ============================================================================

exit_with_result
