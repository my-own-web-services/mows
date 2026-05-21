# Technology review (Rust) — change set 2026-05-20

**Scope:** all uncommitted Rust changes on branch `feat/mows-components-react`
**Reviewer perspective:** Rust Technology Expert
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 2 |
| Major | 10 |
| Minor | 7 |

---

## Findings — Error handling (thiserror, panics)

### ✅ TECH-RUST-1
- **Status:** Fixed in the first pass — both `.expect()` calls on `ssh.stdout/stdin.take()` replaced with `ok_or_else` returning `std::io::Error::BrokenPipe`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:407-408`
- **Issue:** Two `.expect()` calls on `ssh.stdout.take()` and `ssh.stdin.take()` inside production async code, not in tests.
- **Why it matters:** `expect` panics the thread. Even though `Stdio::piped()` was set, panic is unacceptable in a running API handler — the entire Tokio worker crashes and all in-flight requests on that thread are dropped. It should be an explicit early error.
- **Suggestion:** Replace with `ok_or_else`:
  ```rust
  let mut ssh_stdout = ssh.stdout.take().ok_or_else(|| {
      std::io::Error::new(std::io::ErrorKind::Other, "ssh stdout not piped")
  })?;
  let mut ssh_stdin = ssh.stdin.take().ok_or_else(|| {
      std::io::Error::new(std::io::ErrorKind::Other, "ssh stdin not piped")
  })?;
  ```

### ⁉️ TECH-RUST-2
- **Status:** Accepted — `"127.0.0.1:7878".parse().expect("static parse")` is on a string literal that cannot fail at runtime; the `expect` message is the documented exception form per the project rule. The `LazyLock<SocketAddr>` alternative was considered but adds no real safety since the parse is statically infallible.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/config.rs:90`
- **Issue:** `"127.0.0.1:7878".parse().expect("static parse")` in a `fn default_http_listen()` that is called at serde-deserialization time, not just in tests.
- **Why it matters:** A literal that will never fail in practice is still a panic path. The `expect` style is acceptable for truly static data, but the project mandates no panics in non-test code.
- **Suggestion:** Use a `const` parsed at compile time via `std::net::SocketAddr::V4(std::net::SocketAddrV4::new(...))` or wrap in a `LazyLock<SocketAddr>`. Alternatively accept that this `expect` is safe (the string is a literal) and document it explicitly with a comment.

### ✅ TECH-RUST-3
- **Status:** Fixed in the first pass — `anyhow` removed from supervisor `Cargo.toml`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/Cargo.toml:40`
- **Issue:** `anyhow` is listed as a direct dependency but is never imported or used in any of the changed `src/` files.
- **Why it matters:** The project mandates `thiserror` only; `anyhow` is a banned escape hatch. Keeping it in `[dependencies]` is misleading and could be accidentally introduced by a future developer via `use anyhow::Result`. It also inflates compile times unnecessarily.
- **Suggestion:** Remove `anyhow = { workspace = true, ... }` from `Cargo.toml`. (Note: `filez/server/src/server.rs` already used anyhow prior to this change; that is pre-existing and not introduced by this diff.)

### ✅ TECH-RUST-4
- **Status:** Fixed — `openapi_json_router()` mounts `GET /openapi.json` on the public side of the loopback HTTP listener. The doc is pre-serialised at startup and served via a cheap clone per request. Swagger UI is intentionally not mounted today; once a tracked vulnerability for `utoipa-swagger-ui` is resolved, plumb it in here.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs:68`
- **Issue:** The live `router()` function discards the collected OpenAPI document with `let (rest, _openapi) = build_api_router().split_for_parts();` — the spec is thrown away and never served at a `/openapi.json` or Swagger UI route.
- **Why it matters:** The entire OpenAPI migration (utoipa annotations, schema registrations, `openapi_dump` binary) is only useful if the live server also exposes the spec. Currently, the running supervisor has no way to serve the OpenAPI JSON at runtime, making in-situ exploration (Swagger UI, curl) impossible. The `openapi_dump` binary partially mitigates this for CI codegen, but runtime discoverability is lost.
- **Suggestion:** Wire the retained `openapi` value to a `/openapi.json` GET handler and optionally to `utoipa-swagger-ui` (already in `Cargo.toml`):
  ```rust
  pub fn router(state: SharedState) -> Router {
      let (rest, openapi) = build_api_router().split_for_parts();
      let openapi_json = serde_json::to_string(&openapi).unwrap_or_default();
      rest
          .route("/openapi.json", get(move || async move {
              axum::response::Response::builder()
                  .header("content-type", "application/json")
                  .body(openapi_json.into())
                  .unwrap()
          }))
          .merge(SwaggerUi::new("/swagger-ui").url("/openapi.json", openapi))
          ...
  }
  ```

