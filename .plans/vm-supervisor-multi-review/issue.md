# Multi-Review — mows-vm-supervisor (branch `feat/mows-auth-core`)

**Status: every finding resolved or explicitly justified for deferral.** Verified
with `cargo test` (47 unit + 24 e2e = 71 passing), `pnpm tsc --noEmit`, and
`pnpm build` (web). Auth plumbing applies in both `auth_disabled=true`
(local-dev) and full-auth modes — disabled-mode injects an admin
`AuthContext` so the new ownership checks are no-ops there but enforce
correctly the moment a real user logs in.

Diff under review: `git diff HEAD -- utils/mows-vm-supervisor/` (445 lines, 8 files).
Reviewed: alpine.Dockerfile bump 3.20→3.21 + chromium + chrome-devtools-mcp; new `PUT /v1/vms/{vm_id}/agents/{agent_id}` endpoint with caller-supplied id; new `recovery::reconcile_orphans` startup reconciliation; claude kind now stages plugins from `/creds`, registers chrome-devtools MCP, runs with `--dangerously-skip-permissions`; web swap from `VmSshConsole` to `VmAgentConsole`.

Status markers: `❌` open · `✅` resolved · `⁉️` dismissed (with reason).

## Summary

| Perspective   | Critical | Major | Minor | Total |
| ------------- | -------- | ----- | ----- | ----- |
| Security      | 1        | 2     | 1     | 4     |
| Technology    | 0        | 1     | 4     | 5     |
| DevOps        | 0        | 1     | 7     | 8     |
| Architecture  | 0        | 1     | 4     | 5     |
| QA            | 0        | 2     | 9     | 11    |
| Fine Taste    | 0        | 2     | 7     | 9     |
| Documentation | 0        | 1     | 0     | 1     |
| Repository    | 0        | 0     | 3     | 3     |
| Slop          | 3        | 4     | 4     | 11    |
| Future Proof  | 0        | 4     | 3     | 7     |
| **Total**     | **4**    | **18**| **42**| **64** |

After dedup. Total findings raised by agents pre-dedup: 84.

---

## Critical

### ✅ CRIT-1 — `PUT /v1/vms/{vm_id}/agents/{agent_id}` has no authorization, no tenant scoping
*(SECURITY-1 / FUTURE-3)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:189-201`
- **Issue:** Handler extracts `State` + `Path` + `Json` only; no `AuthContext` / `Extension` extractor; no check that the caller owns `vm_id`. The branch is `feat/mows-auth-core` — the agents table has `owner_user_id` but nothing in `create_agent` or the new `put_agent` populates or verifies it.
- **Why it matters:** Once auth lands (which is what this branch is for), an authenticated user A can spawn an agent inside user B's VM by supplying `vm_id=B` in the path, or hijack B's existing agent by guessing its id. The new endpoint widens the attack surface beyond the existing POST and accepts caller-controlled ids.
- **Suggestion:** Add `Extension(actor): Extension<AuthContext>` to both `create_agent` and `put_agent`; before reaching `spawn_agent_inner`, SELECT `owner_user_id` from `vms WHERE id = vm_id` and reject (403) if `actor.user_id != owner`. Populate `agents.owner_user_id` in the INSERT (line 252-259). Verify `existing.owner_user_id == actor.user_id` in the idempotency branch.

### ✅ CRIT-2 — Idempotent PUT returns existing agent without verifying it belongs to the path's vm_id
*(SECURITY-3 / ARCH-1 / QA-1 / SLOP-06)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:197-199`
- **Issue:** `load_agent(&state, &agent_id)` is keyed only by `agent_id`. If an agent with that id already exists under vm-B, a `PUT /v1/vms/vm-A/agents/<id>` silently returns the vm-B row. The same applies to mismatched `kind` (caller asks for `claude`, gets back an existing `shell` agent).
- **Why it matters:** Silent cross-VM routing: the UI tab appears attached to vm-A but the agent is actually running in vm-B; SSH/console attach then fails or, worse, sends traffic to the wrong VM. The OpenAPI contract (`description = "Idempotently materialise…"`) is misleading.
- **Suggestion:** After `load_agent`, assert `existing.vm_id == vm_id && existing.kind == request.kind.unwrap_or("shell")`. On mismatch, return `409 Conflict` with a structured `ErrorResponse` distinguishing `WrongVm` vs `WrongKind`. Add OpenAPI doc for both error cases.

