# Development Guide

This guide covers building, testing, and contributing to mows.

## Prerequisites

- **Rust** (stable toolchain) - for development and unit tests
- **Docker with BuildKit** - for building release binaries
- **Bash** - for integration tests

## Building

### Development Build

For quick iteration during development:

```bash
cargo build
# Binary at: target/debug/mows
```

### Release Build (Local)

Build an optimized binary without Docker:

```bash
cargo build --release
# Binary at: target/release/mows
```

### Static Binary Build (Docker)

Build a fully static, release-optimized binary using Docker:

```bash
bash build.sh
# Binary at: dist/mows
```

The Docker build:
- Creates a fully static binary (musl libc)
- Applies LTO (Link-Time Optimization) for smaller size
- Compresses with UPX for minimal binary size
- Embeds git hash and date for version info

#### Build Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PROFILE` | `release` | Build profile (`release` or `dev`) |
| `TARGETARCH` | `amd64` | Target architecture (`amd64` or `arm64`) |
| `GIT_HASH` | auto | Git commit hash to embed |
| `GIT_DATE` | auto | Git commit date to embed |
| `BUILDX_CACHE` | - | Set to `gha` for GitHub Actions cache |
| `BUILDX_CACHE_DIR` | - | Local directory for build cache |

#### Examples

```bash
# Build for ARM64
TARGETARCH=arm64 bash build.sh

# Development build (faster, no optimizations)
PROFILE=dev bash build.sh

# With local cache directory
BUILDX_CACHE_DIR=/tmp/mows-cache bash build.sh
```

### Cross-Compilation

ARM64 builds use cross-compilation via `cargo-zigbuild` instead of QEMU emulation for faster builds. This is handled automatically by the Dockerfile.

**Note:** LTO is disabled for ARM64 cross-compilation due to LLVM issues. Native ARM64 builds would produce smaller binaries.

## Testing

### Unit Tests

Run all unit tests:

```bash
cargo test
```

Run tests for a specific module:

```bash
cargo test config::tests
cargo test compose::render
```

Run tests with output visible:

```bash
cargo test -- --nocapture
```

### Integration Tests (E2E)

Integration tests are bash scripts in `tests/` that test the full mows binary.

Run all integration tests:

```bash
cd tests
./run-all.sh
```

Run specific tests:

```bash
./run-all.sh test-cli         # Run only CLI tests
./run-all.sh test-compose     # Run all compose-related tests
```

#### Test Runner Options

| Option | Environment Variable | Description |
|--------|---------------------|-------------|
| `-v, --verbose` | `VERBOSE=1` | Show test output in real-time |
| `-j, --jobs N` | `PARALLEL_JOBS=N` | Number of parallel jobs |
| `-k, --keep-output` | `KEEP_OUTPUT=1` | Keep test output directory |
| `--fail-fast` | `FAIL_FAST=1` | Stop on first failure |

Skip specific tests:

```bash
SKIP_TESTS="test-compose-up,test-self-update" ./run-all.sh
```

### Test Isolation

All tests use isolated configuration via `MPM_CONFIG_PATH`. See the Testing Guidelines section in CLAUDE.md for details on writing properly isolated tests.

## CI/CD Pipeline

The CI pipeline runs on GitHub Actions (`.github/workflows/publish-mows.yml`).

### Pipeline Stages

1. **Test Job** (all PRs and pushes)
   - Runs unit tests (`cargo test --release`)
   - Builds release binary for e2e tests
   - Runs integration tests

2. **Build Job** (tags and main branch only)
   - Builds static binaries for linux-amd64 and linux-arm64
   - Uses Docker BuildKit with GitHub Actions cache
   - Generates SHA256 checksums

3. **Release Job** (tags only)
   - Creates GitHub release
   - Uploads binaries and checksums
   - Publishes release notes

### Tests Skipped in CI

Some tests are skipped in CI due to environment limitations:

| Test | Reason |
|------|--------|
| `test-self-update` | Network-dependent, requires GitHub API |

Note: `test-compose-up` and `test-compose-cd` now run in CI using `MPM_MOCK_DOCKER=1` which provides a mock Docker client that simulates Docker operations without requiring a real Docker daemon.

The `test-self-update` test should be run locally before submitting PRs that affect self-update functionality.

### Triggering Builds

- **PRs:** Automatically run tests on changes to `utils/mows-cli/**`
- **Tags:** Create a tag like `mows-cli-v0.5.4` to trigger a release build
- **Manual:** Use "Run workflow" in GitHub Actions for manual builds

## Release Process

1. Update version in `Cargo.toml`
2. Update `CHANGELOG.md` (if exists)
3. Commit: `git commit -m "chore(mows): Bump version to X.Y.Z"`
4. Tag: `git tag mows-cli-vX.Y.Z`
5. Push: `git push && git push --tags`

The CI pipeline will automatically:
- Run all tests
- Build binaries for all platforms
- Create GitHub release with binaries and checksums

## Project Structure

```
utils/mows-cli/
├── src/
│   ├── main.rs              # Entry point, argv[0] detection, CLI routing
│   ├── cli.rs               # CLI argument definitions (clap)
│   ├── package_manager/     # Package manager (mows package-manager / mpm alias)
│   │   └── compose/         # Docker Compose functionality
│   │       ├── config.rs    # Global config (~/.config/mows.cloud/mows.yaml)
│   │       ├── manifest.rs  # Project manifest (mows-manifest.yaml)
│   │       ├── render.rs    # Template rendering pipeline
│   │       ├── up.rs        # compose up command
│   │       ├── install.rs   # compose install command
│   │       ├── update.rs    # compose update command
│   │       ├── secrets.rs   # Secrets management
│   │       └── checks/      # Pre/post deployment checks
│   ├── template/            # Standalone template rendering
│   ├── tools/               # Utility tools (jq, convert, etc.)
│   └── self_update/         # Self-update functionality
├── tests/                   # Integration tests (bash)
│   ├── run-all.sh           # Test runner
│   ├── lib/common.sh        # Shared test utilities
│   └── test-*.sh            # Individual test files
├── docs/                    # Documentation
├── build.sh                 # Docker build script
├── Dockerfile               # Multi-stage build for static binary
└── Cargo.toml               # Rust dependencies
```

## Debugging

### Enable Debug Logging

```bash
RUST_LOG=debug mows package-manager compose up
RUST_LOG=mows=trace mows package-manager compose up  # Even more verbose
```

### Inspect Rendered Templates

Use `--dry-run` to see what would be rendered without executing:

```bash
mows package-manager compose up --dry-run
```

Or render templates directly:

```bash
mows template ./templates/docker-compose.yaml -v values.yaml
```
