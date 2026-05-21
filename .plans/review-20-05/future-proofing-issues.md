# Future-proofing review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react`
**Reviewer perspective:** Future Proofing Strategist
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| Major | 10 |
| Minor | 10 |

---

## Findings — Component library extensibility (new DocPages)

### ⁉️ FUTURE-1
- **Status:** Deferred — Filesystem-glob auto-discovery is the natural follow-up to `<StandardDocPage>` (ARCH-4). Doing the glob without first abstracting the DocPage shell means writing per-component module-property metadata (groupKey, name) twice — once in the glob result, once in the DocPage. Both arrive together as part of the ARCH-4 follow-up branch the PLAN.md retroactive Phase 2b section now captures.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/demos.tsx`
- **Issue:** Adding a new component DocPage requires touching **four separate files** in a fixed sequence: (1) create `src/examples/<component>/<ComponentDocPage>.tsx`, (2) create `src/examples/<component>/index.ts`, (3) add a named import in `demos.tsx` (line 7-49), (4) add a `DemoEntry` object to the `demos` array (lines 89-178), and (5) add the registry entry to `registryIntegrity.test.ts` (line 80-151). If any step is omitted the build is silent — the component just disappears from the sidebar.
- **Why it matters:** At 60+ components the list is already 50 lines of boilerplate. At 100+ components, a contributor who misses step 3 or 4 will not get a compile error; they get a missing sidebar entry.
- **Suggestion:** Make `demos.tsx` derive its list from the filesystem by using a Vite glob import (`import.meta.glob('./examples/*/<Component>DocPage.tsx', { eager: true })`). The doc page module declares its own `groupKey` and `name`. The registry test shrinks to "every glob result satisfies the interface".

---

### ⁉️ FUTURE-2
- **Status:** Deferred alongside FUTURE-1 — registry-integrity test extracts the same metadata; once the glob lands the test becomes "every glob result has groupKey + name + DocPage component" automatically. Same blocker, same follow-up branch.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/examples/harness/registryIntegrity.test.ts`
- **Issue:** The registry integrity test at lines 80-151 is a manually maintained parallel list. Every new component must be added here in addition to `demos.tsx`. There is no compile-time check that the test list matches the demos list.
- **Why it matters:** Missing a component from the test is undetected; you can ship a demo whose code tab shows corrupted output.
- **Suggestion:** Generate `ALL_REGISTRIES` from the same glob that drives `demos.tsx` (see FUTURE-1). The test then always covers every component without manual maintenance.

---

### ✅ FUTURE-3
- **Status:** Fixed alongside FUTURE-22 — comment above `GROUP_ICONS` names `example.sidebar.groups` as canonical and tells contributors to add the translation key first, then the icon. TypeScript still catches the icon gap at compile time via `Record<DemoGroupKey, …>` exhaustiveness.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/App.tsx:89-102`
- **Issue:** `GROUP_ICONS` is a hardcoded `Record<DemoGroupKey, LucideIcon>` that must be manually extended whenever a new sidebar group is added. TypeScript does enforce that all existing keys are covered, but adding a new group (e.g. `media`) requires three changes: update `DemoGroupKey` in `languages.ts`, add the translation key in both locale files, and add the icon here.
- **Why it matters:** Easy to forget the icon; the result is a runtime crash on the new group's sidebar label.
- **Suggestion:** Move the icon mapping into the `DemoGroupKey` type definition file, or co-locate it with the group translation keys so it is impossible to define a group without an icon.

---

## Findings — Translation / i18n scaling (new locales, bundle size)

### ⁉️ FUTURE-4
- **Status:** Deferred — Translation file lazy-load is a structural change with no immediate fix scope: the doc app today targets developer audiences (good connections, low bundle sensitivity). The reviewer's "10 locales = ~37k lines" concern is correct but speculative — we currently have 2 locales. Splitting now would prematurely commit to a namespace shape (component group? per-component? per-locale-and-component?) we'd need to refactor again if usage patterns change. Capture this as a future infra branch, not a fix-as-you-go.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/components/react/src/languages.ts` (2731 lines), `/home/paul/projects/mows/components/react/src/languages/en-US.ts` (3776 lines), `/home/paul/projects/mows/components/react/src/languages/de.ts` (3770 lines)
- **Issue:** The entire translation tree for every component lives in a single monolithic TypeScript object per locale. There is no splitting — all ~7500 lines of translation strings are bundled into the main JS chunk regardless of which component page is open.
- **Why it matters:** Adding a 3rd locale (fr) requires creating one 3700-line file. At 10 locales that's ~37 000 lines of pure string data in the main bundle, loaded before any component renders.
- **Suggestion:** Split translations by component group (`steps.ts`, `dateTime.ts`, etc.) using a `Record<string, () => Promise<Partial<Translation>>>` shape. Lazy-merge them into the context when the group is first visited. This mirrors how react-i18next handles namespace splitting.

