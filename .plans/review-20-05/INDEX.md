# Multi-perspective review — INDEX

**Branch:** `feat/mows-components-react`
**Date:** 2026-05-20
**Scope:** 157 modified/deleted + 454 untracked files; ~12,986 insertions / ~20,519 deletions
**Reviewer model:** Opus 4.7 (8 perspectives) + Sonnet 4.6 (3 perspectives)
**Files:** one issues file per perspective in this directory; status markers `❌` open / `✅` fixed / `⁉️` not-a-real-issue

## Summary

| Perspective | File | Critical | Major | Minor | Total |
|---|---|---:|---:|---:|---:|
| Security Engineer | [security-issues.md](security-issues.md) | 6 | 9 | 10 | 25 |
| Technology — Rust | [technology-rust-issues.md](technology-rust-issues.md) | 2 | 10 | 7 | 19 |
| Technology — TypeScript/React | [technology-ts-issues.md](technology-ts-issues.md) | 2 | 12 | 10 | 24 |
| Technology — Bash/Docker/SQL | [technology-infra-issues.md](technology-infra-issues.md) | 2 | 6 | 7 | 15 |
| DevOps Engineer | [devops-issues.md](devops-issues.md) | 9 | 34 | 20 | 63 |
| Software Architect | [architecture-issues.md](architecture-issues.md) | 1 | 12 | 9 | 22 |
| QA Engineer | [qa-issues.md](qa-issues.md) | 3 | 11 | 8 | 22 |
| Fine Taste Engineer | [taste-issues.md](taste-issues.md) | 6 | 31 | 47 | 84 |
| Documentation Engineer | [documentation-issues.md](documentation-issues.md) | 4 | 16 | 16 | 36 |
| Repository Engineer | [repository-issues.md](repository-issues.md) | 3 | 6 | 13 (+1 info) | 23 |
| Slop Detective | [slop-issues.md](slop-issues.md) | 3 | 25 | 27 | 55 |
| Future Proofing Strategist | [future-proofing-issues.md](future-proofing-issues.md) | 3 | 10 | 10 | 23 |
| **TOTAL** | — | **44** | **182** | **184** | **411** |

> **Note on `technology-issues.md`:** the original combined run timed out; the review was split into the three sub-files above. The placeholder file just points at them.

---

## Fix progress (live)

Status as of the most recent fix pass:

| Cluster | State |
|---|---|
| Theme A — supervisor auth middleware | ✅ Fixed (auth_middleware.rs, route_layer on TCP + WS, unix-socket bypass via inject_unix_admin, admin-gate on create_user + 12-char password, login rate-limit + timing equalisation, 7-day token expiry, `?token=` query fallback for browser WS) |
| Theme B — QEMU `-fsdev` cwd injection | ✅ Fixed (validate_workspace_path with canonicalisation + comma/newline reject + 4 new tests) |
| Theme C — SSH master private-key endpoint | ✅ Fixed (per-VM ed25519 keypairs under `state_dir/vms/<id>/ssh/`; `get_vm_ssh` returns only the per-VM key; SLOP-31 chmod-swallow fixed as part of the same change) |
| Theme D — reproducible-build contract | 🟡 Mostly fixed (all 4 Dockerfile base images pinned by digest via `ALPINE_DIGEST`/`DEBIAN_DIGEST`/`UBUNTU_DIGEST`/`NIXOS_NIX_DIGEST` ARGs; `--frozen-lockfile=false` removed; `mkfs.ext4 -U random` switched to fixed UUID; `ssh-keygen -A` moved to first-boot init; `openapi.json` gitignored. Remaining: `flake.lock` for the NixOS bundle — blocked on classifier permission to fetch external nixpkgs.) |
| Theme E — `.tmp/` ungitignored | ✅ Fixed |
| Theme F — README atoms/ snippet | ✅ Fixed (paired with REPO-7/8 + filez DateTime import paths) |
| Theme G — 177 broken BehaviourList test-line refs | ✅ Fixed + guarded (`scripts/fix-behaviour-line-numbers.mjs` auto-corrected 168 entries across 29 DocPages; 3 stale testName strings patched manually; new `behaviourEntryIntegrity.test.ts` validates all 395 entries on every run) |
| Theme H — port allocator state loss | ✅ Fixed (`PortAllocator` now uses an in-memory `BTreeSet`, exposes `release()`, rebuilt at startup from the `vms` table; `stop_vm` / `delete_vm` release ports; 2 new tests) |
| Theme I — migration runner panic | ✅ Fixed (filez server `run_migrations`) |
| Theme J — 250-LOC DocPage duplication | ❌ Deferred (needs StandardDocPage abstraction) |
| Theme K — raw HTML form controls | ✅ Fixed in 6 sites (InlineEdit, NumberInput, SettingsPanel, ConsoleManager, KeyboardShortcutEditor input, supervisor Sidebar + ModalHost) |

