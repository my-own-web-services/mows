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

# Wait for initial deploy and watch setup
sleep 3

# Verify initial render happened
if [[ -f "$TEST_DIR/results/docker-compose.yaml" ]]; then
    if grep -q "HOSTNAME=original.example.com" "$TEST_DIR/results/docker-compose.yaml"; then
        pass_test "Initial deploy renders templates correctly"
    else
        fail_test "Template values not substituted correctly in initial deploy"
    fi
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

# Wait for initial deploy and watch setup
sleep 3

# Verify initial render
if ! grep -q "HOSTNAME=original.example.com" "$TEST_DIR/results/docker-compose.yaml" 2>/dev/null; then
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

    # Wait for debounce + re-deploy
    sleep 4

    if grep -q "HOSTNAME=changed.example.com" "$TEST_DIR/results/docker-compose.yaml"; then
        pass_test "Re-deploys on values.yaml change with updated values"
    else
        fail_test "Values not updated after file change"
        log_error "Expected HOSTNAME=changed.example.com in results"
        if [[ -f "$TEST_DIR/results/docker-compose.yaml" ]]; then
            grep "HOSTNAME=" "$TEST_DIR/results/docker-compose.yaml" || true
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

# Wait for initial deploy
sleep 3

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

# Wait for debounce + re-deploy
sleep 4

if grep -q "NEW_VAR=added_by_template_change" "$TEST_DIR/results/docker-compose.yaml" 2>/dev/null; then
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

# Wait for initial deploy
sleep 3

# Introduce a template syntax error
cat > "$TEST_DIR/templates/docker-compose.yaml" << 'EOF'
services:
  web:
    image: {{ .broken.undefined.value }
EOF

# Wait for the failed re-deploy attempt
sleep 4

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

    # Wait for recovery re-deploy
    sleep 4

    if grep -q "RECOVERED=true" "$TEST_DIR/results/docker-compose.yaml" 2>/dev/null; then
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


log_test "compose up --watch: detects build context change and logs no-cache rebuild"
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

# Wait for initial deploy and watch setup
sleep 3

# Modify a source file inside the build context
echo 'fn main() { println!("changed"); }' > "$TEST_DIR/app/src/main.rs"

# Wait for debounce + re-deploy
sleep 4

if grep -q "Build context changed" "$WATCH_OUTPUT"; then
    # Also verify that compose_build was called with no_cache=true
    if grep -q "compose_build.*no_cache=true" "$WATCH_OUTPUT"; then
        pass_test "Detects build context change and triggers no-cache build"
    else
        fail_test "Detected build context change but compose_build with no_cache=true not found in output"
        log_error "Watch output:"
        cat "$WATCH_OUTPUT" || true
    fi
else
    fail_test "Did not detect build context change"
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