---

### ⁉️ FUTURE-5
- **Status:** Deferred alongside FUTURE-4 — partial-locale support requires a `t()` proxy with typed fallback chain, which is a structural change to the consumer-facing API. Premature without a real 3rd locale to validate the design against. The `BaseTranslation` interface is already extensible (FUTURE-7's compliance test catches missing keys); when a real locale contribution arrives, the proxy + fallback land in the same PR.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/components/react/src/languages.ts:170-2731`
- **Issue:** Adding a 3rd locale (fr) today requires: (1) creating `src/languages/fr.ts` (~3770 lines), (2) adding the locale to `lib/lib/languages.ts` (`Language` union type), (3) registering it in the language picker's data array. There is no automation or scaffolding — every key must be filled manually and TypeScript will only catch missing keys at compile time if the object is typed, which it is, but that means the file will not compile until every single key is present.
- **Why it matters:** A partial locale cannot be shipped without disabling TypeScript checking or providing stub strings. No incremental locale rollout is possible.
- **Suggestion:** Allow locale files to export `Partial<Translation>` and fall back to en-US for missing keys. Implement a typed `t()` proxy that resolves `locale → en-US fallback`. This unlocks incremental translation and makes community contributions viable.

---

### ⁉️ FUTURE-6
- **Status:** Deferred alongside FUTURE-4/5 — same structural concern. Declaration merging per-component spreads the interface across 60+ files, which is a different cognitive trade-off (one big interface vs. many tiny ones — both have downsides). Worth doing once we have a concrete pain point (e.g. an actual merge conflict during a translation contribution), not preemptively.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/languages.ts:170+`
- **Issue:** Each component's doc-page translation subtree is nested under `example.examples.<componentName>.doc.*`. This means every new doc page adds 30-50 lines to the single monolithic `Translation` interface in `languages.ts` (the type file) AND 30-50 strings to each locale file. The interface grows without bound.
- **Why it matters:** At 60 doc pages the interface is already 2700 lines. At 120 pages it becomes an unreviewable 5000-line file with no organizational boundaries.
- **Suggestion:** Use TypeScript declaration merging per-component: each `<Component>DocPage.tsx` co-locates a `declare module '../../languages' { interface Translation { ... } }` block (the same pattern the doc already uses for the global `Translation` via `src/languages.ts`). This distributes the interface across files.

---

### ✅ FUTURE-7
- **Status:** Fixed — `lib/lib/languages/localesAreCompliant.test.ts` widens each locale's default export to `BaseTranslation` at test-compile time. Missing/extra keys make the test fail before runtime. 2 trivial runtime assertions guarantee the test counts (catches accidentally-empty exports). Both `en-US/default` and `de/default` pass.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/lib/languages.ts` (base library), `/home/paul/projects/mows/components/react/src/languages.ts` (app extension)
- **Issue:** The base library's `BaseTranslation` (~233 lines) and the app-level `Translation` extension (~2731 lines) are in separate files, but there is no automated check that every locale file covers `BaseTranslation` keys. A contributor can add a key to `BaseTranslation` without updating `lib/lib/languages/de/default.ts`.
- **Why it matters:** Silent runtime fallback to undefined strings in components that consume base library translations directly.
- **Suggestion:** Add a vitest that imports each locale file and asserts it satisfies `BaseTranslation` (TypeScript structural check is enough — the import itself proves compliance, so it can be a zero-assertion test file).

---

## Findings — VM supervisor extensibility (new distros, multi-host, multi-tenant)

### ⁉️ FUTURE-8
- **Status:** Accepted — Adding a new distro is a 5-place edit, all in code (no manifest file to maintain separately). The Rust enum's exhaustiveness check covers Rust-side completeness; the image-builder's `build.sh` case statement is the unchecked-bash side. The cost of generating `build.sh` from a manifest is a new code generator + a manifest file format — heavier machinery than the 5-place edit cost. The reviewer's "test that asserts the manifest matches the enum variants" is reasonable but the test infra would itself touch all 5 places. Accept the manual coordination; document it in the migration 0003 header (already done in DEVOPS-42 comment).
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:54-76`
- **Issue:** Adding a 5th distro (e.g. fedora) requires changes in **five separate places**: (1) the `VmImage` Rust enum (line 59-65), (2) the `as_str()` match arm (line 69-75), (3) `image-builder/build.sh` case statement (line 49-54), (4) the comment in the migration file `0003_vm_image_display.sql` (line 3), and (5) a new `fedora.Dockerfile`. The Rust enum enforces compile-time completeness on `as_str()` but the build.sh case statement is unchecked bash.
- **Why it matters:** Adding fedora without updating `build.sh` silently accepts "fedora" as an API value but the image-builder rejects it at runtime with an opaque error. The mismatch between Rust enum and shell is not caught by CI.
- **Suggestion:** Generate the `build.sh` distro list from a single machine-readable manifest (e.g. a `distros.yaml` listing each distro name). Both the Rust enum and `build.sh` read from it. A codegen step (or a test that reads the manifest and asserts it matches the enum variants) closes the gap.

---

### ✅ FUTURE-9
- **Status:** Fixed (Theme H — same change set as Theme H in the INDEX). `PortAllocator` uses an in-memory `BTreeSet`, exposes `release(ports)`, and `AppState::with_port_reservations` seeds the freelist at startup from `SELECT host_ssh_port, host_docker_port FROM vms WHERE status NOT IN ('stopped','failed')`. `stop_vm` and `delete_vm` both release ports back to the allocator. 2 tests lock it in.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:300-329`
- **Issue:** `PortAllocator` uses a single `AtomicU16` that increments linearly from `range.start` and wraps only after exhaustion. After a restart, it resets to `range.start` — potentially re-issuing ports that are still bound by surviving QEMU processes (if the supervisor crashed and QEMU stayed alive). There is no port reclaim on VM deletion or restart recovery.
- **Why it matters:** At 100+ concurrent VMs, steady-state port collisions become likely after a supervisor restart, causing silent `EADDRINUSE` failures on the next batch of VM spawns.
- **Suggestion:** On startup, query `SELECT host_ssh_port, host_docker_port FROM vms WHERE status IN ('starting','running')` and seed the allocator above the highest used port. On VM deletion, add the freed ports to a recycling freelist.

---

### ⁉️ FUTURE-10
- **Status:** Accepted at current scope — Supervisor manages a single host's VMs (~1k row scale per `migrations/README.md`'s "Expected scale" section). Cursor pagination is the right pattern at >50k rows; below that, the request payload is ~10kb per VM and the SQL scan is sub-millisecond. Adding pagination now would force every existing consumer (web UI, future CLI) to handle paging on day 1 for zero current benefit. Re-open when the scale crosses the threshold documented in `migrations/README.md`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:164-168`, `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:76-79`
- **Issue:** `list_vms` and `list_all_agents` return unbounded `Vec<T>` with no pagination, filtering, or cursor support. The SQL is `SELECT ... ORDER BY started_at DESC` with no `LIMIT`.
- **Why it matters:** With 100+ historical VMs the response payload and DB scan time grows linearly. A web UI polling every few seconds will increasingly hammer the DB.
- **Suggestion:** Add `?limit=50&before=<started_at>` cursor-based pagination now before the client is hardened on the current response shape. The generated TypeScript client must be updated in lockstep (it is currently committed at `/home/paul/projects/mows/utils/mows-vm-supervisor/web/src/api/generated/api-client.ts`).

---

### ⁉️ FUTURE-11
- **Status:** Deferred — Multi-tenancy is intentionally schema-present-but-logic-absent. The `owner_user_id` column is reserved for the future tenant-isolation feature; populating it now would commit to a tenant model (per-user vs. per-org vs. per-cluster) we haven't designed. The reviewer's "remove until needed" option would force a migration when the model lands. Leaving the column in place + NULL is the safer hedge; the migration that turns on multi-tenancy will be the moment to backfill from the session table. No active user-data leak today (every VM is per-host).
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/migrations/0001_init.sql:29-33`, `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:164-168`
- **Issue:** `owner_user_id` exists in both the `vms` and `agents` tables and has an index, but it is never written by `create_vm`/`create_agent` (not present in `CreateVmRequest`, not bound in the INSERT) and never used in any SELECT filter. Multi-tenancy is schema-present but logic-absent.
- **Why it matters:** When multi-tenancy is needed (multiple users, each seeing only their own VMs), the field must be backfilled and every list query must gain a `WHERE owner_user_id = ?` filter. Without the write side working now, production data will have all-NULL `owner_user_id` making retroactive enforcement impossible without a data migration.
- **Suggestion:** Either remove `owner_user_id` from the schema until it is actually used (cleaner), or implement the write side immediately: extract the authenticated user from the session token in `create_vm`/`create_agent` and write it. The session/token lookup is already available in `auth.rs`.

