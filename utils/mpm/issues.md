# MPM Issues and Improvements

Comprehensive code review conducted 2026-01-20 across 8 perspectives.

---

## Summary

| Perspective   | Critical | Major | Minor |
| ------------- | -------- | ----- | ----- |
| Security      | 0        | 1     | 5     |
| Rust/Tech     | 3        | 6     | 9     |
| DevOps        | 3        | 7     | 12    |
| Architecture  | 2        | 4     | 6     |
| QA            | 2        | 4     | 8     |
| Fine Taste    | 0        | 3     | 5     |
| Documentation | 1        | 4     | 4     |
| Repository    | 0        | 3     | 6     |

---

## Critical Issues

### 1. ~~Race Condition in Config File Access~~ RESOLVED

**File:** `src/compose/config.rs:114-152`
**Category:** Rust/Tech

**Status:** RESOLVED - Added file locking using the `fs2` crate:

- Added `acquire_lock()` helper that creates/opens a `.yaml.lock` file and acquires an exclusive lock
- `save()` now acquires an exclusive lock before writing
- Added `with_locked()` method for atomic read-modify-write operations that holds the lock for the entire operation
- Lock is automatically released when the file handle is dropped (RAII pattern)

~~Atomic write pattern doesn't protect against concurrent access from multiple `mpm` processes. Two processes could both read the config, modify different fields, and the last write wins (data loss).~~

~~**Recommendation:** Use file locking (e.g., `fs2` crate) or advisory locks before read-modify-write operations.~~

---

### 2. ~~Unbounded Memory Growth in Template Rendering~~ RESOLVED

**File:** `src/compose/render.rs:234-325`
**Category:** Rust/Tech

**Status:** RESOLVED - Added `MAX_VISITED_DIRECTORIES` constant (10,000) that limits the size of the `visited` HashSet. Returns a clear error message if the limit is exceeded, preventing unbounded memory growth while preserving symlink loop detection.

~~`visited` HashSet grows unbounded during directory traversal. Deep or wide directory trees with many symlinks could consume significant memory.~~

~~**Recommendation:** Add depth-based cleanup or limit the visited set size.~~

---

### 3. Missing Drop Implementation for PipelineBackup

**File:** `src/compose/render.rs:604-686`
**Category:** Rust/Tech

If panic occurs between `create` and `commit`/`restore`, backup directory is leaked. No `Drop` guard.

**Recommendation:** Implement `Drop` to auto-restore on panic (similar to RAII pattern).

---

### 4. ~~Hardcoded Version in Dockerfile~~ RESOLVED

**File:** `Dockerfile:3`
**Category:** DevOps

**Status:** RESOLVED - Updated build.sh to extract version from Cargo.toml and pass it as SERVICE_VERSION build arg. Dockerfile default changed to `0.0.0-dev` to make it clear when version isn't being passed.

~~`ARG SERVICE_VERSION="0.2.0"` is hardcoded and outdated (current version is 0.5.3). Creates version inconsistency between binary and container metadata.~~

~~**Recommendation:** Pass version as build arg from build.sh extracted from Cargo.toml.~~

---

### 5. ~~GitHub Actions Not Pinned to SHA~~ RESOLVED

**File:** `.github/workflows/publish-mpm.yml`
**Category:** DevOps (Security)

**Status:** RESOLVED - All GitHub Actions are now pinned to full SHA hashes with version comments. Added `.github/dependabot.yml` to automatically update pinned SHAs weekly.

~~GitHub Actions pinned to mutable tags (v3, v4) instead of immutable SHA hashes. Supply chain security vulnerability.~~

~~**Recommendation:** Pin to SHA hashes:~~

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

---

### 6. Running as Root in Final Container

**File:** `Dockerfile:93-102`
**Category:** DevOps (Security)

No USER directive - container runs as root by default.

**Recommendation:** Document this limitation or add non-root user for non-scratch base images.

---

### 7. ~~Test Isolation Violations~~ RESOLVED

**File:** Multiple test files
**Category:** QA

**Status:** RESOLVED - Added `TestConfigGuard` RAII helper in `src/compose/config.rs` that provides:

