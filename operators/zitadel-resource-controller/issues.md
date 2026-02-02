# Code Review Issues

## Summary

**Resolved: 22 / 33 issues** (5/6 critical, 7+1 N/A of 16 major, 8+1 N/A of 11 minor)

| Perspective   | Critical | Major | Minor |
|---------------|----------|-------|-------|
| Security      | 2        | 3     | 2     |
| Technology    | 1        | 3     | 3     |
| DevOps        | 0        | 2     | 2     |
| Architecture  | 1        | 2     | 2     |
| QA            | 1        | 4     | 1     |
| Fine Taste    | 1        | 3     | 2     |
| Documentation | 1        | 1     | 0     |
| Repository    | 0        | 1     | 1     |

---

## Critical

### SEC-1: Path traversal in file credential target
- **File**: `src/credential_targets/file.rs:19`
- **Perspective**: Security
- **Status**: FIXED - Added path validation rejecting `..` components and requiring absolute paths.
- **Issue**: `file_target.path` is written to directly without validation. A Docker label like `zrc.resource.project.applications.0.clientDataTarget.file.path=/etc/important_config` will overwrite arbitrary files.
- **Recommendation**: Validate that the resolved path is within an allowed base directory. Reject paths containing `..` components.

### SEC-2: Empty vault token when using Token auth method
- **File**: `src/credential_targets/vault.rs:60`
- **Perspective**: Security, QA
- **Status**: FIXED - Added validation that errors out when vault_auth_method is Token but vault_token is empty.
- **Issue**: When `vault_auth_method` is `Token` but `VAULT_TOKEN` is not set, `unwrap_or_default()` produces an empty string sent to Vault. Should fail fast.
- **Recommendation**: Validate at startup: if `vault_auth_method == Token`, require `vault_token` to be non-empty. Error out during config initialization.

### SEC-3: Path traversal in Vault secret engine paths
- **File**: `src/credential_targets/vault.rs:16-24`
- **Perspective**: Security
- **Status**: FIXED - Added `validate_path_component()` rejecting `..`, `/`, and empty values for all Vault path interpolations.
- **Issue**: `resource_scope`, `kubernetes_auth_engine_name`, and `secret_engine_name` from user-controlled labels are interpolated into Vault paths without validation. `../` sequences could bypass scope isolation.
- **Recommendation**: Validate that these values contain only alphanumeric characters, hyphens, and underscores. Reject any containing `..` or `/`.

### ARCH-1: Error types in credential_targets use ControllerError directly
- **File**: `src/credential_targets/mod.rs:12`, `vault.rs:50`, `file.rs:8`
- **Perspective**: Architecture
- **Issue**: credential_targets functions return `Result<(), ControllerError>`, coupling the credential layer to controller-level error types. This violates separation of concerns and makes the module harder to test in isolation.
- **Recommendation**: Define a scoped `CredentialTargetError` enum using `thiserror`. Convert to `ControllerError` at the boundary in `mod.rs`.

### TASTE-1: `cleanup_resource()` is never called - cleanup is broken in K8s mode
- **File**: `src/controller.rs:44`
- **Perspective**: Fine Taste
- **Status**: FIXED - `cleanup()` now calls `cleanup_resource()` to invoke `cleanup_raw()` on CRD deletion.
- **Issue**: `cleanup_resource()` calls `cleanup_raw()` but is never invoked anywhere. The actual `cleanup()` method (line 213) only publishes a Kubernetes event without calling `cleanup_raw()`. This means resource cleanup on CRD deletion does not work.
- **Recommendation**: Investigate whether `cleanup()` should call `cleanup_resource()` / `cleanup_raw()`. This is potentially a pre-existing bug surfaced by the review.

### DOCS-1: Docker compose example has wrong environment variable names
- **File**: `examples/docker-compose-zitadel-resource.yaml:16,18`
- **Perspective**: Documentation
- **Status**: FIXED - Corrected env var names and added all required variables to the example.
- **Issue**: Example uses `ZITADEL_URL` but config.rs expects `ZITADEL_API_ENDPOINT`. Uses `VAULT_ADDR` but config expects `VAULT_URL`. Users following this example will get config failures.
- **Recommendation**: Correct env var names to match config.rs. Add all required vars (`ZITADEL_PA_TOKEN`, `ZITADEL_TLS_DOMAIN_NAME`, `ZITADEL_EXTERNAL_ORIGIN`, `CA_CERTIFICATE_PEM`).