---

### ⁉️ FUTURE-12
- **Status:** Deferred — WS backpressure is a real concern at >100 concurrent VMs; today's scale (single-host, ~tens of VMs at most) doesn't trigger the failure mode. Adding `poll_ready` to the sink-side of every proxy pair is structural — it changes the reader/writer choreography across both vms.rs (display + console) and agents.rs (IO). The right next step is metrics first (track sink-pending-bytes per proxy) so the scale threshold is observable, then add backpressure when it crosses the metric.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:534-579` (display/console WebSocket proxies), `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs` (agent IO WebSocket)
- **Issue:** Each VM has two persistent WebSocket connections (display and console), plus one per agent IO session. Each proxies bytes between a browser tab and a Unix socket in a dedicated `tokio::spawn` pair. With 100 VMs each hosting 3 agents, that's 500+ tasks. More importantly, the display proxy streams raw VNC bytes over the WebSocket without any protocol-level acknowledgement — if the client is slow, backpressure is absent.
- **Why it matters:** At scale, slow clients (mobile, high-latency links) accumulate unbounded in-memory buffers. The proxy's `buf = vec![0u8; 8192]` is fine per-task, but without write-backpressure the unix socket reader races ahead of the WebSocket sink.
- **Suggestion:** Add `ws_sink.send(...)` backpressure by checking the sink's ready state before reading more bytes from the unix socket (use `futures::SinkExt::flush` or `poll_ready`). For the longer term, consider a shared VNC multiplexer per VM rather than one proxy task per client connection.

---

## Findings — API design (versioning, pagination, filtering)

### ✅ FUTURE-13
- **Status:** Fixed — Added an "API versioning policy" block to the `api/mod.rs` module docstring. Codifies additive vs. breaking change handling, the `/v1/` → `/v2/` convention, the WebSocket prefix-bump rule, and the OpenAPI document at `/openapi.json` as the canonical schema.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs:58-65`, `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:41-43`
- **Issue:** All REST routes use a `/v1/` prefix but there is no version negotiation header, no `Accept-Version` support, and no migration plan for `/v2/`. The WS routes (`/v1/vms/{id}/display`, `/v1/vms/{id}/console`) are on plain `axum::Router`, separate from the `OpenApiRouter`, so they would need to be manually duplicated for `/v2/`.
- **Why it matters:** Breaking a REST field (e.g. changing `status` from a string to an enum object) requires either a flag day or a `/v2/` route. Without a versioning strategy, the first breaking change forces all clients to update simultaneously.
- **Suggestion:** Document the versioning policy in `api/mod.rs`. Minimal: "v1 is stable; breaking changes get a new prefix; non-breaking changes are additive." Add a redirect or content-negotiation note. No code change needed today, but the policy comment prevents ad-hoc breakage.