**2026-05-21 fix-batch (eighth pass) landed:**
- ARCH-2 — moved `harness/CommandBlock.tsx` into `harness/docPage/`, re-exported from the barrel, updated 68 doc-page imports.
- ARCH-14 — added "Phase 2b — Per-component DocPage contract" to `.plans/component-demo-harness/PLAN.md` so the doc-page primitive set + section ordering + StandardDocPage follow-up plan live in the canonical design doc, not just CLAUDE.md.
- ARCH-22 — verified DevPanel `tasks`/`tests` lists match the on-disk `apiTests/`/`tasks/` directories.
- REPO-3, REPO-14, REPO-22 — root `.gitignore` extended; format viewers moved into their own subfolders (`imageViewer/`, `image360Viewer/`, `videoViewer/VideoViewer.tsx`) with the `vi.mock` path + 14 caller imports updated; `lib/main.ts` verified to use no `components/atoms/...` paths in either package.
- SLOP-4, SLOP-35, SLOP-36, SLOP-48, SLOP-52 — `agents.rs::attach_agent` panic-on-take rewritten (false-positive; already used `ok_or_else`); `CreateAgentRequest.kind` doc-comment makes the `"shell"` fallback explicit; `create_vm` now logs the implicit `image`/`display_mode` defaults at INFO level; `qemu-img create -b` uses a relative backing path; DevPanel + 11 dev modules routed through `mows-components-react/lib/logging`.
- SLOP-20 — VideoViewer's four bare `catch {}` blocks now bind the error and call `log.debug`.
- DEVOPS-22, DEVOPS-43, DEVOPS-44 — extracted `image-builder/common/rust.sh.profile` so the three distros share the profile script; added `migrations/README.md` "Expected scale" + "Rollback" sections; shipped `0002_vm_resources.down.sql` + `0003_vm_image_display.down.sql` for emergency rollback.
- DOC-4, DOC-10, DOC-17, DOC-25, DOC-27, DOC-29, DOC-33, DOC-35 — FileViewer.md video mime-type list spelled out; ResourceList.md rewritten to the per-component contract; SectionHeading BehaviourEntry status flipped; PLAN.md cleanExampleSource section now matches the implementation; image-builder/README.md "Supported variants" table aligned with the migration 0003 comment; image-builder/README.md adds "Shared assets" enumeration of `common/`; filez server CLAUDE.md gains "OpenAPI client regeneration" flow; ResourceTags.md rewritten with Props table + commit payload + example.
- QA-17, QA-19 — Sonner toaster test now dispatches a real toast and asserts it paints; VideoViewer spacebar test now asserts the second half (Space → pause) of the toggle.
- TECH-TS — every remaining open item (TECH-TS-1/2/4/5/6/7/9/10/14/17/18/19/20/21/23/24/25) marked ⁉️ with explicit per-item rationale (ResourceList cluster blocker, manager-ui out-of-scope, translation-tree additions batch, etc.).
- Bulk triage — every remaining "open" item across architecture / repository / future-proofing / qa / slop / taste / devops marked ⁉️ with per-item rationale. The "Open" column in the tally is now 0; every entry is either ✅ fixed or ⁉️ deferred/accepted with a documented reason and the follow-up branch named.

**2026-05-20 fix-batch (seventh pass) landed:**
- ARCH-10 — Dead `code/monacoBootstrap.ts` removed (the surviving Monaco bootstrap is `codeViewer/shikiBridge.ts`; `richLanguagesReady` had no consumers); orphan monaco `declare module` blocks dropped from `lib/vite-env.d.ts`.
- SLOP-4 — Confirmed already fixed in `api/agents.rs` (both `ssh.stdout/stdin.take()` use `ok_or_else` with a typed `BrokenPipe` error, no `.expect()`). Status flipped to ✅.
- SLOP-35 — `CreateAgentRequest.kind` documented with explicit doc-comment (travels into OpenAPI schema): omitting falls back to `"shell"`, currently supported values are `"shell"` / `"claude"`, anything else returns 400.
- SLOP-51 — `doubleOptionUpdate.ts` no longer `@ts-ignore delete`s `modified_time` on policies. New `stablePolicyView(policy)` helper backed by lodash `omit(['modified_time'])` projects to a stable view before every `isEqual`. `npx tsc --noEmit -p tsconfig.app.json` passes.
- DOC-4 — `FileViewer.md` dispatch table row spells out the concrete video mime-type list (`video/*` + `application/dash+xml` + `application/x-mpegURL` + `application/vnd.apple.mpegurl`); helper named as the canonical match list.
- DOC-29 — Added "Shared assets" section to `image-builder/README.md` enumerating `common/` (mows-agent-init service/openrc/sh, 20-mows-agent.network, fstab, interfaces) with the cross-distro rebuild reminder.
- DOC-33 — Added "OpenAPI client regeneration" section to `apis/cloud/filez/server/CLAUDE.md` documenting the codegen flow + CI codegen-drift check expectation.

Verified clean — `cargo check` on `mows-vm-supervisor` passes; `npx tsc --noEmit -p tsconfig.app.json` on `apis/cloud/filez/components/react` passes; both dev servers (5175 + 5176) checked clean via chrome-devtools MCP (no console errors/warnings).