### ✅ CRIT-3 — `if let Ok(existing) = load_agent(...)` swallows every DB error as "not found"
*(TECH-1 / SLOP-05)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:197`
- **Issue:** `Result::ok()` collapses NotFound and every other variant (connection lost, pool exhausted, schema mismatch, sqlx::Error::Database) into the "spawn anew" branch.
- **Why it matters:** A transient DB error turns into a duplicate spawn. The subsequent `INSERT` either succeeds (silent split-brain: two agent rows with the same id no longer possible due to PK but tmux session + log file paths collide), or fails on PK violation and the user sees a 500. Either way, the idempotency contract is broken on the path that needed it most (retries during DB hiccups).
- **Suggestion:** Replace with explicit `match`:
  ```rust
  match load_agent(&state, &agent_id).await {
      Ok(existing) => return Ok(Json(existing)),
      Err(SupervisorError::NotFound(_)) => {} // fallthrough to spawn
      Err(e) => return Err(e),
  }
  ```
  Combine with CRIT-2's vm_id/kind check inside the `Ok` arm.

### ✅ CRIT-4 — `cp -a /creds/plugins /home/agent/.claude/plugins 2>/dev/null || true` silent failure + symlink-follow risk
*(SLOP-02 / SECURITY-4)*

- **File:** `utils/mows-vm-supervisor/src/kinds.rs:191-192`
- **Issue:** `cp -a` follows symlinks within the source tree by default for files (the `-a` archive flag preserves symlinks themselves but contents of pointed-to directories are still readable). Combined with `2>/dev/null || true`, any failure (mount missing, perm denied, ENOSPC, symlink loop) is invisible.
- **Why it matters:** (a) If `/creds/plugins` contains an attacker-placed symlink (e.g. plugin filenames coming from a less-trusted UI), the copy can dereference paths outside `/creds`, leaking host secrets into the guest. (b) When the operator updates `/creds/plugins` on the host expecting plugins to update in the guest, they never know if the copy failed.
- **Suggestion:** Replace with explicit validation + `rsync -a --delete --copy-links=no`. Verify `/creds/plugins` is a real directory owned by the supervisor user before copying. Drop the `|| true` — let bootstrap fail loudly if plugin staging fails, since the agent claims to support plugins.

---

## Major

### ✅ MAJ-1 — `agent_id` path parameter is not validated; accepts `../`, empty string, whitespace, etc.
*(SECURITY-2 / QA-2)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:189-200` (the `spawn_agent_inner` already calls `validate_resource_name` for `name` at line 249, but `agent_id` skips this entirely).
- **Issue:** Caller-supplied `agent_id` flows directly into `INSERT` (PK), `tmux` session names, log file paths in `agent_runtime::spawn`, and SSH command lines without `validate_resource_name`.
- **Why it matters:** Path traversal in log file paths (`<state_dir>/agents/<agent_id>/log` — a `../` traversal writes outside the agents dir). Tmux session name injection if the id contains shell metacharacters. Empty / whitespace ids create unreachable rows.
- **Suggestion:** Call `validate_resource_name("agent_id", &agent_id)?` as the very first line of `put_agent` (before `load_agent`). Mirror the existing convention used for `name`. Add a unit test covering `""`, `"../etc"`, `"a b"`, `"a;b"`, `"a$b"`.

### ✅ MAJ-2 — `--dangerously-skip-permissions` downgrade is undocumented in the diff
*(SLOP-04)*

- **File:** `utils/mows-vm-supervisor/src/kinds.rs:218-219`
- **Issue:** Previously `--permission-mode acceptEdits` (user confirms tool use), now `--dangerously-skip-permissions` (no confirmation). No code comment explains why; the commit message bundles it with chrome-devtools MCP work.
- **Why it matters:** Reviewer cannot tell whether this was intentional (claude needs free tool use for chrome-devtools-mcp to operate autonomously inside the qcow2 sandbox) or accidental. The change has real safety implications even though the qcow2 overlay limits blast radius.
- **Suggestion:** Add a comment immediately above the `exec /usr/local/bin/claude --dangerously-skip-permissions` line stating: "Per-agent qcow2 overlay sandboxes filesystem mutations; full permissions are acceptable inside this VM but would be unsafe on the host." Cross-reference the qcow2 overlay setup.

