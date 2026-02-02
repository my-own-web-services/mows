# MOWS CLI (mows-cli)

MOWS uses a busybox-style binary called `mows` with subcommands:
- `mows package-manager compose ...` - Package manager compose operations
- `mows tools ...` - Utility tools (json-to-yaml, jq, etc.)
- `mows template ...` - Template rendering
- `mows self-update` - Self-update

A symlink `mpm` is provided as an alias for `mows package-manager`, so `mpm compose ...` is equivalent to `mows package-manager compose ...`.

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
- `compose ps` returns containers as running and healthy
- `compose logs` returns empty logs
- Container inspections return minimal mock data

This allows testing the full mows workflow without a Docker daemon.

### Tests Skipped in CI

| Test | Reason |
|------|--------|
| `test-self-update` | Network-dependent, requires GitHub API |

Note: `test-compose-up` now runs in CI using `MPM_MOCK_DOCKER=1`.

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