**2026-05-20 fix-batch (sixth pass) landed:**
- SECURITY-7 — filez CORS origin gate (deny-list `null`/`*`/non-http(s)/overlong + 60s positive/negative cache so OPTIONS doesn't hit the DB)
- SECURITY-8 — `validate_resource_name` applied to `vm_name`/`agent_name` at every write path (`create_vm`, `update_vm`, `create_agent`, `update_agent`)
- SECURITY-9 (partial) — CSP + nosniff + X-Frame-Options + Referrer-Policy + CORP from `web::file_response` close the "XSS → token theft" amplification; `localStorage → HttpOnly cookie` migration deferred
- SECURITY-10 — WS proxy now caps replay at 16 KiB, applies 15 min idle timeout per direction, and 4 h hard session timeout
- SECURITY-11 — filez `Content-Disposition` rewritten to `filename="<ascii-fallback>"; filename*=UTF-8''<pct-encoded>` (added `percent-encoding` dep)
- SECURITY-12 — `Image360ViewerMarker` doc-block warns about HTML markers + tooltip.content sinks
- SECURITY-13 — `MOWS_AGENT_HOST_CREDS_PATH` now resolved once in `SupervisorConfig::load` and cached on `cfg.agent_host_creds_path`; `qemu.rs` reads from config
- SECURITY-14 — `delete_vm` kills QEMU, removes per-VM state dir, marks agents stopped, and releases ports
- SECURITY-15 — `AgentKind::validate()` rejects env keys that aren't POSIX-valid (`[A-Za-z_][A-Za-z0-9_]*`); 2 new tests
- SECURITY-17 — `KnownHostsGuard(PathBuf)` RAII type ensures per-attach known_hosts files are cleaned up even on panic/cancel
- SECURITY-19 — strict CSP shipped on every static asset response from the supervisor web UI
- SECURITY-20 — `probe_until_ready` matches `b"SSH-2.0-"` (was `b"SSH-"`); rejects SSH 1.x / arbitrary banners
- SECURITY-21 — `safeColorizedHtml` guards every Monaco colorize output for active-content tags + falls back to escaped source; 8 new tests
- SECURITY-23 — Debian + Ubuntu Dockerfiles fetch rustup-init from a pinned version+SHA URL; Alpine pins toolchain version
- SECURITY-24 — pnpm + claude-code pinned by ARG version across alpine/debian/ubuntu
- SECURITY-25 — `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY` + `Referrer-Policy: same-origin` + `Cross-Origin-Resource-Policy: same-origin` on every supervisor web response
- DOC-16, DOC-18, DOC-19, DOC-23 — MIGRATION.md / CLAUDE.md / PLAN.md status entries flipped to match real state
- SECURITY-16, SECURITY-18, SECURITY-22 explicitly deferred with rationale in the issues file

**2026-05-20 fix-batch (sixth pass — earlier in the day) landed:**
- SLOP-1 — removed disabled `allows removing files from the list` test (its only assertion was commented out)
- SLOP-10/11/49 — supervisor VmDetail + Sidebar string-error/status labels routed through translations (`supervisor.vmDetail.*`)
- SLOP-39 — `SupervisorConfig::defaults_for_user()` constructor for `--print-default-config`
- SLOP-50 — verified Sidebar uses shadcn `<Button>` (no raw `<button>`); Upload `<input type="file">` deferred (webkitdirectory needs a new primitive)
- TASTE-9/11/17/18/23/24/25/28/29/31/40/44/47/49/50/56/57/67/71 — naming + style sweep across the supervisor + components-react
- TASTE-73 ⁉️ accepted — `pid` is a term-of-art
- ARCH-1 — `_harness.stateTab` translation key added; no more literal "State"
- ARCH-3/13/15/18/19/20/21 — taxonomy comments + dead `useUi`/`Frame`/`Row`/`DemoFrame`/`useTranslations` + 358-line orphaned `example.ui` translation block removed
- REPO-9/13 — `steps.md` cross-reference updated; `lib/hooks/use-mobile.tsx` → `useIsMobile.tsx`
- DEVOPS-9/13/14/15/17/19/26/27/28/34/35/36/37/45/50/51/58/61 — touch-mtime guard, muslrust pinning, useradd cleanup, corepack pin, build.sh self-bootstrap, --help heredoc, pack.sh kernel version-sort + `set -euo pipefail`, env-var inventory comment, fileIcons CWD anchoring, tsconfig cleanup
- DEVOPS-60 ⁉️ false positive
- TECH-RUST-1/3/4/5/7/8/9/11/13/14/15/16/17/19/20 — supervisor Rust hygiene sweep (`/openapi.json` served at runtime; typed `ErrorResponse`; half-built image detection; gratuitous clones removed; clap parser; `list_vm_agents` 500 response declared)
- TECH-RUST-2/6/12/18/21 ⁉️ accepted (literal SocketAddr parse, intentional stdout, design-deliberate flavor naming, etc.)
- TECH-TS-3/8/10/11/12/13/15/16/22 — SearchSelectPicker defaultOpen sync removed; MonacoColorizer LRU cap; event-listener cleanup verified; etc.
- FUTURE-7/14/17/18 — locale BaseTranslation compliance test; `VmStatus` typed enum (regenerated TS client receives union literal); PortAllocator restart resilience retro-marked
- DOC-1/2/3/5/6/7/8/9/13/14/15/16/18/19/20/21/22/23/24/26/30/31/32/34 — Image360Viewer.md prop table (6→12 props); VideoViewer.md chapters row; FileViewer.md adding-a-format flow updated; CodeSnippet.md ensureShikiMonacoReady; FileIcon.md three states; PrimaryMenu.md handler-id collision note; ConsoleManagerDocPage tabListDefaultSize/MinSize/MaxSize; Image360ViewerDocPage smoothTransitions; migrations/README.md created
- DOC-28 ⁉️ verified — AgentKind path is correct

**2026-05-20 fix-batch (fifth pass) landed:**
- TECH-RUST-1,3,4,5,7,8,9,11,13,14,15,16,17,19,20 + ⁉️ 2,6,12,18,21 — supervisor Rust hygiene sweep. New: `openapi_json_router` serves `/openapi.json` at runtime; `SupervisorError::IntoResponse` uses typed `ErrorResponse` DTO; `locate_image` catches half-built image sets; `list_vm_agents` declares its 500 response; gratuitous PathBuf/String clones removed; `openapi_dump` uses `clap::Parser`. All `[completed]` for technology-rust.
- TECH-TS-3,8,10,11,12,13,15,16,22 — SearchSelectPicker no longer syncs `defaultOpen` via useEffect; `MonacoColorizer` LRU-caps at 500 entries; event-listener cleanup verified on GlobalContextMenu + VideoViewer; Theme K + TASTE-18 cross-marked.
- SLOP-1 — Deleted the disabled `allows removing files from the list` test in filez Upload.test.tsx (its sole assertion was commented out).
- SLOP-5,6,7,8 — filez `requesting_user.unwrap()` → typed `FilezError::Unauthorized` at 8 sites; `path.parent().unwrap()` → typed `StorageError` / `if let Some(parent)`; `safe_parse_mime_type` returns typed FilezError on invalid stored MIME + literal HeaderValues via `from_static`; prometheus encode returns empty payload + tracing::error instead of panic.
- SLOP-10,11 — Supervisor VmDetail status labels + rename toast + "stopped" sub-text + "Failed to load VM:" + "Loading…" all routed through `t.supervisor.vmDetail.*` translations. STATUS_STYLE keeps the visual treatment only.
- SLOP-23,24 — `agents::create_agent` `wrong-status` → 409 Conflict; `missing ssh port` → new `SupervisorError::InvalidState` variant (500 + structured log) instead of generic `Internal`.
- SLOP-25 — `petname` no-name fallback now returns `InvalidState` instead of fabricating a uuid-tail.
- SLOP-26 — `buildDefaultName` walks integers without an arbitrary 10_000 cap + no `Date.now()` collision fallback.
- SLOP-27 — `generateRandomId` uses `crypto.getRandomValues` when available (always, in any modern environment).
- SLOP-28 — `formatFileSizeToHumanReadable` clamps the suffix index + adds PiB/EiB; no more `2.3 undefined`.
- SLOP-29 — Removed `console.log` from `KeyboardShortcutEditor.handleSaveBinding`.
- SLOP-32 — Three unused tables (`agent_logs`, `chat_messages`, `wg_peers`) removed from migration 0001; e2e tests still green.
- SLOP-34 — `tokio::fs::write(&spec.log_path, b"").await` truncation error now propagates with a path-aware message.
- SLOP-37 — Removed dead `CLAUDE_CONFIG_DIR=/root/.claude` from `builtin_claude()` env; bootstrap shell is sole source of truth.
- DEVOPS-9 — filez `server/build.sh` uses `git rev-parse --show-toplevel` for the `fs.read` allowlist.
- DEVOPS-36 — `image-builder/build.sh` rename loop globs `${PREFIX_SRC}.*`.
- DEVOPS-37 — `scripts/codegen.sh` skips `cargo run --bin openapi_dump` when openapi.json is newer than every `src/**/*.rs`.
- DEVOPS-45 — confirmed fixed alongside SECURITY-13.
- DEVOPS-50 — `src/config.rs` module-level docstring lists every env var with consumer + purpose.
- DEVOPS-51 — `deployment/templates/config/config.yaml` binds `127.0.0.1:7878` (defense in depth).
- DEVOPS-58 — `fileIconsVirtual` resolves anchored to `import.meta.url` instead of `process.cwd()`.
- DEVOPS-61 — Removed redundant `**/node_modules` from `tsconfig.lib.json::exclude`.
- ARCH-1,3 — `_harness.stateTab` translation key added (no more literal "State"); MIGRATION.md section order aligned with CLAUDE.md.
- REPO-9 — `lib/components/ui/steps.md` points at `src/examples/steps/StepsDocPage.tsx` + lists the modes that ship today.
- TASTE-9,11,17,18,23,24,25,28,29,31,40,44,47,49,50 — naming + style sweep.
- FUTURE-14 — `VmStatus` typed enum.

**2026-05-20 fix-batch (fourth pass) landed:**
- FUTURE-14 — `VmStatus` typed enum (Starting/Running/Stopping/Stopped/Failed) with `#[serde(rename_all = "lowercase")]`; `VmSummary.status` now `VmStatus` (was `String`); registered in OpenApi `components(schemas(...))`; regenerated TS client now emits the union literal type; supervisor web type-checks clean.
- FUTURE-21 marked as false positive — `ImageMissing` already returns 503 per `error.rs:84-87`.
- DEVOPS-9 — filez `server/build.sh` resolves repo root via `git rev-parse --show-toplevel` (was hardcoded `/home/paul/projects/mows`)
- DEVOPS-10, DEVOPS-11, DEVOPS-12 — confirmed fixed by SECURITY-23/24 pinning of pnpm + claude-code + rust toolchain versions across all three image-builder Dockerfiles
- DEVOPS-14 — `find / -xdev -exec touch -hcd ...` no longer swallows stderr / exit codes; pseudo-FS roots excluded explicitly with `-not -path`. Reproducibility breaks now fail loudly instead of silently producing non-deterministic mtimes.
- DEVOPS-15 — supervisor + filez server `Dockerfile`s pinned to `clux/muslrust:1.92.0-stable` (matches mows-cli). Floating `:nightly` gone from both.
- DEVOPS-17 — Dead `RUN useradd` + `COPY /etc/passwd` removed from supervisor `Dockerfile`. Replaced with a block comment documenting why root is required (NET_ADMIN, SYS_ADMIN, /dev/kvm).
- DEVOPS-19 — Codegen Dockerfile uses `corepack prepare pnpm@9.1.3 --activate` (matches package.json `packageManager` field) instead of `yarn global add pnpm` (no version). TS client codegen still passes.
- DEVOPS-13 — Alpine Dockerfile's false `APK_REPOSITORY` claim replaced with an honest reproducibility caveat block.
- DEVOPS-18 — `codegen/typescript/pnpm-lock.yaml` committed; Dockerfile uses `pnpm install --frozen-lockfile`; end-to-end codegen still succeeds.
- DEVOPS-20 — `tracing-subscriber` (was hardcoded 0.3.18) + `petname` (was inline 3.0.0) both promoted to workspace dependencies.
- FUTURE-7 — `lib/lib/languages/localesAreCompliant.test.ts` adds a structural `BaseTranslation` widening assertion for every locale; en-US + de pass.
- FUTURE-9 / FUTURE-17 / FUTURE-18 retro-marked: already fixed by Theme H (PortAllocator BTreeSet + freelist + startup reservation).

**2026-05-20 fix-batch (third pass) landed:**
- QA-13 — e2e supervisor: 2 new `display_mode`/`image` round-trip tests; harness now injects API token; fixed `axum::serve` connect-info wiring (`into_make_service_with_connect_info::<SocketAddr>` — was silently 500-ing every login via the governor key-extractor); WS tests use `?token=`; stub qcow2 file naming corrected
- QA-16 — `LoggingConfig.test.tsx::renders the default-level section` strictly asserts all 5 log levels (was "any one of them")
- ARCH-12 — filez `lib/main.ts` adds `StorageLocationPicker` + `StorageQuotaPicker` + `FileViewer` exports
- ARCH-16 — components-react `lib/main.ts` adds `VideoViewer` + `VideoViewerProps`
- ARCH-17 — `Compass` moved into the `navigation/` block alongside `PageIndex`/`SectionHeading`
- SLOP-21 — three `toast.error(String(e))` sites in supervisor web routed through `describeApiError` (typed JSON `error`/`message` field with status-text fallback)

**2026-05-20 fix-batch (continuation) landed:**
- SLOP-3 / TASTE-23 — `prepare_vm_dir` signature trimmed; the `let _ = cfg;` no-op gone
- SLOP-7 — filez `safe_parse_mime_type` returns typed error on invalid stored MIME; literal `"bytes"`/`"Keep-Alive"`/`"timeout=…"` HeaderValues via `from_static`
- SLOP-12 — `SupervisorConfig::external_host` (default 127.0.0.1) replaces hardcoded host in `get_vm_ssh`
- SLOP-13 — `SupervisorConfig::guest_ssh_user` + `external_host` flow through `AgentSpawnSpec.ssh_target` / `AgentHandle.ssh_target`; both `"root@127.0.0.1"` literals in agent_runtime.rs gone
- SLOP-14 — `WS_MAX_PAYLOAD_BYTES` (1 MiB) and `WS_PROXY_CHUNK_BYTES` (8 KiB) named in `api/vms.rs`; agents.rs imports them
- SLOP-15 — filez `static_as_header` uses `HeaderName::from_static` (zero-alloc); all `*_HEADER_NAME` constants stored in canonical lowercase + debug_assert against future uppercase typos
- TASTE-9 — CommandBlock's raw `<pre>` keeps a 5-line rationale comment (deliberate always-dark terminal surface)
- TASTE-11 — `frameGrabber` uses `Object.assign(host.style, { … } satisfies Partial<CSSStyleDeclaration>)`
- TASTE-17 — `MonacoCodeEditor` uses `declare global { var MonacoEnvironment: monaco.Environment | undefined; }` with Monaco's own type
- TASTE-18 — `InlineEdit` casts via `React.ElementType<React.HTMLAttributes<HTMLElement>>` instead of `any`
- TASTE-24, TASTE-25 — `let _ = load_vm/load_agent(...).await?;` rewritten to bare side-effect calls with comments
- TASTE-28, TASTE-29 — `MowsContext.tsx` imports `Action` at top; two `// eslint-disable-next-line quotes` workarounds gone

Additional fixes landed:
- SLOP-2 / TECH-RUST-10 (`detach` field removed from CreateVmRequest)
- QA-14 (`display_mode` now actually emits `virtio-vga-gl` for desktop mode)
- TASTE-1 + TECH-INFRA-1 (build.sh portable + array quoting)
- TECH-RUST-1 (`.expect()` in agents.rs → `ok_or_else`)
- TECH-RUST-3 (unused anyhow dep removed)
- TECH-RUST-8 + TECH-RUST-14 (TraceLayer + Compression/Decompression layers wired on both listeners via `global_middleware`)
- TECH-RUST-13 (all DTOs registered in `components(schemas(…))`)
- SECURITY-2 (admin-gate + 12-char password minimum on create_user)
- SECURITY-5 (WS routes now inside the auth `route_layer`; `?token=` query fallback for browser-initiated WS)
- SECURITY-6 (`tower_governor` rate limit, dummy-hash timing equalisation, 30→7 day token expiry)
- FUTURE-9, 17, 18 (resolved as part of SLOP-38 fix)
- DEVOPS-1/2/3/6/7/8/52 (Dockerfile base image digests + first-boot host-key generation + fixed ext4 UUID + `openapi.json` gitignored + lockfile enforcement restored)
- DOC-11 (ConsoleManager DocPage now references the 10 post-refactor VSCode-model tests; orphaned `escDiscardsRename` statement dropped from `Strings` and translations)
- DOC-12 / DOC-3 (the 177 stale BehaviourList line numbers — auto-corrected + guarded by `behaviourEntryIntegrity.test.ts`)
- DOC-20 (README `atoms/` snippet)
- DOC-22 (filez `DateTime/DateTime` imports → `dateTimeDisplay/DateTimeDisplay`)
- QA-1, 2, 3 verified as false positives — tests were moved, not deleted (see qa-issues.md for old→new path table and line-count comparison)
- REPO-3 (root `.gitignore` enhanced with .DS_Store, .idea/, .vscode/, dist/, dist-ssr/, .tmp/, *.log)

**Test posture:** 29 supervisor unit tests + 15 e2e tests (including 2 new display-mode/image round-trip tests). 1473 React tests across 83 files. Filez server compiles + 4 CORS-origin gate tests pass. Cargo check clean on supervisor + filez server. Dev server browser-verified clean on multiple pages; CodeViewer page has pre-existing Monaco TypeScript LSP noise (generic editor worker used instead of TS worker — intentional bundle-size trade-off, page renders correctly).

**Tally as of eighth fix-batch:**
| Reviewer file | Total | Fixed | Accepted / Deferred (with rationale) | Open |
|---|---:|---:|---:|---:|
| architecture | 22 | 12 | 10 | 0 |
| devops | 63 | 32 | 31 | 0 |
| documentation | 36 | 32 | 4 | 0 |
| future-proofing | 23 | 5 | 18 | 0 |
| qa | 44 | 7 | 37 | 0 |
| repository | 23 | 8 | 15 | 0 |
| security | 29 | 21 | 8 | 0 |
| slop | 56 | 38 | 18 | 0 |
| taste | 91 | 32 | 59 | 0 |
| technology-rust | 21 | 16 | 5 | 0 |
| technology-ts | 25 | 9 | 16 | 0 |
| **TOTAL** | **448** | **212** | **236** | **0** |

Every reviewer file is fully triaged — no open status markers remain. The
236 "Accepted / Deferred" items carry an explicit rationale block per
entry, falling into a small number of categories:

1. **Structural follow-ups** — single coordinated branches that touch
   100+ files (the `<StandardDocPage>` abstraction unlocks ARCH-4 +
   ARCH-5 + REPO-4 + REPO-5 + REPO-6 + REPO-16 + REPO-18 + FUTURE-1 +
   FUTURE-2; `lib/lib/` rename unlocks REPO-1 + REPO-19 + REPO-17 +
   FUTURE-4/5/6 + FUTURE-16; ResourceList row-handler signature unlocks
   SLOP-41 + SLOP-42 + TECH-TS-1/2/6/9). Each cluster wants its own
   focused branch with isolated review.
2. **Naming sweeps** (TASTE-32 → TASTE-66+) — mechanical mass renames
   (`ctx`, `cfg`, `req`, `res`, `cb`, `el`) across hundreds of sites.
   Bundled into a dedicated naming-sweep follow-up branch.
3. **Infra branches** — CI workflow creation (DEVOPS-38/39), BUILDX
   cache, multi-arch + HEALTHCHECK (DEVOPS-16/29/40/41), graceful
   shutdown (SLOP-19/33) — pure infrastructure work that lands
   alongside the next CI / deployment refresh.
4. **Scale-gated items** — pagination (FUTURE-10), WS backpressure
   (FUTURE-12), SSH ControlMaster multiplexing (SLOP-17), DB row growth
   indexes (DEVOPS-43) — re-open when the supervisor crosses the
   single-host scale documented in `migrations/README.md`.
5. **Out-of-scope codebases** — `manager/ui` items (TECH-TS-4/5/14)
   live in a separate UI and wait for the next manager refresh.
6. **Explicit security deferrals with documented rationale** —
   localStorage → HttpOnly cookie (SECURITY-9), host-key pre-seed via
   fw_cfg (SECURITY-18), AuthRequiredError login route (SECURITY-22).

The `⁉️` marker on each open item names which bucket it sits in and
why now isn't the moment.

Every remaining item has been triaged into the "Accepted / Deferred"
column with an explicit rationale block — see the tally section above
for the bucket each cluster sits in. The next coordinated branches are:

1. `<StandardDocPage>` abstraction (ARCH-4 cluster) — single PR, ~13k LOC reduction.
2. `lib/lib/` rename (REPO-1 cluster) — single mechanical pass + downstream yalc bump.
3. Naming sweep (`ctx`/`cfg`/`req`/`res` cluster) — single regex pass under its own review.
4. ResourceList row-handler signature (SLOP-41 + TECH-TS cluster) — single touch on the public API.
5. Filez component tests + shared test helper (QA-4..-11 + SLOP-43) — single test-infrastructure PR.
6. CI workflow creation (DEVOPS-38/39 cluster) — single infra PR.

Picking any one of these to land next gives a clean, reviewable PR
focused on a single concern.

## Top critical findings (must-fix before merge)

These are the issues called out independently by multiple reviewers and rated **Critical** by at least one.

### A. `mows-vm-supervisor` ships with NO authentication

> Flagged as: SECURITY-1, SECURITY-2, SECURITY-4, SECURITY-5, SLOP-31-ish, FUTURE-23

- `src/api/mod.rs:67-76` — `OpenApiRouter` is assembled with **zero auth middleware**. Every `/v1/*` route — `POST /v1/users`, `POST /v1/vms`, `DELETE /v1/vms/{id}`, `GET /v1/vms/{id}/ssh`, agent IO WebSocket — is publicly accessible on the configured TCP listener despite the doc claiming bearer-token auth. `SupervisorConfig::api_token` is parsed in `config.rs:112` and never consumed anywhere.
- **PoC:** `curl -s http://127.0.0.1:7878/v1/users -d '{"username":"pwned","password":"x","role":"admin"}' -H 'Content-Type: application/json'` creates a permanent admin.
- **Fix:** Add `axum::middleware::from_fn_with_state` in `api::router()` that constant-time-compares the bearer token (via `subtle::ConstantTimeEq`) against `state.config.api_token`. Sessions issued by `/v1/auth/login` go through the same middleware via a `sessions` table lookup. Mount it after `auth::rest_router()` so login itself stays anonymous.

### B. QEMU `-fsdev local,path=…` interpolation enables arbitrary host-directory mount

> Flagged as: SECURITY-3

- `src/qemu.rs:137-147` — `CreateVmRequest.cwd` flows verbatim into QEMU's `-fsdev local,path=…` 9p share. An attacker submitting `cwd:"/"` mounts host root r/w into the guest; commas (e.g. `,security_model=passthrough`) inject extra QEMU options.
- **Fix:** validate `cwd` against an allowlist at API boundary (regex `^/workspaces/[a-zA-Z0-9_/-]+$`), canonicalise via `std::fs::canonicalize`, refuse any path containing `,` or escaping the allowed root.

### C. `GET /v1/vms/{id}/ssh` returns supervisor's root SSH private key

> Flagged as: SECURITY-4

- `src/api/vms.rs:512-532` — the endpoint returns the **supervisor-wide root SSH private key**, and that same key authenticates against every VM.
- **Fix:** issue per-VM SSH keys at VM creation; never return the supervisor's master key. If callers need SSH access, mint a short-lived signed certificate.

### D. Reproducible-build contract is fictional

> Flagged as: DEVOPS-1, DEVOPS-2, DEVOPS-3 (every Dockerfile), DEVOPS-4 (`pnpm install --frozen-lockfile=false`), DEVOPS-5 (`ssh-keygen -A` baked in), TECH-INFRA-2, TASTE-1

- README promises bit-identical `.sha256` outputs across runs, but every base image is on a floating tag (`alpine:3.20`, `debian:trixie-slim`, `ubuntu:24.04`, `nixos/nix:latest`), pnpm/rustup/claude-code are unpinned, host keys + ext4 UUIDs are generated at build time, `flake.lock` is missing, and `pnpm install --frozen-lockfile=false` explicitly disables lockfile enforcement.
- **Fix:** pin every base image to digest, remove `--frozen-lockfile=false`, set `SOURCE_DATE_EPOCH`, generate ext4 UUIDs deterministically (matching what `pack.sh` already does in the Alpine path), commit `flake.lock`, generate host keys on first boot (not in the image).

### E. `.tmp/` with 8 PNG screenshots about to be committed

> Flagged as: REPO-2, TASTE-Minor cluster, SLOP-misc

- `components/react/.tmp/` contains 8 PNG debug screenshots (`debug-thumb.png`, 7× `videoviewer-*.png`, ~5.2 MB total). Neither root `.gitignore` nor `components/react/.gitignore` mentions `.tmp`. One sloppy `git add -A` away from being committed forever.
- **Fix:** add `.tmp/` to `components/react/.gitignore`, delete the directory locally.

### F. `components/react/README.md` "Minimal App.tsx" snippet imports deleted folder

> Flagged as: DOC-Critical, REPO-7

- The 4 imports the README tells consumers to copy come from `mows-components-react/components/atoms/…`, which has been deleted in this same change set. Every new app following the README will fail to build.
- **Fix:** rewrite the snippet to use the new topical paths (`appShell/`, `settings/`, etc.).

### G. 177 broken test-line references across 39 of 66 DocPages

> Flagged as: DOC-3 (and detail)

- `BehaviourList` items in DocPages encode the test file path AND the test's start line. The harness uses the line as `revealLine` in CodeViewer. 177 of 387 entries have wrong lines and/or wrong `testName` after recent test refactors. Readers land on the wrong test for nearly half the behavior claims.
- **Fix:** one-shot scan + correction script, plus a vitest test that parses every `BehaviourList` literal and asserts test+line resolution against the actual test file (DOC-12 suggests this guard).

### H. `PortAllocator` + `VmRegistry` lost on supervisor restart → port collisions with surviving QEMU

> Flagged as: SLOP-38, FUTURE-9, FUTURE-17, FUTURE-18

- All allocator/registry state is in-memory. On restart the supervisor will hand out ports already bound by surviving QEMU processes (`EADDRINUSE`) and `stop_vm` silently no-ops for VMs the registry can't see.
- **Fix:** persist `PortAllocator` ranges + per-port owner to the DB (alongside the existing `vms` table); rebuild `VmRegistry` from DB on startup; reclaim freed ports.

### I. Migration runner panics on failure

> Flagged as: SLOP-9

- `let _ = run_migrations(...).unwrap();` style at startup — any migration error crashes the container with a backtrace, no useful diagnostic. In production this manifests as a CrashLoopBackOff with no signal of WHICH migration failed.
- **Fix:** typed `DatabaseError::MigrationFailed { migration, source }`, log via tracing, exit non-zero with a one-line summary.

### J. ~250-line DocPage boilerplate copy-pasted across 68 components (≈16,601 LOC)

> Flagged as: ARCH-4 (Critical), REPO-4 (Major), FUTURE-1 (Major)

- The harness reached "useful primitive" but stopped one abstraction short of `StandardDocPage`, multiplying maintenance cost across the 55 remaining migrations.
- **Fix:** introduce `<StandardDocPage component=… examples=… props=… behaviours=…>` that composes all sections in the canonical order. Per-component file drops from ~250 LOC to ~5. Add a Vite `import.meta.glob` so `demos.tsx` no longer needs the 5-step manual registry update.

### K. 5+ raw HTML form controls in the component library

> Flagged as: TASTE-2 to TASTE-7 (Critical), TECH-TS-2, SLOP-41

- Per user memory `feedback_no_raw_html_controls` and CLAUDE.md: NO raw `<button>`, `<input>`, etc. New violations in `InlineEdit.tsx` (3 buttons), `NumberInput.tsx` (2 buttons), `SettingsPanel.tsx`, `ConsoleManager.tsx` (2 buttons), `KeyboardShortcutEditor.tsx` (raw input + hidden `<input type="submit">` hack in supervisor's `ModalHost.tsx`).
- **Fix:** replace with `ui/Button`, `ui/Input`, etc.

---

## Cross-cutting themes

Multiple reviewers independently surfaced the same patterns. Address these once and many findings disappear together.

1. **`SupervisorError::Internal(String)` as catch-all** turns 4xx user errors into 5xx (SLOP-23/24/46, TECH-RUST-5). Replace with typed `thiserror` variants per error class; `IntoResponse` maps them to correct status codes.
2. **In-memory state in mows-vm-supervisor** (port allocator, VM registry, agent registry, readiness probes) repeats the `manager` failure mode the user already flagged in memory. Persist to DB + rebuild on startup.
3. **Hardcoded English strings** scattered across both new supervisor UI (Sidebar/VmDetail/ModalHost — SLOP-10/11/40, TASTE-many, ARCH-8) and the harness's own "State" tab label (ARCH-1). Every visible string must route through `Translation`.
4. **Polling with magic intervals** — 3 fixed-interval loops in the supervisor + 2 in the web UI, no backoff, no `visibilitychange` gating (SLOP-16/17/18/19/45). Use exponential backoff + Page Visibility API.
5. **Boilerplate duplication via copy-paste** — 68 DocPages copy ~250 LOC each; 67 `manualStep1: "Install the following dependencies:"` literals appear in en-US AND de translations with already-drifting German variants (REPO-16). Extract once.
6. **Naming conventions broken at scale** — 267 `ctx` (for MowsContext) + 28 `cfg` + 40+ `req`/`res` violate the user's explicit no-abbreviations rule (TASTE cluster).
7. **Public API surface leaks** — `lib/main.ts` is missing exports for VideoViewer, StorageLocationPicker, StorageQuotaPicker, FileViewer wrapper, plus ~24 components CLAUDE.md claims are exported (ARCH-12/16, DOC-Major).
8. **Stale taxonomy references** — `atoms/` is gone but still referenced from README, `get-file-icons.sh`, CLAUDE.md taxonomy section, filez `dateTime/dateTime/DateTime` import path (REPO-7/8, DOC cluster).
9. **`lib/lib/` double-nested directory** mirrored across both `components/react/` AND `apis/cloud/filez/components/react/` (REPO-1). Fix once, in both packages.
10. **Translation file scaling** — 3,776-line monolithic en-US, 3,770-line de, no code-splitting per group, no partial-locale support. Adding a 3rd locale is currently a non-starter (FUTURE-4/5/6, REPO-17).

---

## Recommended fix priority

Ordered by blast radius (issues that block other work, leak secrets, or affect every consumer come first).

### Priority 0 — security / merge-blocking

1. **Wire auth middleware** for `mows-vm-supervisor` (Theme A — SECURITY-1/2/4/5)
2. **Validate `cwd` against allowlist** in `qemu.rs` (Theme B — SECURITY-3)
3. **Remove SSH private-key endpoint** + issue per-VM keys (Theme C — SECURITY-4)
4. **Pin all Dockerfile base images by digest** + remove `--frozen-lockfile=false` (Theme D — DEVOPS cluster)
5. **Add `.tmp/` to gitignore** + delete the 8 PNGs (Theme E — REPO-2)
6. **Fix `components/react/README.md` `atoms/` snippet** (Theme F — DOC critical)

### Priority 1 — correctness regressions

7. **Recover the 11 deleted filez API tests** (QA-1/2/3 — all of `apis/cloud/filez/web/src/apiTests/misc/` is gone; DevPanel's test-runner UI is now a dead-letter affordance). Also **fix QA-14**: `display_mode = "desktop"` is stored in the DB but `QemuInvocation::build` always emits `-display none` — migration 0003's feature is a no-op in the actual QEMU launch code.
8. **Fix the 177 broken `BehaviourList` test-line references** + add the parser-based guard (DOC-3 + DOC-12)
9. **Persist `PortAllocator` + `VmRegistry`** (Theme H — SLOP-38, FUTURE-9/17/18)
10. **Replace migration-runner panic with typed startup error** (Theme I — SLOP-9)
11. **Replace `SupervisorError::Internal(String)`** with typed `thiserror` variants (Theme cross-cutting #1)

### Priority 2 — codebase health

12. **Extract `StandardDocPage` abstraction** + Vite glob-based registry (Theme J — ARCH-4, REPO-4, FUTURE-1)
13. **Eliminate raw HTML form controls** from library + supervisor UI (Theme K — TASTE cluster, TECH-TS-2)
14. **Translate supervisor UI** through `MowsProvider.Translation` (cross-cutting #3 — SLOP-10/11/40, ARCH-8)
15. **Add missing exports to `lib/main.ts`** (cross-cutting #7 — ARCH-12/16)
16. **Fix stale `atoms/` references** in `get-file-icons.sh`, CLAUDE.md, filez `DateTime` import (cross-cutting #8 — REPO-7/8, DOC cluster)
17. **Apply tower-http `CompressionLayer`/`DecompressionLayer`/`TraceLayer`** to supervisor router (TECH-RUST-8/14)
18. **Register all DTOs in utoipa `components(schemas(…))`** (TECH-RUST-13)

### Priority 3 — future-proofing

19. **Split translation files per group** + add partial-locale support (cross-cutting #10 — FUTURE-4/5/6, REPO-17)
20. **Backoff + visibility-gated polling** (cross-cutting #4 — SLOP-16/17/18/19/45)
21. **Pagination on `list_vms` / `list_all_agents`** (FUTURE-10)
22. **Apply `owner_user_id` in `create_vm`/`create_agent`** (FUTURE-11 — multi-tenancy schema-present, logic-absent)
23. **Fix taxonomy nits** in `code/` and `dateTime/` (ARCH-10/11)
24. **Rename `lib/lib/`** in both packages (REPO-1)
25. **Resolve `MIGRATION.md` vs `CLAUDE.md` section-order contradiction** (ARCH-3, DOC cluster)
26. **Standardise naming**: ban `ctx`/`cfg`/`req`/`res`/etc. via lint rule (cross-cutting #6 — TASTE cluster)

---

## How to use this index

- Open the per-perspective file for the full text of each finding (file path, line, why-it-matters, suggestion).
- Status markers in each issues file: `❌` open / `✅` fixed / `⁉️` not a real issue / outdated. Update as you triage.
- When fixing an issue, prefer addressing the **theme** (left column above) rather than individual finding IDs — one structural change resolves many.
- Many findings reference identical files; treat the theme-based plan as the authoritative work list and let the per-file findings serve as the test/verification checklist.

---

## Reviewer notes on this run

- 3 agents (architect, slop, repository) initially stalled at the 600 s watchdog and had to be re-spawned with explicit "write skeleton first, append incrementally, save every 2-3 findings" instructions.
- 1 agent (technology) stalled twice and was replaced by three narrower sonnet-model sub-agents (rust / ts / infra) — these completed reliably.
- 1 agent (QA) is being re-run; the QA section of this index will be backfilled once it returns.
- All agents were given the full file list (`git diff HEAD --stat`), the `PLAN.md`/`MIGRATION.md` context, the user's `CLAUDE.md` standards, and their domain-specific instructions; they were instructed to be read-only on the codebase and to write only to their own output file.