### ✅ MAJ-3 — Stale comments in `src/api/vms.rs` still describe `--permission-mode acceptEdits` and `/v1/agents` alignment
*(DOC-1 / DOC-2 / REPO-1 / REPO-5)*

- **File:** `utils/mows-vm-supervisor/src/api/vms.rs:899` and `:939` (verify exact line numbers — the `proxy_vm_ssh` doc-comment block)
- **Issue:** `VmSshIoQuery.command` doc still says `execs 'claude --permission-mode acceptEdits'`; another comment in `proxy_vm_ssh` claims `/v1/agents` and the ssh-io tab "stay aligned" — but the web UI no longer uses ssh-io for spawning agents.
- **Why it matters:** Future maintainers will read these comments and assume the legacy paths still mirror the new agent endpoint. Compliance/auditors reading API docs see the safer mode that no longer exists.
- **Suggestion:** Update both comment blocks: replace `acceptEdits` with `--dangerously-skip-permissions`; rewrite the "stay aligned" sentence to "ssh-io is the legacy direct-attach path; new agent bootstrap goes through `PUT /v1/vms/{vm_id}/agents/{agent_id}` and `kinds::builtin_claude`."

### ✅ MAJ-4 — TOCTOU on concurrent PUTs with the same `agent_id`
*(TECH-2 / QA-4)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:189-201`
- **Issue:** Two concurrent PUTs with the same `agent_id`: both pass `load_agent` (NotFound), both call `spawn_agent_inner`, both attempt `INSERT INTO agents` (line 252). The second fails on PK constraint with a `sqlx::Error::Database`, the user sees `500 Internal Server Error`.
- **Why it matters:** Idempotency contract states the PUT must always succeed; under realistic frontend retry scenarios (network blip, react double-mount in dev), the user gets a hard error instead of either the first or second result.
- **Suggestion:** Use `INSERT INTO agents ... ON CONFLICT(id) DO NOTHING RETURNING ...` (SQLite) — if no row returned, immediately `load_agent` again and return the existing row. Alternatively serialize the load+insert behind a `tokio::sync::Mutex` keyed by `agent_id` (acceptable since contention is per-id and rare).

### ✅ MAJ-5 — Chromium and supporting libraries are unpinned in the image
*(DEVOPS-2 / SLOP-07 / SECURITY-5)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:120-128`
- **Issue:** `apk add --no-cache chromium nss freetype harfbuzz ttf-freefont font-noto-emoji` — no `=version` pinning. Only the alpine base digest is pinned.
- **Why it matters:** Alpine pushes chromium security backports in-place under the same `3.21` tag; the comment block at the top of the Dockerfile (lines 21-28) promises reproducibility only within a 24-48h window for non-base-pinned packages. Chromium's release cadence is fast — within weeks of the merge, identical Dockerfile inputs will produce different chromium binaries. Real risk: a chromium major bump diverges from `chrome-devtools-mcp@1.1.0`'s tested matrix.
- **Suggestion:** Pin via `chromium=<version>-r0` in the `apk add` (resolve via `apk policy chromium` on the pinned base image). Bump in lock-step with `ALPINE_DIGEST`. Optionally add a CI lint that compares the lock list against the pinned base.

### ✅ MAJ-6 — Inline shell + Python bootstrap script in `kinds.rs` is becoming unreviewable
*(TASTE-2 / SLOP-03 / ARCH-3)*

- **File:** `utils/mows-vm-supervisor/src/kinds.rs:178-219`
- **Issue:** ~42-line shell embedded as a Rust string literal, with an embedded `python3 -c "..."` block doing JSON munging on `.claude.json`. No syntax highlighting, no shellcheck, no unit tests, no error visibility. A misplaced quote silently breaks the agent at runtime.
- **Why it matters:** This script grows with every new MCP server, every new credential staging step. The Python heredoc on line 199-211 already does five distinct mutations on `.claude.json`. A typo in any single character produces a non-functional `claude` agent with no failure on the supervisor side (the `2>/dev/null || true` wrapping suppresses the error).
- **Suggestion:** Extract to `utils/mows-vm-supervisor/src/kinds/claude_bootstrap.sh` (or a dedicated `.py` script for the JSON manipulation) and embed via `include_str!()`. Run shellcheck in CI. Add a unit test that pipes the script to `sh -n` (syntax check) and a happy-path integration test that runs the JSON merger against a known input.

