# MPM Integration Tests

End-to-end tests for mpm functionality. These tests run the actual `mpm` binary against real or mocked environments.

## Quick Start

```bash
# Run all tests
./run-all.sh

# Run specific test
./run-all.sh test-tools

# Run with verbose output
VERBOSE=1 ./run-all.sh

# List available tests
./run-all.sh --list
```

## Test Organization

| Test File | Description |
|-----------|-------------|
| `test-cli.sh` | General CLI functionality (version, help, manpage) |
| `test-compose-cd.sh` | Project navigation (`mpm compose cd`) |
| `test-compose-init.sh` | Project initialization (`mpm compose init`) |
| `test-compose-install.sh` | Remote project installation (`mpm compose install`) |
| `test-compose-secrets.sh` | Secrets generation and management |
| `test-compose-up.sh` | Compose rendering pipeline |
| `test-self-update.sh` | Self-update functionality (skipped in CI) |
| `test-template.sh` | Template rendering (`mpm template`) |
| `test-tools.sh` | Tool subcommands (json-to-yaml, jq, expand-object, etc.) |

### Shared Utilities

- `lib/common.sh` - Shared test functions, assertions, and setup/teardown helpers

## Running Tests

### Command Line Options

```bash
./run-all.sh [OPTIONS] [TEST_FILTER]

Options:
    -h, --help          Show help message
    -v, --verbose       Show test output in real-time
    -j, --jobs N        Number of parallel jobs (default: CPU cores)
    -k, --keep-output   Keep test output directory after run
    -f, --fail-fast     Stop on first failure
    -s, --sequential    Run tests sequentially (same as -j 1)
    -l, --list          List available tests without running
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PARALLEL_JOBS` | Number of parallel jobs |
| `OUTPUT_DIR` | Directory for test output |
| `VERBOSE` | Set to `1` for verbose output |
| `KEEP_OUTPUT` | Set to `1` to keep output directory |
| `FAIL_FAST` | Set to `1` to stop on first failure |
| `MPM_BIN` | Path to mpm binary (default: release build) |
| `DEBUG` | Set to `1` for debug output in tests |
| `MPM_MOCK_DOCKER` | Set to `1` to use mock Docker client |

## CI/CD

### Mock Docker Client

Tests requiring Docker can run in CI using the mock Docker client:

```bash
export MPM_MOCK_DOCKER=1
./run-all.sh
```

The mock client simulates Docker operations:
- `compose up` succeeds immediately
- `compose ps` returns containers as running and healthy
- `compose logs` returns empty logs
- Container inspections return minimal mock data

### Tests Skipped in CI

| Test | Reason |
|------|--------|
| `test-self-update` | Network-dependent, requires GitHub API |

## Writing New Tests

1. Create a new file `test-<name>.sh` in this directory
2. Add the standard header:
   ```bash
   #!/usr/bin/env bash
   # End-to-end tests for mpm <feature>
   # These tests are isolated and can run in parallel

   set -euo pipefail
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   source "$SCRIPT_DIR/lib/common.sh"
   ```
3. Use functions from `lib/common.sh` for assertions and setup
4. Ensure tests are isolated (use temp directories, don't modify global state)
5. The test runner will automatically discover and run your test
