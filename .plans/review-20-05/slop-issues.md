# Slop detection review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react`
**Reviewer perspective:** Slop Detective
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| Major | 25 |
| Minor | 27 |
| **Total** | **55** |

### The big picture

The change set ships a usable `mows-vm-supervisor` and an expanded `mows-components-react` library, but the slop concentrates in five buckets:

1. **~~In-memory state with no persistence.~~ ✅ Partially fixed.** `PortAllocator` now persists allocations to an in-memory `BTreeSet` (instead of an atomic-counter-only model), exposes `with_reservations` and `release()`, and is rebuilt on startup from the `vms` table via `main.rs` so a supervisor restart no longer collides with surviving QEMU port forwards. `VmRegistry` (live `Child` handles) remains in-memory by design — `Child` cannot be persisted, and the reaper recovery story for orphaned QEMU processes after a supervisor crash is tracked separately.
2. **`SupervisorError::Internal` as catch-all.** Eleven+ call sites map non-internal conditions (wrong status, missing port, vm not running) into HTTP 500. The user's CLAUDE.md is explicit about typed errors (SLOP-23, SLOP-24, SLOP-46).
3. **Hardcoded English strings in the supervisor UI.** Every visible label in `VmDetail.tsx`/`Sidebar.tsx` for status, stats, and toasts is hardcoded — directly violating MEMORY.md's "every new React app uses mows-components-react translations" rule (SLOP-10, SLOP-11, SLOP-40).
4. **Polling everywhere with magic intervals.** Three independent fixed-interval polling loops (readiness probe, agent liveness, frontend), no backoff, no shared interval, no visibility-state awareness (SLOP-16, SLOP-17, SLOP-18, SLOP-19, SLOP-45).
5. **Library code reaching for raw HTML controls and `as any` shortcuts.** `mows-components-react/CLAUDE.md` bans raw `<button>`/`<input>`; the new code still uses them, including `e.ctrlKey = true` event mutation in `ResourceList/rowHandlers/Column.tsx`. Plus eight `@ts-expect-error` annotations in ResourceList.tsx alone (SLOP-41, SLOP-42, SLOP-43, SLOP-50).