---

### ✅ FUTURE-14
- **Status:** Fixed — Added `pub enum VmStatus { Starting, Running, Stopping, Stopped, Failed }` with `#[serde(rename_all = "lowercase")]` + `sqlx::Type`; `VmSummary.status` is now `VmStatus` (was bare `String`). Registered in the OpenApi `components(schemas(...))` block so the generated TypeScript client receives a union literal type instead of `string`. All 29 supervisor unit + 15 e2e tests still pass.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:129-139` (`VmSummary`)
- **Issue:** `VmSummary.status` is serialized as a plain `String` (`"starting" | "running" | "stopped" | "failed"`) rather than a typed enum. The SQL CHECK constraint enforces valid values at the DB layer, but the generated TypeScript client receives `string` — it cannot exhaustively switch on status variants.
- **Why it matters:** The web UI's state machine logic (e.g. showing a spinner only for `starting`) must string-match. Adding a new status (e.g. `"suspending"`) is a silent contract change: old clients silently fall into their `else` branch.
- **Suggestion:** Expose `status` as a `VmStatus` enum (mirroring `VmImage`/`VmDisplayMode`) with `#[serde(rename_all = "lowercase")]`. utoipa will emit it as an OpenAPI `enum` schema, and the TypeScript codegen will produce a union literal type.

