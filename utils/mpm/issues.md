# MOWS Issues and Improvements - Fifth Review (package_manager rename + full review)

Fifth comprehensive code review conducted 2026-02-01 after the pm-to-package_manager rename.
8-perspective parallel review examining 57 files changed, ~1600 lines added, ~11600 removed.

---

## Summary

| Perspective      | Critical | Major | Minor |
|------------------|----------|-------|-------|
| Security         | 1        | 3     | 5     |
| Technology/Rust  | 4        | 5     | 5     |
| DevOps           | 3        | 3     | 6     |
| Architecture     | 3        | 5     | 7     |
| QA               | 3        | 6     | 7     |
| Fine Taste       | 1        | 2     | 5     |
| Documentation    | 3        | 2     | 2     |
| Repository       | 4        | 2     | 3     |
| **TOTAL (raw)**  | **22**   | **28**| **40**|

**Note:** Many findings overlap across agents. The deduplicated unique issue count is listed below.

---

## Deduplicated Findings

### Critical Issues

#### ❌ C1. Git Staging Mismatch: Files at Wrong Path in Index (Repository)

**File:** Git index vs disk (`src/pm/compose/` in index, `src/package_manager/compose/` on disk)

Git tracks files as renames from `src/compose/` to `src/pm/compose/`, but the actual files on disk are at `src/package_manager/compose/`. The `src/package_manager/` directory shows as untracked (`??`). Committing in this state would produce a broken checkout.

**Fix:** Reset staging for compose files and re-add from `src/package_manager/` path. Stage `src/package_manager/` and unstage stale `src/pm/compose/` references.

---

#### ❌ C2. Untracked Workflow File - CI/CD Pipeline Not Active (DevOps, Repository)

**File:** `.github/workflows/publish-mows.yml` (untracked `??`)

New workflow file exists on disk but is untracked. Old `publish-mpm.yml` is deleted (`D`). CI/CD won't trigger on `mows-cli-v*` tags until this is committed.

**Fix:** Add and commit `publish-mows.yml` before pushing any release tags.

---

#### ❌ C3. TOCTOU Race in `ensure_mpm_symlink()` (Security, Architecture)

**File:** `src/self_update/update.rs:304-358`

Between the `symlink_metadata()` check and `symlink()` creation, another process could create a file at the target path. On multi-user systems, an attacker could exploit the window to redirect the `mpm` symlink.

**Exploitability:** Requires local access on a multi-user system. The window is small but real.

**Fix:** Use atomic operations or verify the created symlink's target after creation (which the code already does on lines 341-356). The existing post-creation verification mitigates this significantly. Consider also using a temp-name + rename approach for atomicity.

---

#### ❌ C4. README.md Verbose Example Has Stale `pm` Reference (Documentation)

**File:** `README.md:260`

Verbose mode example shows `mows -V pm compose up` which uses the old `pm` subcommand name instead of `package-manager`.

**Fix:** Change to `mows -V package-manager compose up`.

---

#### ❌ C5. Documentation Still References `mpm.yaml` Config Filename (Documentation)

**Files:** `docs/configuration.md:7,9,12,179`, `docs/compose/commands.md:51,215`, `docs/self-update.md:143`

Multiple documentation files reference `~/.config/mows.cloud/mpm.yaml` as the config file path and `MPM_CONFIG_PATH` as the environment variable. The implementation now uses `mows.yaml` as primary with `mpm.yaml` as legacy fallback, and `MOWS_CONFIG_PATH` as primary env var with `MPM_CONFIG_PATH` as legacy.

**Fix:** Update all docs to show `mows.yaml` as default config file and `MOWS_CONFIG_PATH` as primary env var, noting `MPM_CONFIG_PATH` as legacy fallback.

---

#### ❌ C6. Inconsistent HTTP Error Handling - Network Errors Use `Message` Variant (Technology, Fine Taste)