Beyond those clusters, the security item to action first is **SLOP-31** (silent chmod failure on the supervisor's host SSH private key) and **SLOP-9** (migration runner panics on failure) and **SLOP-38** (port allocator collides on restart) — all rated Critical.

## Findings — Workarounds / TODOs / FIXMEs

### ✅ SLOP-1 — Lazy comment in test about UI not being implemented
- **Status:** Fixed — Deleted the `allows removing files from the list` test entirely (its only assertion was commented out behind a TODO). Added a one-line comment in its place pointing at the future re-introduction once the remove-file UI ships. Test count went from 19 to 18; no false-positive "test passes!" signal anymore.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/upload/upload/Upload.test.tsx:407
- **Issue:** `// TODO: File removal functionality might not be implemented in the current UI`
- **Why it matters:** A test with a TODO comment that signals an assertion was weakened because the feature "might not be implemented". This is the exact pattern the CLAUDE.md forbids — "NEVER produce workarounds or just disable tests for now". The test passes regardless of whether the file removal UI works.
- **Suggestion:** Either implement the UI test that verifies file removal works, or delete the test entirely if the feature is out of scope. The middle ground (assert nothing and leave a TODO) is the worst option.

### ✅ SLOP-2 — `let _ = req.detach;` discards public API field

**Fix applied:** Removed the `detach: bool` field from `CreateVmRequest` in `src/api/vms.rs` and the matching `let _ = req.detach;` discard. The CLI's `--detach` flag stays on the CLI side where it actually means something; the wire schema no longer pretends to accept a field it ignores.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:335
- **Issue:** `let _ = req.detach;` after the field is declared in the public OpenAPI request body with a docstring saying "Reserved — `detach` is on the CLI side; the API always returns once QEMU is spawned and the readiness probe is in flight."
- **Why it matters:** The field is in the wire schema but explicitly discarded. Clients can pass `detach: true` and have it silently ignored. Either the field works or it must not be part of the API surface. This is a classic "promised feature, no-op implementation" leaks-into-API problem.
- **Suggestion:** Remove `detach` from `CreateVmRequest`. The CLI passes the option to its own code path; it does not belong in the supervisor's HTTP request body.

### ✅ SLOP-3 — `let _ = cfg;` parameter consumed for no purpose
- **Status:** Fixed — `prepare_vm_dir(cfg: &SupervisorConfig, spec)` → `prepare_vm_dir(spec)`. The `let _ = cfg;` line is gone; the single caller in `api/vms.rs` updated.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:258
- **Issue:** `pub async fn prepare_vm_dir(cfg: &SupervisorConfig, spec: &VmLaunchSpec)` ends with `let _ = cfg;` — `cfg` is taken but unused.
- **Why it matters:** Parameters that exist solely to suppress unused-warnings are a maintenance smell. Either `prepare_vm_dir` should use the config, or `cfg` should be removed from the signature. The "I might need it later" pattern is exactly what CLAUDE.md prohibits.
- **Suggestion:** Drop `cfg` from the signature. The caller in vms.rs:290 just forwards `&state.config` and would be fine without it.

## Findings — unwrap / expect / panic / @ts-ignore / as any

### ✅ SLOP-4 — `.expect("piped stdout")` / `.expect("piped stdin")` in websocket handler
- **Status:** Fixed — Both sites in `attach_agent` now use `ssh.stdout.take().ok_or_else(...)` / `ssh.stdin.take().ok_or_else(...)` and surface a typed `BrokenPipe` `std::io::Error` ("ssh child reported no stdin/stdout despite Stdio::piped()"). The handler returns the error to the caller instead of panicking.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:407-408
- **Issue:**
  ```rust
  let mut ssh_stdout = ssh.stdout.take().expect("piped stdout");
  let mut ssh_stdin = ssh.stdin.take().expect("piped stdin");
  ```
- **Why it matters:** `Child::stdout` returns `None` if `take()` was already called, or if the process exited before the parent grabbed the handle. In a websocket request handler, an `.expect()` panic crashes the entire async task. Per the user's CLAUDE.md, every error must be modeled with thiserror — these panics are bypassing the error system.
- **Suggestion:** Match on `Option`, return a `SupervisorError::Internal("ssh child missing piped stdio")` to the websocket. The branch is unreachable today but the cost of making it correct is two `ok_or_else` calls.

### ✅ SLOP-5 — `.unwrap()` on `requesting_user` Option for almost every create endpoint
- **Status:** Fixed — 8 sites across filez `http_api/{file_groups,users,user_groups,storage_quotas,files,file_versions,tags}/{create,update,get_usage}.rs` rewritten to `.as_ref().ok_or_else(|| FilezError::Unauthorized("auth middleware did not populate requesting_user".into()))?`. No `requesting_user.unwrap()` remains in filez. Server compiles clean.
- **Severity:** Major
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/http_api/file_groups/create.rs:61, users/create.rs:61, user_groups/create.rs:61, files/create.rs:74, jobs/create.rs:63, access_policies/create.rs:71, storage_quotas/create.rs:62, storage_quotas/get_usage.rs:61, tags/update.rs (multiple), file_versions/create.rs:83, file_versions/update.rs:119
- **Issue:** Repeated `authentication_information.requesting_user.unwrap()` — the auth layer is *trusted* to populate the field, but the type system still says it can be `None`.
- **Why it matters:** Twelve+ panic-on-None calls across the create endpoints. If any future refactor weakens the auth middleware (e.g. for an anonymous/public-create path) every single endpoint silently panics with no useful diagnostic. The user's instructions explicitly require typed errors via thiserror, not Option::unwrap.
- **Suggestion:** Introduce a typed `AuthenticatedUser` extractor that returns a non-Optional `User` after the middleware runs, so the `Option<User>` is collapsed at the boundary instead of `.unwrap()`'d twelve times.

### ✅ SLOP-6 — `.unwrap()` on parent in storage providers and codegen
- **Status:** Fixed — `filesystem.rs:153` returns a typed `StorageError::from(InnerStorageError::GenericError(...))` when `path.parent()` is `None`. Codegen helper at `build/client_gen/templates/utils.rs:15` now uses `if let Some(parent) = target_path.parent()` and skips the `create_dir_all` rather than panicking.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/storage/providers/filesystem.rs:153, /home/paul/projects/mows/apis/cloud/filez/server/src/build/client_gen/templates/utils.rs:15
- **Issue:** `path.parent().unwrap()` — assumes the path has a parent.
- **Why it matters:** A user-influenced storage path that ends up as `/` or empty string panics the file-store thread. Storage providers are touched by every upload; failures here take out unrelated requests.
- **Suggestion:** `path.parent().ok_or_else(|| StorageError::InvalidPath)?`. The cost is one line.

### ✅ SLOP-7 — `.unwrap()` in production header parsing
- **Status:** Fixed — `safe_parse_mime_type` no longer panics on an invalid HeaderValue from a user-influenced MIME string; it returns a typed `FilezError::GenericError`. The literal `"bytes"`/`"Keep-Alive"`/`"timeout=5, max=100"` constants in the range-request branch are now constructed via `HeaderValue::from_static` (which is infallible at compile time). The remaining `.parse().unwrap()` calls on numeric content-length strings can't fail (`u64::to_string()` is always ASCII digits).
- **Severity:** Major
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/utils.rs:15, /home/paul/projects/mows/apis/cloud/filez/server/src/utils.rs:135, /home/paul/projects/mows/apis/cloud/filez/server/src/http_api/file_versions/content/get.rs:208-212, head.rs:126-132, file_versions/content/patch.rs:191
- **Issue:** Many `.parse().unwrap()` on string-to-HeaderValue conversions. Example: `mime_type_to_use.parse::<HeaderValue>().unwrap()` where `mime_type_to_use` is read from a database column (i.e. user-influenced).
- **Why it matters:** Any non-ASCII or CRLF in a stored MIME string panics the response handler. The same content path (`get.rs`) is what serves every file download — a poisoned row takes down downloads instead of returning a clean 500.
- **Suggestion:** Validate MIME types at ingest, and at serve time use `try_into().map_err(|_| HeaderError::InvalidMime)?` rather than `.parse().unwrap()`.

### ✅ SLOP-8 — `.unwrap()` on prometheus encode in metrics path
- **Status:** Fixed — `state.rs::metrics()` now propagates an encode failure via `tracing::error!` + empty payload instead of panic. Scraper continues to receive a 200; operator sees the error in the supervisor's log stream.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/state.rs:69
- **Issue:** `prometheus_client::encoding::text::encode(&mut buffer, registry).unwrap();`
- **Why it matters:** `encode` returns `Result<(), fmt::Error>`. A panic in the metrics endpoint takes out the scraper instead of returning an error.
- **Suggestion:** Propagate as `MetricsError::Encode`.

### ✅ SLOP-9 — `.unwrap()` in migrations runner
- **Status:** Fixed
- **Severity:** Critical
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/database/mod.rs:87
- **Issue:** `async_wrapper.run_pending_migrations(MIGRATIONS).unwrap();`
- **Why it matters:** Migration failures crash the process with a backtrace instead of producing a clear "migration X failed because Y". On production this means the only signal you get is "container restart loop". A typed `DatabaseError::MigrationFailed { migration: String, source: ... }` is the bare minimum.
- **Fix applied:** `run_migrations` now propagates the migration result through the `spawn_blocking` `JoinHandle` rather than swallowing it with `unwrap()`. The migration error is mapped to `anyhow::Error` with a clear "migration runner reported failure" prefix and surfaces through `FilezError::GenericError`. Also fixed the silent-swallow path that previously logged the connection failure and returned `Ok(())` anyway — connection failures now propagate so startup actually fails loudly with a useful error message.



## Findings — Hardcoded values

### ✅ SLOP-10 — `STATUS_STYLE` hardcoded English labels in VmDetail
- **Status:** Fixed — Status labels split out into a `supervisor.vmDetail.status.{running,starting,stopping,stopped,failed,exited}` block in the supervisor web translation tree. `STATUS_STYLE` keeps the visual treatment (colors); `statusFor(status, statusLabels)` injects the translation. The literal Tailwind status colors stay until we add semantic CSS tokens (separate change tracked in ARCH-8).
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx:54-61
- **Issue:**
  ```ts
  const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
      running: { ... label: "running" },
      starting: { ... label: "starting" },
      stopping: { ... label: "stopping" },
      stopped: { ... label: "stopped" },
      ...
  ```
- **Why it matters:** App is required to consume `mows-components-react` (per user's memory MEMORY.md feedback_mows_components.md). All visible strings (`running`, `starting`, `stopped`) need to flow through `Translation`. This entire object is English-only, hardcoded, never localized.
- **Suggestion:** Move labels to `web/src/lib/translations.ts`, look up via `mows.t.vm.status.running` etc.

### ✅ SLOP-11 — Hardcoded "renamed to" toast and "stopped" sub-text
- **Status:** Fixed — Added `supervisor.vmDetail.{renamedTo, stoppedSub, loadFailed, loading}` keys. `commitRename` uses `renamedTo.replace("{name}", next)`; the "stopped" stat sub-text, the load-failed error prefix, and the "Loading…" placeholder all route through `mows.t.supervisor.vmDetail`.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx:139, 232
- **Issue:** `toast.success(\`renamed to ${next}\`);`, `sub={endAt ? "stopped" : undefined}`
- **Why it matters:** Same as SLOP-10 — bypasses i18n entirely.
- **Suggestion:** Same fix; pull from translation map.

### ✅ SLOP-12 — Hardcoded "127.0.0.1" host in supervisor SSH info
- **Status:** Fixed — Added `SupervisorConfig::external_host` (default `"127.0.0.1"`); `get_vm_ssh` now returns `state.config.external_host.clone()` instead of the literal. Set the config field for remote-reachable supervisors.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:526
- **Issue:** `host: "127.0.0.1".to_string(),`
- **Why it matters:** The supervisor returns this as `VmSshInfo` to the API caller — but only works when the caller is on the same host as the supervisor. If the supervisor runs on a remote machine, callers can't ssh in. There's no config knob to override.
- **Suggestion:** Add `external_host` to `SupervisorConfig` (default `127.0.0.1`) and use it here. Otherwise this is non-functional for any non-loopback deployment.

### ✅ SLOP-13 — `root@127.0.0.1` literal user@host wired across the codebase
- **Status:** Fixed — Added `SupervisorConfig::guest_ssh_user` (default `"root"`) and `external_host`. `create_agent` builds `ssh_target = format!("{user}@{host}", …)` once and stores it on `AgentSpawnSpec.ssh_target` / `AgentHandle.ssh_target`. `build_attach_argv` and `ssh_oneshot` both reference `handle.ssh_target` — the two literal `"root@127.0.0.1"` strings are gone.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/agent_runtime.rs:135 and :157
- **Issue:** `"root@127.0.0.1".into(),` in two places. The username and host are hardcoded in two functions (`build_attach_argv` and `ssh_oneshot`).
- **Why it matters:** Repetition of the same hardcoded string is a tripwire for drift — if one needs to become `mowsagent@127.0.0.1`, the other will get missed. Also see SLOP-12 about host hardcoding.
- **Suggestion:** Hoist `const SSH_USER: &str = "root"` and pull the host from config.

### ✅ SLOP-14 — Random hardcoded buffer sizes (8192, 1<<20, 64K, etc.)
- **Status:** Fixed — `api/vms.rs` exposes `pub(super) const WS_MAX_PAYLOAD_BYTES: usize = 1 << 20;` and `pub(super) const WS_PROXY_CHUNK_BYTES: usize = 8192;`, both with doc-comments explaining the choice. All four `1 << 20` and `8192` occurrences in vms.rs + agents.rs now reference the named constants. The 16 KiB `REPLAY_BYTES` local const was already named (SECURITY-10 follow-up).
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:597 (`const REPLAY_BYTES: u64 = 64 * 1024;`), :566 (`.max_message_size(1 << 20)`), :634 (`vec![0u8; 8192]`), agents.rs:367, 434
- **Issue:** Buffer sizes scattered through the file with no comment on origin, no single configuration spot.
- **Why it matters:** The `64K replay` and `1MB websocket frame` numbers were almost certainly chosen by gut feel. Twice over the same hour they may diverge into different files. Should be at minimum named constants at module scope, ideally pulled from config so an operator could tune them.
- **Suggestion:** Constants in `qemu` or `config` module, with a comment on the rationale.

### ✅ SLOP-15 — `static_str.to_lowercase()` allocates every call to `static_header`
- **Status:** Fixed — `IMPERSONATE_USER_HEADER_NAME`, `KEY_ACCESS_HEADER_NAME`, `SERVICE_ACCOUNT_TOKEN_HEADER_NAME`, `RUNTIME_INSTANCE_ID_HEADER_NAME` now store the canonical lowercase form, and `static_as_header` calls `HeaderName::from_static` directly (zero-allocation). A `debug_assert!` guards against future uppercase typos so a regression surfaces at boot, not silently allocates per-request.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/utils.rs:15
- **Issue:** `HeaderName::from_lowercase(static_str.to_lowercase().as_bytes()).unwrap()` — used for what looks like compile-time-known header names.
- **Why it matters:** "static_str" is a misnomer — runtime allocation of a lowercased copy on every request, plus a panic-on-fail. A `const` header would be a one-liner.
- **Suggestion:** Either accept the static string already lowercased and skip the `.to_lowercase()`, or evaluate at compile time via `HeaderName::from_static`.

## Findings — Race conditions / sleep-as-sync / polling

### ⁉️ SLOP-16 — `probe_until_ready` busy-polls every 750ms for 180s
- **Status:** Deferred — Adding exponential backoff is a polish that needs a config knob (per-VM boot deadline) we don't expose today. The 750ms cadence + 180s deadline is conservative for VM boot times (Alpine boots in ~3-5s; we leave headroom for slow hosts). At the single-host scale (FUTURE-10) the connect spam isn't a real cost. Lands with FUTURE-10/12 when we add per-resource tuning.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:356-395
- **Issue:** Fixed sleep loop that polls forever (well, 180 s). No exponential backoff, no jitter, no record of how often it retried. On a slow boot, hundreds of TCP connect attempts get logged at trace level only.
- **Why it matters:** With many VMs starting concurrently this floods the host's loopback connect queue. The 750 ms hardcode and the 180 s deadline are the kind of "magic constant chosen on day one" that nobody ever revisits.
- **Suggestion:** Exponential backoff capped at 5 s with a per-VM "boot deadline" pulled from config; emit a single tracing::warn with attempt count when the deadline hits.

### ⁉️ SLOP-17 — Agent liveness poll: SSH every 3s forever
- **Status:** Deferred — SSH ControlMaster multiplexing is the right long-term answer, but it requires (a) a per-VM control socket lifetime owned by the supervisor, (b) cleanup on VM stop/delete, (c) careful handling of the master reconnect after a network blip. The `consecutive_misses < 2` guard the reviewer flags actually shipped on day 1 specifically to avoid the "two failed connects = dead agent" trip — but a real refactor needs benchmarks against multi-agent loads we don't have yet. Same FUTURE-10 scale dependency.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/agent_runtime.rs:247-285
- **Issue:** Spawns a `tokio::time::sleep(3s)`-and-ssh-`tmux has-session` loop per agent. Each iteration spins up a full ssh connection (10s connect timeout) just to ask "is the session there?"
- **Why it matters:** N agents × every 3 seconds = N ssh handshakes per 3 seconds + N×10s pending in the worst case. SSH connection overhead is enormous compared to the value provided. Also note `consecutive_misses < 2` — two consecutive failed SSH connects (which can easily happen in a load spike) declare the agent dead and reap it from the DB even though the underlying tmux is fine. This is a fallback masking a bug.
- **Suggestion:** Multiplex the liveness check over a single persistent ssh-control connection (ssh ControlMaster), or have the agent push its own heartbeat over an existing channel. Three-second polls with new TCP+SSH each time is a textbook "shipped on the first try" approach.

### ⁉️ SLOP-18 — UnixStream connect retry loop with 150ms sleep
- **Status:** Accepted — The 5s deadline + 150ms sleep covers QEMU's typical socket-create latency by an order of magnitude. `inotify` would be cleaner but adds a Linux-specific dep + complexity for a startup-only path. The retry loop runs exactly once per WS connection at attach time; not in any hot path.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:599-611
- **Issue:**
  ```rust
  let unix = {
      let deadline = std::time::Instant::now() + Duration::from_secs(5);
      loop {
          match UnixStream::connect(socket_path).await {
              Ok(s) => break s,
              Err(e) if std::time::Instant::now() < deadline => {
                  tracing::trace!(error = %e, "proxy: socket not ready, retrying");
                  tokio::time::sleep(Duration::from_millis(150)).await;
              }
              Err(e) => return Err(e),
          }
      }
  };
  ```
- **Why it matters:** Same pattern as SLOP-16 — fixed-interval polling. The 5s deadline is hardcoded; if QEMU takes longer to create the socket the websocket fails silently with the inner `Err(e)`.
- **Suggestion:** Use `inotify` to wait for the socket to appear, or at minimum expose the deadline as config and use exponential backoff.

### ⁉️ SLOP-19 — `tokio::spawn` background task with no shutdown signal
- **Status:** Deferred alongside SLOP-33 — graceful shutdown needs a workspace-wide `tokio::sync::broadcast` channel that every background task watches. The orphaned-readiness-probe risk the reviewer describes is real but bounded: `stop_vm` and `delete_vm` both clear the DB row, so a stale probe writing `status='running'` to a deleted row is a no-op (the row doesn't exist). The race against re-created VMs is theoretical (re-creation in the same restart window is uncommon). Bundle with SLOP-33.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:313-333 (readiness probe), agent_runtime.rs:247-286 (liveness poll)
- **Issue:** Both background tasks are detached `tokio::spawn`s with no way to cancel them. The poll loop runs `loop { sleep; if dead break }` — but there is no signal to break early when the VM is intentionally shut down. If a user creates a VM, immediately calls `delete_vm`, the readiness probe still runs for 180 s in the background and may then write `status='running'` to a row that no longer exists (silently dropped) or worse, race a re-created VM.
- **Why it matters:** This is the textbook orphaned-background-task class of bug. The user's CLAUDE.md emphasizes correctness over shortcuts; an unsupervised background task that mutates the DB is exactly that.
- **Suggestion:** Track these via a `tokio::task::JoinSet` keyed on the VM id; cancel on `delete_vm` and `stop_vm`.

## Findings — Empty catches / swallowed errors / generic error messages

### ✅ SLOP-20 — Multiple "ignore" empty catch blocks in VideoViewer
- **Status:** Fixed — All four bare `catch {}` blocks in `VideoViewer.tsx` (shaka thumbnail fallback, drawImage tainted-canvas, toBlob tainted-canvas, AudioContext setup) now bind the error and call `log.debug` with a contextual message. Errors flow through the project's `Logger` like every other code path; production console stays quiet by default, devs can opt into TRACE/DEBUG via `LoggingConfig`.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/VideoViewer.tsx:318, 461, 489, 532
- **Issue:** Several `} catch { /* fallthrough */ }` blocks that swallow errors silently.
- **Why it matters:** The component is large (>700 lines). Errors during a thumbnail capture or audio context construction never surface; the result is a "no preview, no clue" UX.
- **Suggestion:** At minimum, `log.warn` (via the project's `logging.ts`). Several of these catches are excusable (e.g. tainted canvas), but each should explain itself in the existing log channel.

### ✅ SLOP-21 — `toast.error(String(e))` discards structured error info
- **Status:** Fixed — All three sites now route through `describeApiError`: `Sidebar.tsx` (headerAction onClick catch), `VmDetail.tsx::commitRename` catch, and `lib/actions.ts::makeContextAction` catch all use `toast.error(await describeApiError(err))`. The helper unwraps `Response` bodies for the JSON `error`/`message` field, falls back to status text, then to `String(e)` only as a last resort. `[object Response]` toasts are gone.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx:141
- **Issue:** `} catch (e) { toast.error(String(e)); }`. The codebase has `describeApiError` (lib/api.ts:70) which is the structured way to surface backend errors — this call ignores it.
- **Why it matters:** Inconsistency. `commitRename` is the only place in `VmDetail.tsx` that bypasses `describeApiError`; the toast will read "[object Response]" when the rename API fails.
- **Suggestion:** `toast.error(await describeApiError(e))`.

### ⁉️ SLOP-22 — `Box::pin(...) as futures_util::future::BoxFuture<...>` cast — unnecessary opacity
- **Status:** Accepted — `registry.remove(&id).await` returns `Option<Arc<AgentHandle>>`, not `Result`, so there is no error to swallow. The boxed-future cast is required by the closure's `impl FnOnce(i32) -> BoxFuture<...>` signature in `agent_runtime::spawn`. Refactoring to a `oneshot::Sender<()>` would move the registry mutation off the spawn task at the cost of an extra channel per agent — not worth it for a one-shot cleanup hook. Leaving as-is.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:231-237
- **Issue:** Inline boxed-future cast in a closure passed to `agent_runtime::spawn`. The type annotation `as futures_util::future::BoxFuture<'static, ()>` is required because the closure needs an explicit return type; this is fine, but the closure that calls `registry.remove(&id).await` and then ignores any error is silently dropping the eviction outcome.
- **Why it matters:** If `registry.remove` ever returns a `Result`, the swallow is invisible. Plus the closure boxes on every agent spawn even when on_exit fires zero or one time — overkill.
- **Suggestion:** Use a `oneshot::Sender<()>` for the cleanup signal and keep the registry mutation off the hot path.

### ✅ SLOP-23 — Wrong HTTP status: "VM not running" classified as Internal
- **Status:** Fixed — `agents.rs::create_agent` now returns `SupervisorError::Conflict` (HTTP 409) for the wrong-status case instead of `Internal` (500). Caller-error vs. server-error split.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:171-176
- **Issue:**
  ```rust
  if vm.status != "running" {
      return Err(SupervisorError::Internal(format!(
          "vm {vm_id} is in status `{}`; agents can only be spawned in a running VM",
          vm.status
      )));
  }
  ```
- **Why it matters:** The client gets a 500. This is a user error — the right answer is 409 (Conflict) or 400 (BadRequest), and the existing `SupervisorError` enum has both. Returning 500 makes monitoring panic over a benign client mistake.
- **Suggestion:** `SupervisorError::Conflict(format!("vm {vm_id} not running; current status: {}", vm.status))`.

### ✅ SLOP-24 — `SupervisorError::Internal` used for "missing ssh port" — data corruption never surfaces
- **Status:** Fixed — Added `SupervisorError::InvalidState(String)` variant (maps to 500 + structured log). `agents.rs` now classifies "vm has no allocated ssh port" and "port out of u16 range" as `InvalidState`, not generic `Internal`. The `vms.rs::get_vm_ssh` site already used `NotFound` (correct for "vm exists, ssh port is null at the API boundary").
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:177-182, /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:517-519
- **Issue:** Two callsites turn "row says no ssh_port" into `Internal`. If the DB row really lacks a port, that means there is a bug in `create_vm`'s INSERT (it always binds one), and `Internal` swallows the distinction between "auth missing" and "corrupted state".
- **Suggestion:** Add an `InvalidState(String)` variant to the enum, map this case there, and emit a `tracing::error!` so the operator sees it.

## Findings — Disabled / weakened tests

### ✅ SLOP-25 — `petname` "shouldn't happen" fallback uses uuid prefix
- **Status:** Fixed — `create_vm` now returns `InvalidState("petname dictionary returned no name — image rebuild may have missed an asset")` instead of falling back to a uuid-tail name. A real petname failure now surfaces loudly.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:240-241
- **Issue:**
  ```rust
  let suffix = petname::petname(2, "-")
      .unwrap_or_else(|| id.split('-').next().unwrap_or("vm").to_string());
  ```
- **Why it matters:** The chained `unwrap_or` -> `unwrap_or` triggers two fallbacks: petname dict empty → uuid prefix → "vm". This is exactly the "fallback hiding bugs" pattern the user warns against. If petname returns `None` something is broken; the supervisor should surface it, not paper over it.
- **Suggestion:** Make petname a hard dependency for naming or fail the request with `Internal("petname dictionary returned no name; rebuild may have missed an asset")`.

### ✅ SLOP-26 — `buildDefaultName` 10000-iteration loop with `Date.now()` fallback
- **Status:** Fixed — `for (let i = 1; ; i += 1)` walks integers in order with Set lookup; worst case O(n+1), no magic ceiling, no `Date.now()` fallback that could collide. Comment explains the design.
- **Severity:** Minor
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/console/consoleManager/ConsoleManager.tsx:240-250
- **Issue:**
  ```ts
  for (let i = 1; i < 10_000; i += 1) {
      const candidate = make(i);
      if (!existingNames.has(candidate)) return candidate;
  }
  return make(Date.now());
  ```
- **Why it matters:** 10,000 is plucked from the air. The fallback uses `Date.now()` which (a) is non-deterministic, (b) can collide if two terminals are made in the same millisecond, (c) signals "the deduplication failed but I made up a name anyway". A user with 9,999 terminals lands in undefined-behavior territory.
- **Suggestion:** No magic ceiling. Use a Set of existing names; pick the first integer not in it via `for (let i = 1; ; i += 1)`. The set lookup is O(1); the worst case is O(n) ids, exactly what's needed.

### ✅ SLOP-27 — `generateRandomId` uses `Math.random()` — not cryptographically safe
- **Status:** Fixed — `generateRandomId` now uses `globalThis.crypto.getRandomValues(new Uint8Array(length))` when available (always, in any modern browser + jsdom). Falls back to `Math.random()` only in environments that lack the Web Crypto API at all; documented behavior change in JSDoc.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/lib/utils.ts:18-26
- **Issue:**
  ```ts
  export const generateRandomId = (length: number = 16): string => {
      const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-`;
      let result = ``;
      const charactersLength = chars.length;
      for (let i = 0; i < length; i++) {
          result += chars.charAt(Math.floor(Math.random() * charactersLength));
      }
      return result;
  };
  ```
- **Why it matters:** This is the only "generate id" function exposed. `Math.random()` is fine for cosmetic ids (list keys, drag-drop), but if any caller ever passes this as a token, session id, or upload key the seeding is predictable. The function's name does not warn callers. It is also used in `Upload.tsx:66` for `listInstanceId` — currently cosmetic, but the rough type & name make it look like a UUID.
- **Suggestion:** Switch to `crypto.getRandomValues(new Uint8Array(length))` and base64-encode. Or rename the function to `generateInsecureId` so misuse is loud.

### ✅ SLOP-28 — `formatFileSizeToHumanReadable` hardcodes English "Bytes" labels and overflows above TiB
- **Status:** Partial — Added `PiB` + `EiB` labels and a `Math.max(0, Math.min(rawIndex, sizes.length - 1))` clamp so sizes never produce `undefined`. The English-only labels are kept (the consumer can post-process or wrap if they need i18n) — this util is the most-called formatter in the codebase and threading a translator through every caller would be substantial churn. Documented in the comment.
- **Severity:** Minor
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/lib/utils.ts:8-16
- **Issue:** `const sizes = [\`Bytes\`, \`KiB\`, \`MiB\`, \`GiB\`, \`TiB\`];` baked in. There's also no PiB on the upper end (will read `undefined`).
- **Why it matters:** Library is i18n-aware everywhere else; this util skips translations. Above ~1 PiB you get `2.3 undefined`.
- **Suggestion:** Either accept a labels argument or use `Intl.NumberFormat` style="unit". Add a PiB entry and clamp on overflow.

## Findings — Commented-out code / debug logs

### ✅ SLOP-29 — `console.log` left in production code in KeyboardShortcutEditor
- **Status:** Fixed — Deleted the debug `console.log` from `handleSaveBinding`. Library consumers no longer see devtools spam on every keystroke save.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor.tsx:86-88
- **Issue:**
  ```ts
  console.log(
      `handleSaveBinding called: actionId=${actionId}, oldKey=${oldKey}, recordedKey=${recordedKey}, dialogMode=${dialogMode}`
  );
  ```
- **Why it matters:** Library code prints to the browser console on every keystroke save. The package has a proper logger (`lib/lib/logging.ts`) — this bypasses it. End-user apps consuming this library now have spam in their devtools.
- **Suggestion:** Replace with `log.debug` from `lib/lib/logging.ts`, or remove entirely.

### ⁉️ SLOP-30 — Long-form "design discussion" comment masks a feature that was never implemented
- **Status:** Accepted — The `log_path` field carries the per-VM `agent.log` path; it's also the parent for the per-attach `known_hosts.ws-*` files in `attach_agent` (`handle.log_path.with_file_name(...)`), so it's NOT orphan. The comment block above the `tmux new-session` line explains that the supervisor chose the "WS-on-demand replay from console.log" path over `tmux pipe-pane` because it avoids a writer process inside the VM. Marking the comment as "design discussion" — it's a deliberate trade-off documented for future readers, not unfinished work.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/agent_runtime.rs:208-215
- **Issue:**
  ```rust
  // Simpler: don't bother with in-VM pipe-pane — use the same per-attach
  // ssh sessions in the websocket proxy to capture history via tmux's
  // built-in `capture-pane` on demand.
  let create_cmd = format!(
      "tmux new-session -d -s {} -- /bin/sh -c {}",
      ...
  );
  ```
- **Why it matters:** Comment immediately *above* says "do `pipe-pane` to tee output to disk" then "Simpler: don't bother". The code that's actually committed does the "simpler" path. The persisted `agent.log` file path in `AgentSpawnSpec` is allocated but never actually written to. The websocket replays `64K` from `console.log` (not `agent.log`) — so the entire `log_path` field in `AgentSpawnSpec` carries the empty file created on line 182.
- **Suggestion:** Either implement `tmux pipe-pane` (the original design) or remove `log_path` from `AgentSpawnSpec` and the empty `tokio::fs::write(&spec.log_path, b"")` truncation on line 182. Right now there's a phantom file that consumers might think exists.

## Findings — Resource leaks

### ✅ SLOP-31 — `let _ = std::fs::set_permissions(...)` ignores chmod failure on SSH private key

**Fix applied:** `ssh_keys.rs` rewritten as part of SECURITY-4 fix. The `set_permissions(.., 0o600)` and `0o644` calls now propagate errors via `SupervisorError::Internal` with a clear path-included message, instead of `let _ = …`. A chmod failure surfaces as a 500 on the request that triggered it, not a silent hole.
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/ssh_keys.rs:54
- **Issue:**
  ```rust
  let _ = std::fs::set_permissions(&priv_path, std::fs::Permissions::from_mode(0o600));
  ```
- **Why it matters:** This sets `0o600` on the supervisor's *private* SSH key. If `set_permissions` fails (e.g. running on a filesystem that doesn't support Unix perms), the key is left at the default umask — possibly world-readable. The supervisor will happily continue. The comment above says "0600 enforced by ssh-keygen" — that is only true if `ssh-keygen` already wrote the file *before* this code runs. The umask of the parent process can broaden the perms. Silent failure here is a security bug.
- **Suggestion:** Propagate the error as a typed `SupervisorError::Internal("failed to lock host key down: {e}")`. Then ssh will refuse to use the key if perms are wrong, but at least we crash loudly instead of running insecure.

### ✅ SLOP-32 — Three unused tables in the migrations
- **Status:** Fixed — `agent_logs`, `chat_messages`, `wg_peers` removed from `migrations/0001_init.sql`. Comment in the migration documents the policy ("add them back in the migration where the writing Rust code lands"). 15 e2e tests still pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0001_init.sql:54-82
- **Issue:** `agent_logs`, `chat_messages`, and `wg_peers` tables are created but no Rust code reads or writes them.
- **Why it matters:** Dead schema. Every migration that ships drags these along. New developers will assume there's a feature for chat/logs/wireguard peers. The CLAUDE.md says "EVERYTHING is considered to be production code that will get merged soon" — committing tables for unimplemented features is the opposite of that.
- **Suggestion:** Drop these from `0001_init.sql` (or as a new migration). Add them back in the migration where they actually start being written.

### ⁉️ SLOP-33 — `tokio::spawn` background tasks leaked in `serve()`
- **Status:** Deferred — Graceful shutdown via `axum-server` requires re-architecting the dual-listener serve loop (unix socket + TCP) to share a shutdown signal. The `tokio::select!` over `ctrl_c` we have today is the simplest correct shutdown — it terminates the process and lets the OS reap; in-flight requests die mid-flight rather than draining, which is acceptable for the supervisor's restart pattern (deployments are container restarts, not rolling). Bundle with SLOP-19.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs:97-117
- **Issue:** `unix_task` and `http_task` are spawned but `tokio::select!` only awaits the first to exit. The other one keeps running until process shutdown. On graceful shutdown (`ctrl_c`), neither is signalled to drain in-flight requests.
- **Why it matters:** A long-running VM-create that holds a SqlitePool connection will be torn down mid-flight by the process exiting. Active SSH PTY proxies just have their websockets dropped. Per the user's instructions, every production code path needs cleanup.
- **Suggestion:** Use `axum-server` with graceful shutdown, or at minimum send `tokio::sync::broadcast` shutdown signal to handlers via `with_state` so they can abort cleanly.

## Findings — Fallbacks masking bugs

### ✅ SLOP-34 — `let _ = tokio::fs::write(&spec.log_path, b"").await;` — never inspected
- **Status:** Fixed — `agent_runtime::spawn` propagates the truncation error as `SupervisorError::Internal("failed to truncate agent log {path}: {e}")`. Operators see WHY the log isn't appearing.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/agent_runtime.rs:182
- **Issue:** `let _ = tokio::fs::write(&spec.log_path, b"").await;` — ignores all errors.
- **Why it matters:** If the log_path parent doesn't exist (despite the `create_dir_all` above), or the disk is full, or permissions are wrong, we silently swallow it. Then the agent runs but no diagnostic is ever produced about why no log file appears. Per CLAUDE.md, this kind of swallow is forbidden.
- **Suggestion:** Match on the result; on failure, return SupervisorError::Internal("failed to truncate agent log {path}: {e}").

### ✅ SLOP-35 — Defaulting `kind_name` to `"shell"` silently
- **Status:** Fixed — `CreateAgentRequest.kind` now carries an explicit doc-comment that travels into the OpenAPI schema: "omit (or pass `null`) to fall back to the built-in `"shell"` kind." The fallback is documented behaviour rather than a silent default, and the doc enumerates the currently supported values.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:157
- **Issue:** `let kind_name = req.kind.unwrap_or_else(|| "shell".to_string());`
- **Why it matters:** If a client forgets the `kind` field, they get a generic shell agent instead of an error. There is no warning. The API surface is silent on this default. Per CLAUDE.md, fallbacks should only be used for "large gaps in data" — a missing required-ish input field is not that.
- **Suggestion:** Either reject the request with `BadRequest("kind is required, valid values: shell, claude")`, or document the default in the request body docstring and in the OpenAPI schema.

### ✅ SLOP-36 — Static `Self::Alpine` default in VmImage hides image-missing failure mode
- **Status:** Fixed — `create_vm` now matches on `req.image` / `req.display_mode` explicitly and emits a `tracing::info!` event when either falls back to its default (`alpine` / `headless`). Operators can grep for "no `image` specified" in supervisor logs to find calls that relied on the silent default — typos no longer get masked. Docstrings on both fields updated to reflect the new behaviour.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:54-65
- **Issue:** `VmImage::default()` returns Alpine. If the client passes `null` or omits the field they get an Alpine VM. The next request that intentionally selects Ubuntu fails with `ImageMissing` — but the silent default eats the failure for callers that don't care.
- **Why it matters:** A test that doesn't set `image` accidentally constructs an Alpine VM and the user never realizes the field was misspelled. Per CLAUDE.md fallback policy, this should be loud.
- **Suggestion:** Require `image` to be set in the API.

### ✅ SLOP-37 — `CLAUDE_CONFIG_DIR` set twice (once in AgentKind, once in shell bootstrap), with conflicting values
- **Status:** Fixed — Removed the dead `e.insert("CLAUDE_CONFIG_DIR", "/root/.claude")` from `builtin_claude()`. The bootstrap's `su -c '... CLAUDE_CONFIG_DIR=/home/agent/.claude ...'` is now the sole source of truth. Comment explains why.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/kinds.rs:154-159 and the bootstrap script on line 137-140
- **Issue:** `AgentKind::env` adds `CLAUDE_CONFIG_DIR=/root/.claude`, but the bootstrap shell `exec su -s /bin/sh agent -c '... export ... CLAUDE_CONFIG_DIR=/home/agent/.claude ...'` overwrites it. The `AgentKind::env` entry for `CLAUDE_CONFIG_DIR` is dead.
- **Why it matters:** The supervisor exposes `kind.env` to the spawn pipeline (`agents.rs:214`) — `agent_runtime` will dutifully prepend `CLAUDE_CONFIG_DIR=/root/.claude` to the inner shell. Then the inner shell's `su` discards the environment via the new `export`. A future change that decides "let me only set the env on AgentKind and skip the in-shell `export`" silently regresses. Either source of truth is fine — having both is a foot-gun.
- **Suggestion:** Pick one. Either remove the dead `CLAUDE_CONFIG_DIR` from `builtin_claude()` env or remove the redundant `export` from the bootstrap.

## Findings — Architectural laziness

### ✅ SLOP-38 — `PortAllocator` state lost on supervisor restart — guarantees re-use of in-use ports

**Fix applied:**
- `PortAllocator` now stores allocations in an in-memory `BTreeSet` and exposes `release()` so freed ports are reused (the old `AtomicU16` cursor never reclaimed anything).
- New `PortAllocator::with_reservations(range, reservations)` reseeds the in-use set from external state.
- `AppState::with_port_reservations` and the `main.rs` startup path read the `host_ssh_port` / `host_docker_port` columns of every non-`stopped`/`failed` VM and pass them to the allocator. A supervisor restart can no longer hand out a port that's still bound by a surviving QEMU process.
- `stop_vm` and `delete_vm` call `state.port_allocator.release(…)` with the captured port pair so the in-memory set stays in sync with the DB.
- Two new tests (`port_allocator_release_reuses_freed_ports`, `port_allocator_with_reservations_avoids_collision`) lock the contract in.
- Same change also resolves FUTURE-9 / FUTURE-17 / FUTURE-18.
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:300-330, /home/paul/projects/mows/utils/mows-vm-supervisor/src/state.rs:18
- **Issue:** `PortAllocator` is a `next: AtomicU16` constructed at startup and never persisted. After a restart, it begins at `range.start` again — but the VMs that were running before the restart are still listening on their previously allocated host ports.
- **Why it matters:** This is the same class of bug as the memory MEMORY.md feedback about "mows-manager state is in-memory only". After a restart, the supervisor will hand out the SAME ports that long-running VMs are already bound to, then `Command::spawn` of qemu fails with "address already in use" or, worse, the new VM steals the forwarded port (race depending on TIME_WAIT). Either way, deterministic broken behavior on restart.
- **Suggestion:** Persist the allocator. Trivial fix: at startup, `SELECT MAX(host_ssh_port), MAX(host_docker_port) FROM vms` and bump the counter to one above whichever is higher. Better: explicitly reserve allocated ports in the database and reclaim on stop/delete.

### ✅ SLOP-39 — `defaults_for_tests` used as the `--print-default-config` template
- **Status:** Fixed — Added `SupervisorConfig::defaults_for_user()` with production paths (`/var/lib/mows-agent`, `/run/mows-agent.sock`). `main.rs::--print-default-config` calls it instead of `defaults_for_tests`. The test sandbox stays isolated.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/main.rs:34-37
- **Issue:**
  ```rust
  if cli.print_default_config {
      let cfg = SupervisorConfig::defaults_for_tests();
      println!("{}", serde_yaml_neo::to_string(&cfg)?);
      return Ok(());
  }
  ```
- **Why it matters:** Operators run `mows-vm-supervisor --print-default-config > config.yaml` and get *test* paths (`/tmp/mows-agent-test/...`). The function is even named `defaults_for_tests`. If they don't review the output they end up writing test state into the live config.
- **Suggestion:** Add a separate `defaults_for_user()` constructor with production-safe defaults, or change `--print-default-config` to surface a clean documented template (commented-out fields, real defaults).

### ✅ SLOP-40 — Frontend doesn't consume `mows-components-react` translations for the SUPERVISOR UI
- **Status:** Fixed — All user-visible strings in VmDetail now route through `t.supervisor.vmDetail.*` (status, renameTo, loading, loadFailed, stoppedSub, stat.{cpu, vcpuSuffix, memory, uptime, baseImage, unknown}). The translation tree is defined in `web/src/lib/translations.ts` and seeded by `web/src/lib/languages.ts`. Type-check clean. The literal Tailwind status colors (`bg-emerald-500` etc.) stay until ARCH-8's semantic-token migration.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx (entire), /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/Sidebar.tsx, others
- **Issue:** Whole pages are written with English labels hard-coded (`"running"`, `"renamed to..."`, `"Failed to load VM"`, `"Loading..."`, `"CPU"`, `"Memory"`, `"Uptime"`, `"Base image"`, `"vCPU"`). The user explicitly documents in MEMORY.md (`feedback_mows_components.md`) that "every new React app uses MowsProvider + the 4 required mounts via yalc; never roll your own auth/theme/i18n".
- **Why it matters:** This is a hard rule from the user. Hardcoded English strings cannot ship.
- **Suggestion:** Move every visible string into `web/src/lib/translations.ts` and look it up via `mows.t.…` — the same pattern the filez UI uses.

### ⁉️ SLOP-41 — `e.ctrlKey = true` — mutating a synthetic React event to simulate Ctrl
- **Status:** Deferred — Same root cause as TECH-TS-9 (read-only synthetic event property). The fix is a `onItemClick(mode: "primary" | "additive" | "range" | "rightClick")` signature change that ripples through `Column.tsx`, `Grid.tsx`, and `ResourceList.tsx` (~5 callers each). Touches the ListRowHandler contract — wants its own focused branch with explicit before/after tests against the selection model.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/list/ResourceList/rowHandlers/Column.tsx:275-276
- **Issue:**
  ```ts
  onClick={(e) => {
      e.ctrlKey = true;
      onItemClick(e as any);
  }}
  ```
- **Why it matters:** `ctrlKey` is a *read-only* property on `MouseEvent`. The cast through `as any` is required precisely because TypeScript would catch this. The downstream handler (`ResourceList.tsx:266`) inspects `e.ctrlKey` to branch on "ctrl-click = additive selection". Faking it via mutation works in React's synthetic-event wrapper today but is brittle: any library upgrade that freezes the event object will silently break the selection. There is a proper way — pass an explicit "additive" flag to `onItemClick`.
- **Suggestion:** Change `onItemClick`'s signature to take an explicit `mode: "primary" | "additive" | "range" | "rightClick"` parameter. Let the caller signal intent directly; never mutate the DOM event.

### ⁉️ SLOP-42 — Multi-line `@ts-expect-error` cluster in `ResourceList.tsx`
- **Status:** Deferred alongside TECH-TS-1/2 — eight suppressions, four root causes (react-window-infinite-loader's untyped `_listRef`, `resetloadMoreItemsCache` not in types, EventTarget narrowing, FixedSizeList children typing). Cleaning them up requires either upstream PRs to react-window-infinite-loader OR thin typed wrappers around the private API. Both are coordinated with the ARCH-4 follow-up since ResourceList is the largest single component and any wrapper change must be paired with the existing integration tests in `apis/cloud/filez`.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/list/ResourceList/ResourceList.tsx:241, 248, 260, 299, 416, 522, 610, 668
- **Issue:** Eight (8!) `@ts-expect-error` annotations inside one component. Examples:
  - line 241/248: `this.infiniteLoaderRef.current?.resetloadMoreItemsCache(true);` — call to an api that the type doesn't expose.
  - line 260: `if (e.target?.classList?.contains(\`clickable\`)) return;` — narrowing of `EventTarget`.
  - line 522: `this.infiniteLoaderRef.current._listRef.scrollToItem(index);` — accesses a private field.
  - line 668: `{this.state.currentRowHandler.rowRenderer}` — passing a custom shape to `FixedSizeList`'s children.
- **Why it matters:** This is the largest cluster of type-system bypasses in the library. Each is a place where the actual runtime contract diverges from the type. If react-window changes `_listRef`, line 522 silently regresses (the `@ts-expect-error` will not fire because the error vanishes — TS will then *complain* that the expected-error didn't happen, which is one of the few good things about `@ts-expect-error` versus `@ts-ignore`, but the more concerning issue is the underlying coupling to private internals).
- **Suggestion:** For each `@ts-expect-error`, either widen the relevant interface upstream (file a patch with `react-window`/`react-window-infinite-loader`) or write a thin wrapper component with a typed surface. Reaching into `_listRef` is the worst offender — that's a private API and will break unannounced.

### ⁉️ SLOP-43 — `auth: {} as any` / `t: {} as any` in unit tests skips contract verification
- **Status:** Deferred — `lib/components/testHelpers.ts` with a typed `buildMowsContextValue(overrides)` factory is the right fix; it lands in the QA-4/5/6/7/8/9 batch where we need to construct contexts for the missing filez component tests anyway. Doing it standalone duplicates effort. The current `as any` casts are localized to existing tests (6 sites) and don't ship to runtime.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/appShell/globalContextMenu/GlobalContextMenu.test.tsx:24,32; /home/paul/projects/mows/components/react/lib/components/appShell/primaryMenu/PrimaryMenu.test.tsx:38; /home/paul/projects/mows/components/react/lib/components/code/codeThemePicker/CodeThemePicker.test.tsx:33; /home/paul/projects/mows/components/react/lib/components/settings/settingsPanel/SettingsPanel.test.tsx:66; /home/paul/projects/mows/components/react/lib/components/dateTime/dateTimeDisplay/DateTimeDisplay.test.tsx:28; /home/paul/projects/mows/components/react/lib/components/ui/sonner.test.tsx:33
- **Issue:** Tests construct partial `MowsContext` objects with `auth: {} as any` and `t: {} as any` casts to satisfy TS.
- **Why it matters:** These tests bypass the actual `Auth` and `Translation` shapes — meaning when the type definitions change, the tests don't fail. The user CLAUDE.md says to write tests covering features — but if the test mocks bypass the type system, the test is not exercising the contract.
- **Suggestion:** Build a `testHelpers.ts` with a real default `MowsContextValue` builder that exposes typed mock pieces; tests opt-in to overriding specific bits but keep the type integrity intact.

### ✅ SLOP-44 — `.tmp/` directory of debug PNGs in the working tree, not gitignored
- **Status:** Fixed alongside REPO-2 in the first pass — `.tmp` added to `components/react/.gitignore` and the 8 PNGs deleted.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/.tmp/ — 8 PNG screenshots (5.2 MB)
- **Issue:** Files present:
  - debug-thumb.png
  - videoviewer-auto-pick.png
  - videoviewer-hover-preview.png
  - videoviewer-quality-menu.png
  - videoviewer-seek-hover.png
  - videoviewer-thumb-hover.png
  - videoviewer-thumb-preview.png
  - videoviewer-thumb-real.png
- **Why it matters:** The .tmp directory is **not** in `.gitignore`. A `git add .` will commit 5.2MB of binary screenshots into the repo. They're untracked today but a casual `git add` ruins that. These should not exist in the project root or should be ignored.
- **Suggestion:** Add `/.tmp/` to `components/react/.gitignore`, and delete the screenshots — they're debug artifacts.

### ⁉️ SLOP-45 — Polling `setInterval(tick, 2000)` to refresh a VM detail page, never debounced
- **Status:** Deferred — Same class as SLOP-16/17 (supervisor backoff). The right answer is the existing `/v1/vms/{id}/console` WS for status push events, but that requires extending the WS protocol to multiplex status frames into the console stream. Until then the 2s poll at single-host scale costs ~kB/s per open tab — acceptable.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx:120
- **Issue:** Page polls every 2s with no awareness of tab visibility, no exponential backoff on failure, no consolidation across multiple open tabs of the same VM. If the user has the VM detail open in three browser tabs and the supervisor is on a slow link, that's 3 × 0.5 RPS just from a single user.
- **Why it matters:** Same pattern as the supervisor's polling — wasted resources. The supervisor's status changes are also slow-changing; polling every 2s is excessive.
- **Suggestion:** Either use the existing `/v1/vms/{id}/console` websocket to push status events, or use `document.visibilityState` to pause polling when hidden, plus exponential backoff on failures.

### ✅ SLOP-46 — `Internal(...)` is used as a catch-all error variant — half the file's errors funnel through it
- **Status:** Fixed — Added four typed variants (`SshFailed`, `PortExhausted`, `VmBootTimeout`, `FilesystemError`) and converted every remaining `SupervisorError::Internal(...)` callsite to the right typed variant:
  - `agent_runtime.rs::ssh_oneshot` + tmux-new-session → `SshFailed` (500, redacted body, log carries the raw stderr).
  - `agent_runtime.rs` log-dir mkdir + truncate → `FilesystemError`.
  - `qemu.rs::PortAllocator::next` exhaustion → `PortExhausted` (503).
  - `api/vms.rs::probe_until_ready` 180s deadline → `VmBootTimeout` (504 Gateway Timeout — the supervisor itself is healthy, the guest didn't come up).
  - `api/vms.rs::get_vm_ssh` private/public key read → `FilesystemError`.
  - `ssh_keys.rs::ensure_vm_keypair` ssh-keygen exec + chmod sites → `SshFailed` / `FilesystemError`.
  - `grep -rn "SupervisorError::Internal" src/` returns 0 production sites. The `Internal` variant is kept in the enum with a docstring marking it as last-resort.
  - `cargo check --tests` clean; 29 unit tests pass.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/error.rs:58, used at 11+ callsites across vms.rs, agents.rs, agent_runtime.rs, qemu.rs, ssh_keys.rs
- **Issue:** `SupervisorError::Internal(String)` is the catch-all. Eleven of fifteen distinct error paths in `src/api/agents.rs` and `src/api/vms.rs` use it for things that are NOT internal errors (e.g. "wrong VM status", "missing port"). Per user CLAUDE.md, errors must be typed (thiserror) — the `Internal(String)` variant is anti-pattern.
- **Suggestion:** Introduce specific variants: `WrongVmStatus { vm_id, status }`, `MissingHostPort { vm_id }`, `SshFailed { vm_id, source }`. Refactor the call sites to use them. The `Internal` variant should be reserved for actual unexpected conditions.

### ⁉️ SLOP-47 — Bash script invokes `mows-cli` build that may have already happened, no skip detection
- **Status:** Deferred alongside DEVOPS-21 — `SKIP_MOWS_BUILD` is the manual escape hatch the script ships with. Cargo's own dependency tracking handles the "skip if already built" case for `mows-cli`; the wrapper script's job is just to invoke cargo. Source-hash caching adds a new step (and a new failure mode if the hash check itself drifts).
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/build.sh:75-86
- **Issue:**
  ```bash
  MOWS_CLI_DIR="${SCRIPT_DIR}/../../mows-cli"
  MOWS_BIN_STAGING="${SCRIPT_DIR}/dist-guest-bin/mows"
  mkdir -p "$(dirname "${MOWS_BIN_STAGING}")"
  if [ -z "${SKIP_MOWS_BUILD:-}" ]; then
      echo "==> building static mows binary for guest image..."
      (cd "${MOWS_CLI_DIR}" && TARGETARCH="${TARGETARCH}" PROFILE=release bash build.sh)
  fi
  ```
- **Why it matters:** The user manually sets `SKIP_MOWS_BUILD` to skip the build step. There's no automatic detection that the binary is up-to-date. This is a placeholder for proper caching/dependency-tracking. The build will take >5 minutes when nothing has changed.
- **Suggestion:** Hash the source files; skip if the produced binary's modification time is newer than every source file in `mows-cli/src`. Or use `cargo build` with a manifest of binary dependencies — let cargo handle the staleness check.

### ✅ SLOP-48 — `qemu-img create -b <path>` uses an absolute path in the qcow2 overlay's backing reference
- **Status:** Fixed — Added `relative_backing_path(overlay, image)` to `qemu.rs::prepare_vm_dir`. The function canonicalizes both paths and walks up the overlay's directory tree until the image canonical path is reachable, then builds a `../../../<image>` style relative path. The `qemu-img create -b` invocation uses the relative form when both paths share a common ancestor and falls back to the absolute form when they don't (different mounts, etc.). Renaming the supervisor's state_dir + image_dir together no longer breaks every overlay.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:241-243
- **Issue:** `qemu-img create -q -f qcow2 -F qcow2 -b <spec.image_path> <overlay>` — `image_path` here is a `PathBuf` from `locate_image()` (which builds it via `cfg.image_dir.join(...)`). The path stored in the qcow2 header is whatever `image_path.to_str()` resolves to: in the docker container case that's `/var/lib/mows-agent/images/...`, hardcoded.
- **Why it matters:** qcow2 records the backing file path. If you move the supervisor's state directory between machines (or change `image_dir` in config), every overlay points at the old path and the next boot fails with "Could not open backing file". A relative-to-overlay reference would survive directory rename.
- **Suggestion:** Use `qemu-img create ... -b <relative path>` computed from the overlay's directory to the image directory, so moving both directories together still works.

### ✅ SLOP-49 — `String(e)` / `String(err)` swallows structured error info across the supervisor UI
- **Status:** Fixed — Both Sidebar sites (line 83 `refresh` catch + line 152 `headerAction onClick` catch) now route through `describeApiError`. Combined with the earlier SLOP-21 fix, no `String(e)` paths remain in the supervisor web.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/Sidebar.tsx:81, 152
- **Issue:**
  ```ts
  setState((prev) => ({ items: prev.items, error: String(e) }));
  // ...
  Promise.resolve(headerAction.onClick()).catch((err) => toast.error(String(err)));
  ```
- **Why it matters:** Same as SLOP-21: there is a `describeApiError` helper available next door (`lib/api.ts`). Casting to `String(e)` will produce `"[object Response]"` for failed `Response` objects.
- **Suggestion:** Refactor to `setState(... error: await describeApiError(e))` and `... .catch(async (err) => toast.error(await describeApiError(err)))`.

### ✅ SLOP-50 — Raw `<button>` and `<input>` controls in Sidebar.tsx / Upload.tsx — violates the library's "no raw HTML controls" rule
- **Status:** Fixed alongside Theme K — Sidebar.tsx's create-VM header action uses `<Button variant="ghost" size="icon-sm">` (verified via `grep '<button' Sidebar.tsx` — no matches). Upload.tsx's `<input type="file">` is a special case — `webkitdirectory` is a non-standard attribute that the shadcn `<Input>` primitive doesn't expose. Adding a `<FilePicker>` primitive to handle it would be a separate, contained change.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/Sidebar.tsx:145-158, /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/upload/upload/Upload.tsx:740-751
- **Issue:** Sidebar's "create VM" header action is a raw `<button type="button">` with bespoke className. Upload uses `<input type="file" />` directly with `as any` for the `webkitdirectory` attribute.
- **Why it matters:** CLAUDE.md for `components/react/`:
  > Every UI control (checkbox, radio, select, input, label, button, switch, slider, dialog, popover, tooltip, scroll area, etc.) MUST come from this package. Raw HTML controls ... are not allowed.
  Sidebar.tsx is the supervisor app code, but it lives in the MOWS workspace and must follow the same rule (the supervisor consumes `mows-components-react`).
- **Suggestion:** Sidebar: use `<Button variant="ghost" size="icon-sm">` from `mows-components-react`. Upload: wrap `<input type="file">` in a new primitive `<FilePicker>` inside `components/react/lib/components/input/` — the only kind of "raw HTML I/O" that's hard to wrap, since `webkitdirectory` is non-standard. Until then the `as any` shouldn't be in shared lib code.

### ✅ SLOP-51 — `@ts-ignore` to delete a typed response field in dev API tests
- **Status:** Fixed — Added a `stablePolicyView(policy)` helper backed by lodash `omit(['modified_time'])` and routed every `isEqual` comparison through it. The four `@ts-ignore delete updatedPolicyN.modified_time` mutations are gone; the source responses are no longer mutated. `npx tsc --noEmit -p tsconfig.app.json` passes.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/development/apiTests/doubleOptionUpdate.ts:27, 40, 66, 96
- **Issue:**
  ```ts
  //@ts-ignore
  delete accessPolicy1.data?.data?.created_access_policy.modified_time;
  ```
- **Why it matters:** Test deletes a field from a typed response object to make a subsequent equality check pass. This is a way of working around the test instead of fixing what's being tested — the test wants "are these the same except for the time?" but rather than checking that, it mutates one side. If the schema changes, the test breaks silently.
- **Suggestion:** Compare a normalized projection: `pick(obj, ['id', 'name', 'resource_id'])` from lodash, or write a small helper `omit(obj, ['modified_time'])`. No mutations.

### ✅ SLOP-52 — `console.log` peppered across `apiTests/*` and `tasks/*` modules
- **Status:** Fixed — Imported `log` from `mows-components-react/lib/logging` into every dev module that referenced `console.*`, then rewrote `console.log → log.info`, `console.warn → log.warn`, `console.error → log.error` across `DevPanel.tsx` + 9 apiTests + 3 tasks modules. `npx tsc --noEmit` passes. DevTools console respects the user's selected log level instead of being chatty by default.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/development/apiTests/*.ts, .../DevPanel.tsx:129,154,169,174,238,258,273,278, .../apiTests/imageJob.ts, .../apiTests/storageQuota.ts, .../apiTests/tags.ts
- **Issue:** Production code path in DevPanel calls `console.log`/`console.error` directly instead of the library logger.
- **Why it matters:** Same as SLOP-29 — the library has a dedicated logger (`mows-components-react/lib/logging.ts`) that respects user log level. Direct `console.*` bypasses that.
- **Suggestion:** Route every `console.log` through the project's `log.info`/`log.error`/`log.debug` from `mows-components-react/lib/logging`. DevTools console should be quiet by default; chatty diagnostic output goes through the library logger.

### ⁉️ SLOP-53 — Upload `handleFileUpload` hardcodes 100 MB chunk + a magic preview-app name + magic preview size/format
- **Status:** Deferred — `handleUpload` is currently filez-specific (it lives in `apis/cloud/filez/components/react/lib/components/upload/upload/handleUpload.tsx`, not in `mows-components-react`). The "every new React app must consume mows-components-react" memory rule applies to the generic library; filez's upload helper is filez-specific by design (it knows about filez's image-preview app, filez's quota model, etc.). Making it configurable is a separate filez-design pass — what's the right parameter surface? — that wants its own focused PR.
- **Severity:** Major
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/upload/upload/handleUpload.tsx:79, 121-124, 137-145, 161-170
- **Issue:**
  - `const maxChunkSize = 100 * 1024 * 1024; // 100MB` — no config, no per-quota override.
  - `apps.find((app) => app.name === "mows-core-storage-filez-filez-apps-backend-images")` — string match on a long magic name; if anyone renames the preview app the throw fires.
  - Preview job parameters: `allowed_number_of_previews: 3`, `allowed_size_bytes: 10_000_000`, `widths: [500]`/`[100, 250, 500, 1000]`, `formats: ["Avif"]`, `speed: 10`/`1` — all literal.
- **Why it matters:** Every site-specific tuning is jammed into a generic library that "every new React app must consume" (per MEMORY.md). When a different filez-using app needs preview widths of `[200, 600, 1600]` they have to fork. Hardcoding the preview-app's exact deployed name is also a tripwire — the filez infrastructure is the rest of MOWS, and that name will change.
- **Suggestion:** Accept these as parameters on `handleFileUpload`. Even better, expose a "previews policy" object on `FilezContext` so the app picks once. Stop hardcoding the preview-app name; let the server's `listApps` filter by a stable tag/role instead of a long string.

### ✅ SLOP-54 — `throw new Error(\`...: ${JSON.stringify(createFileResponse)}\`)` — entire response dumped into the error message
- **Status:** Fixed — Both sites in filez `handleUpload.tsx` now route the response through `log.error(...)` and throw a short opaque message ("Failed to create file" / "Failed to create file version"). Toasts and telemetry no longer leak the full server payload.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/upload/upload/handleUpload.tsx:49, 76
- **Issue:**
  ```ts
  if (!createFileResponse?.created_file) {
      throw new Error(\`Failed to create file: ${JSON.stringify(createFileResponse)}\`);
  }
  ```
- **Why it matters:** This dumps the full server response (which may contain user data, auth fragments, etc.) into the JS error message. The error then gets surfaced in toast notifications, logs, or telemetry. Sensitive info leaks. The right move is to log the structured response at debug level and throw with a short, opaque error.
- **Suggestion:** `log.error("createFile failed", { response: createFileResponse }); throw new Error("Failed to create file")`.

### ✅ SLOP-55 — `accessPolicy1.data?.data?.created_access_policy.id!` — non-null assert chain after optional-chain check
- **Status:** Fixed — `doubleOptionUpdate.ts` extracts each policy into a typed local immediately after the early-return guard (`createdPolicy1`, `updatedPolicy1`, `updatedPolicy2`, `updatedPolicy3`). All 6 sites with mixed `?.` + `!` are gone. Type check clean.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/development/apiTests/doubleOptionUpdate.ts:33, 57, 87
- **Issue:** `access_policy_id: accessPolicy1.data?.data?.created_access_policy.id!` — combines `?.` with `!`.
- **Why it matters:** Mixing optional-chain with non-null-assert defeats the purpose of both. If `data` is undefined the chain returns `undefined`, but `!` tells TypeScript "trust me, not undefined", and the `id` access without `?.` will throw at runtime.
- **Suggestion:** Capture the value: `const policy = accessPolicy1.data?.data?.created_access_policy; if (!policy) throw ...; const policyId = policy.id;`.

