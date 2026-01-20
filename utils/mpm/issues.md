# MPM Issues and Improvements

Comprehensive code review conducted 2026-01-20 across 8 perspectives.

---

## Summary

| Perspective   | Critical | Major | Minor |
| ------------- | -------- | ----- | ----- |
| Security      | 0        | 2     | 5     |
| Rust/Tech     | 3        | 6     | 11    |
| DevOps        | 3        | 7     | 12    |
| Architecture  | 2        | 4     | 6     |
| QA            | 3        | 4     | 8     |
| Fine Taste    | 0        | 3     | 5     |
| Documentation | 1        | 4     | 6     |
| Repository    | 0        | 3     | 6     |

---

## Critical Issues

### 1. Race Condition in Config File Access

**File:** `src/compose/config.rs:114-152`
**Category:** Rust/Tech

Atomic write pattern doesn't protect against concurrent access from multiple `mpm` processes. Two processes could both read the config, modify different fields, and the last write wins (data loss).

**Recommendation:** Use file locking (e.g., `fs2` crate) or advisory locks before read-modify-write operations.

---

### 2. Unbounded Memory Growth in Template Rendering

**File:** `src/compose/render.rs:234-325`
**Category:** Rust/Tech

`visited` HashSet grows unbounded during directory traversal. Deep or wide directory trees with many symlinks could consume significant memory.

**Recommendation:** Add depth-based cleanup or limit the visited set size.

---

### 3. Missing Drop Implementation for PipelineBackup

**File:** `src/compose/render.rs:604-686`
**Category:** Rust/Tech

If panic occurs between `create` and `commit`/`restore`, backup directory is leaked. No `Drop` guard.

**Recommendation:** Implement `Drop` to auto-restore on panic (similar to RAII pattern).

---

### 4. Hardcoded Version in Dockerfile

**File:** `Dockerfile:3`
**Category:** DevOps

`ARG SERVICE_VERSION="0.2.0"` is hardcoded and outdated (current version is 0.5.3). Creates version inconsistency between binary and container metadata.

**Recommendation:** Pass version as build arg from build.sh extracted from Cargo.toml.

---

### 5. GitHub Actions Not Pinned to SHA

**File:** `.github/workflows/publish-mpm.yml`
**Category:** DevOps (Security)

GitHub Actions pinned to mutable tags (v3, v4) instead of immutable SHA hashes. Supply chain security vulnerability.

**Recommendation:** Pin to SHA hashes:

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

### 8. Excessive unwrap()/expect() in Production Code

**File:** 222 occurrences across 17 files
**Category:** QA

Extensive use of `.unwrap()` and `.expect()` can cause panics instead of graceful error handling.

**High-risk files:** `compose/update.rs`, `compose/install.rs`, `template/render.rs`, `self_update/update.rs`

**Recommendation:** Audit all `.unwrap()` calls and convert to proper `Result` error propagation.

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

#### 11. Path Traversal in Custom Values File Path

**File:** `src/compose/render.rs:121-133`

The validation prevents `..` and absolute paths but doesn't prevent subtle traversal attacks like `./templates/../../../etc/passwd`.

**Recommendation:** Use canonical path resolution and verify result is within expected directory.

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

#### 15. Blocking I/O in Port Health Checks

**File:** `src/compose/checks/health.rs:543-566`

Sequential TCP connection attempts with `sleep()` blocks main thread. With many ports, delays accumulate.

**Recommendation:** Use async or parallel checks with `rayon`.

---

#### 16. Unbounded Recursion in Dependency Collection

**File:** `src/tools/workspace_docker.rs:324-360`

No maximum depth limit for transitive dependency resolution. Circular dependencies could cause stack overflow.

**Recommendation:** Add depth counter and fail-safe maximum (e.g., 100 levels).

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

#### 19. LTO Disabled for ARM64 Cross-Compilation

**File:** `Dockerfile:76`

Link-Time Optimization disabled for ARM64 due to SIGILL errors. Creates performance/size parity issues.

**Recommendation:** Test with newer Zig/LLVM versions or use native ARM64 runners.

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

#### 33. Dead/Incomplete Build Command

**File:** `src/main.rs:56`

`Build` command defined but does nothing except print git root.

**Recommendation:** Implement or remove the command.

---

#### 34. Multiple Command Execution Patterns

**File:** 10 different files

External commands executed with varying patterns for error handling, output capture, status checking.

**Recommendation:** Create a command execution helper module.

---

## Minor Issues

### Security

#### 35. Secrets File Permissions Race Condition

**File:** `src/compose/render.rs:18-30`

File permissions set AFTER creation, creating brief window where file is world-readable.

**Recommendation:** Use `OpenOptions::mode(0o600)` at creation time.

---

#### 36. Git URL Validation Allows Insecure Protocols

**File:** `src/compose/install.rs:19`

Allows `git://` and `http://` protocols which can be MITM'd.

**Recommendation:** Only allow `https://`, `ssh://`, and `git@`.

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

#### 40. Non-idiomatic Error Conversion

**File:** Multiple files

`.map_err(|e| format!("...: {}", e))` loses error context and chains.

**Recommendation:** Consider `anyhow` or `thiserror`.

---

#### 41. Missing #[must_use] Annotations

**File:** Functions returning Result without side effects

Compiler won't warn if result is accidentally ignored.

---

#### 42. Magic Numbers Without Constants

**File:** `src/compose/render.rs`, `src/compose/config.rs`, `src/compose/up.rs`

File permissions `0o600`, `0o755`, timeouts like `30`, `2`, `1` used inline.

**Recommendation:** Create named constants with documentation.

---