**File:** `src/self_update/update.rs:109,120,166,178,738,746`

HTTP errors from reqwest are wrapped in `MowsError::Message(format!("...: {}", e))` instead of using the existing `MowsError::Network(#[from] reqwest::Error)` variant. This loses the original error type and defeats the structured error system.

**Fix:** Use `?` operator to let `#[from]` handle conversion automatically, or add context wrappers. For lines where context is needed (e.g., "Failed to fetch latest release"), consider adding a dedicated error variant or using a wrapper pattern.

---

### Major Issues

#### ❌ M1. Redundant `use crate::error::IoResultExt` in `ensure_mpm_symlink()` (Technology, Fine Taste)

**File:** `src/self_update/update.rs:305`

`IoResultExt` is imported inside the function body but is already imported at module level (line 13).

**Fix:** Remove the local import on line 305.

---

#### ❌ M2. `ensure_mpm_symlink()` Error Handling Doesn't Distinguish Error Types (QA, Security)

**File:** `src/self_update/update.rs:333-335`

The `Err(_)` branch on `symlink_metadata()` catches all errors (ENOENT, EACCES, ENOTDIR, etc.) and treats them all as "path does not exist". Permission errors or filesystem corruption would be silently ignored.

**Fix:** Match on specific error kinds: treat `NotFound` as "proceed to create", propagate other errors.

---

#### ❌ M3. Tests Still Use `MPM_CONFIG_PATH` Instead of `MOWS_CONFIG_PATH` (DevOps, QA)

**File:** `tests/lib/common.sh:94,103`

Integration tests set `MPM_CONFIG_PATH` (legacy) for config isolation, not `MOWS_CONFIG_PATH` (primary). Tests don't exercise the primary env var path.

**Fix:** Change test setup to use `MOWS_CONFIG_PATH` as the primary variable.

---

#### ❌ M4. Missing Config Migration Tests (QA)

**File:** `src/package_manager/compose/config.rs:101-110`

Auto-migration from `mpm.yaml` to `mows.yaml` has no dedicated tests:
- No test for successful migration path
- No test for migration failure and fallback
- No test for concurrent access during migration

**Fix:** Add unit tests for migration success, failure, and edge cases.

---

#### ❌ M5. `unwrap_or()` on Tag Version Extraction (Technology)

**File:** `src/self_update/update.rs:557`

`target_tag.strip_prefix("mows-cli-v").unwrap_or(&target_tag)` silently falls back to using the full tag name if prefix stripping fails. This masks a logic error.

**Fix:** Use `.ok_or_else(|| MowsError::Message(...))` to fail explicitly if the tag format is unexpected.

---

#### ❌ M6. Visibility Inconsistency Between Parent and Child Modules (Architecture)

**File:** `src/package_manager/mod.rs:1` and `src/package_manager/compose/mod.rs`

Parent uses `pub(crate) mod compose` but compose internally uses `pub mod config` and `pub mod docker`. This leaks internal types beyond the intended boundary.

**Fix:** Change `pub mod config` and `pub mod docker` to `pub(crate) mod config` and `pub(crate) mod docker` in compose/mod.rs.

---

#### ❌ M7. `build_mpm_command()` Uses `MowsError::Message` for Internal Error (Fine Taste)

**File:** `src/cli.rs:384-386`

An internal structure error (subcommand not found in CLI definition) uses the generic `Message` variant. This should use a more appropriate variant.

**Fix:** Use `MowsError::Config(...)` or a dedicated variant to distinguish internal logic errors from user-facing messages.

---

#### ❌ M8. `issues.md` Has Stale `src/pm/` Path References (Repository)

**File:** `issues.md` (this file - previous version)

Previous issues.md referenced `src/pm/compose/config.rs` and similar paths that no longer exist after the rename to `src/package_manager/`.

**Fix:** Resolved by this rewrite.

---

### Minor Issues

#### ❌ m1. argv[0] Detection Cannot Be Exploited (Security - Informational)

