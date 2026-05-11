#!/usr/bin/env bash
# Full e2e for `mows tools agent run` — boots a real Alpine VM through the
# supervisor and verifies an agent actually reaches `running` and is
# attachable. This is the test that catches regressions in:
#   - the mows-cli ↔ supervisor wire (POST /v1/vms, GET /ssh)
#   - the auto-start path that brings up the supervisor container on demand
#   - SSH attach (notably the per-agent known_hosts file scoped by id, not
#     port — a port-scoped file collides on port reuse)
#
# Requirements:
#   - /dev/kvm (real KVM)
#   - built guest qcow2 at $MOWS_AGENT_IMAGE_DIR/alpine-mows-agent-amd64.qcow2
#     (default: ~/.local/state/mows-agent/images/...)
#   - the supervisor container image ‘mows-vm-supervisor:dev’ on the local
#     Docker daemon (built by `bash utils/mows-vm-supervisor/build.sh`)
#   - the system `ssh` binary
#
# Skip via AGENT_FULL_SKIP=1; otherwise this test will FAIL if any
# prerequisite is missing (we want explicit failure rather than silent skip).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

TEST_NAME="Agent (full boot)"

# Opt-IN by default: this test takes minutes (real KVM boot) and requires
# host-specific resources, so a clean `./run-all.sh` doesn't surface its
# slowness or false-failures from missing prereqs. Run with:
#   AGENT_FULL_RUN=1 ./run-all.sh test-agent-full
if [[ "${AGENT_FULL_RUN:-0}" != "1" ]]; then
    log_test "agent-full: skipped (set AGENT_FULL_RUN=1 to enable)"
    pass_test "skipped (opt-in)"
    exit 0
fi

ensure_mows_built

# ---------------------------------------------------------------------------
# Prereq checks — fail loudly so the user knows what to install/build.
# ---------------------------------------------------------------------------

log_test "agent-full: /dev/kvm present"
if [[ -e /dev/kvm ]]; then
    pass_test "/dev/kvm available"
else
    fail_test "/dev/kvm missing — KVM-capable host required"
    exit 1
fi

IMAGE_DIR="${MOWS_AGENT_IMAGE_DIR:-$HOME/.local/state/mows-agent/images}"
log_test "agent-full: guest image present at $IMAGE_DIR"
if [[ -f "$IMAGE_DIR/alpine-mows-agent-amd64.qcow2" ]]; then
    pass_test "qcow2 present"
else
    fail_test "qcow2 missing — run \`$MOWS_BIN tools agent build-image\`"
    exit 1
fi

log_test "agent-full: docker image mows-vm-supervisor:dev present"
if docker image inspect mows-vm-supervisor:dev >/dev/null 2>&1; then
    pass_test "supervisor image present"
else
    fail_test "image missing — build with \`bash utils/mows-vm-supervisor/build.sh\`"
    exit 1
fi

log_test "agent-full: ssh client on PATH"
if command -v ssh >/dev/null 2>&1; then
    pass_test "ssh present"
else
    fail_test "ssh client required"
    exit 1
fi

# ---------------------------------------------------------------------------
# Test body — run an agent end-to-end.
# ---------------------------------------------------------------------------

# Use the 'shell' kind so we don't need ~/.claude credentials forwarded —
# faster to provision and the SSH path is identical.
TEST_WORKSPACE="$(mktemp -d)"
trap 'rm -rf "$TEST_WORKSPACE"' EXIT

# Confirm the supervisor is reachable; the auto-start path should bring it
# up on first command if it isn't already running.
log_test "agent-full: 'mows vms supervisor status' (auto-starts if needed)"
if "$MOWS_BIN" vms supervisor status >/dev/null 2>&1; then
    pass_test "supervisor reachable"
else
    fail_test "supervisor did not become reachable"
    exit 1
fi

log_test "agent-full: 'mows vms run' starts a VM"
RUN_OUT="$( cd "$TEST_WORKSPACE" && \
    "$MOWS_BIN" vms run 2>&1 )"
echo "$RUN_OUT" | head -5
NEW_ID="$(printf '%s\n' "$RUN_OUT" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1)"
if [[ -n "$NEW_ID" ]]; then
    pass_test "vm started (id=$NEW_ID)"
else
    fail_test "could not parse new VM id from output: $RUN_OUT"
    exit 1
fi

cleanup_vm() {
    "$MOWS_BIN" vms stop "$NEW_ID" >/dev/null 2>&1 || true
    "$MOWS_BIN" vms rm "$NEW_ID" >/dev/null 2>&1 || true
}
trap 'cleanup_vm; rm -rf "$TEST_WORKSPACE"' EXIT

# Poll until status=running. The supervisor's readiness probe waits for an
# SSH banner from the guest with its own 180s budget; we mirror that so a
# slow host doesn't fail the test before the supervisor itself gives up.
log_test "agent-full: VM reaches running within 200s"
DEADLINE=$(( SECONDS + 200 ))
STATUS=""
while (( SECONDS < DEADLINE )); do
    STATUS="$(curl -sf "${MOWS_VM_SUPERVISOR_URL:-http://127.0.0.1:7878}/v1/vms/$NEW_ID" \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' \
        2>/dev/null || echo unknown)"
    if [[ "$STATUS" == "running" ]]; then
        break
    fi
    if [[ "$STATUS" == "failed" ]]; then
        fail_test "VM entered failed state"
        exit 1
    fi
    sleep 2
done
if [[ "$STATUS" == "running" ]]; then
    pass_test "VM running"