- Automatic mutex for concurrent test safety
- Temporary file creation for isolated config
- Automatic cleanup on drop
- 5 new tests demonstrating proper isolation pattern

Updated CLAUDE.md with documentation on using `TestConfigGuard`.

~~Several tests do NOT set `MPM_CONFIG_PATH` despite modifying config state. Could corrupt developer's actual config file.~~

~~**Recommendation:** Audit all tests calling `MpmConfig::load()` or `MpmConfig::save()` to ensure they set MPM_CONFIG_PATH.~~

---

### 8. ~~Excessive unwrap()/expect() in Production Code~~ RESOLVED

**File:** 222 occurrences across 17 files
**Category:** QA

**Status:** RESOLVED - Audited all 222 occurrences across 17 files:

- 215+ occurrences are in test code (appropriate - tests should panic on failures)
- Fixed 5 production code issues:
    - `compose/update.rs`: 2 fixes - `parent().unwrap()` → `parent().ok_or_else()`
    - `tools/jq.rs`: 1 fix - proper JSON serialization error propagation
    - `template/error.rs`: 2 fixes - `map_or` pattern instead of `is_none()/unwrap()`
- 1 `expect()` in `health.rs` retained (compile-time constant initialization, appropriate use)

~~Extensive use of `.unwrap()` and `.expect()` can cause panics instead of graceful error handling.~~

~~**High-risk files:** `compose/update.rs`, `compose/install.rs`, `template/render.rs`, `self_update/update.rs`~~

~~**Recommendation:** Audit all `.unwrap()` calls and convert to proper `Result` error propagation.~~

---

### 9. Missing Error Scenario Tests

**File:** Throughout codebase
**Category:** QA

Limited testing of error paths: network failures, corrupted YAML, permission errors, git failures, Docker unavailable.

**Recommendation:** Add comprehensive error scenario tests.

---

### 10. ~~CLAUDE.md Missing CI/CD Context~~ RESOLVED

**File:** `CLAUDE.md`, `docs/development.md`
**Category:** Documentation

**Status:** RESOLVED - Created comprehensive `docs/development.md` covering:

- Building (development, release, static Docker builds)
- Build options and environment variables
- Cross-compilation notes (ARM64 via cargo-zigbuild)
- Running unit tests and integration tests
- Tests skipped in CI and why
- CI/CD pipeline stages and triggers
- Release process
- Project structure
- Debugging tips

Updated CLAUDE.md with quick reference and link to full guide.
Updated README.md with link to development guide.

~~Missing: how to run full test suite locally, what tests are skipped in CI and why, build.sh usage, cross-compilation notes.~~

~~**Recommendation:** Add sections on testing, building, and CI/CD pipeline.~~

---

## Major Issues

### Security

#### 11. ~~Path Traversal in Custom Values File Path~~ RESOLVED

**File:** `src/compose/render.rs:121-133`

**Status:** RESOLVED - Replaced string-based validation with proper canonical path resolution:

- Added `validate_path_within_dir()` function that canonicalizes both paths
- Verifies resolved path starts with the base directory after symlink resolution
- Detects traversal via `..`, symlinks pointing outside, and other normalization tricks
- Added 4 tests: valid paths, absolute paths, traversal, and symlink traversal

~~The validation prevents `..` and absolute paths but doesn't prevent subtle traversal attacks like `./templates/../../../etc/passwd`.~~

~~**Recommendation:** Use canonical path resolution and verify result is within expected directory.~~

---

#### 12. ~~Template Functions Allow Shell Execution~~ INVALID

**File:** `src/template/render.rs:24`, `src/compose/render.rs:175`

**Status:** NOT AN ISSUE - Reviewed gtmpl-ng source code (`~/projects/gtmpl-rust`). The `all_functions()` provides 155 safe template functions:

- 152 Helm-compatible: string manipulation, math, crypto hashes, encoding, lists, dicts, regex, paths, JSON/YAML
- 3 mows-specific: `mowsRandomString`, `mowsDigest`, `mowsJoinDomain`

**No shell execution functions exist.** The "exec" in gtmpl-ng refers to "template execution" (rendering), not shell commands.

