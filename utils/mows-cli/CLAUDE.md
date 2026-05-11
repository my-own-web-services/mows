# MOWS CLI (mows-cli)

MOWS uses a busybox-style binary called `mows` with subcommands:
- `mows package-manager compose ...` - Package manager compose operations
- `mows tools ...` - Utility tools (json-to-yaml, jq, etc.)
- `mows vms ...` - Spawn and manage Alpine QEMU VMs (and the supervisor that runs them)
- `mows agents ...` - Run AI coding agents (claude-code, future kinds) inside QEMU VMs
- `mows template ...` - Template rendering
- `mows self-update` - Self-update

A symlink `mpm` is provided as an alias for `mows package-manager`, so `mpm compose ...` is equivalent to `mows package-manager compose ...`.

## `mows vms` and `mows agents`

`vms` and `agents` are sibling root commands. A **VM** is the general-purpose
Alpine QEMU primitive: `/workspace` (host CWD, rw) and `/creds` (host
`~/.claude`, ro) mounted via 9p, sshd listening on a forwarded host port,
and an independent dockerd inside. **Agents** are processes running
*inside* a VM (one VM may host many), started over SSH by the supervisor.

Both root commands talk to the **mows-vm-supervisor** container (under
`utils/mows-vm-supervisor/`). The CLI talks to the supervisor over loopback
HTTP today; unix socket and (later) WireGuard remote control share the same
axum API on the supervisor side.

The supervisor also exposes per-VM **display** and **console** websocket
streams for the future web UI:
- `GET /v1/vms/:id/display` — RFB/VNC. QEMU binds VNC to a unix socket
  (`<state_dir>/vms/<id>/display.sock`); axum proxies raw bytes
  bidirectionally as binary websocket frames. noVNC connects directly.
- `GET /v1/vms/:id/console` — guest serial console. QEMU exposes the
  serial chardev as a unix socket and persists everything to `console.log`
  via the chardev `logfile=` option, so the on-disk log captures output
  whether or not a websocket client is attached. Only one console client
  may attach at a time (QEMU `server=on,wait=off` semantics).

### `mows vms`

| Subcommand | Purpose |
|---|---|
| `vms run` | Boot a fresh VM and (default) attach via SSH. `--detach` runs in the background. |
| `vms list` | List running and stopped VMs. |
| `vms attach <id\|name>` | SSH into a running VM. |
| `vms logs <id\|name>` | Print recent VM logs. |
| `vms stop <id\|name>` | Stop a running VM. |
| `vms rm <id\|name>` | Remove a stopped VM and its on-disk state. |
| `vms build-image` | Build (or rebuild) the cached Alpine guest qcow2 image. |
| `vms supervisor {start,stop,status,logs,wg-config}` | Manage the supervisor container itself. |

### `mows agents`

| Subcommand | Purpose |
|---|---|
| `agents run` | Convenience: boot a fresh VM, spawn an agent in it, and attach. |
| `agents create <vm-id>` | Spawn an additional agent inside an existing VM. |
| `agents list` | List agents (optionally filter by VM). |
| `agents attach <id\|name>` | Attach the local terminal to a running agent via tmux. |
| `agents logs <id\|name>` | Print recent agent logs. |
| `agents stop <id\|name>` | Stop a running agent. |
| `agents rm <id\|name>` | Remove a stopped agent and its on-disk state. |
| `agents user {add,list,passwd,rm}` | Web-UI / API user accounts. |

Environment variables:

- `MOWS_VM_SUPERVISOR_URL` — supervisor base URL (default `http://127.0.0.1:7878`).
- `MOWS_VM_SUPERVISOR_API_TOKEN` (or `_FILE`) — bearer token used for HTTP listener.

Design doc: `.plans/agent-vm/PLAN.md`.

## Testing Guidelines

### Config File Isolation

**CRITICAL**: All tests that call `MowsConfig::load()` or `MowsConfig::save()` MUST use proper isolation to prevent modifying the user's actual config file at `~/.config/mows.cloud/mows.yaml`.

