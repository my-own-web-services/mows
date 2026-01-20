# MPM (MOWS Package Manager)

## Testing Guidelines

### Config File Isolation

**CRITICAL**: All tests that call `MpmConfig::load()` or `MpmConfig::save()` MUST use proper isolation to prevent modifying the user's actual config file at `~/.config/mows.cloud/mpm.yaml`.

#### Recommended: Use TestConfigGuard (for unit tests)

The `TestConfigGuard` helper in `src/compose/config.rs` provides RAII-based isolation:

```rust
#[test]
fn test_config_persistence() {
    let _guard = TestConfigGuard::new();  // Sets up isolated environment

    let mut config = MpmConfig::default();
    config.set_update_available("1.0.0".to_string());
    config.save().unwrap();

    let loaded = MpmConfig::load().unwrap();
    assert_eq!(loaded.update.unwrap().available_version, "1.0.0");
}  // Guard automatically cleans up when dropped
```

The guard:
1. Acquires a mutex to prevent concurrent test interference
2. Creates a temporary file for the config
3. Sets `MPM_CONFIG_PATH` to the temp file
4. Automatically cleans up when dropped

#### Alternative: Manual Setup (if needed outside config module)

```rust
use tempfile::NamedTempFile;
use std::env;

#[test]
fn test_example() {
    let temp_config = NamedTempFile::new().unwrap();
    env::set_var("MPM_CONFIG_PATH", temp_config.path());

    // ... run test that uses MpmConfig ...

    env::remove_var("MPM_CONFIG_PATH");
}
```

#### For integration tests (bash):

```bash
export MPM_CONFIG_PATH=$(mktemp)
# ... run mpm commands ...
rm -f "$MPM_CONFIG_PATH"
```

### Why This Matters

- Tests should be isolated and not affect user state
- The config file stores project registrations and update check timestamps
- Modifying the real config could break user workflows or cause unexpected behavior
- Tests run in parallel by default, so the mutex in TestConfigGuard prevents race conditions

## Running Tests

### Unit Tests

```bash
cargo test                    # Run all unit tests
cargo test config::tests      # Run specific module tests
cargo test -- --nocapture     # Show test output
```

### Integration Tests (E2E)

```bash
cd tests
./run-all.sh                  # Run all integration tests
./run-all.sh test-cli         # Run specific test
VERBOSE=1 ./run-all.sh        # Verbose output
```

### Tests Skipped in CI

These tests are skipped in CI due to environment limitations and should be run locally:

| Test | Reason |
|------|--------|
| `test-compose-up` | Requires Docker daemon with port binding |
| `test-self-update` | Network-dependent, requires GitHub API |
| `test-compose-cd` | Shell integration not available in CI |

## Building

### Development

```bash
cargo build                   # Debug build
cargo build --release         # Release build (local)
```

### Static Binary (Docker)

```bash
bash build.sh                 # Build static binary to dist/mpm
TARGETARCH=arm64 bash build.sh  # Cross-compile for ARM64
PROFILE=dev bash build.sh     # Faster dev build
```

See [docs/development.md](docs/development.md) for full build options and CI/CD documentation.