~~Templates use `gtmpl-ng` with `all_functions()` which includes shell execution capabilities.~~

~~**Recommendation:** Whitelist template functions instead of using `all_functions()`, remove shell execution.~~

---

### Rust/Tech

#### 13. ~~String-Based Error Handling Throughout Codebase~~ RESOLVED

**File:** All modules
**Category:** Architecture

**Status:** RESOLVED - Migrated entire codebase to use `MpmError` enum with `thiserror`. Created `src/error.rs` with:

- `MpmError` enum with variants: Git, Docker, Config, Manifest, Template, Validation, Jq, Message, Io, YamlParse, YamlSerialize, Command, Path
- Helper constructors for common error types
- `IoResultExt` trait for ergonomic IO error context
- All modules now use `Result<T, MpmError>` instead of `Result<T, String>`

~~Entire application uses `Result<T, String>` for error handling. Loses type safety, prevents pattern matching, makes recovery impossible.~~

~~**Recommendation:** Define proper error enums using `thiserror` or `anyhow`.~~

---

#### 14. ~~String Allocation in Hot Path (YAML Indent)~~ RESOLVED

**File:** `src/yaml_indent.rs:49-134`

**Status:** RESOLVED - Migrated entire workspace from deprecated `serde-yaml` to `serde-yaml-neo` (v0.10.0) and updated all YAML serialization to use native `to_string_with_indent()` API.

Changes made:

- Replaced `serde_yaml::to_string()` + `yaml_with_indent()` post-processing with `serde_yaml_neo::to_string_with_indent()` in:
    - `src/tools/object.rs` (4 places)
    - `src/compose/render.rs` (1 place)
    - `src/compose/update.rs` (1 place)
- The `yaml_indent.rs` module is kept for backwards compatibility but no longer used in hot paths

~~Allocates new `String` for every line with `format!` and `" ".repeat()`. For large YAML files, creates many temporary allocations.~~
~~Move to our own fork of serde-yaml and implement it properly there~~

~~**Recommendation:** Pre-allocate output buffer capacity, reuse indent strings.~~

---

#### 15. ~~Blocking I/O in Port Health Checks~~ RESOLVED

**File:** `src/compose/checks/health.rs:543-566`

**Status:** RESOLVED - Refactored `collect_port_status` to use rayon for parallel TCP connection checks. Port checks are now collected first, then checked in parallel using `par_iter()`, and results are grouped back to containers.

~~Sequential TCP connection attempts with `sleep()` blocks main thread. With many ports, delays accumulate.~~

~~**Recommendation:** Use async or parallel checks with `rayon`.~~

---

#### 16. ~~Unbounded Recursion in Dependency Collection~~ RESOLVED

**File:** `src/tools/workspace_docker.rs:324-360`

**Status:** RESOLVED - Added `MAX_DEPENDENCIES` constant (1000) as a fail-safe limit. The function already uses iterative processing with a `processed` HashSet to prevent infinite loops, but now also returns an error if the limit is exceeded.

~~No maximum depth limit for transitive dependency resolution. Circular dependencies could cause stack overflow.~~

~~**Recommendation:** Add depth counter and fail-safe maximum (e.g., 100 levels).~~

---

#### 17. Tight Coupling - Direct Docker Command Execution

**File:** `compose/up.rs`, `compose/checks/`
**Category:** Architecture

Docker commands executed directly via `std::process::Command` scattered throughout with no abstraction layer. Untestable, no way to support alternative runtimes.

**Recommendation:** Create a `DockerClient` trait abstraction.

---

### DevOps

#### 18. No Supply Chain Security Measures

**File:** CI/CD pipeline

Missing: SBOM generation, dependency vulnerability scanning, container image scanning, SLSA attestations.

**Recommendation:** Add cargo-audit, Trivy scanning, SBOM generation to CI.

---

#### 19. ~~LTO Disabled for ARM64 Cross-Compilation~~ RESOLVED

**File:** `Dockerfile:76`