#### 43. Inefficient Levenshtein Implementation

**File:** `src/template/error.rs:9-38`

Allocates new Vec on every call. Consider `strsim` crate.

---

#### 44. Redundant Clone in Hot Loop

**File:** `src/compose/secrets.rs:187`

`.clone()` called twice per entry in merge logic.

---

#### 45. Unnecessary String Allocation in find_git_root

**File:** `src/utils.rs:23`

`String::from_utf8_lossy` creates owned String when trimmed slice would suffice.

---

#### 46. Missing Timeout on Background Update Check

**File:** `src/self_update/update.rs:769-785`

1-second HTTP timeout but no overall function timeout. Network stack issues could hang CLI exit.

---

#### 47. Duplicate Template Rendering Logic

**File:** `template/render.rs`, `compose/render.rs`

Preamble generation and variable injection logic duplicated.

---

### DevOps

#### 48. No Binary Artifact Retention Policy

**File:** `.github/workflows/publish-mpm.yml:113`

Artifacts kept for default 90 days, accumulating storage costs.

**Recommendation:** Set `retention-days: 7` for PR builds.

---

#### 49. Docker Buildx Cache Scope Too Broad

**File:** `build.sh:53`

Cache scope only by architecture. PRs can corrupt main branch caches.

**Recommendation:** Use branch-aware scoping.

---

#### 50. UPX Compression Without Verification

**File:** `Dockerfile:85`

UPX applied without testing compressed binary works.

**Recommendation:** Add `/${BINARY_NAME} --version` after compression.

---

#### 51. No Build Reproducibility Verification

**File:** CI pipeline

Claims "reproducible builds" but no verification step.

---

#### 52. cargo-workspace-docker.toml Regeneration in Build

**File:** `build.sh:23-29`

Build script modifies source tree, violates build hermeticity.

**Recommendation:** Verify instead of regenerate.

---

#### 53. install.sh Not Validating Installed Version

**File:** `scripts/install.sh:195`

After installation, doesn't verify installed version matches expected.

---

#### 54. prepare-publish.sh Uses Non-Portable sed -i

**File:** `scripts/prepare-publish.sh`

GNU sed syntax breaks on macOS.

---

#### 55. No Healthcheck in Container Image

**File:** `Dockerfile` (app stage)

No HEALTHCHECK directive for containerized deployments.

---

#### 56. Missing Docker BuildKit Configuration

**File:** Build scripts

No explicit `DOCKER_BUILDKIT=1` set.

---

#### 57. .dockerignore Could Be Expanded

**File:** `.dockerignore`

Only excludes `target`, `dist`. Could also exclude `tests/`, `docs/`, `.git/`, `*.md`.

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

#### 64. Abbreviated Variable Names

**File:** `src/tools/workspace_docker.rs`

Uses: `ws_dep`, `dep`, `pkg`, `deps`, `rel_path`, `dep_path`, `td_name`

Should be: `workspace_dependency`, `dependency`, `package`, `dependencies`, `relative_path`, `dependency_path`, `transitive_dependency_name`

---

#### 65. Abbreviated Names in template/error.rs

**File:** `src/template/error.rs:10`

Parameters `a`, `b` should be `first_string`, `second_string` or similar.

---

#### 66. Comments That Restate Code

**File:** `src/compose/init.rs`

Line 57: "// Determine project name" - states WHAT not WHY.
Lines 290, 294, 308, 325: similar issues.

---

#### 67. #[allow(dead_code)] on Package::name

**File:** `src/tools/workspace_docker.rs:150-153`

If field is unused, remove it. If needed for deserialization, restructure.

---

#### 68. Empty Test Module in passthrough.rs

**File:** `src/compose/passthrough.rs:78-80`

Empty test module with comment. Either remove or add unit tests with mocks.

---

### Documentation

#### 69. Version Examples Outdated

**File:** README.md, docs/\*.md

Examples use `0.2.0`, `0.3.0` but current version is `0.5.3`.

**Recommendation:** Update to current version or use placeholders.

---

#### 70. Missing "drives" Command in README

**File:** README.md:123

`mpm tools drives` implemented but not in README tools section.

---

#### 71. cargo-workspace-docker Tool Under-Explained

**File:** `docs/tools/overview.md:250-308`

Missing: why tool exists, connection to build.sh, when to regenerate.

---

#### 72. Missing manpage/shell-init Documentation

**File:** User-facing docs

Commands exist but not documented.

---

#### 73. TODO in Code Without Context

**File:** `src/tools/jq.rs:116`

"TODO: Re-enable when standard library support is added" - no context.

---

#### 74. docker-compose.yaml Undocumented

**File:** `docker-compose.yaml`

No comments explaining purpose vs build.sh.

---

### Repository

#### 75. Duplicate Manifest Finding Logic

**File:** `compose/mod.rs`, `compose/update.rs:226`

`find_manifest` in update.rs duplicates logic in compose/mod.rs.

---

#### 76. yaml_indent Public But Internal

**File:** `src/yaml_indent.rs`

Declared `pub mod` but primarily internal utility. Re-exported via utils.rs.

---

#### 77. tests/ Lacks README

**File:** `tests/`

No documentation about test organization or how to run different suites.

---

#### 78. Utils Module is Catch-All

**File:** `src/utils.rs`

Mixes: git operations, I/O utilities, YAML parsing, indentation.

**Recommendation:** Split into `git.rs`, `io.rs`, `yaml.rs`.

---

#### 79. Inconsistent Option Handling in APIs

**File:** Various tool commands

Some use `&Option<PathBuf>`, some use `Option<&Path>`.

**Recommendation:** Use `Option<&Path>` consistently.

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