### ✅ MAJ-7 — Stringly-typed agent kind dispatch
*(TASTE-1 / FUTURE-1)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:209-214`
- **Issue:** `match kind_name.as_str() { "shell" => ..., "claude" => ..., other => Err(...) }`. The `CreateAgentRequest.kind` field is `Option<String>`.
- **Why it matters:** Typos in client requests are only caught at runtime; OpenAPI schema documents `kind` as `string | null` instead of `enum`. Adding a new kind (codex, gemini-cli) requires both editing the match and updating clients manually because there's no schema enumeration. With auth-core landing, custom user-defined kinds become a likely feature — a registry pattern is the natural next step.
- **Suggestion:** Define `#[derive(Serialize, Deserialize, ToSchema)] #[serde(rename_all = "lowercase")] enum AgentKindName { Shell, Claude }` and use it in `CreateAgentRequest`. Replace the match with a method on the enum returning `AgentKind`. When extensibility is needed, convert to a `HashMap<&str, fn() -> AgentKind>` registry initialized at startup.

### ✅ MAJ-8 — MCP servers hardcoded in `builtin_claude`; not part of `AgentKind` data model
*(FUTURE-2 / DEVOPS-7)*

- **File:** `utils/mows-vm-supervisor/src/kinds.rs:206-207`
- **Issue:** The chrome-devtools MCP entry is inlined into the python JSON-mutator. Adding a second MCP (e.g. a database explorer, a docs server) requires editing the same shell-in-Rust string.
- **Why it matters:** Every future agent kind that needs MCP servers will reimplement the same bootstrap. The data ("which MCP servers"), the env vars (`PUPPETEER_*`), and the apk package list (chromium etc.) are spread across `kinds.rs` and `alpine.Dockerfile` with no single source of truth.
- **Suggestion:** Add `mcp_servers: Vec<McpServerSpec>` (name, command, args, env) to `AgentKind`. Have `builtin_claude` populate the list; the bootstrap script then loops over them when writing `.claude.json`. This also makes it possible to attach kind-specific apk packages declaratively.

### ✅ MAJ-9 — ConsoleManager `tabId == agent_id` collides across browser tabs/windows on the same VM
*(FUTURE-7 / ARCH-4)*

- **File:** `utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx:214-223,236-243` (also `web/src/components/VmAgentConsole.tsx`)
- **Issue:** ConsoleManager persists `tabId` via `mows:console:vm:<vmId>:console`. The `tabId` is regenerated per ConsoleManager instance but is **the same** for a "SSH" tab the user opens in two separate browser windows. The second window's `PUT /v1/vms/{vmId}/agents/{tabId}` returns the first window's agent, so closing one window kills the other window's session.
- **Why it matters:** UX foot-gun in a multi-window/multi-monitor workflow. Also means resource-id namespace is leaking a UI concern (tab identity) into the data model — see ARCH-4.
- **Suggestion:** Either (a) namespace `tabId` per browser context: `const agentId = useMemo(() => \`${ctx.tabId}-${crypto.randomUUID()}\`, [])` so each instance gets a fresh id and ConsoleManager re-hydration uses the cached one; or (b) document the constraint and surface a warning toast when ConsoleManager detects a duplicate-instance reattach. Option (a) is preferred.

### ✅ MAJ-10 — `reconcile_orphans` mutates DB but emits no `SupervisorEvent`
*(FUTURE-4 / ARCH-6)*

- **File:** `utils/mows-vm-supervisor/src/recovery.rs` + `src/main.rs:73-83`
- **Issue:** Recovery flips VM/agent rows to `failed` but never calls `state.events.emit(SupervisorEvent::VmUpdated { ... })`. The supervisor also has no `EventBus` injected during the recovery call.
- **Why it matters:** A web client connected via `/v1/events` immediately after a restart will never see the recovery transitions — the UI still shows VMs as `running` until the next manual refresh. Inconsistent state visibility during the most error-prone moment (post-restart).
- **Suggestion:** Either (a) emit events as part of the reconcile transaction by passing `&state.events` into `reconcile_orphans`, or (b) trigger a single `SupervisorEvent::RecoveryCompleted { stats }` after the call in `main.rs` and have the frontend treat it as "refresh all VM/agent state". Option (a) is more granular and integrates cleanly with the existing event stream.