**Status:** RESOLVED - Updated Zig from 0.13.0 to 0.15.2 and enabled thin LTO for ARM64 cross-compilation. The SIGILL issue was caused by older Zig/LLVM versions. Thin LTO provides most of the optimization benefits while being more compatible with cross-compilation.

~~Link-Time Optimization disabled for ARM64 due to SIGILL errors. Creates performance/size parity issues.~~

~~**Recommendation:** Test with newer Zig/LLVM versions or use native ARM64 runners.~~

---

#### 20. ~~Flaky Tests Skipped in CI (33%)~~ Tests Skipped in CI (22%)

**File:** `.github/workflows/publish-mpm.yml:58`

**PARTIALLY RESOLVED:** Fixed test-compose-cd (was a bug in YAML generation, not flaky). Now only 2 out of 9 tests skipped: test-compose-up (requires Docker daemon), test-self-update (requires network).

**Remaining:** The 2 skipped tests have legitimate environment requirements (Docker daemon, GitHub API access) that aren't available in CI.

---

#### 21. cargo-chef Git Revision Pinned to Fork

**File:** `Dockerfile:17`

Using specific git revision from a fork instead of official cargo-chef release. No automatic updates.

**Recommendation:** Document why fork is needed, open PR upstream, or switch to official.

---

#### 22. Build Cache Not Optimized for Monorepo

**File:** `.github/workflows/publish-mpm.yml:40`

Cache key uses `utils/mpm/Cargo.lock` but file is at repository root.

**Recommendation:** Fix path to `${{ hashFiles('**/Cargo.lock') }}` or `Cargo.lock`.

---

### QA

#### 23. Secrets Handling Edge Cases Untested

**File:** `src/compose/secrets.rs`

Missing tests: incorrect permissions, binary data, very long values, concurrent regeneration, locked files.

---

#### 24. Git Operations Error Handling Untested

**File:** `compose/update.rs`, `compose/install.rs`

Missing tests: merge conflicts, auth failures, network interruptions, corrupted repos, detached HEAD.

---

#### 25. Template Rendering Security Untested

**File:** `src/template/render.rs`

Missing tests: filesystem access attempts, recursive expansion limits, memory exhaustion, code injection.

---

### Architecture

#### 26. Module Organization - Unclear Boundaries in Compose

**File:** `compose/` module

`render.rs` (888 lines) handles templates, secrets, backups, Docker Compose, and directory setup. Secrets split between `secrets.rs` and `render.rs`.

**Recommendation:** Restructure into config/, docker/, rendering/, orchestration/ subdirectories.

---

#### 27. Duplicate ComposeConfig Type Names

**File:** `compose/config.rs`, `compose/manifest.rs`

Two different types named `ComposeConfig` with different purposes.

**Recommendation:** Rename to distinguish: `GlobalComposeConfig` vs `ManifestComposeConfig`.

---

### Documentation

#### 28. Missing Reproducible Builds Documentation

**File:** Missing

Recent commit added binary integrity verification but no user-facing documentation explaining what it means or how to verify.

**Recommendation:** Create `docs/reproducible-builds.md`.

---

#### 29. Missing Build Process Documentation

**File:** Missing

build.sh supports many options (PROFILE, TARGETARCH, cache modes) but none documented.

**Recommendation:** Create `docs/building.md` or add section in README.

---

#### 30. Inconsistent Source Code Doc Comments

**File:** Multiple files

Files with minimal coverage: `compose/up.rs` (1 comment), `compose/init.rs` (12 comments for many complex functions).

**Recommendation:** Add doc comments to public functions and modules.

---

#### 31. Missing Module-Level Documentation

**File:** `src/**/mod.rs` files

No `//!` module doc comments explaining purpose or architecture.

---

### Repository

#### 32. Duplicate Values File Finding Logic

**File:** `compose/render.rs:117`, `compose/update.rs:249`, `template/variables.rs:89`

Three separate implementations of nearly identical logic for finding values files.

**Recommendation:** Consolidate into a single shared function.

---

#### 33. ~~Dead/Incomplete Build Command~~ RESOLVED

**File:** `src/main.rs:56`

**Status:** RESOLVED - Removed the incomplete Build command from cli.rs and main.rs.

~~`Build` command defined but does nothing except print git root.~~