---

## Major

### SEC-4: No validation of OIDC redirect URIs
- **File**: `src/zitadel_client.rs:537`
- **Perspective**: Security
- **Issue**: Redirect URIs from labels/CRDs are passed to Zitadel without validation. An attacker can inject `http://attacker.com/callback` for OAuth redirection attacks.
- **Recommendation**: Validate redirect URIs: parse with `url` crate, reject non-HTTPS unless `dev_mode` is enabled.

### SEC-5: Secrets potentially logged at DEBUG level
- **File**: `src/zitadel_client.rs:478-479, 568-569`
- **Perspective**: Security
- **Status**: FIXED - Added `skip(self)` to all 19 `ZitadelClient` method `#[instrument]` macros and `skip(vault_token)` to `create_vault_client`.
- **Issue**: Client secrets in JSON objects pass through `#[instrument]`-decorated functions. At DEBUG tracing level, these could leak into logs.
- **Recommendation**: Use `skip` in `#[instrument]` for sensitive parameters, or redact secrets in log output.

### SEC-6: No rate limiting on Docker event processing
- **File**: `src/provider/docker.rs:83-117`
- **Perspective**: Security, DevOps
- **Issue**: Rapidly starting/stopping containers causes unbounded API calls to Zitadel with no debouncing or rate limiting.
- **Recommendation**: Add debouncing or rate limiting for container events.

### TECH-1: `== None` instead of `.is_none()` and other Rust idiom issues
- **File**: `src/zitadel_client.rs:224`
- **Perspective**: Technology, Fine Taste
- **Status**: FIXED - Changed `== None` to `!.any()` pattern, `.find().is_some()` to `.any()`, and fixed iterator consumption bug.
- **Issue**: Non-idiomatic Rust patterns: `== None` instead of `.is_none()`, `.find().is_some()` instead of `.any()`, unnecessary `&` on `&str` values.
- **Recommendation**: Use `.is_none()`, `.any()`, remove redundant borrows.

### TECH-2: Redundant `.map_err(|e| e.into())` in vault handler
- **File**: `src/credential_targets/vault.rs:34`
- **Perspective**: Technology, Fine Taste
- **Status**: NOT APPLICABLE - The `.map_err(ControllerError::from)` is intentional: the result is captured into a variable for deferred return after vault token revocation. Using `?` here would skip the token cleanup.
- **Issue**: `.map_err(|e| e.into())` is redundant - the `?` operator handles conversion via `Into` automatically.
- **Recommendation**: Replace with `vaultrs::kv2::set(...).await?` or `.map_err(ControllerError::from)`.

### TECH-3: Custom `to_string()` methods instead of `Display` impl
- **File**: `src/resource_types.rs:57-60, 72-77`
- **Perspective**: Technology, Fine Taste
- **Status**: FIXED - Changed to `as_zitadel_id()` methods returning `&'static str`, eliminating unnecessary allocations.
- **Issue**: `RawZitadelActionFlowEnum::to_string()` and `RawZitadelActionFlowComplementTokenEnum::to_string()` use manual methods returning `String` instead of implementing `Display`. Causes unnecessary allocations and bypasses standard conventions.
- **Recommendation**: Implement `Display` trait or return `&'static str`.

### ARCH-2: No provider trait for extensibility
- **File**: `src/provider/mod.rs:1-2`, `src/main.rs:42-91`
- **Perspective**: Architecture
- **Issue**: Provider pattern is hardcoded with direct match arms in main.rs. Adding a new provider (Podman, SystemD) requires modifying main.rs.
- **Recommendation**: Consider a `Provider` trait with `async fn run()` if more providers are expected. For now with only two providers, the match is acceptable.

### ARCH-3: Config fetched independently via global in each module
- **File**: `src/zitadel_client.rs:43-50`, `src/credential_targets/vault.rs:13`, `src/handlers/raw.rs:46`
- **Perspective**: Architecture
- **Issue**: Each module independently calls `get_current_config_cloned!(config())` instead of receiving config as a parameter. This creates hidden dependencies and makes unit testing difficult.
- **Recommendation**: Pass config through the call stack for testability. Accept as parameter in `apply_raw`, `cleanup_raw`, `handle_vault_target`, etc.