### ✅ MAJ-11 — No tests for `put_agent` or `VmAgentConsole` idempotency
*(QA-3)*

- **Files:** `utils/mows-vm-supervisor/src/api/agents.rs` (no `#[cfg(test)]` for `put_agent`), `utils/mows-vm-supervisor/web/src/components/VmAgentConsole.tsx` (no `.test.tsx` covering the PUT-on-mount path)
- **Issue:** Per-project rule (CLAUDE.md: "ALWAYS try to create a test that covers it"), but the new endpoint and component have no unit/integration coverage; only the playwright e2e harness exercises happy paths.
- **Why it matters:** All the issues above (CRIT-2/CRIT-3, MAJ-1/MAJ-4) are exactly the regressions a thin Rust integration test would catch in seconds — much faster than the playwright cycle.
- **Suggestion:** Add a Rust integration test (under `utils/mows-vm-supervisor/tests/`) covering: PUT to unknown VM (404), PUT to non-running VM (409), PUT with unknown kind (400), PUT to existing agent (200 + same row), PUT to existing agent with DIFFERENT `vm_id` (must become 409 per CRIT-2), PUT to existing agent with different `kind` (must become 409 per CRIT-2), concurrent double PUT (must both succeed and return the same row per MAJ-4). Add a vitest test for `VmAgentConsole` covering: mount → PUT happy path, mount → PUT 4xx → error state surfaced.

---

## Minor

### ✅ MIN-1 — Numerous `2>/dev/null || true` patterns in `builtin_claude`
*(SLOP-01 / TASTE-3)*

- **File:** `utils/mows-vm-supervisor/src/kinds.rs:182-216`
- **Issue:** ~8 occurrences (`cp ... 2>/dev/null || true`, `chown ... 2>/dev/null || true`, `python3 ... 2>/dev/null || true`).
- **Suggestion:** Audit each: where a missing source file is expected (e.g. first-boot has no `/creds`), use `[ -e ]` guards; where failure is unexpected (chown, JSON writer), let stderr propagate to the agent log.

### ✅ MIN-2 — `spawn_agent_inner` `_inner` suffix is a code smell
*(TASTE-4)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:203`
- **Suggestion:** Rename to `spawn_agent`; both `create_agent` and `put_agent` are simply two HTTP-shape adapters around it.

### ✅ MIN-3 — `description = "..."` uses `\` line-continuation inside utoipa macro
*(TASTE-5)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:174-176`
- **Issue:** Rust will join the continuation correctly, but the resulting string includes runs of whitespace from the indent; utoipa surfaces this in the OpenAPI doc.
- **Suggestion:** Either inline as a single longer string, or extract to a `const PUT_AGENT_DESCRIPTION: &str = "...";` outside the macro.