### ✅ TECH-RUST-5
- **Status:** Fixed — `SupervisorError::IntoResponse` now constructs `axum::Json(ErrorResponse { error: public_message })` instead of `serde_json::json!({"error": ...})`. The OpenAPI schema and the runtime payload are now bound to the same type; renaming the field surfaces as a compile error on both sides. `api::types` module exposure raised to `pub(crate)` for the cross-module use.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/error.rs:100`
- **Issue:** `IntoResponse` for `SupervisorError` constructs the JSON error body using `serde_json::json!({"error": public_message})` — a raw `serde_json::Value` — instead of the `ErrorResponse` DTO defined in `api/types.rs`.
- **Why it matters:** The OpenAPI spec declares all error responses as `ErrorResponse` (a typed schema). At runtime the JSON key is indeed `"error"`, which happens to match, but the schema and the serialisation path are disconnected. If the field name ever changes in one place it silently diverges from the other. Using the DTO would make this a compile-time contract.
- **Suggestion:**
  ```rust
  use crate::api::types::ErrorResponse;
  // ...
  let body = axum::Json(ErrorResponse { error: public_message });
  (status, body).into_response()
  ```

---

## Findings — Tracing & logging

### ⁉️ TECH-RUST-6
- **Status:** Accepted — `--print-default-config` is deliberate machine-readable stdout output (YAML the operator pipes into a file). `tracing::info!` would route it to stderr along with operational logs and break the pipe use case. Documented as an intentional exception below; no code change beyond the explanatory comment.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/main.rs:36`
- **Issue:** `println!("{}", serde_yaml_neo::to_string(&cfg)?)` is used to print the default config, in production binary code.
- **Why it matters:** The project mandates the tracing ecosystem exclusively. `println!` bypasses structured logging, is not suppressed by `RUST_LOG`, and cannot be distinguished from actual log output in a container environment. Even for a CLI utility path like `--print-default-config`, stdout output should be intentional plain output (which is fine) but the codebase convention is to use tracing for all diagnostic output. Here the intent is deliberate stdout (not a diagnostic), so the question is whether this is the only `println!` — it is, and it is intentional. The project rule ("tracing ecosystem should always be used") is strict.
- **Suggestion:** Since `--print-default-config` is explicitly a machine-readable stdout emission (not a log), the most pragmatic fix is to add a comment explaining the intentional exception, or replace with `tracing::info!` for the message and use a dedicated write to stdout for the YAML content, depending on whether the output is meant to be piped. For piped output, the current `println!` is correct and an exception comment is sufficient; but if tooling also reads it, consider keeping the stdout write and suppressing tracing for this code path (e.g., don't init the subscriber before this early-return branch).

### ✅ TECH-RUST-7
- **Status:** Fixed — `openapi_dump.rs` now carries an explicit `#![allow(clippy::print_stderr)]` + header comment noting "no tracing subscriber is initialized; eprintln is intentional for fatal errors". Acknowledges the convention exception cleanly.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/bin/openapi_dump.rs:27,35,43`
- **Issue:** Three `eprintln!` calls in the build-time `openapi_dump` binary use stderr directly instead of tracing.
- **Why it matters:** `openapi_dump` is a CLI binary whose only purpose is to write a file or stdout; it never initialises a tracing subscriber. Using `eprintln!` is intentional and correct for a non-server binary — but the project rule is absolute. Practically the risk is zero (it's build tooling), but it is inconsistent.
- **Suggestion:** Either acknowledge the exception with an in-file comment `// CLI tool: tracing subscriber not initialized; eprintln is intentional`, or use `eprintln!` consistently and add `#![allow(clippy::print_stderr)]` to the file. Alternatively initialise a minimal subscriber and convert to `tracing::error!`. The comment approach is lowest ceremony.

### ✅ TECH-RUST-8
- **Status:** Fixed in the first pass — `TraceLayer` (with `DefaultMakeSpan` + `DefaultOnResponse`) applied via `global_middleware()` on both listeners.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs` (whole file)
- **Issue:** `tower-http` `trace` feature is listed in `Cargo.toml` but `TraceLayer` is never applied to the router in `api/mod.rs`.
- **Why it matters:** Every HTTP request and response passes through the router without structured tracing of method, path, status, or latency. This makes production debugging significantly harder. The feature flag is paying a compile-time cost for zero runtime benefit.
- **Suggestion:** Add `TraceLayer` to the router:
  ```rust
  use tower_http::trace::TraceLayer;
  // in router():
  rest.layer(TraceLayer::new_for_http())
  ```

---

## Findings — Async correctness

### ✅ TECH-RUST-9
- **Status:** Fixed in the first pass — `serve()` now uses `tokio::fs::{create_dir_all, try_exists, remove_file, set_permissions}` everywhere. No `std::fs::*` calls remain on the async path.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs:82-92`
- **Issue:** Three synchronous filesystem calls — `std::fs::remove_file`, `std::fs::create_dir_all`, and `std::fs::set_permissions` — are made directly inside the `async fn serve()` function before the executor is fully yielded to.
- **Why it matters:** `serve()` is called from `#[tokio::main]`, meaning these blocking calls run on a Tokio async thread. Blocking the async executor thread stalls all other tasks sharing that thread. `std::fs::*` can block for arbitrarily long on slow filesystems (NFS, overlayfs in Docker). Use `tokio::fs::remove_file`, `tokio::fs::create_dir_all`, and `tokio::fs::set_permissions` (or `tokio::task::spawn_blocking` for `set_permissions` which lacks an async equivalent in all Tokio versions).
- **Suggestion:**
  ```rust
  if unix_path.exists() {
      tokio::fs::remove_file(&unix_path).await?;
  }
  if let Some(parent) = unix_path.parent() {
      tokio::fs::create_dir_all(parent).await?;
  }
  // set_permissions via spawn_blocking:
  let unix_path2 = unix_path.clone();
  tokio::task::spawn_blocking(move || {
      std::fs::set_permissions(&unix_path2, std::fs::Permissions::from_mode(0o660))
  }).await??;
  ```

### ✅ TECH-RUST-10 (Fixed via SLOP-2 fix — `detach` field removed from CreateVmRequest)
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:335`
- **Issue:** `let _ = req.detach;` is dead code — the field is deserialized, then silently dropped. The struct field `detach: bool` is accepted by the API surface but never acts on anything.
- **Why it matters:** API consumers setting `"detach": true` will receive no error and no behaviour change. This is a silent lie in the API contract. Either the feature should be implemented or the field should be removed from the request schema and the utoipa annotation updated accordingly, until it is implemented.
- **Suggestion:** Remove `pub detach: bool` from `CreateVmRequest` and from the `#[utoipa::path]` annotation, or implement actual detach semantics (background spawn without the readiness probe). Do not silently accept parameters that have no effect.

---

## Findings — Serde / serialization

### ✅ TECH-RUST-11
- **Status:** Fixed — `locate_image` now rejects the half-built case (qcow2 present + exactly one of vmlinuz/initramfs missing) with a structured `ImageMissing` error. The fully-stubbed case (none of the three exist) still works for e2e tests and is documented as intentional.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:271-296`
- **Issue:** `locate_image` only checks for the existence of the `.qcow2` file but not for `.vmlinuz` or `.initramfs`, yet all three paths are returned in `ImageArtifacts` and then consumed by `QemuInvocation::build`. If kernel or initramfs are absent, QEMU is launched without `-kernel`/`-initrd` silently (the `if kernel_path.exists()` guards in `build()` swallow the missing files).
- **Why it matters:** A VM created with `ubuntu` or `nixos` image (which don't have image files yet per the doc-comment) will successfully reach `locate_image` if _any_ qcow2 is present with that name but the kernel/initramfs were not built. The VM would then boot without the kernel flag — and depending on whether the qcow2 has a bootloader installed, it may silently fail or hang. The `ImageMissing` path is only checked for the qcow2.
- **Suggestion:** Add existence checks for kernel and initramfs in `locate_image`:
  ```rust
  if !kernel.exists() || !initramfs.exists() {
      return Err(SupervisorError::ImageMissing(format!(
          "kernel or initramfs missing for {distro}-{flavor}-{arch_name}"
      )));
  }
  ```

### ⁉️ TECH-RUST-12
- **Status:** Accepted as design — `headless` vs `desktop` does ship as a distinct artifact today (the desktop image bundles xfce4 + VNC autostart that the headless image deliberately omits to keep disk footprint small). The naming convention is the deliberate image-builder contract documented in `image-builder/README.md` and in the per-distro Dockerfiles (`FLAVOR=headless|desktop` build arg). The reviewer's "could in principle be the same image" doesn't hold for this codebase.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:275`
- **Issue:** `locate_image(&state.config, image.as_str(), display_mode.as_str())` passes `display_mode` as the `flavor` parameter. This means an image for `alpine`+`headless` would be expected at `alpine-headless-mows-agent-amd64.qcow2`. The naming conflates two orthogonal concepts: display mode is a runtime configuration, not a build artifact variant.
- **Why it matters:** The image builder would need to produce per-display-mode images even though `headless` vs `desktop` could in principle be the same image with different QEMU flags. This bakes an artifact naming decision in the API layer that may not match the actual image builder's output convention. At minimum the semantics should be documented; at best, `display_mode` should map to a `-display none` / `-vnc` QEMU flag, not a distinct image file.
- **Suggestion:** Separate image selection (distro) from display configuration (runtime QEMU flags). Pass only `image.as_str()` as the artifact identifier and derive display arguments independently in `QemuInvocation::build` from the `display_mode` field.

---

## Findings — utoipa / axum

### ✅ TECH-RUST-13
- **Status:** Fixed in the first pass — every public DTO (`CreateVmRequest`, `UpdateVmRequest`, `VmSummary`, `VmDefaultsResponse`, `VmSshInfo`, `VmImage`, `VmDisplayMode`, `VmStatus`, `CreateAgentRequest`, `UpdateAgentRequest`, `AgentSummary`, `CreateUserRequest`, `UserSummary`, `LoginRequest`, `LoginResponse`, `HealthResponse`) is registered in `#[openapi] components(schemas(...))`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs:49-52`
- **Issue:** The `#[openapi]` `components(schemas(...))` block only registers `ErrorResponse` and `OperationResult`. It does not register `VmSummary`, `AgentSummary`, `VmSshInfo`, `LoginResponse`, `UserSummary`, `HealthResponse`, `VmDefaultsResponse`, `VmImage`, `VmDisplayMode`, `CreateVmRequest`, `CreateAgentRequest`, `UpdateVmRequest`, `UpdateAgentRequest`, `CreateUserRequest`.
- **Why it matters:** utoipa-axum inlines schemas referenced from `#[utoipa::path]` annotations into the generated `openapi.json` if they are listed in `components`. Schemas not listed are emitted inline at every usage site rather than as `$ref` entries, bloating the spec and preventing client generators from producing reusable model classes. Some generators (e.g. openapi-typescript-codegen) may also fail to resolve inline schemas in non-trivial positions.
- **Suggestion:** Add all public DTOs to the `components(schemas(...))` list:
  ```rust
  components(schemas(
      types::ErrorResponse,
      types::OperationResult,
      vms::VmSummary,
      vms::VmSshInfo,
      vms::VmImage,
      vms::VmDisplayMode,
      vms::VmDefaultsResponse,
      vms::CreateVmRequest,
      vms::UpdateVmRequest,
      agents::AgentSummary,
      agents::CreateAgentRequest,
      agents::UpdateAgentRequest,
      auth::LoginResponse,
      users::UserSummary,
      users::CreateUserRequest,
      health::HealthResponse,
  ))
  ```

### ✅ TECH-RUST-14
- **Status:** Fixed in the first pass — `CompressionLayer` + `DecompressionLayer` applied via `global_middleware()` on both listeners.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs` (router function)
- **Issue:** No HTTP compression middleware (`CompressionLayer`) is applied to the axum router, even though `tower-http` is already pulled in with `compression-full` and `decompression-full` features.
- **Why it matters:** The project mandates: "the compression tower addons should always be used with support for all compression types." The feature flags pay the compile cost but the middleware is never applied, so all API responses (including potentially large JSON lists of VMs/agents) are sent uncompressed.
- **Suggestion:**
  ```rust
  use tower_http::compression::CompressionLayer;
  use tower_http::decompression::DecompressionLayer;
  // in router():
  rest.layer(CompressionLayer::new())
      .layer(DecompressionLayer::new())
  ```

### ✅ TECH-RUST-15
- **Status:** Fixed — Added `(status = 500, description = "Internal error", body = ErrorResponse)` to the `list_vm_agents` `#[utoipa::path]` responses block, matching the convention used by every other DB-backed handler.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs` (list_vm_agents, create_agent utoipa annotations)
- **Issue:** The `list_vm_agents` utoipa `responses` block is missing the 500/internal-error response that `list_all_agents` has; symmetry with other endpoints is broken.
- **Why it matters:** Clients and generated SDKs do not know to handle 500 from this endpoint even though all DB-backed handlers can return it. Incomplete response documentation leads to unhandled-error bugs in generated clients.
- **Suggestion:** Add `(status = 500, description = "Internal error", body = ErrorResponse)` to the `list_vm_agents` `#[utoipa::path]` responses.

---

## Findings — Idiomatic Rust

### ✅ TECH-RUST-16
- **Status:** Fixed — `kernel_path` and `initrd_path` in `QemuInvocation::build` now reference `&spec.kernel_path` / `&spec.initrd_path` directly (no clones).
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:81-82`
- **Issue:** `let kernel_path = spec.kernel_path.clone(); let initrd_path = spec.initrd_path.clone();` clones two `PathBuf` values only to use them by reference in `if kernel_path.exists()` / `args.push(kernel_path.display().to_string())` — the originals could be used directly.
- **Why it matters:** Gratuitous clones waste a heap allocation each call. `PathBuf` does not implement `Copy` but all uses of the locals are either immutable references or value moves into a `String` via `display()` — the original `spec.kernel_path` can be referenced directly since `spec` is borrowed for the duration of `build`.
- **Suggestion:** Replace with direct references:
  ```rust
  // Remove the clone lines; use &spec.kernel_path and &spec.initrd_path directly.
  if spec.kernel_path.exists() {
      args.push(spec.kernel_path.display().to_string());
      ...
  }
  ```

### ✅ TECH-RUST-17
- **Status:** Fixed — `None => suffix` instead of `None => suffix.clone()` in `create_vm` name derivation.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:244`
- **Issue:** `suffix.clone()` inside `None => suffix.clone()` in the `match cwd_basename` arm where `suffix` is immediately moved into the outer `name` binding and never used again.
- **Why it matters:** `petname::petname` returns `Option<String>`; `suffix` is already owned and is the last use in all branches — the `None` branch could just consume it directly with `None => suffix`. The `.clone()` is wasted.
- **Suggestion:**
  ```rust
  let name = req.name.unwrap_or_else(|| match cwd_basename {
      Some(base) => format!("{base}-{suffix}"),
      None => suffix,  // not suffix.clone()
  });
  ```

### ⁉️ TECH-RUST-18
- **Status:** Not applicable — `create_vm` already extracts `canonical_cwd` into a local before any `.bind()` and the `VmSummary` response moves the local. There is no `req.cwd.clone()` in the current code (the diff applied during earlier passes restructured this).
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:340`
- **Issue:** `cwd: req.cwd.clone()` in the returned `VmSummary` at the end of `create_vm` — `req.cwd` has already been used by value (`bind(&req.cwd)` at line 262 borrows it, `as_deref()` at line 273 borrows it). At line 340 the request struct is still alive, so the `.clone()` is needed. However, the field accesses could be reordered to move `req.cwd` last, eliminating the clone.
- **Why it matters:** Minor allocation. Moving `req.cwd` into the response struct instead of cloning it avoids one heap allocation per VM creation. Since `req.cwd` is `Option<String>`, it's cheap but still unnecessary.
- **Suggestion:** Extract `req.cwd` early into a local variable and take the value at the point it is no longer needed as a reference (after all `.bind(&cwd_local)` calls). Return `cwd: cwd_local` without a clone.

### ✅ TECH-RUST-19
- **Status:** Fixed — `openapi_dump.rs` now uses `#[derive(clap::Parser)] struct Cli { #[arg(short, long)] output: Option<String> }`. Hand-rolled `parse_output_path` deleted. Both `--output VALUE` and `--output=VALUE` work; new flags are one `#[arg]` away.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/bin/openapi_dump.rs:54-66`
- **Issue:** The hand-rolled `parse_output_path` argument parser reimplements what `clap` (already a direct dependency via `mows-vm-supervisor`) provides for free. The manual iterator loop is also missing the `--output=value` combined-form in the `--output`/`-o` branch (only the `=` prefix form handles it, the iterator-advance form for `--output value` is correct).
- **Why it matters:** The custom parser is more fragile and harder to maintain than just adding a `clap::Parser` derive to `openapi_dump`. If a new flag is ever needed (e.g. `--format yaml`) it must be manually added to the parser. It is also inconsistent with the main binary which already uses `clap`.
- **Suggestion:** Add a small `clap` struct:
  ```rust
  #[derive(clap::Parser)]
  struct Cli {
      #[arg(short, long)]
      output: Option<String>,
  }
  ```
  and replace `parse_output_path` with `Cli::parse().output`.

### ✅ TECH-RUST-20
- **Status:** Fixed alongside SLOP-12 — `get_vm_ssh` now returns `state.config.external_host.clone()` and `state.config.guest_ssh_user.clone()`. The hardcoded `"127.0.0.1".to_string()` is gone.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:526`
- **Issue:** `host: "127.0.0.1".to_string()` uses `.to_string()` on a string literal where `"127.0.0.1".into()` or an `&'static str` field would be more idiomatic. More importantly, the host is hardcoded to `127.0.0.1` which is correct for the loopback listener but will be wrong when the supervisor is accessed via the Unix socket from a remote client — they would get an unreachable loopback address.
- **Why it matters:** Clients querying `/v1/vms/{id}/ssh` from a remote machine (or via the reverse proxy) get a hardcoded loopback host, which is wrong. The actual host should come from the request's `Host` header or the configured public address.
- **Suggestion:** Accept the `Host` header in `get_vm_ssh` (via `axum::extract::Host`) and derive the SSH host from it, or add a `public_host` field to `SupervisorConfig`.

### ⁉️ TECH-RUST-21
- **Status:** Accepted — the actual behavior matches the doc comment (`ImageMissing` → 503 with an actionable message pointing at `image-builder/build.sh`). An explicit early-match guard would shift the error site one function up but produce essentially the same outcome (same error type, same status code, same actionable string). Not worth the duplication; the qcow2-existence check already gives the right answer.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:52-54` (doc-comment on `VmImage`)
- **Issue:** The doc-comment on `VmImage` says "the other variants are accepted by the API surface but `create_vm` will reject them with a 503" — but that is not what happens. `create_vm` calls `locate_image` which returns `ImageMissing` (→ HTTP 503), which is correct behaviour but the rejection happens via a missing file, not an explicit variant check. The API accepts `ubuntu`/`debian`/`nixos` and immediately tries to find the image file; the error message tells users to run `bash image-builder/build.sh`. No validation gate explicitly rejects unknown/unbuilt images.
- **Why it matters:** The mismatch between the doc-comment's stated behaviour and actual behaviour is misleading. If the intent is to provide a clear "not yet available" error early, an explicit match on the `VmImage` variant to return a structured `SupervisorError::ImageMissing` before filesystem I/O would be more defensive and the error message more actionable.
- **Suggestion:** Add an explicit guard at the top of `create_vm`:
  ```rust
  if !matches!(image, VmImage::Alpine) {
      return Err(SupervisorError::ImageMissing(format!(
          "{} images are not yet built — run the image-builder for that distro",
          image.as_str()
      )));
  }
  ```
  and update the doc-comment to accurately describe the path.