### TASTE-2: Unused `kube_client` parameters in controller.rs
- **File**: `src/controller.rs:35, 46`
- **Perspective**: Fine Taste, Repository
- **Status**: FIXED - Removed unused `kube_client` parameter from both `apply_resource()` and `cleanup_resource()` and updated all callers.
- **Issue**: Both `apply_resource()` and `cleanup_resource()` accept a `kube_client` parameter that is never used. Generates compiler warnings.
- **Recommendation**: Remove unused parameters or prefix with `_` if needed for trait compliance.

### QA-1: Docker event stream errors have no backoff
- **File**: `src/provider/docker.rs:105-108`
- **Perspective**: QA
- **Status**: FIXED - Rewrote Docker event loop with exponential backoff (1s to 60s) and automatic reconnection with full resync after each reconnection.
- **Issue**: Event stream errors are logged and the loop continues immediately. Persistent errors cause infinite tight loop spamming logs.
- **Recommendation**: Add exponential backoff when event stream errors occur repeatedly.

### QA-2: `full_sync()` silently returns on list_containers error
- **File**: `src/provider/docker.rs:128-132`
- **Perspective**: QA
- **Issue**: If `list_containers` fails, `full_sync` returns without clearing or updating `known_resources`, leaving potentially stale state.
- **Recommendation**: Log at error level (already done), but consider whether stale state needs explicit handling.

### QA-3: Missing edge case tests for label parser
- **File**: `src/provider/docker_label_parser.rs:99-114`
- **Perspective**: QA
- **Status**: FIXED - Added 12 edge case tests covering negative numbers, large integers, floats as strings, empty strings, sparse indices, single-element arrays, conflicting paths, custom prefix, empty labels map, nested arrays, multiple applications, and multiline scripts.
- **Issue**: No tests for: negative numbers, very large integers beyond i64, empty string values, sparse numeric indices (0,2,4 without 1,3), deeply nested paths.
- **Recommendation**: Add test cases for these edge cases.

### QA-4: No tests for credential target modules
- **File**: `src/credential_targets/file.rs`, `src/credential_targets/vault.rs`
- **Perspective**: QA, Repository
- **Issue**: File and vault credential targets have zero test coverage. These handle sensitive credential data.
- **Recommendation**: Add unit tests for file target (at minimum: write success, directory creation, error on invalid path). Vault tests require mocking but at minimum test error paths.

### DEVOPS-1: Docker provider mode missing /metrics endpoint
- **File**: `src/main.rs:72-77`
- **Perspective**: DevOps
- **Issue**: Docker provider mode only exposes `/health` but not `/metrics` or `/` diagnostics. Reduces observability.
- **Recommendation**: Add metrics and diagnostics endpoints to Docker provider mode web server.

### DEVOPS-2: Provider mode detection should validate invalid values
- **File**: `src/config.rs:88-91`
- **Perspective**: DevOps
- **Status**: FIXED - Auto-detection now rejects invalid `PROVIDER_MODE` values with a clear error.

### DOCS-2: README lacks Docker provider documentation
- **File**: `README.md`
- **Perspective**: Documentation
- **Issue**: No documentation of Docker provider support, label format, new env vars, or auto-detection behavior.
- **Recommendation**: Add Docker provider section to README covering: label format, env vars, auto-detection logic, examples.

---

## Minor

### TECH-4: `#![allow(unused_imports)]` blanket suppression in main.rs
- **File**: `src/main.rs:1`
- **Perspective**: Technology
- **Status**: FIXED - Removed blanket `#![allow(unused_imports)]`.
- **Issue**: Blanket `allow(unused_imports)` could hide genuine unused imports.
- **Recommendation**: Remove and fix specific unused imports.

### TECH-5: `anyhow::Error` converted to `GenericError(String)` loses error chain
- **File**: `src/lib.rs:70-73`
- **Perspective**: Technology
- **Issue**: `From<anyhow::Error>` stringifies the error, losing the chain and type information.
- **Recommendation**: Consider wrapping `anyhow::Error` directly or propagating specific error types.