### ✅ MIN-4 — Term "materialise" is unusual; codebase elsewhere uses `create` / `ensure`
*(TASTE-10)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:174` and propagates to `web/src/api/generated/api-client.ts`
- **Suggestion:** Rephrase to "Create-or-return an agent with the caller-supplied id."

### ✅ MIN-5 — Python JSON-mutation inside `kinds.rs` is fragile to future MCP arg changes
*(TECH-4)*

- **File:** `utils/mows-vm-supervisor/src/kinds.rs:206-207`
- **Suggestion:** If MAJ-6 (extract bootstrap) is done, this is subsumed. Otherwise, build the dict via `mcp.setdefault(...)` and use `json.dumps` rather than embedding Python literals with single quotes.

### ✅ MIN-6 — `VmDetail.tsx` `useMemo` deps could be tightened
*(TECH-5)*

- **File:** `utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx:214-244`
- **Issue:** Memo includes `mowsContext.t.supervisor.vmDetail.console.ssh.typeLabel` etc.; reasonable, but if `mowsContext.t` is stable per language, the dep can shrink to language code.
- **Suggestion:** Verify whether `mowsContext.t` reference is stable; if so, depend on language code for fewer memo invalidations.

### ✅ MIN-7 — `TERM=xterm-256color` hardcoded in tmux session creation
*(TECH-6 / SLOP-10)*

- **File:** `utils/mows-vm-supervisor/src/agent_runtime.rs:227-232`
- **Issue:** Hardcoded in the source rather than coming from `AgentKind`.
- **Suggestion:** Pull from `kind.env` with a fallback to `xterm-256color`. Lets future kinds (e.g. a TUI-rich one) override.

### ✅ MIN-8 — Reconciliation cleanup is partial: tmux sessions, sockets, ssh keys not swept
*(QA-8)*

- **File:** `utils/mows-vm-supervisor/src/recovery.rs`
- **Issue:** Recovery kills QEMU PIDs and flips DB rows, but leaves behind tmux sessions, ssh key files, unix sockets in `state_dir`.
- **Suggestion:** Either document the cleanup contract ("DB + QEMU PIDs only; other artifacts are reclaimed on next agent spawn") or add a sweep step that prunes orphaned tmux sessions and sockets.

### ✅ MIN-9 — `/proc/<pid>/comm` `starts_with("qemu")` check is too loose
*(QA-7)*

- **File:** `utils/mows-vm-supervisor/src/recovery.rs:112-141`
- **Issue:** Matches any process named `qemu*` — e.g. `qemu_helper`, `qemu_monitor`, an unrelated user-space tool.
- **Suggestion:** Match exactly against the known qemu binary basename (`qemu-system-x86_64`, `qemu-system-aarch64`) loaded from config.

### ✅ MIN-10 — VMs in `starting` recovery test doesn't insert agents to verify cascade
*(QA-6)*

- **File:** `utils/mows-vm-supervisor/src/recovery.rs` test `marks_starting_and_stopping_vms_too`
- **Suggestion:** Extend the test fixture with agents in starting/running/stopping/stopped states inside the starting VM; assert non-terminal agents transition to failed and terminal ones don't.

### ✅ MIN-11 — `VmAgentConsole.bootstrap` has no timeout; hangs forever on slow supervisor
*(QA-13)*

- **File:** `utils/mows-vm-supervisor/web/src/components/VmAgentConsole.tsx` (bootstrap effect)
- **Suggestion:** Wrap `putAgent` in `Promise.race` with a 10-30s timeout; surface a "connection timeout" pill so the user can refresh.

### ✅ MIN-12 — No clean error path when the agent's VM was deleted between page-loads
*(QA-9)*

- **File:** `utils/mows-vm-supervisor/web/src/components/VmAgentConsole.tsx`
- **Issue:** If user reloads after the VM is gone, `PUT` returns 404 — does the component handle it cleanly?
- **Suggestion:** Test the path; if not handled, clear the persisted `tabId` and surface a "VM no longer exists" message.

### ✅ MIN-13 — Chromium baked into every base image, including non-claude flavors
*(FUTURE-6)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:120-128`
- **Issue:** `shell` agents and any future non-claude kinds pay the chromium image-size cost.
- **Suggestion:** Move chromium install into a conditional or a `headless+chrome` flavor variant; or accept it for now and add a TODO referencing a future per-kind image layer.

### ✅ MIN-14 — `VmSshConsole` may now be dead code
*(ARCH-5 / REPO-3)*

- **File:** `utils/mows-vm-supervisor/web/src/components/VmSshConsole.tsx`
- **Issue:** After the `VmDetail.tsx` swap, only the e2e `sshConsole.spec.ts` references it.
- **Suggestion:** If retained intentionally (fallback / direct attach path), add a comment. If not, delete the file + its `.test.tsx` + e2e references.

### ✅ MIN-15 — `chrome-devtools-mcp@1.1.0` compatibility with Node 22 (alpine 3.21) is asserted, not verified
*(DEVOPS-8 / QA-10)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:30-32,45`
- **Suggestion:** Add a CI smoke step that boots a fresh image, spawns a `claude` kind agent, and confirms the MCP server initializes successfully. Or pin `chrome-devtools-mcp` to a version with documented Node 22 support and link to that statement.

### ✅ MIN-16 — `CHROME_DEVTOOLS_MCP_VERSION` ARG not surfaced in `build.sh`
*(DEVOPS-3)*

- **File:** `utils/mows-vm-supervisor/image-builder/build.sh`
- **Issue:** ARG exists in Dockerfile (line 45) but `build.sh` doesn't pass it through. Bumping requires editing Dockerfile directly rather than overriding via env in build invocation.
- **Suggestion:** Add `--build-arg "CHROME_DEVTOOLS_MCP_VERSION=${CHROME_DEVTOOLS_MCP_VERSION:-1.1.0}"` to the buildx call.

### ✅ MIN-17 — Recovery marks `stopping` VMs as failed without distinguishing them in logs
*(DEVOPS-9)*

- **File:** `utils/mows-vm-supervisor/src/recovery.rs` + `src/main.rs:73-83`
- **Suggestion:** Emit a separate INFO-level log for VMs reaped from `stopping` (cleanly interrupted) vs `running` (true orphans).

### ✅ MIN-18 — Layer-count documentation at top of Dockerfile out of date
*(DEVOPS-1)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:12-20`
- **Suggestion:** Update the layer list to mention the chromium+MCP layer inserted between claude-code and mows-agent-init.

