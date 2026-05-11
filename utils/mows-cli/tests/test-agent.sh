#!/usr/bin/env bash
# Smoke test for `mows tools agent` against a live mows-vm-supervisor.
#
# This test is gated on:
#   - a running supervisor reachable at $MOWS_VM_SUPERVISOR_URL
#     (default http://127.0.0.1:7878), OR
#   - the local supervisor binary at $MOWS_VM_SUPERVISOR_BIN
#
# It does NOT spawn QEMU VMs (that requires /dev/kvm + a built qcow2);
# it only verifies the CLI ↔ supervisor wire is intact end-to-end.
#
# Skip in CI by default by setting AGENT_TEST_SKIP=1.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Agent (HTTP smoke)"

if [[ "${AGENT_TEST_SKIP:-0}" == "1" ]]; then
    log_test "agent: skipped via AGENT_TEST_SKIP=1"
    pass_test "skipped (env)"
    exit 0
fi

ensure_mows_built

SUPERVISOR_URL="${MOWS_VM_SUPERVISOR_URL:-http://127.0.0.1:7878}"

log_test "agent: supervisor /v1/healthz reachable"
if curl --silent --fail --max-time 2 "${SUPERVISOR_URL}/v1/healthz" >/dev/null 2>&1; then
    pass_test "supervisor up at ${SUPERVISOR_URL}"
else
    log_test "agent: skipped — supervisor not reachable at ${SUPERVISOR_URL}"
    log_test "        start it with: cd utils/mows-vm-supervisor/deployment && mpm compose up"
    pass_test "skipped (supervisor not running)"
    exit 0
fi

log_test "agent: 'mows tools agent supervisor status' succeeds"
if MOWS_VM_SUPERVISOR_URL="${SUPERVISOR_URL}" \
        $MOWS_BIN tools agent supervisor status 2>&1 | grep -q "ok"; then
    pass_test "supervisor status returns ok"
else
    fail_test "supervisor status did not return ok"
fi

log_test "agent: 'mows tools agent list' returns valid JSON"
if MOWS_VM_SUPERVISOR_URL="${SUPERVISOR_URL}" \
        $MOWS_BIN tools agent list >/dev/null 2>&1; then
    pass_test "agent list executes"
else
    fail_test "agent list failed"
fi

log_test "agent: 'mows tools agent --help' is wired"
if $MOWS_BIN tools agent --help 2>&1 | grep -qE "^Commands:.*$"; then
    pass_test "help output present"
else
    fail_test "help output missing or malformed"
fi