### TECH-6: Test code uses `.unwrap()` without descriptive messages
- **File**: `src/provider/docker_label_parser.rs:193, 233, etc.`
- **Perspective**: Technology
- **Issue**: Test assertions use `.unwrap()` without context messages, making failure diagnostics harder.
- **Recommendation**: Replace with `.expect("description")` for better failure output.

### ARCH-4: Unused type definitions
- **File**: `src/resource_types.rs:129, 212`
- **Perspective**: Architecture, Repository
- **Status**: FIXED - Removed unused `ClientDataTargetKubernetes` and `RawZitadelApplicationSaml` types.
- **Issue**: `ClientDataTargetKubernetes` and `RawZitadelApplicationSaml` are defined but never used.
- **Recommendation**: Remove unused types or document as planned future additions.

### ARCH-5: Wildcard re-export in crd.rs
- **File**: `src/crd.rs:5`
- **Perspective**: Architecture
- **Status**: FIXED - Replaced `pub use crate::resource_types::*` with targeted import `use crate::resource_types::RawZitadelResource`.
- **Issue**: `pub use crate::resource_types::*` exposes all types through `crd` module, creating a broad public API surface. Changes to `resource_types` implicitly affect `crd`'s public API.
- **Recommendation**: Explicitly re-export only the types needed for CRD compatibility.

### TASTE-3: Redundant `..Default::default()` on proto messages
- **File**: `src/zitadel_client.rs:135, 354, 468`
- **Perspective**: Fine Taste
- **Status**: NOT APPLICABLE - These are protobuf generated message structs with many optional fields. Only a subset of fields is set; `..Default::default()` is the standard and correct pattern for proto messages.
- **Issue**: Unnecessary `..Default::default()` on struct initializers where all fields are already set.
- **Recommendation**: Remove if all fields are explicitly initialized.

### TASTE-4: Empty macros.rs module declared but unused
- **File**: `src/lib.rs`, `src/macros.rs`
- **Perspective**: Fine Taste, Repository
- **Status**: FIXED - Removed empty `macros.rs` file and its `pub mod macros;` declaration from `lib.rs`.
- **Issue**: `pub mod macros;` is declared but the module appears to be empty.
- **Recommendation**: Remove if unused, or populate if needed.

### DEVOPS-3: Docker socket mounting security in example
- **File**: `examples/docker-compose-zitadel-resource.yaml:21`
- **Perspective**: DevOps
- **Status**: FIXED - Comment added: "Docker socket access grants significant host control - use with caution".
- **Issue**: Docker socket mounted read-only is good, but could use a comment about security implications.
- **Recommendation**: Add a comment noting that Docker socket access grants significant host control.

### DEVOPS-4: VAULT_TOKEN passed as plaintext env var in example
- **File**: `examples/docker-compose-zitadel-resource.yaml:19`
- **Perspective**: DevOps
- **Status**: FIXED - Comment added: "Use a .env file for secrets, never commit tokens to version control".
- **Issue**: Example shows `VAULT_TOKEN: ${VAULT_TOKEN}` which is fine (references external var), but should note to use `.env` file.
- **Recommendation**: Add comment referencing `.env` file usage for secrets.

### QA-5: Docker label parser lacks test for duplicate keys
- **File**: `src/provider/docker_label_parser.rs`
- **Perspective**: QA
- **Status**: FIXED - Added doc comment on `parse_labels` explaining that duplicate keys are impossible due to `HashMap` input type and Docker's own deduplication.
- **Issue**: No test verifying behavior when HashMap input has effective duplicate keys (won't happen due to HashMap, but worth documenting).
- **Recommendation**: Add a clarifying comment or test confirming HashMap dedup behavior.

### REPO-1: Inconsistent module export style between provider and credential_targets
- **File**: `src/provider/mod.rs`, `src/credential_targets/mod.rs`
- **Perspective**: Repository
- **Status**: FIXED - Added `pub use docker::DockerProvider` re-export in `provider/mod.rs`. Updated `main.rs` import to use `provider::DockerProvider`.
- **Issue**: `credential_targets/mod.rs` exports a public dispatcher function directly. `provider/mod.rs` only declares submodules, requiring `provider::docker::DockerProvider` full path.
- **Recommendation**: Consider re-exporting `DockerProvider` from `provider/mod.rs` for consistency.