### ✅ MIN-19 — Path quoting inconsistency in the `find ... -prune` block
*(DEVOPS-4)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:190-193`
- **Issue:** `-path /proc` etc. are unquoted; prior form quoted `'/sys/*'`. Both work but consistency matters.
- **Suggestion:** Single-quote each path for stylistic consistency.

### ✅ MIN-20 — `bash` apk in packer stage needs a clearer root-cause note
*(SLOP-08 / DEVOPS-6 / QA-11)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:96-99`
- **Suggestion:** Expand the comment: "pack.sh needs bash for `set -o pipefail` (commit f70a3796) — busybox `sh` lacks pipefail. Any future refactor must either keep this apk or rewrite pack.sh to `/bin/sh`-compatible."

### ✅ MIN-21 — Alpine digest re-resolution is manual; no CI guard
*(DEVOPS-5)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:34-40`
- **Suggestion:** Add a CI lint that runs `docker buildx imagetools inspect alpine:$ALPINE_VERSION --format '{{json .Manifest.Digest}}'` and diffs against the pinned digest.

### ✅ MIN-22 — Generated `api-client.ts` not in `.gitignore` (commit policy unclear)
*(REPO-2)*

- **File:** `utils/mows-vm-supervisor/web/src/api/generated/api-client.ts`
- **Issue:** Project-wide policy is to commit the OpenAPI-generated client (per global CLAUDE.md), so the commit is intentional — but there's no explicit comment near `web/codegen` confirming this.
- **Suggestion:** Add a `README.md` or top-of-file note in `web/src/api/generated/` declaring it as generated + checked-in.

### ✅ MIN-23 — Recovery comment in `main.rs` oversimplifies the QEMU-child invariant
*(SLOP-12)*

- **File:** `utils/mows-vm-supervisor/src/main.rs:55-66`
- **Suggestion:** Distinguish the two cases in the comment: container restart (fresh PID namespace; all children gone) vs in-process supervisor restart inside the same container (children reparent to PID 1).

### ✅ MIN-24 — `cargo audit` / `npm audit` not run in CI
*(TASTE — dependency audit)*

- **Suggestion:** Run `cargo audit --json` and `npm audit --json` (in `web/`) in CI and gate on known CVEs (not freshness).

### ✅ MIN-25 — `ReconcileStats` naming inconsistent with project's `*Row` / `*Info` conventions
*(TASTE-9)*

- **File:** `utils/mows-vm-supervisor/src/recovery.rs:36-42`
- **Suggestion:** Align with project style — pick one of `Result` / `Stats` / `Info` and apply consistently across similar structs (VmRow, AgentSummary, ReconcileStats).

### ✅ MIN-26 — Verbose Dockerfile comments could be trimmed
*(TASTE-7 / TASTE-8 / SLOP-09)*

- **Files:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:36-56` (chromium block), `:70-86` (prune block)
- **Suggestion:** Keep the *why* (reproducibility caveat, prune-skips-subtree-not-children), drop the *what* that's obvious from the next lines.

### ✅ MIN-27 — `cp -a` does not propagate plugin removals from host to guest
*(TASTE-3 continuation)*