else
    fail_test "VM did not reach running (last status: $STATUS)"
    exit 1
fi

# Run a non-interactive command via the same SSH path mows-cli uses. We
# fetch the keypair from the supervisor and ssh in directly — exercising
# the same wire as `mows tools agent attach`.
log_test "agent-full: ssh into VM and run \`echo hello\`"
SSH_INFO="$(curl -sf "${MOWS_VM_SUPERVISOR_URL:-http://127.0.0.1:7878}/v1/vms/$NEW_ID/ssh")"
SSH_PORT="$(echo "$SSH_INFO" | python3 -c 'import json,sys; print(json.load(sys.stdin)["port"])')"
KEY_FILE="$(mktemp)"
chmod 600 "$KEY_FILE"
echo "$SSH_INFO" | python3 -c 'import json,sys; sys.stdout.write(json.load(sys.stdin)["private_key"])' > "$KEY_FILE"
KH_FILE="$(mktemp)"
rm -f "$KH_FILE"
SSH_OUT="$(ssh -i "$KEY_FILE" \
    -p "$SSH_PORT" \
    -o "StrictHostKeyChecking=accept-new" \
    -o "UserKnownHostsFile=$KH_FILE" \
    -o "IdentitiesOnly=yes" \
    -o "ConnectTimeout=10" \
    root@127.0.0.1 \
    'echo hello-from-vm' 2>&1)"
SSH_RC=$?
rm -f "$KEY_FILE" "$KH_FILE"
if [[ $SSH_RC -eq 0 && "$SSH_OUT" == *"hello-from-vm"* ]]; then
    pass_test "ssh exec roundtripped"
else
    fail_test "ssh exec failed (rc=$SSH_RC, output=$SSH_OUT)"
    exit 1
fi

# Spawn a claude agent (the default kind for `mows agents run`). Catches
# regressions in: claude binary present in image, /creds mount usable,
# .claude.json restoration, agent dropping to non-root user, agent runtime
# flipping status to running on first stdout byte.
log_test "agent-full: 'mows agents create --kind claude' reaches running"
CLAUDE_OUT="$("$MOWS_BIN" agents create "$NEW_ID" --kind claude --detach 2>&1)"
CLAUDE_ID="$(printf '%s\n' "$CLAUDE_OUT" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1)"
if [[ -z "$CLAUDE_ID" ]]; then
    fail_test "could not parse claude agent id: $CLAUDE_OUT"
    exit 1
fi
CLAUDE_DEADLINE=$(( SECONDS + 90 ))
CLAUDE_STATUS=""
while (( SECONDS < CLAUDE_DEADLINE )); do
    CLAUDE_STATUS="$(curl -sf "${MOWS_VM_SUPERVISOR_URL:-http://127.0.0.1:7878}/v1/agents/$CLAUDE_ID" \
        | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' 2>/dev/null || echo unknown)"
    if [[ "$CLAUDE_STATUS" == "running" ]]; then
        break
    fi
    if [[ "$CLAUDE_STATUS" == "failed" ]]; then
        # Dump the agent log so failures are debuggable.
        echo "claude agent failed; agent.log:"
        docker exec mows-vm-supervisor sh -c "cat /var/lib/mows-agent/agents/$CLAUDE_ID/agent.log 2>&1 | head -40" || true
        fail_test "claude agent failed"
        exit 1
    fi
    sleep 2
done
if [[ "$CLAUDE_STATUS" == "running" ]]; then
    pass_test "claude reached running"
else
    fail_test "claude did not reach running within 90s (last: $CLAUDE_STATUS)"
    exit 1
fi

# Spawn TWO shell agents to prove multi-agent-per-VM works.
log_test "agent-full: 'mows agents create' spawns a shell agent inside the VM"
A1_OUT="$("$MOWS_BIN" agents create "$NEW_ID" --kind shell --detach 2>&1)"
A1_ID="$(printf '%s\n' "$A1_OUT" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1)"
if [[ -n "$A1_ID" && "$A1_ID" != "$NEW_ID" ]]; then
    pass_test "first agent spawned (id=$A1_ID)"
else
    fail_test "could not parse first agent id: $A1_OUT"
    exit 1
fi

log_test "agent-full: a second agent can be spawned in the same VM"
A2_OUT="$("$MOWS_BIN" agents create "$NEW_ID" --kind shell --detach 2>&1)"
A2_ID="$(printf '%s\n' "$A2_OUT" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1)"
if [[ -n "$A2_ID" && "$A2_ID" != "$A1_ID" ]]; then
    pass_test "second agent spawned (id=$A2_ID)"
else
    fail_test "could not parse second agent id: $A2_OUT"
    exit 1
fi

log_test "agent-full: 'mows agents list --vm' shows both agents"
LIST_OUT="$("$MOWS_BIN" agents list --vm "$NEW_ID" 2>&1)"
if echo "$LIST_OUT" | grep -q "${A1_ID:0:8}" && echo "$LIST_OUT" | grep -q "${A2_ID:0:8}"; then
    pass_test "both agents listed under the VM"
else
    fail_test "agents list missing one of the IDs:\n$LIST_OUT"
    exit 1
fi

# Stop + cleanup is handled by the trap (VM stop cascades to its agents).
log_test "agent-full: 'mows vms stop' tears the VM down (cascades to agents)"
if "$MOWS_BIN" vms stop "$NEW_ID" >/dev/null 2>&1; then
    pass_test "vm stop succeeded"
else
    fail_test "vm stop failed"
    exit 1
fi