~~**Recommendation:** Implement or remove the command.~~

---

#### 34. Multiple Command Execution Patterns

**File:** 10 different files

External commands executed with varying patterns for error handling, output capture, status checking.

**Recommendation:** Create a command execution helper module.

---

## Minor Issues

### Security

#### 35. ~~Secrets File Permissions Race Condition~~ RESOLVED

**File:** `src/compose/render.rs:18-30`

**Status:** RESOLVED - Changed `write_secret_file` to use `OpenOptions::new().mode(SECRET_FILE_MODE)` which sets permissions atomically at file creation, eliminating the race condition window.

~~File permissions set AFTER creation, creating brief window where file is world-readable.~~

~~**Recommendation:** Use `OpenOptions::mode(0o600)` at creation time.~~

---

#### 36. ~~Git URL Validation Allows Insecure Protocols~~ RESOLVED

**File:** `src/compose/install.rs:19`

**Status:** RESOLVED - Changed `validate_git_url` to only allow secure protocols: `https://`, `ssh://`, and `git@`. Insecure protocols (`http://`, `git://`) are now rejected with a clear error message.

~~Allows `git://` and `http://` protocols which can be MITM'd.~~

~~**Recommendation:** Only allow `https://`, `ssh://`, and `git@`.~~

---

#### 37. Build Script Execution Risk (Mitigated)

**File:** `src/self_update/update.rs:455-460`

Executes `./build.sh` from cloned repo. Mitigated by SSH signature verification.

---

#### 38. No Certificate Pinning for Self-Update

**File:** `src/self_update/update.rs:13-14`

GitHub URLs hardcoded but no additional validation beyond HTTPS.

**Recommendation:** Consider certificate pinning for critical infrastructure.

---

#### 39. Symlink Loop Detection Can Be Slow

**File:** `src/compose/render.rs:266-281`

Canonicalize can be slow with many symlinks. Mitigated by MAX_DIRECTORY_DEPTH.

---

### Rust/Tech

#### 40. ~~Non-idiomatic Error Conversion~~ RESOLVED

**File:** Multiple files

**Status:** RESOLVED - Converted `.map_err(|e| format!(...))` patterns to use proper error extension traits:

- `IoResultExt::io_context()` for I/O errors (preserves source error chain)
- `TomlResultExt::toml_context()` for TOML parsing errors
- `MpmError::command()` for command execution errors

Files updated: `drives.rs`, `workspace_docker.rs`, `manpage.rs`, `shell_init.rs`

~~`.map_err(|e| format!("...: {}", e))` loses error context and chains.~~

~~**Recommendation:** Consider `anyhow` or `thiserror`.~~

---

#### 41. ~~Missing #[must_use] Annotations~~ NOT NEEDED

**File:** Functions returning Result without side effects

**Status:** NOT NEEDED - Rust already warns on unused `Result` and `Option` values by default. Adding explicit `#[must_use]` annotations would be redundant for most cases.

~~Compiler won't warn if result is accidentally ignored.~~

---

#### 42. ~~Magic Numbers Without Constants~~ RESOLVED

**File:** `src/compose/render.rs`, `src/compose/config.rs`, `src/compose/up.rs`

**Status:** RESOLVED - Extracted all magic numbers to documented constants:

- `up.rs`: `CONTAINER_READY_TIMEOUT`, `CONTAINER_POLL_INTERVAL`, `CONTAINER_STARTUP_DELAY`
- `render.rs`: `SECRET_FILE_MODE` (0o600), `DIRECTORY_MODE` (0o755)
- `config.rs`: `CONFIG_FILE_MODE` (0o600)
- `health.rs`: `HTTP_REQUEST_TIMEOUT`, `TCP_CONNECT_TIMEOUT`

~~File permissions `0o600`, `0o755`, timeouts like `30`, `2`, `1` used inline.~~

~~**Recommendation:** Create named constants with documentation.~~

---

#### 43. ~~Inefficient Levenshtein Implementation~~ RESOLVED

**File:** `src/template/error.rs:9-38`

**Status:** RESOLVED - Replaced 30-line custom implementation with `strsim` crate.