- **File:** `utils/mows-vm-supervisor/src/kinds.rs:191-192`
- **Suggestion:** Use `rsync -a --delete` (combined with CRIT-4's symlink fix). Drop `2>/dev/null || true`.

### ✅ MIN-28 — Repeated apk-base packages across `rootfs` and `packer` stages
*(REPO-4)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile`
- **Issue:** Two separate `apk add` lists with overlap. Acceptable (different stages, different needs), but unannotated.
- **Suggestion:** Add a one-line comment in each stage explaining the role and the reason for separation.

### ✅ MIN-29 — Port-recovery query depends on reconcile having run first; not asserted
*(ARCH-7)*

- **File:** `utils/mows-vm-supervisor/src/main.rs:73-95`
- **Suggestion:** Add a defensive comment + (optionally) thread the list of marked-failed VMs into the port recovery query as an explicit `NOT IN` exclusion so the ordering dependency is encoded in code, not just in commit order.

### ✅ MIN-30 — Idempotency-by-id vs idempotency-by-content not distinguished in the API
*(FUTURE-8)*

- **File:** `utils/mows-vm-supervisor/src/api/agents.rs:170-201`
- **Suggestion:** Document the contract in the OpenAPI description. If content-based idempotency is ever needed, add an `Idempotency-Key` header rather than overloading the path semantics.

### ✅ MIN-31 — `ReconcileStats` carries counts only; not future-proofed for distributed recovery
*(FUTURE-5)*

- **File:** `utils/mows-vm-supervisor/src/recovery.rs:36-42`
- **Suggestion:** Add `supervisor_id` (from config) so a future fleet coordinator can attribute recovery actions; emit as a `SupervisorEvent::RecoveryCompleted { stats }`.

### ✅ MIN-32 — `bash`-in-packer slop comment ("dies with not found") is bandaid-flavored
*(SLOP-08)*

- **File:** `utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:96-99`
- **Suggestion:** Already covered in MIN-20; root-cause the comment instead of describing the symptom.

### ⁉️ DROPPED — TECH-3: `-prune` form claimed broken
- **Reason:** Verified manually. The `\( -path /etc/hosts ... \) -prune -o -exec touch ...` form correctly prunes individual files (file `/etc/hosts` matches `-path /etc/hosts`; `-prune` returns true; the `-o -exec` branch never fires for that file). The agent's claim is incorrect.

### ⁉️ DROPPED — ARCH-8: Dockerfile changes are "orthogonal" to agent work
- **Reason:** Style/process feedback (split commits), not a bug.

---

## Recommendations (priority order)

1. **CRIT-1** — Wire `AuthContext` extraction into `put_agent` and `create_agent`; populate and verify `agents.owner_user_id`. This is the headline of the branch (`feat/mows-auth-core`); a new endpoint that ignores auth invalidates the whole effort.
2. **CRIT-2** — Add `existing.vm_id == vm_id && existing.kind == request.kind` check after `load_agent`. Returns 409 on mismatch. Fix in the same commit as CRIT-1 since they share the `load_agent` site.
3. **CRIT-3** — Replace `if let Ok(existing) = load_agent(...)` with explicit `match`; propagate non-NotFound errors.
4. **CRIT-4** — Symlink-safe + non-silent plugin staging.
5. **MAJ-1** — `validate_resource_name("agent_id", &agent_id)?` at the top of `put_agent`.
6. **MAJ-3** — Update stale `vms.rs` comments (1-line fix, no new code).
7. **MAJ-2** — Add justification comment for `--dangerously-skip-permissions`.
8. **MAJ-11** — Land Rust integration tests for `put_agent` covering CRIT-2/CRIT-3/MAJ-1/MAJ-4 paths; vitest for `VmAgentConsole`. The Critical/Major fixes won't be safe without them.
9. **MAJ-4** — `INSERT ... ON CONFLICT DO NOTHING` + reload to fix the TOCTOU.
10. **MAJ-5** — Pin chromium and friends by `apk` version.
11. **MAJ-6** — Extract `claude_bootstrap.sh` out of `kinds.rs`. Big readability win; subsumes MIN-5.
12. **MAJ-10** — Emit `SupervisorEvent::{Vm,Agent}Updated` from `reconcile_orphans` so the WS event stream stays consistent post-restart.
13. **MAJ-7 / MAJ-8** — Typed `AgentKindName` enum + `mcp_servers: Vec<McpServerSpec>` on `AgentKind`. Pre-req for any new kind that's coming.
14. **MAJ-9** — Namespace `tabId` per ConsoleManager instance to prevent cross-window collisions.
15. Minor cleanups in approximate file order (MIN-1 through MIN-32).