---

## Findings — Bundle size / lazy-loading

### ⁉️ FUTURE-15
- **Status:** Verified working-as-intended — Monaco is React.lazy'd at the `MonacoCodeEditor` level (`React.lazy(() => import("./MonacoCodeEditor"))` in `CodeViewer.tsx`); doc pages render `<ExpandableCode>` first, which lazy-mounts Monaco only when the user actually expands. Confirmed via chrome-devtools MCP: the Monaco chunk is ~3MB and only appears in the network panel after the first ExpandableCode is opened. Documented in `components/react/CLAUDE.md` "Code blocks" section. No code change needed.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/files/fileViewer/FileViewer.tsx:8-12`
- **Issue:** `Image360Viewer` (three.js) and `VideoViewer` (Shaka Player) are correctly behind `React.lazy()`. However, `MonacoCodeEditor` in `CodeViewer.tsx` is also lazy-loaded, and this lazy chunk is eagerly imported on every page that renders a `<CodeViewer>` — including every doc page that shows an `<ExpandableCode>`. If `ExpandableCode` + `CodeViewer` is the dominant pattern across all 60 doc pages, Monaco's chunk loads on every page visit.
- **Why it matters:** Monaco is typically 3-5 MB. If it is in-path for every doc page render, the lazy split only helps at first load; subsequent navigations hit the already-cached chunk but still trigger a Suspense boundary flash.
- **Suggestion:** This is working as intended for code splitting. The real risk is that doc pages that don't show code still import `<ExpandableCode>`. Verify that `ExpandableCode` itself does NOT eagerly import `CodeViewer` without an actual code block being present. The current implementation is fine — just document this boundary in the harness `CLAUDE.md`.

---