~~Allocates new Vec on every call. Consider `strsim` crate.~~

---

#### 44. ~~Redundant Clone in Hot Loop~~ RESOLVED

**File:** `src/compose/secrets.rs:187`

**Status:** RESOLVED - No `.clone()` calls exist in the merge logic. The code uses references and `format!()` which doesn't require cloning.

~~`.clone()` called twice per entry in merge logic.~~

---

#### 45. ~~Unnecessary String Allocation in find_git_root~~ NOT AN ISSUE

**File:** `src/utils.rs:23`

**Status:** NOT AN ISSUE - `String::from_utf8_lossy` returns `Cow<str>`, not `String`. It only allocates if there are invalid UTF-8 bytes (rare for git output). The `.trim()` returns a borrowed `&str` slice, which `PathBuf::from()` accepts directly.

~~`String::from_utf8_lossy` creates owned String when trimmed slice would suffice.~~

---

#### 46. ~~Missing Timeout on Background Update Check~~ NOT AN ISSUE

**File:** `src/self_update/update.rs:769-785`

**Status:** NOT AN ISSUE - The reqwest `timeout()` is a **total request timeout** (not just HTTP-level), covering the entire operation: DNS resolution, TCP connection, TLS handshake, request sending, and response receiving. Combined with `connect_timeout()`, any network stack hang will timeout after 1 second. The subsequent config file operations are local disk I/O.

~~1-second HTTP timeout but no overall function timeout. Network stack issues could hang CLI exit.~~

---

#### 47. ~~Duplicate Template Rendering Logic~~ RESOLVED

**File:** `template/render.rs`, `compose/render.rs`

**Status:** RESOLVED - Extracted shared `render_template_string()` function in `template/render.rs` that handles:

- Template setup with all gtmpl functions
- Variable preamble generation (`{{- $varname := .varname }}`)
- Parsing and rendering with proper error handling

Both `template/render.rs` and `compose/render.rs` now use this shared function, eliminating ~80 lines of duplicated code.

~~Preamble generation and variable injection logic duplicated.~~

---

### DevOps

#### 48. ~~No Binary Artifact Retention Policy~~ RESOLVED

**File:** `.github/workflows/publish-mpm.yml:113`

**Status:** RESOLVED - Added `retention-days: 7` to artifact upload step.

~~Artifacts kept for default 90 days, accumulating storage costs.~~

~~**Recommendation:** Set `retention-days: 7` for PR builds.~~

---

#### 49. Docker Buildx Cache Scope Too Broad

**File:** `build.sh:53`

Cache scope only by architecture. PRs can corrupt main branch caches.

**Recommendation:** Use branch-aware scoping.

---

#### 50. ~~UPX Compression Without Verification~~ RESOLVED

**File:** `Dockerfile:85`

**Status:** RESOLVED - Added `/${BINARY_NAME} --version` verification step after UPX compression to ensure the compressed binary still works.

~~UPX applied without testing compressed binary works.~~

~~**Recommendation:** Add `/${BINARY_NAME} --version` after compression.~~

---

#### 51. No Build Reproducibility Verification

**File:** CI pipeline

Claims "reproducible builds" but no verification step.

---

#### 52. cargo-workspace-docker.toml Regeneration in Build

**File:** `build.sh:23-29`

Build script modifies source tree, violates build hermeticity.

**Recommendation:** Verify instead of regenerate.

**This is fixed by addressing the bigger issue of generating this whole stuff inside the container, also fixing the issue with cargo-chef**

---

#### 53. ~~install.sh Not Validating Installed Version~~ RESOLVED

**File:** `scripts/install.sh:195`

**Status:** RESOLVED - Added version verification after installation:
- Captures installed version from `mpm --version` output
- Compares against expected version that was downloaded
- Fails with clear error if versions don't match

~~After installation, doesn't verify installed version matches expected.~~

---

#### 54. ~~prepare-publish.sh Uses Non-Portable sed -i~~ RESOLVED

**File:** `scripts/prepare-publish.sh`