**File:** `src/main.rs:59-68`

`is_mpm_invocation()` trusts argv[0], which can be spoofed. Not exploitable - worst case is wrong help output shown.

---

#### ❌ m2. Hardcoded SSH Key Without Rotation Plan (Security - Informational)

**File:** `src/self_update/update.rs:19-20`

Standard practice for self-updating tools. Key rotation creates bootstrap problem. No action needed.

---

#### ❌ m3. SSH Signature Verification Relies on String Matching (Security)

**File:** `src/self_update/update.rs:684-698`

Verification checks for "Good "git" signature for" in output. Git output format changes could break this. However, the underlying `ssh-keygen` verification is cryptographically sound; the string check is additional defense-in-depth.

---

#### ❌ m4. Cross-Device File Move Race Condition (Security)

**File:** `src/self_update/update.rs:31-46`

Between `fs::copy()` and `fs::remove_file()` in the EXDEV fallback, a race window exists. Mitigated by the backup/restore mechanism in `replace_binary()`.

---

#### ❌ m5. Excessive Cloning in `build_mpm_command()` (Technology)

**File:** `src/cli.rs:395-401`

Subcommands are cloned from the main CLI tree. Called during `shell_init()` and `manpage()` generation. Not a hot path but adds unnecessary allocations.

**Fix:** Cache the result or restructure to build command tree once.

---

#### ❌ m6. Verbose Flag Manually Re-defined in `build_mpm_command()` (Architecture)

**File:** `src/cli.rs:385-391`

Verbose flag is manually constructed in `build_mpm_command()` instead of being derived from the `Cli` struct definition.

**Fix:** Extract the verbose arg definition to a shared function.

---

#### ❌ m7. File Removal Uses `let _ =` to Silently Ignore Errors (Technology)

**File:** `src/self_update/update.rs:226,291`

Checksum file and backup file cleanup silently discard errors. Should at least log warnings.

**Fix:** Use `let _ = fs::remove_file(...).map_err(|e| tracing::warn!("...: {}", e));`

---

#### ❌ m8. Missing Integration Test for Symlink Equivalence (QA)

Missing end-to-end test verifying that `mpm compose up` and `mows package-manager compose up` produce equivalent behavior.

---

#### ❌ m9. `ensure_mpm_symlink()` Name vs Behavior Mismatch (Architecture)

**File:** `src/self_update/update.rs:296-358`

Function name says "ensure" (implying guarantee) but silently succeeds when it can't create the symlink (existing non-symlink file at path).

**Fix:** Rename to `create_mpm_symlink_if_possible()` or change behavior to return error when blocked.

---

#### ❌ m10. Hardcoded Network Timeouts (Technology)

**File:** `src/self_update/update.rs:22-26`

`HTTP_TIMEOUT_SECS` and `VERSION_CHECK_TIMEOUT_SECS` are hardcoded. No env var override available.

---

#### ❌ m11. `MowsError::TemplateExec` Auto-Converts Without Context (Technology)

**File:** `src/error.rs:84`

`#[from]` on template exec errors loses context about which template was being executed.

---

#### ❌ m12. `From<String>` and `From<&str>` for `MowsError` Enable Loose Error Handling (Technology)

**File:** `src/error.rs:202-213`

These backward-compatibility conversions allow `"string"?` to create generic `MowsError::Message` instead of proper typed errors.

---

#### ❌ m13. Dockerfile HEALTHCHECK/ENTRYPOINT Hardcoded (DevOps)

**File:** `Dockerfile:111-112`

Uses literal `./mows` instead of `${BINARY_NAME}`. Comment explains Docker doesn't expand ARGs in exec-form JSON, which is correct. This is intentional.

---

#### ❌ m14. Install Script Version Verification Regex Fragility (DevOps)

**File:** `scripts/install.sh:194`

