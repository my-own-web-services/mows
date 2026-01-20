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