**Status:** RESOLVED - Added portable `sedi()` helper function that detects OS and uses `sed -i ''` on macOS, `sed -i` on Linux. Replaced all `sed -i` calls with `sedi`.

~~GNU sed syntax breaks on macOS.~~

---

#### 55. No Healthcheck in Container Image

**File:** `Dockerfile` (app stage)

No HEALTHCHECK directive for containerized deployments.

---

#### 56. Missing Docker BuildKit Configuration

**File:** Build scripts

No explicit `DOCKER_BUILDKIT=1` set.

---

#### 57. ~~.dockerignore Could Be Expanded~~ RESOLVED

**File:** `.dockerignore`

**Status:** RESOLVED - Expanded .dockerignore to exclude `.git`, `.github`, `tests`, `docs`, `*.md` (except README.md), `.vscode`, `.idea`, and editor swap files.

~~Only excludes `target`, `dist`. Could also exclude `tests/`, `docs/`, `.git/`, `*.md`.~~

---

### QA

#### 58. Manifest Validation Limited

**File:** `src/compose/manifest.rs`

Only 6 unit tests, mostly serialization. Missing: invalid version, missing fields, unknown fields, malformed structures.

---

#### 59. Config File Race Conditions Untested

**File:** `src/compose/config.rs`

Atomic write implemented but no concurrent tests.

---

#### 60. Path Traversal Attack Testing Limited

**File:** `compose/install.rs`

Good sanitization but missing: Unicode normalization, mixed encoding, case-sensitivity bypass tests.

---

#### 61. Tool Subcommands Input Validation Limited

**File:** `src/tools/*`

Missing tests: extremely large files, binary files, invalid UTF-8, circular references, deep nesting.

---

#### 62. Self-Update Attack Simulation Missing

**File:** `src/self_update/update.rs`

Missing: MITM simulation, checksum mismatch, signature failure, binary replacement race tests.

---

#### 63. Template Variable Conflict Tests Missing

**File:** `src/template/variables.rs`

Missing: conflicting keys, circular references, very large files.

---

### Fine Taste

#### 64. Abbreviated Variable Names - RESOLVED

**File:** `src/tools/workspace_docker.rs`

Uses: `ws_dep`, `dep`, `pkg`, `deps`, `rel_path`, `dep_path`, `td_name`

Should be: `workspace_dependency`, `dependency`, `package`, `dependencies`, `relative_path`, `dependency_path`, `transitive_dependency_name`

**Resolution:** Renamed all abbreviated variable names to their full descriptive forms.

---

#### 65. Abbreviated Names in template/error.rs - RESOLVED

**File:** `src/template/error.rs:10`

Parameters `a`, `b` should be `first_string`, `second_string` or similar.

**Resolution:** No longer applicable - the levenshtein function is now imported from the `strsim` crate rather than being implemented locally.

---

#### 66. Comments That Restate Code - RESOLVED

**File:** `src/compose/init.rs`

Line 57: "// Determine project name" - states WHAT not WHY.
Lines 290, 294, 308, 325: similar issues.

**Resolution:** Removed redundant comments that merely restated what the code does (e.g., "// Find Dockerfiles", "// Generate and write X"). Kept comments that explain WHY something is done.

---

#### 67. ~~#[allow(dead_code)] on Package::name~~ RESOLVED

**File:** `src/tools/workspace_docker.rs:150-153`

**Status:** RESOLVED - Removed the unused `name` field from the `Package` struct entirely since it was not needed for deserialization.

~~If field is unused, remove it. If needed for deserialization, restructure.~~

---

#### 68. ~~Empty Test Module in passthrough.rs~~ RESOLVED

**File:** `src/compose/passthrough.rs:78-80`

**Status:** RESOLVED - Removed the empty test module. Integration tests cover this functionality.

~~Empty test module with comment. Either remove or add unit tests with mocks.~~

---

### Documentation

#### 69. Version Examples Outdated

**File:** README.md, docs/\*.md

Examples use `0.2.0`, `0.3.0` but current version is `0.5.3`.

**Recommendation:** Update to current version or use placeholders.

---

#### 70. ~~Missing "drives" Command in README~~ RESOLVED

**File:** README.md:123