Version verification uses `grep -oP '^mows \K[0-9]+\.[0-9]+\.[0-9]+'` which depends on exact output format of `mows version`.

---

#### ❌ m15. `MockDockerClient` Available in Production Code (Architecture)

**File:** `src/package_manager/compose/docker.rs:350-442`

`MockDockerClient` is always compiled (gated by env var, not `#[cfg(test)]`). This is intentional for CI mock support (`MPM_MOCK_DOCKER=1`) but adds ~60 lines of test infrastructure to the binary.

---

## Recommendations Priority

### Must Fix (Before Merge)

1. **C1** - Fix git staging: unstage `src/pm/compose/` and stage `src/package_manager/`
2. **C2** - Commit `publish-mows.yml` to git
3. **C4** - Fix stale `pm` reference in README.md:260
4. **C5** - Update docs to reference `mows.yaml` and `MOWS_CONFIG_PATH`
5. **M1** - Remove redundant `IoResultExt` import
6. **M3** - Update tests to use `MOWS_CONFIG_PATH`
7. **M8** - Resolved by this rewrite

### Should Fix (High Value)

8. **C3** - Improve `ensure_mpm_symlink()` TOCTOU mitigation
9. **C6** - Standardize HTTP error handling to use `Network` variant or `?`
10. **M2** - Distinguish error types in `symlink_metadata()` catch-all
11. **M4** - Add config migration tests
12. **M5** - Replace `unwrap_or` with explicit error on tag version extraction
13. **M6** - Fix module visibility inconsistency
14. **M7** - Use proper error variant in `build_mpm_command()`

### Nice to Have (Low Priority)

15. **m5** - Cache `build_mpm_command()` result
16. **m6** - Extract verbose flag definition to shared function
17. **m7** - Log warnings on file removal failures
18. **m8** - Add symlink equivalence integration test
19. **m9** - Rename `ensure_mpm_symlink()` to match actual behavior

---

## Previously Resolved Issues (from prior reviews)

The following issues from the fourth review have been resolved:

- **C1 (old)** `.expect()` in `build_mpm_command()` - Replaced with `ok_or_else()` returning `Result`
- **C2 (old)** Missing unit tests - Tests added for `is_mpm_invocation()`, `build_mpm_command()`, path extraction
- **C5 (old)** Error type named `MpmError` - Renamed to `MowsError` throughout
- **C6 (old)** Config filename `mpm.yaml` - Changed to `mows.yaml` with migration
- **C8 (old)** CLAUDE.md stale path - Updated to `src/package_manager/compose/config.rs`
- **M1/M2 (old)** Weak error types in `move_file()` and `update.rs` - Improved with `IoResultExt` and proper error constructors
- **M5 (old)** Silent skip in `ensure_mpm_symlink()` - Now logs at `warn` level
- **M7 (old)** `#[allow(dead_code)]` suppression - Partially addressed
- **M8 (old)** Incomplete argv[0] integration tests - Expanded in test-cli.sh
- **m7 (old)** No symlink target verification - Added post-creation verification
- **m10 (old)** No version string validation - Added `is_valid_semver()` check
- **m12 (old)** `MPM_CONFIG_PATH` not aliased - Added `MOWS_CONFIG_PATH` support with fallback

---

## Positive Observations

1. **Clean argv[0] detection** - Simple, correct approach with proper tests
2. **Backward compatibility** - `mpm` symlink strategy works across build, install, update, and completions
3. **Consistent tag format** - `mows-cli-v*` used consistently
4. **Improved error handling** - `IoResultExt` and `MowsError` constructors used throughout
5. **Dual completion/manpage generation** - Both `mows` and `mpm` completions properly generated
6. **Config migration** - Automatic migration from `mpm.yaml` to `mows.yaml` with fallback
7. **Test infrastructure** - Both `$MOWS_BIN` and `$MPM_BIN` properly supported
8. **Documentation** - All docs comprehensively updated with both invocation forms
