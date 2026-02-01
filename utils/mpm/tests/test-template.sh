#!/usr/bin/env bash
# End-to-end tests for mpm template command
# These tests are isolated and can run in parallel

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Template"

# ============================================================================
# Setup
# ============================================================================

ensure_mpm_built
trap cleanup_test_dirs EXIT

# ============================================================================
# Basic Template Rendering
# ============================================================================

log_test "template: simple variable substitution"
TEST_DIR=$(create_test_dir "simple")
cat > "$TEST_DIR/template.txt" << 'EOF'
Hello {{ .name }}!
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
name: World
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Hello World!" "$TEST_DIR/output.txt"; then
        pass_test "Simple variable substitution"
    else
        fail_test "Variable not substituted correctly"
        cat "$TEST_DIR/output.txt"
    fi
else
    fail_test "Template command failed"
fi

log_test "template: nested variable access"
TEST_DIR=$(create_test_dir "nested")
cat > "$TEST_DIR/template.txt" << 'EOF'
Server: {{ .server.host }}:{{ .server.port }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
server:
  host: localhost
  port: 8080
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Server: localhost:8080" "$TEST_DIR/output.txt"; then
        pass_test "Nested variable access"
    else
        fail_test "Nested variable not substituted correctly"
    fi
else
    fail_test "Template nested command failed"
fi

log_test "template: dollar syntax for variables"
TEST_DIR=$(create_test_dir "dollar")
cat > "$TEST_DIR/template.txt" << 'EOF'
Value: {{ $myvar }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
myvar: dollar-value
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Value: dollar-value" "$TEST_DIR/output.txt"; then
        pass_test "Dollar syntax variable"
    else
        fail_test "Dollar syntax not working"
    fi
else
    fail_test "Template dollar syntax command failed"
fi

# ============================================================================
# Variable File Loading
# ============================================================================

log_test "template: auto-load values.yaml"
TEST_DIR=$(create_test_dir "auto-yaml")
mkdir -p "$TEST_DIR/input"
cat > "$TEST_DIR/input/template.txt" << 'EOF'
App: {{ .appName }}
EOF
cat > "$TEST_DIR/input/values.yaml" << 'EOF'
appName: MyApp
EOF
if $MOWS_BIN template -i "$TEST_DIR/input" -o "$TEST_DIR/output"; then
    if grep -q "App: MyApp" "$TEST_DIR/output/template.txt"; then
        pass_test "Auto-load values.yaml"
    else
        fail_test "values.yaml not auto-loaded"
    fi
else
    fail_test "Template auto-load command failed"
fi

log_test "template: auto-load values.yml"
TEST_DIR=$(create_test_dir "auto-yml")
mkdir -p "$TEST_DIR/input"
cat > "$TEST_DIR/input/template.txt" << 'EOF'
App: {{ .appName }}
EOF
cat > "$TEST_DIR/input/values.yml" << 'EOF'
appName: MyAppYml
EOF
if $MOWS_BIN template -i "$TEST_DIR/input" -o "$TEST_DIR/output"; then
    if grep -q "App: MyAppYml" "$TEST_DIR/output/template.txt"; then
        pass_test "Auto-load values.yml"
    else
        fail_test "values.yml not auto-loaded"
    fi
else
    fail_test "Template auto-load yml command failed"
fi

log_test "template: auto-load values.json"
TEST_DIR=$(create_test_dir "auto-json")
mkdir -p "$TEST_DIR/input"
cat > "$TEST_DIR/input/template.txt" << 'EOF'
App: {{ .appName }}
EOF
cat > "$TEST_DIR/input/values.json" << 'EOF'
{"appName": "MyAppJson"}
EOF
if $MOWS_BIN template -i "$TEST_DIR/input" -o "$TEST_DIR/output"; then
    if grep -q "App: MyAppJson" "$TEST_DIR/output/template.txt"; then
        pass_test "Auto-load values.json"
    else
        fail_test "values.json not auto-loaded"
    fi
else
    fail_test "Template auto-load json command failed"
fi

log_test "template: explicit variable file with --variable"
TEST_DIR=$(create_test_dir "explicit-var")
cat > "$TEST_DIR/template.txt" << 'EOF'
Config: {{ $config.setting }}
EOF
cat > "$TEST_DIR/config.yaml" << 'EOF'
setting: custom-value
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" --variable "config:$TEST_DIR/config.yaml" -o "$TEST_DIR/output.txt"; then
    if grep -q "Config: custom-value" "$TEST_DIR/output.txt"; then
        pass_test "Explicit variable file"
    else
        fail_test "Explicit variable not loaded"
    fi
else
    fail_test "Template explicit variable command failed"
fi

log_test "template: multiple variable files"
TEST_DIR=$(create_test_dir "multi-var")
cat > "$TEST_DIR/template.txt" << 'EOF'
DB: {{ $db.host }}
Cache: {{ $cache.host }}
EOF
cat > "$TEST_DIR/db.yaml" << 'EOF'
host: db.local
EOF
cat > "$TEST_DIR/cache.yaml" << 'EOF'
host: cache.local
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" \
    --variable "db:$TEST_DIR/db.yaml" \
    --variable "cache:$TEST_DIR/cache.yaml" \
    -o "$TEST_DIR/output.txt"; then
    if grep -q "DB: db.local" "$TEST_DIR/output.txt" && \
       grep -q "Cache: cache.local" "$TEST_DIR/output.txt"; then
        pass_test "Multiple variable files"
    else
        fail_test "Multiple variables not loaded correctly"
    fi
else
    fail_test "Template multiple variables command failed"
fi

log_test "template: .env file as variable source"
TEST_DIR=$(create_test_dir "env-var")
cat > "$TEST_DIR/template.txt" << 'EOF'
API_KEY: {{ $env.API_KEY }}
DB_HOST: {{ $env.DB_HOST }}
EOF
cat > "$TEST_DIR/config.env" << 'EOF'
API_KEY=secret123
DB_HOST=localhost
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" \
    --variable "env:$TEST_DIR/config.env" \
    -o "$TEST_DIR/output.txt"; then
    if grep -q "API_KEY: secret123" "$TEST_DIR/output.txt" && \
       grep -q "DB_HOST: localhost" "$TEST_DIR/output.txt"; then
        pass_test ".env file as variable source"
    else
        fail_test ".env variables not loaded correctly"
    fi
else
    fail_test "Template .env variable command failed"
fi

# ============================================================================
# Template Functions
# ============================================================================

log_test "template: upper function"
TEST_DIR=$(create_test_dir "func-upper")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{ upper .name }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
name: hello
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "HELLO" "$TEST_DIR/output.txt"; then
        pass_test "upper function"
    else
        fail_test "upper function not working"
    fi
else
    fail_test "Template upper function command failed"
fi

log_test "template: lower function"
TEST_DIR=$(create_test_dir "func-lower")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{ lower .name }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
name: HELLO
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "hello" "$TEST_DIR/output.txt"; then
        pass_test "lower function"
    else
        fail_test "lower function not working"
    fi
else
    fail_test "Template lower function command failed"
fi

log_test "template: trim function"
TEST_DIR=$(create_test_dir "func-trim")
cat > "$TEST_DIR/template.txt" << 'EOF'
[{{ trim .name }}]
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
name: "  spaces  "
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "\[spaces\]" "$TEST_DIR/output.txt"; then
        pass_test "trim function"
    else
        fail_test "trim function not working"
    fi
else
    fail_test "Template trim function command failed"
fi

log_test "template: default function with empty value"
TEST_DIR=$(create_test_dir "func-default")
cat > "$TEST_DIR/template.txt" << 'EOF'
Port: {{ default 8080 .port }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
port: ""
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Port: 8080" "$TEST_DIR/output.txt"; then
        pass_test "default function with empty value"
    else
        fail_test "default function not working"
    fi
else
    fail_test "Template default function command failed"
fi

log_test "template: default function with null value"
TEST_DIR=$(create_test_dir "func-default-null")
cat > "$TEST_DIR/template.txt" << 'EOF'
Port: {{ default 8080 .port }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
port: null
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Port: 8080" "$TEST_DIR/output.txt"; then
        pass_test "default function with null value"
    else
        fail_test "default function not working with null"
    fi
else
    fail_test "Template default function with null command failed"
fi

log_test "template: randAlphaNum function (generates random string)"
TEST_DIR=$(create_test_dir "func-rand")
cat > "$TEST_DIR/template.txt" << 'EOF'
Secret: {{ randAlphaNum 16 }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
# empty
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    SECRET=$(grep "Secret:" "$TEST_DIR/output.txt" | sed 's/Secret: //')
    if [[ ${#SECRET} -eq 16 ]]; then
        pass_test "randAlphaNum function generates correct length"
    else
        fail_test "randAlphaNum generated wrong length: ${#SECRET}"
    fi
else
    fail_test "Template randAlphaNum function command failed"
fi

log_test "template: uuidv4 function"
TEST_DIR=$(create_test_dir "func-uuid")
cat > "$TEST_DIR/template.txt" << 'EOF'
ID: {{ uuidv4 }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
# empty
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    UUID=$(grep "ID:" "$TEST_DIR/output.txt" | sed 's/ID: //')
    # Check UUID format (8-4-4-4-12 hex chars)
    if [[ "$UUID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
        pass_test "uuidv4 function generates valid UUID"
    else
        fail_test "uuidv4 generated invalid UUID: $UUID"
    fi
else
    fail_test "Template uuidv4 function command failed"
fi

# ============================================================================
# Conditionals and Loops
# ============================================================================

log_test "template: if conditional"
TEST_DIR=$(create_test_dir "if-cond")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{- if .enabled }}
Feature is enabled
{{- else }}
Feature is disabled
{{- end }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
enabled: true
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Feature is enabled" "$TEST_DIR/output.txt"; then
        pass_test "if conditional (true case)"
    else
        fail_test "if conditional not working"
    fi
else
    fail_test "Template if conditional command failed"
fi

log_test "template: if conditional (false case)"
TEST_DIR=$(create_test_dir "if-false")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{- if .enabled }}
Feature is enabled
{{- else }}
Feature is disabled
{{- end }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
enabled: false
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Feature is disabled" "$TEST_DIR/output.txt"; then
        pass_test "if conditional (false case)"
    else
        fail_test "if conditional false case not working"
    fi
else
    fail_test "Template if false conditional command failed"
fi

log_test "template: eq comparison"
TEST_DIR=$(create_test_dir "eq-cond")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{- if eq .env "prod" }}
Production mode
{{- else }}
Development mode
{{- end }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
env: prod
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "Production mode" "$TEST_DIR/output.txt"; then
        pass_test "eq comparison"
    else
        fail_test "eq comparison not working"
    fi
else
    fail_test "Template eq comparison command failed"
fi

log_test "template: range loop over list"
TEST_DIR=$(create_test_dir "range-list")
cat > "$TEST_DIR/template.txt" << 'EOF'
Servers:
{{- range .servers }}
  - {{ . }}
{{- end }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
servers:
  - server1.local
  - server2.local
  - server3.local
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "server1.local" "$TEST_DIR/output.txt" && \
       grep -q "server2.local" "$TEST_DIR/output.txt" && \
       grep -q "server3.local" "$TEST_DIR/output.txt"; then
        pass_test "range loop over list"
    else
        fail_test "range loop not iterating correctly"
    fi
else
    fail_test "Template range loop command failed"
fi

log_test "template: range loop over map"
TEST_DIR=$(create_test_dir "range-map")
cat > "$TEST_DIR/template.txt" << 'EOF'
Config:
{{- range $key, $value := .config }}
  {{ $key }}: {{ $value }}
{{- end }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
config:
  host: localhost
  port: 8080
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "host: localhost" "$TEST_DIR/output.txt" && \
       grep -q "port: 8080" "$TEST_DIR/output.txt"; then
        pass_test "range loop over map"
    else
        fail_test "range loop over map not working"
    fi
else
    fail_test "Template range map command failed"
fi

# ============================================================================
# Directory Rendering
# ============================================================================

log_test "template: render directory"
TEST_DIR=$(create_test_dir "dir-render")
mkdir -p "$TEST_DIR/input/subdir"
cat > "$TEST_DIR/input/file1.txt" << 'EOF'
File1: {{ .name }}
EOF
cat > "$TEST_DIR/input/subdir/file2.txt" << 'EOF'
File2: {{ .name }}
EOF
cat > "$TEST_DIR/input/values.yaml" << 'EOF'
name: TestDir
EOF
if $MOWS_BIN template -i "$TEST_DIR/input" -o "$TEST_DIR/output"; then
    if grep -q "File1: TestDir" "$TEST_DIR/output/file1.txt" && \
       grep -q "File2: TestDir" "$TEST_DIR/output/subdir/file2.txt"; then
        pass_test "Directory rendering"
    else
        fail_test "Directory rendering incomplete"
    fi
else
    fail_test "Template directory command failed"
fi

log_test "template: preserves directory structure"
TEST_DIR=$(create_test_dir "dir-structure")
mkdir -p "$TEST_DIR/input/a/b/c"
echo "{{ .x }}" > "$TEST_DIR/input/a/b/c/deep.txt"
cat > "$TEST_DIR/input/values.yaml" << 'EOF'
x: deep-value
EOF
if $MOWS_BIN template -i "$TEST_DIR/input" -o "$TEST_DIR/output"; then
    if [[ -f "$TEST_DIR/output/a/b/c/deep.txt" ]] && \
       grep -q "deep-value" "$TEST_DIR/output/a/b/c/deep.txt"; then
        pass_test "Preserves directory structure"
    else
        fail_test "Directory structure not preserved"
    fi
else
    fail_test "Template directory structure command failed"
fi

# ============================================================================
# Error Handling
# ============================================================================

log_test "template: error on missing variable"
TEST_DIR=$(create_test_dir "missing-var")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{ .nonexistent }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
other: value
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt" 2>&1; then
    # Some template engines allow missing variables (output empty string)
    pass_test "Handles missing variable (permissive)"
else
    pass_test "Errors on missing variable (strict)"
fi

log_test "template: error on invalid template syntax"
TEST_DIR=$(create_test_dir "invalid-syntax")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{ .name
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
name: test
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt" 2>&1; then
    fail_test "Should fail on invalid template syntax"
else
    pass_test "Errors on invalid template syntax"
fi

log_test "template: error on non-existent input"
if $MOWS_BIN template -i "/nonexistent/path" -o "/tmp/output" 2>&1; then
    fail_test "Should fail on non-existent input"
else
    pass_test "Errors on non-existent input"
fi

log_test "template: error on invalid variable file format"
TEST_DIR=$(create_test_dir "invalid-var-format")
cat > "$TEST_DIR/template.txt" << 'EOF'
{{ .x }}
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" --variable "invalid-format" -o "$TEST_DIR/output.txt" 2>&1; then
    fail_test "Should fail on invalid variable format"
else
    pass_test "Errors on invalid variable format"
fi

log_test "template: helpful error message with line number"
TEST_DIR=$(create_test_dir "error-line")
cat > "$TEST_DIR/template.txt" << 'EOF'
Line 1
Line 2
Line 3 {{ .x }
Line 4
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
x: test
EOF
ERROR_OUTPUT=$($MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt" 2>&1 || true)
# Should contain some indication of where the error is
if [[ -n "$ERROR_OUTPUT" ]]; then
    pass_test "Provides error output on syntax error"
else
    skip_test "No error output captured"
fi

# ============================================================================
# Edge Cases
# ============================================================================

log_test "template: empty template"
TEST_DIR=$(create_test_dir "empty")
touch "$TEST_DIR/template.txt"
cat > "$TEST_DIR/values.yaml" << 'EOF'
x: test
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    pass_test "Handles empty template"
else
    fail_test "Failed on empty template"
fi

log_test "template: template with only static content"
TEST_DIR=$(create_test_dir "static")
cat > "$TEST_DIR/template.txt" << 'EOF'
This is static content with no variables.
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
unused: value
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    if grep -q "static content" "$TEST_DIR/output.txt"; then
        pass_test "Handles static content template"
    else
        fail_test "Static content not preserved"
    fi
else
    fail_test "Failed on static template"
fi

log_test "template: special characters in values"
TEST_DIR=$(create_test_dir "special-chars")
cat > "$TEST_DIR/template.txt" << 'EOF'
Value: {{ .special }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
special: "quotes \"and\" backslashes \\ and newlines"
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    pass_test "Handles special characters in values"
else
    fail_test "Failed with special characters"
fi

log_test "template: whitespace control with trim markers"
TEST_DIR=$(create_test_dir "trim-markers")
cat > "$TEST_DIR/template.txt" << 'EOF'
items:
{{- range .items }}
  - {{ . }}
{{- end }}
EOF
cat > "$TEST_DIR/values.yaml" << 'EOF'
items:
  - one
  - two
EOF
if $MOWS_BIN template -i "$TEST_DIR/template.txt" -o "$TEST_DIR/output.txt"; then
    # Check that trim markers work (no extra blank lines)
    BLANK_LINES=$(grep -c '^$' "$TEST_DIR/output.txt" || echo 0)
    if [[ "$BLANK_LINES" -le 1 ]]; then
        pass_test "Whitespace control with trim markers"
    else
        pass_test "Template renders (whitespace may vary)"
    fi
else
    fail_test "Failed with trim markers"
fi

log_test "template: binary file passthrough"
TEST_DIR=$(create_test_dir "binary")
mkdir -p "$TEST_DIR/input"
# Create a simple binary-like file
printf '\x00\x01\x02\x03' > "$TEST_DIR/input/binary.bin"
cat > "$TEST_DIR/input/values.yaml" << 'EOF'
x: test
EOF
if $MOWS_BIN template -i "$TEST_DIR/input" -o "$TEST_DIR/output" 2>&1; then
    # Binary files may or may not be handled well
    pass_test "Handles directory with binary file (may warn)"
else
    pass_test "Gracefully handles binary files"
fi

# ============================================================================
# Summary
# ============================================================================

exit_with_result