#### Recommended: Use TestConfigGuard (for unit tests)

The `TestConfigGuard` helper in `src/package_manager/compose/config.rs` provides RAII-based isolation:

```rust
#[test]
fn test_config_persistence() {
    let _guard = TestConfigGuard::new();  // Sets up isolated environment

    let mut config = MowsConfig::default();
    config.set_update_available("1.0.0".to_string());
    config.save().unwrap();

    let loaded = MowsConfig::load().unwrap();
    assert_eq!(loaded.update.unwrap().available_version, "1.0.0");
}  // Guard automatically cleans up when dropped
```

The guard:
1. Acquires a mutex to prevent concurrent test interference
2. Creates a temporary file for the config
3. Sets `MOWS_CONFIG_PATH` to the temp file
4. Automatically cleans up when dropped

#### Alternative: Manual Setup (if needed outside config module)

```rust
use tempfile::NamedTempFile;
use std::env;

#[test]
fn test_example() {
    let temp_config = NamedTempFile::new().unwrap();
    env::set_var("MOWS_CONFIG_PATH", temp_config.path());

    // ... run test that uses MowsConfig ...

    env::remove_var("MOWS_CONFIG_PATH");
}
```

#### For integration tests (bash):

```bash
export MOWS_CONFIG_PATH=$(mktemp)
# ... run mows/mpm commands ...
rm -f "$MOWS_CONFIG_PATH"
```

### Why This Matters

- Tests should be isolated and not affect user state
- The config file stores project registrations and update check timestamps
- Modifying the real config could break user workflows or cause unexpected behavior
- Tests run in parallel by default, so the mutex in TestConfigGuard prevents race conditions

## Running Tests

### Unit Tests

```bash
cargo test -p mows-cli                    # Run all unit tests
cargo test -p mows-cli config::tests      # Run specific module tests
cargo test -p mows-cli -- --nocapture     # Show test output
```

### Integration Tests (E2E)

The E2E tests use two environment variables to locate the binaries:
- `MOWS_BIN` - Path to the `mows` binary (default: `target/release/mows`)
- `MPM_BIN` - Path to the `mpm` symlink (default: alongside the `mows` binary)

```bash
cd tests
./run-all.sh                  # Run all integration tests
./run-all.sh test-cli         # Run specific test
VERBOSE=1 ./run-all.sh        # Verbose output
```

Tests that use `mows` directly (tools, template, self-update, cli) reference `$MOWS_BIN`.
Tests that use the package manager via the symlink (compose) reference `$MPM_BIN`.

### Mock Docker Client for CI

Tests that require Docker can run in CI using the mock Docker client:

```bash
export MPM_MOCK_DOCKER=1
./run-all.sh  # Docker operations use mock client
```

The mock client (`MPM_MOCK_DOCKER=1`) simulates Docker operations:
- `compose up` succeeds immediately
- `compose build` succeeds immediately (prints `mock: compose_build project=<name> no_cache=<bool>` to stdout for test verification)
- `compose ps` returns containers as running and healthy
- `compose logs` returns empty logs
- Container inspections return minimal mock data

This allows testing the full mows workflow without a Docker daemon.

### Tests Skipped in CI

| Test | Reason |
|------|--------|
| `test-self-update` | Network-dependent, requires GitHub API |

Note: `test-compose-up` and `test-compose-watch` now run in CI using `MPM_MOCK_DOCKER=1`.

## Building

The crate name is `mows-cli`, producing a binary called `mows`. A `mpm` symlink is created alongside it.

### Development

```bash
cargo build -p mows-cli                   # Debug build (target/debug/mows)
cargo build -p mows-cli --release         # Release build (target/release/mows)
```

### Static Binary (Docker)

```bash
bash build.sh                 # Build static binary to dist/mows
TARGETARCH=arm64 bash build.sh  # Cross-compile for ARM64
PROFILE=dev bash build.sh     # Faster dev build
```

See [docs/development.md](docs/development.md) for full build options and CI/CD documentation.