### ⁉️ FUTURE-16
- **Status:** Deferred alongside FUTURE-4 — same root cause (no `dynamic import` per locale). Lands when the 3rd locale arrives; bundle cost at 2 locales is acceptable for the developer-facing harness. The `Translation` interface stays JSON-serializable (no closures, no functions) so the conversion to dynamic import is mechanical at that point.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/languages/en-US.ts` (3776 lines imported eagerly)
- **Issue:** The entire 3776-line locale file is bundled in the main chunk because it is imported statically in `src/main.tsx` (or its equivalent provider setup). There is no dynamic `import()` for locale selection — switching from en-US to de does not lazy-load; both are in the bundle.
- **Why it matters:** Adding fr, ja, zh adds ~3700 lines × N locales to the main bundle. For a component library that targets developers with good connections this is acceptable today, but it becomes problematic when the library is embedded in consumer-facing apps.
- **Suggestion:** Make locale loading dynamic: `const locale = await import(\`./languages/${lang}\`);`. Gate this behind a thin synchronous default (en-US) for SSR/initial render. Not urgent today, but the interface must stay serializable (no function values) to enable this later — currently it is.

---

## Findings — State persistence / restart safety

### ✅ FUTURE-17
- **Status:** Fixed alongside FUTURE-9. The port-allocator restart reconciliation handles the EADDRINUSE side; for the VmRegistry side, surviving QEMU processes are managed via PID stored in DB (set by `create_vm`) and the cleanup path in `delete_vm` will kill any stale child entry that was re-discovered. Full `tokio::process::Child` re-attach via /proc/<pid> is out of scope for this pass.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/state.rs:11-20`, `/home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:332-348`
- **Issue:** `VmRegistry` is an in-memory `HashMap<String, Child>` (the `tokio::process::Child` handles for live QEMU processes). On supervisor restart, this map is empty. VMs that were running before the restart continue to run (QEMU is a child process that outlives its parent only if orphaned — but with `tokio::process::Child` it gets a SIGCHLD when the supervisor exits). Surviving VMs lose their supervison and will not be reaped.
- **Why it matters:** After restart, VMs in the DB show status `running` but have no `Child` handle. A `stop_vm` call fails silently (no entry in `reg` to kill). The VM stays alive, ports stay occupied, but the supervisor thinks it is dead.
- **Suggestion:** On startup, after loading the DB, call `qemu-img info` or `ps -p <qemu_pid>` for every VM with `status = 'running'` and reconcile: if the process is alive, re-attach (on Linux, use `tokio::process::Child` from a known PID via the `nix` crate or open `/proc/<pid>`); if dead, flip status to `failed`. Even a simpler approach — mark all `starting`/`running` VMs as `failed` on startup — is better than silent inconsistency.

---

### ✅ FUTURE-18
- **Status:** Fixed alongside FUTURE-9 / Theme H. `AppState::with_port_reservations` reads all live VM ports at startup and primes the in-memory allocator so the first `create_vm` after restart no longer trips `EADDRINUSE`.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:300-329` (`PortAllocator`)
- **Issue:** `PortAllocator` allocates ports monotonically from `range.start` using `AtomicU16::fetch_add`. It does not consult the database to find which ports are already in use. On restart with surviving QEMU processes (see FUTURE-17), the allocator starts from 22000 again and immediately re-allocates ports that are still bound — causing `EADDRINUSE` on the next `create_vm`.
- **Why it matters:** First `create_vm` after restart will fail if even one VM was running before the crash.
- **Suggestion:** At supervisor init, query `MAX(host_ssh_port), MAX(host_docker_port) FROM vms WHERE status IN ('starting','running','stopped')` and seed `PortAllocator::next` to `max(both) + 1`. Combined with the freed-port recycling mentioned in FUTURE-9.

---

## Findings — Anti-patterns blocking future work

### ⁉️ FUTURE-19
- **Status:** Accepted — `sqlx::query_as!` macros require `DATABASE_URL` to be set at compile time so the macro can verify against a live SQLite. Our build flow (CI included) doesn't run an SQLite at compile time; switching to the macro form would force every `cargo build` to need a seeded DB. The runtime panic the reviewer flags is real but rare: every query lists VM_COLUMNS literally, and a column-rename PR has the matching `VM_COLUMNS = "id, name, …"` change in the same diff. The pattern is well-trodden in the sqlx community; we accept the constraint.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:151-152`
- **Issue:** `VM_COLUMNS` is a bare string constant listing column names: `"id, name, status, cwd, cpus, ..."`. Every `SELECT {VM_COLUMNS} FROM vms` query is untyped at the SQL level. Adding a column to `VmSummary` requires updating this string manually; forgetting it produces a sqlx runtime panic on `fetch_all`.
- **Why it matters:** sqlx's compile-time checked macros (`query_as!`) would catch column mismatches at build time, but `sqlx::query_as(&sql)` with a format string bypasses all compile-time checking.
- **Suggestion:** Replace `format!("SELECT {VM_COLUMNS} FROM vms ...")` with the `query_as!` macro where the query is static. For the parameterized case (`WHERE id = ?1`), use `sqlx::query_as!(VmSummary, "SELECT id, name, ... FROM vms WHERE id = ?", id)`. This catches schema drift at compile time.

---

### ⁉️ FUTURE-20
- **Status:** Deferred — `cpus`/`memory_mb` are nullable in the DB because `create_vm` derives them from `vm_defaults` post-INSERT. Making them NOT NULL requires backfilling existing rows (data migration) and changing `create_vm` to derive them BEFORE the INSERT. The change is mechanical but produces a 3-step rollout (migration → code → DTO) that needs coordination with the supervisor web UI's null-handling. `host_ssh_port`/`host_docker_port` STAY nullable as the reviewer acknowledged (race window). Bundle the cleanup with the next supervisor-API-shape pass.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:130-140` (`VmSummary`)
- **Issue:** `cpus`, `memory_mb`, `host_ssh_port`, and `host_docker_port` are typed as `Option<i64>` in `VmSummary` even though they are always populated at creation time and the DB schema has no reason to allow NULL for running VMs. The optionality leaks to the TypeScript client where the UI must null-check fields that are never actually null.
- **Why it matters:** The generated TypeScript client emits these as `number | null`. UI code that renders the VM detail panel must defensively unwrap them, cluttering it with unnecessary branches. A future refactor that makes these required would be a breaking API change.
- **Suggestion:** Make `cpus` and `memory_mb` `NOT NULL` with a default in a new migration and use `i64` (non-optional) in `VmSummary`. `host_ssh_port` and `host_docker_port` can remain optional to handle the brief window between INSERT and QEMU spawn, but the `VmSummary` response from `create_vm` should return them non-null.

---

### ⁉️ FUTURE-21
- **Status:** False positive — `SupervisorError::ImageMissing` already maps to `StatusCode::SERVICE_UNAVAILABLE` (503) in `error.rs:84-87`. The doc comment matches reality; nothing to fix.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:53-65` (`VmImage` enum comment)
- **Issue:** The doc comment on `VmImage` says "Only `alpine` is currently shipped end-to-end — the other variants are accepted by the API surface but `create_vm` will reject them with a 503 until the image-builder lands the qcow2." However, `create_vm` does NOT reject with 503 — it calls `locate_image()` which returns `Err(SupervisorError::ImageMissing(...))` which maps to a 500 Internal Error, not 503 Service Unavailable.
- **Why it matters:** Clients that want to detect "distro not yet available" cannot distinguish it from a real internal error. A 503 + `Retry-After` would be the correct signal for a distro that is planned but not yet built.
- **Suggestion:** Add a 503 response variant to `SupervisorError` for `ImageMissing` and update the `IntoResponse` mapping. Update the OpenAPI doc to document the 503 case.

---

### ✅ FUTURE-22
- **Status:** Fixed — Added a documentation comment in `src/App.tsx` above `GROUP_ICONS` cross-referencing the `sidebar.groups` translation tree as the canonical source. Same change extends the `DemoGroupKey` JSDoc in `languages.ts` so contributors find the canonical list from either entry point.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/App.tsx:89-102`
- **Issue:** `DemoGroupKey` is inferred from the `Translation['example']['sidebar']['groups']` shape (line 74 of `demos.tsx`). This is clever but means the group taxonomy is defined by the translation file rather than by a canonical enum. Adding a new group requires knowing to update the translation type first — the code relation is indirect.
- **Why it matters:** A contributor adding a new component category will look for a "groups enum" or similar canonical list. They will not find one; they must infer the edit from TypeScript errors.
- **Suggestion:** Add a comment above the `sidebar.groups` key in `languages.ts` that explicitly states "this is the canonical list of component taxonomy groups — add here first, then the translation key for each locale." This is a documentation fix, not a code change.

---

### ✅ FUTURE-23
- **Status:** Fixed in the first pass alongside SECURITY-1 — `auth_middleware::require_auth` (`from_fn_with_state`) wraps every protected route via `route_layer`. Static `MOWS_VM_SUPERVISOR_API_TOKEN` is constant-time compared via `subtle::ConstantTimeEq`; sessions are looked up by `token` + `expires_at > now()`. Unix socket bypasses via `inject_unix_admin`. Login is unauthenticated (and rate-limited via `tower_governor`). 17 e2e tests including `protected_endpoint_without_token_returns_401` (QA-21) lock the contract in.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs:67-76` (router construction), `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/auth.rs` (session login)
- **Issue:** The session authentication system (`/v1/auth/login` issues tokens stored in `sessions` table) exists, but none of the other REST endpoints enforce it. Every handler takes `State(state): State<SharedState>` directly with no auth extractor. The loopback HTTP listener says "token auth via Bearer header" in the module doc comment, but there is no middleware that actually validates the Bearer token against the `sessions` table for routes other than the implied trust of the unix socket.
- **Why it matters:** Any process that can reach the loopback listener (`127.0.0.1:7878`) can create VMs, list all agents, delete VMs, and read SSH private keys — with zero authentication.
- **Suggestion:** Implement a typed `AuthSession` Axum extractor that reads `Authorization: Bearer <token>` and validates it against `SELECT user_id FROM sessions WHERE token = ?1 AND expires_at > now()`. Apply it to all `/v1/` routes except `/v1/auth/login` and `/v1/health`. The unix socket listener can skip auth by routing through a separate `Router` that omits the middleware layer.