**Status:** RESOLVED - Added `mpm tools drives` to the README tools section.

~~`mpm tools drives` implemented but not in README tools section.~~

---

#### 71. ~~cargo-workspace-docker Tool Under-Explained~~ RESOLVED

**File:** `docs/tools/overview.md:250-308`

**Status:** RESOLVED - Added comprehensive documentation including:

- "Why This Tool Exists" section explaining the problem it solves
- "When to Regenerate" section with clear guidance
- Improved structure with proper headings

~~Missing: why tool exists, connection to build.sh, when to regenerate.~~

---

#### 72. Missing manpage/shell-init Documentation

**File:** User-facing docs

Commands exist but not documented.

---

#### 73. ~~TODO in Code Without Context~~ RESOLVED

**File:** `src/tools/jq.rs:116`

**Status:** RESOLVED - Added detailed context including GitHub issue link (https://github.com/01mf02/jaq/issues/56) and explanation of what stdlib functions are missing.

~~"TODO: Re-enable when standard library support is added" - no context.~~

---

#### 74. ~~docker-compose.yaml Undocumented~~ RESOLVED

**File:** `docker-compose.yaml`

**Status:** RESOLVED - Added header comment explaining:
- Enables `docker compose build` as alternative to build.sh
- Marks package for `cargo-workspace-docker --all` detection
- Points to build.sh for production builds

~~No comments explaining purpose vs build.sh.~~

---

### Repository

#### 75. ~~Duplicate Manifest Finding Logic~~ RESOLVED

**File:** `compose/mod.rs`, `compose/update.rs:226`

**Status:** RESOLVED - Extracted shared `find_manifest_file_from()` function in mod.rs:
- Walks UP parent directories and returns the manifest file path
- Used by both `find_manifest_dir()` in mod.rs and update.rs
- Removed duplicate `find_manifest()` from update.rs (~25 lines)

~~`find_manifest` in update.rs duplicates logic in compose/mod.rs.~~

---

#### 76. ~~yaml_indent Public But Internal~~ RESOLVED

**File:** `src/yaml_indent.rs`

**Status:** RESOLVED - Changed `pub mod yaml_indent` to `mod yaml_indent` in main.rs. The module is now internal-only, with needed functions re-exported via utils.rs. Also removed unused `yaml_with_indent` from the re-export.

~~Declared `pub mod` but primarily internal utility. Re-exported via utils.rs.~~

---

#### 77. tests/ Lacks README

**File:** `tests/`

No documentation about test organization or how to run different suites.

---

#### 78. ~~Utils Module is Catch-All~~ RESOLVED

**File:** `src/utils.rs`

**Status:** RESOLVED - Split `utils.rs` into a `utils/` directory module with:
- `utils/git.rs` - git operations (`find_git_root`)
- `utils/io.rs` - I/O utilities (`read_input`, `write_output`)
- `utils/yaml.rs` - YAML parsing (`parse_yaml`, `format_yaml_error`)
- `utils/mod.rs` - re-exports for backwards compatibility

~~Mixes: git operations, I/O utilities, YAML parsing, indentation.~~

---

#### 79. ~~Inconsistent Option Handling in APIs~~ RESOLVED

**File:** Various tool commands

**Status:** RESOLVED - Standardized all tool command APIs to use `Option<&Path>` instead of `&Option<PathBuf>`:
- `utils/io.rs`: `read_input`, `write_output`
- `tools/convert.rs`: `json_to_yaml`, `yaml_to_json`, `prettify_json`
- `tools/jq.rs`: `jq_command`
- `tools/object.rs`: `expand_object_command`, `flatten_object_command`
- `tools/workspace_docker.rs`: `workspace_docker_command`
- Updated main.rs call sites to use `.as_deref()`

~~Some use `&Option<PathBuf>`, some use `Option<&Path>`.~~

---

#### 80. FlattenLabelsError Underutilized

**File:** `src/tools/object.rs`

Custom error type defined but immediately converted to String. Good pattern - extend to other modules.

---

## Previously Noted (Keeping for Reference)

- tab lines
- file linting based on schema
- warning for empty variables
- template before and after render line comparison side by side
