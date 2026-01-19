# MPM (MOWS Package Manager)

## Testing Guidelines

### Config File Isolation

**CRITICAL**: All tests that interact with `MpmConfig` MUST set the `MPM_CONFIG_PATH` environment variable to a temporary file path. This prevents tests from modifying the user's actual config file at `~/.config/mows.cloud/mpm.yaml`.

```rust
use tempfile::NamedTempFile;
use std::env;

#[test]
fn test_example() {
    // Create a temporary config file
    let temp_config = NamedTempFile::new().unwrap();
    env::set_var("MPM_CONFIG_PATH", temp_config.path());

    // ... run test that uses MpmConfig ...

    // Clean up
    env::remove_var("MPM_CONFIG_PATH");
}
```

For integration tests or bash-based tests:

```bash
export MPM_CONFIG_PATH=$(mktemp)
# ... run mpm commands ...
rm -f "$MPM_CONFIG_PATH"
```

### Why This Matters

- Tests should be isolated and not affect user state
- The config file stores project registrations and update check timestamps
- Modifying the real config could break user workflows or cause unexpected behavior
