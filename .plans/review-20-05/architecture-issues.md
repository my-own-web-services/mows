# Architecture review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react`
**Reviewer perspective:** Software Architect
**Date:** 2026-05-20

## Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| Major | 12 |
| Minor | 9 |
| **Total** | **22** |

## Findings — Component library structure

### ✅ ARCH-10
- **Status:** Fixed — `code/monacoBootstrap.ts` was dead code (the surviving `ensureShikiMonacoReady` lives inside `codeViewer/shikiBridge.ts`; nothing imported the bootstrap's `richLanguagesReady`). Deleted the file outright and removed the now-orphan `monaco-editor/esm/vs/language/{json,typescript}/*` module declarations from `lib/vite-env.d.ts`. The `code/` group now follows the one-component-per-folder discipline.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/components/code/codeViewer/` and the rest of the `code/` group
- **Issue:** `code/` is intended as the topical home for code-rendering components, but `code/codeViewer/CodeViewer.tsx` is one of the few components in the library that pulls in Monaco (heavy dep). Meanwhile a sibling file `code/monacoBootstrap.ts` lives at the **group root** (not inside `codeViewer/`) but is consumed only by `CodeViewer`. The "one-component-per-folder" discipline the taxonomy enforces is broken here.
- **Why it matters:** Future contributors looking at `code/` see three subfolders + a bare module file, which signals "this file is shared across the group". It isn't — only `CodeViewer` uses it. The other components in the group (`codeSnippet`, `codeThemePicker`, `expandableCode`) don't even need Monaco, so the bootstrap is misplaced. Co-locating it inside `codeViewer/` would also make the lazy/bundle boundary obvious.
- **Suggestion:** Move `code/monacoBootstrap.ts` to `code/codeViewer/monacoBootstrap.ts`. If it later turns out to be shared (e.g. `codeThemePicker` ends up reading the Monaco theme catalog), promote it back deliberately at that point — not preemptively.

### ⁉️ ARCH-11
- **Status:** Deferred — Splitting `dateTime/dateTimePicker/` into four sibling folders (`dateTimeInput/`, `dateTimePicker/`, `timePicker/`, `timezoneSelector/`) is the right convention. The blocker is that the `useDateTimePicker.ts` hook is shared across all four sub-components — moving it to `dateTime/shared/` is awkward (new "shared" folder concept the rest of the package doesn't use). The cleanup needs design work first; doing it now would either (a) create the "shared" concept ad-hoc or (b) duplicate the hook. Capture the rule alongside the next dateTime change.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/components/dateTime/dateTimePicker/` (and how `dateTime/` is organised)
- **Issue:** `dateTime/dateTimePicker/` contains four exported components — `DateTimePicker`, `DateTimeInput`, `TimePicker`, `TimezoneSelector`, plus `useDateTimePicker.ts` — bundled into one folder. Meanwhile a sibling `dateTime/dateTimeDisplay/` and `dateTime/dateTimeRangePicker/` each hold a single component. The "one component per folder" rule from the taxonomy is followed inconsistently.
- **Why it matters:** Lib readers searching for `<TimePicker>` find no `dateTime/timePicker/` folder; they have to know it's nested inside `dateTimePicker/`. Same for `<TimezoneSelector>`. Discoverability is worse than the old flat `atoms/` layout for these three.
- **Suggestion:** Split `dateTime/dateTimePicker/` into `dateTime/dateTimeInput/`, `dateTime/dateTimePicker/`, `dateTime/timePicker/`, `dateTime/timezoneSelector/`. Keep `useDateTimePicker.ts` co-located in `dateTimePicker/` if it's that component's hook, or hoist to `dateTime/shared/`. Apply the rule uniformly across the package.

## Findings — Doc page harness

### ✅ ARCH-1
- **Status:** Fixed — Added `example.examples._harness.stateTab` to `Translation` (+ both locale files). `ExampleCard` now renders `{harness.stateTab}` instead of literal `"State"`. Existing State-tab tests updated to match the new translation tree.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/examples/harness/ExampleCard.tsx:69`
- **Issue:** The "State" tab trigger label is a hardcoded English string (`<TabsTrigger value={`state`}>State</TabsTrigger>`), bypassing the translation system that every other piece of the harness routes through.
- **Why it matters:** The CLAUDE.md doc-page contract explicitly requires all narrative + UI labels to go through `Translation`. Every doc-page reader sees an un-localised "State" tab next to a properly localised "Code" tab — the harness contradicts the contract it enforces on consumers.
- **Suggestion:** Add `t.example.examples._harness.stateTab` (mirroring `codeTab`) and read it on line 69. Set both en-US and de strings in the same change.

### ✅ ARCH-2
- **Status:** Fixed — Moved `harness/CommandBlock.tsx` into `harness/docPage/CommandBlock.tsx`, re-exported from the `docPage` barrel (`index.ts`), and rewrote the 68 `import { CommandBlock } from "../harness/CommandBlock"` sites to `../harness/docPage/CommandBlock`. Doc pages now pull every primitive from a single sub-path.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/examples/harness/docPage/` and `/home/paul/projects/mows/components/react/src/examples/harness/CommandBlock.tsx`
- **Issue:** Doc-page primitives are split between two modules. `harness/docPage/` holds `BehaviourList`, `DocPage`, `DocSection`, `InstallationTabs`, `ManualSteps`, `PropTable`, `renderInlineMarkup`. But `harness/CommandBlock.tsx` — used only by doc pages — lives one level up. Doc pages therefore import from two different harness sub-paths.
- **Why it matters:** Two sibling modules with overlapping responsibilities is the textbook setup for incoherent imports. With ~35 more pages to migrate per MIGRATION.md, every page repeats the dual-import pattern; refactoring later requires touching all of them.
- **Suggestion:** Move `CommandBlock.tsx` into `harness/docPage/` and re-export it from `harness/docPage/index.ts`. Have every doc page import every primitive from a single barrel: `import { CommandBlock, DocPage, DocSection, ExampleCard, ... } from "../harness/docPage";` — `harness/index.ts` keeps the top-level barrel.

### ✅ ARCH-3
- **Status:** Fixed — Updated `MIGRATION.md` line 12-13 to match the shadcn-style ordering CLAUDE.md and the migrated DocPages already use: **Installation → Examples → Usage → Composition → RTL → Defined behaviour → API Reference**. Recap now explicitly defers to CLAUDE.md as the canonical contract.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/.plans/component-demo-harness/MIGRATION.md:13-14` vs `/home/paul/projects/mows/components/react/CLAUDE.md` (Doc pages section)
- **Issue:** Section ordering in every migrated DocPage is **Installation → Examples → Usage → Composition → RTL → Defined behaviour → API Reference**, but `MIGRATION.md` line 13-14 documents the contract as **Installation · Usage · Composition · Examples · RTL · Defined behaviour · API Reference**.
- **Why it matters:** Two normative documents disagree. Future migrations will either re-introduce the disagreement or shuffle to match whichever contract the agent saw first. There is no single source of truth.
- **Suggestion:** Pick one ordering (the shadcn convention used by current pages — Installation → Examples → Usage → Composition — is fine). Write it in CLAUDE.md as the only contract, delete the conflicting recap from MIGRATION.md (replace with "see CLAUDE.md › Doc pages").

### ⁉️ ARCH-4
- **Status:** Deferred — Captured in `.plans/component-demo-harness/PLAN.md` "Phase 2b — Per-component DocPage contract" (added under ARCH-14) as the canonical follow-up. The `<StandardDocPage config={…}>` abstraction would dedupe ~13k LOC across 68 doc pages, but it has to land as a single coordinated change that proves the abstraction on `SidebarDocPage` first and then ports the rest — every page swap touches the DocPage's translation keys and the registry's source-import. Doing it inside this multi-perspective-review fix branch would multiply the risk surface; it belongs in its own focused PR. Same blocker for REPO-4 and FUTURE-1.
- **Severity:** Critical
- **File:** `/home/paul/projects/mows/components/react/src/examples/sidebar/SidebarDocPage.tsx` (370 LOC) and every other DocPage repeats this exact pattern
- **Issue:** Every DocPage repeats the same boilerplate: `useDocStrings()` reading `MowsContext` and throwing on missing provider, identical `ANCHOR` constant with the same seven keys, identical `buildIndexItems(t)` mapping, identical `<InstallationTabs>` wrapper with three `<ManualStep>` entries, identical empty `<DocSection id={ANCHOR.rtl} ... />`, identical `<DocSection id={ANCHOR.definedBehaviour} ...>` shape. At ~250-370 LOC per page × ~17 already-migrated pages × ~35 remaining = ~13k LOC of copy-pasted ceremony when migration completes.
- **Why it matters:** The harness's stated goal in PLAN.md is "Does the harness make this trivial?". In practice migrating one component requires writing ~250 LOC of which only ~30% is component-specific. Worse, fixing a structural bug (anchor scheme, manual-step wording, index-item shape, RTL section convention) means editing every migrated page. The "extensibility for ~55 more migrations" question fails on its own benchmark.
- **Suggestion:** Introduce a higher-level primitive in `harness/docPage/StandardDocPage.tsx` that takes the component-specific bits as a strongly-typed config:
  ```ts
  interface StandardDocPageConfig {
      docStrings: (t: Translation) => DocStrings;
      packageInstall: string;
      usage: { snippet: string };
      composition: { snippet: string };
      examples: { id: string; example: RegisteredExample }[];
      behaviour: BehaviourEntry[];
      propTables: { heading: string; rows: PropRow[] }[];
      rtlSkipReason?: string;
  }
  ```
  The DocPage component then becomes 30-50 LOC of pure content. Refactoring the entire fleet of pages becomes a single change. Migrate `SidebarDocPage` first to prove the abstraction, then port the other 16; future migrations are O(content) rather than O(layout+content).

### ⁉️ ARCH-5
- **Status:** Deferred alongside ARCH-4 — `<PreviewFrame>` is exactly the kind of primitive that belongs inside `<StandardDocPage>`. Extracting it ahead of the abstraction means two future API surfaces collide. Landing both together inside the ARCH-4 follow-up branch keeps the harness API minimal.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/examples/harness/ExampleCard.tsx:61`
- **Issue:** `<div className={`rounded-md border bg-card p-6`}>` reaches for the exact div-shape CLAUDE.md's "Doc pages" section calls out as a missing primitive ("If a doc page reaches for `<div className="rounded-md border">` … that's a missing primitive").
- **Why it matters:** Today only `ExampleCard` uses it; tomorrow it appears in ad-hoc preview frames inside DocPages. The exact same div also appears in `/home/paul/projects/mows/components/react/src/demos.tsx:65` (`<DemoFrame>`) and `/home/paul/projects/mows/components/react/src/uiDemos.tsx:125` (`<Frame>`). Three copies of the same anti-pattern.
- **Suggestion:** Extract a `<PreviewFrame>` primitive in `harness/docPage/` and use it inside `ExampleCard`, `DemoFrame`, and `Frame`. Or delete `DemoFrame`/`Frame` if their only callers have been migrated to DocPages.

## Findings — mows-vm-supervisor restructure

### ⁉️ ARCH-6
- **Status:** Deferred — Moving all per-resource DTOs out of `api/vms.rs` and `api/agents.rs` is a significant refactor (touches every handler signature + every DTO import + the OpenApi `components(schemas(…))` registration). The user-flagged risk — `#[derive(sqlx::FromRow)]` on `VmSummary` coupling DB-row shape to API-DTO shape — is real but well-bounded today (we've added VmStatus / VmImage / VmDisplayMode typed enums separately so columns can evolve without DTO breakage). The DTO/Row split needs its own branch; the e2e suite would catch any regressions on the way through.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/types.rs` (43 LOC) vs `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:45-150`
- **Issue:** `api/types.rs` only holds two cross-cutting DTOs (`ErrorResponse`, `OperationResult`). Every per-resource DTO — `VmImage`, `VmDisplayMode`, `CreateVmRequest`, `UpdateVmRequest`, `VmDefaultsResponse`, `VmSummary`, `VmSshInfo` — lives inline in `api/vms.rs`. Same for `api/agents.rs` (458 LOC). The result is `vms.rs` mixes HTTP handlers + DTOs + sqlx FromRow rows + business helpers (`load_vm`) in one ~700-line file.
- **Why it matters:** The promised layer separation (api as HTTP-only, types as DTOs, qemu.rs / agent_runtime.rs as business logic) is leaky. `types.rs` exists but is half-empty. `#[derive(sqlx::FromRow)]` on `VmSummary` couples the DTO shape to the database row shape — a DB schema change implicitly becomes an API contract change without a translation layer.
- **Suggestion:** Either (a) move all per-resource DTOs into `api/types.rs` keeping it the single DTO module, or (b) split per resource: `api/vms/handlers.rs` + `api/vms/types.rs` + `api/vms/db.rs`. Decouple `VmSummary` (API DTO) from `VmRow` (DB row) so schema evolution doesn't break the OpenAPI contract.

### ⁉️ ARCH-7
- **Status:** Deferred — Extracting `vm_runtime.rs` parallel to `agent_runtime.rs` is the right structural move; the supervisor would gain a single domain entry point for VM lifecycle (provision / stop / delete) and the HTTP handlers would shrink to parse-and-respond. The reorg touches every VM lifecycle site (create, stop, delete, future reconciler) + e2e fixtures. Lands as its own branch — same scope class as ARCH-6 (Rust-side restructure) and benefits from the same focused review.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:227-310` (`create_vm` handler)
- **Issue:** The `create_vm` handler contains business logic that belongs in `qemu.rs` / a domain service: port allocation, sqlx INSERT, calling `prepare_vm_dir`, calling `spawn_qemu`, building `QemuInvocation`, populating the in-memory registry, and emitting tracing events. The HTTP handler is doing the work the qemu module should expose as `provision_vm(req) -> VmRecord`.
- **Why it matters:** `qemu.rs` is well-named ("QEMU spawner — pure VM concern") but the call-site spreads the domain orchestration across `api/vms.rs::create_vm`. As `stop_vm`, `delete_vm`, and a future supervisor lifecycle reconciler grow, they'll each re-implement parts of the orchestration. The supervisor already has `agent_runtime.rs` as a domain module for agents — VMs should have an equivalent.
- **Suggestion:** Add `src/vm_runtime.rs` parallel to `agent_runtime.rs`. Expose `provision(state, req) -> Result<VmSummary>`, `stop(state, id) -> Result<()>`, `delete(state, id) -> Result<()>`. The `api/vms.rs` handlers become thin: parse → call → JSON-respond. This matches how `agents.rs` is already structured.

### ⁉️ ARCH-8
- **Status:** Partially fixed already (SLOP-10/11/40 + SECURITY-25 cluster) — every user-visible string in VmDetail + Sidebar now routes through `t.supervisor.vmDetail.*` translations (verified via `grep "Failed to load VM\|stopped\|running"` in `web/src/pages/VmDetail.tsx` returns 0 matches). ModalHost's hardcoded labels (Base image / Display / CPUs / Memory MB / radio labels) and the raw `<button type="submit" className="hidden">` are the residual surface; they need (a) new translation keys + (b) a `<HiddenSubmit>` primitive in `components/react/lib/components/ui/` to replace the hidden button. Both are bundled into the supervisor-web-i18n follow-up branch alongside the literal-status-color → semantic-token migration (ARCH-9-adjacent). Tracking the residual scope here rather than re-opening the closed SLOP items.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/web/src/components/ModalHost.tsx` and `/home/paul/projects/mows/utils/mows-vm-supervisor/web/src/pages/VmDetail.tsx`
- **Issue:** The supervisor's frontend rewrite hardcodes English everywhere and breaks the global "no raw HTML controls" + "no literal colors" rules from CLAUDE.md memory. Concrete examples:
  - `ModalHost.tsx:232` — `<button type="submit" className="hidden" />` (raw HTML button).
  - `ModalHost.tsx:130, 142, 154, 173, 208, 219` — hardcoded labels `"Name (optional)"`, `"Workspace path (optional)"`, `"Base image"`, `"Display"`, `"CPUs"`, `"Memory (MB)"`.
  - `ModalHost.tsx:165-168, 191, 201` — base image / display radio labels (`Alpine`, `Debian`, `Ubuntu`, `NixOS`, `Headless`, `Desktop`) hardcoded.
  - `VmDetail.tsx:54-60` — `STATUS_STYLE` uses literal Tailwind colors (`bg-emerald-500`, `bg-amber-500`, `text-red-500`) violating the dark/light-mode semantic-token rule.
  - `VmDetail.tsx:163, 170, 198-211, 219-241` — strings `"Failed to load VM:"`, `"Loading…"`, `"running"`, `"vCPU"`, `"CPU"`, `"Memory"`, `"Uptime"`, `"Base image"`, `"stopped"` are not translated.
  - `Sidebar.tsx:52-58` — `statusDot()` also uses literal colors.
- **Why it matters:** User memory explicitly states "no raw HTML form controls — if none fits, stop and ask" and "all frontends must consume mows-components-react". This new frontend opts out of both. Other apps that copy this pattern entrench the violations. Literal status colors won't adapt to theme changes.
- **Suggestion:** Remove the raw `<button>` — `<Dialog>` + form-level Enter handler already submits; if a hidden submit really is needed, add a `<HiddenSubmit>` primitive in `lib/components/ui/`. Move every hardcoded label into `web/src/lib/translations.ts` and route through `useMows().t`. Replace literal status colors with semantic tokens (e.g. add `--color-status-running`, `--color-status-failed` to the components-react theme and reference them via `bg-status-running` / `bg-status-failed`). Apply same fix to `Sidebar.tsx::statusDot`.

### ⁉️ ARCH-9
- **Status:** Deferred — Routing the supervisor token through `MowsProvider`'s storagePrefix system requires `mows-components-react` to expose an auth-token helper (the package currently treats auth as OIDC-only via `react-oidc-context`). Adding a "self-issued token" path is feasible but it's a new surface in the shared package and needs design — should the token be stored in cookies (SECURITY-9 deferred) or localStorage with the prefix? Same blocker as SECURITY-9; both move together once the cookie-session decision lands.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/api.ts:27-42`
- **Issue:** The frontend reads `localStorage.getItem("mows-vm-supervisor:token")` directly — duplicating localStorage key strings and bypassing the `MowsProvider` storage-prefix contract ("App-specific localStorage / CSS class namespacing is driven by the required `storagePrefix` prop on `<MowsProvider>`").
- **Why it matters:** `mows-components-react` owns auth; new frontends should obtain credentials through `useMows()`. Hardcoding a separate `mows-vm-supervisor:token` key in api.ts creates a parallel auth surface and the key isn't namespaced by `storagePrefix`.
- **Suggestion:** Route token storage through `MowsProvider`'s storage prefix system. Expose an auth helper in `mows-components-react` (e.g. `useMows().auth.token` or a token-storage utility) and consume it from `api.ts`'s `securityWorker`.

## Findings — apis/cloud/filez moves

### ✅ ARCH-12
- **Status:** Fixed — Added `StorageLocationPicker`, `StorageQuotaPicker`, and `FileViewer` exports to filez `main.ts`. Also dropped the stale "Filez components reorganized 2026-05-12" comment per TASTE-27's pattern. Filez consumers can now import these three by name.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/apis/cloud/filez/components/react/lib/main.ts`
- **Issue:** The filez taxonomy reorganisation reorganised every component under topical groups (`appShell/`, `fileGroups/`, `files/`, `jobs/`, `storage/`, `tags/`, `upload/`) but `lib/main.ts` only re-exports a partial subset of the moved components. Missing exports — components that have a folder + source under `lib/components/` but no corresponding `main.ts` export:
  - `storage/storageLocationPicker/StorageLocationPicker` — has a `.tsx` file, no export.
  - `storage/storageQuotaPicker/StorageQuotaPicker` — has a `.tsx` file, no export.
  - `files/fileViewer/FileViewer` — the filez wrapper that resolves `FilezFile` → URL exists at `lib/components/files/fileViewer/FileViewer.tsx`, no export.
- **Why it matters:** The CLAUDE.md for filez literally says "All components should be exported from main". The reorg moved these three but forgot to re-add the exports. Any consumer (e.g. `apis/cloud/filez/web/`) that imports `StorageLocationPicker` from the package will get a TypeError unless they import the deep path — which then breaks the moment we rename the folder.
- **Suggestion:** Add the three missing `export { default as ... } from "./components/.../..."` lines to `main.ts`. Add a `pnpm build` failure (or a simple test) that catches components present in `lib/components/` but missing from `main.ts`.

### ✅ ARCH-13
- **Status:** Fixed — filez CLAUDE.md `list/ResourceList/` entry now names the test files it actually holds and explicitly forbids putting filez-side source there. ARCH-21 (consumer should know it's tests-only) covered by the same change.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/apis/cloud/filez/components/react/CLAUDE.md` (taxonomy section) vs `/home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/`
- **Issue:** The filez CLAUDE.md taxonomy lists `list/ResourceList/` as a group ("only integration tests for the mows-side ResourceList running under FilezProvider. No filez ResourceList implementation"). But there is no `list/` folder in the filez tree at all — the directory listing shows only `appShell, development, fileGroups, files, jobs, list, storage, tags, upload`. Wait — actually `list/` does exist but contains no current files (the old `FileList.tsx` / `JobList.tsx` were deleted, and `FileList` was relocated under `files/fileList/`).
- **Why it matters:** Dead taxonomy entry: the CLAUDE.md describes a group that exists on disk but is empty (or near-empty). Future contributors will look for the documented integration tests and not find them.
- **Suggestion:** Either restore the integration-test files in `list/ResourceList/` or remove the `list/` entry from filez CLAUDE.md. Pick one.

## Findings — Plan alignment

### ✅ ARCH-14
- **Status:** Fixed — Added a "Phase 2b — Per-component DocPage contract" section to `.plans/component-demo-harness/PLAN.md` enumerating every harness primitive (DocPage/DocSection/InstallationTabs/CommandBlock/ManualSteps/ExampleCard/ExpandableCode+CodeViewer/CodeSnippet/BehaviourList/PropTable), the canonical section order (Installation → Examples → Usage → Composition → RTL → Defined behaviour → API Reference), the translation routing rule, and the ARCH-4 StandardDocPage follow-up as a tracked deferral. CLAUDE.md keeps the contributor-facing summary; PLAN.md now owns the design.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/.plans/component-demo-harness/MIGRATION.md:142, 146` ("MachineMonitor… 5 behaviour statements linked", "ui/Sidebar… 11 behaviour statements linked")
- **Issue:** MIGRATION.md tracks per-component progress but the format is inconsistent. Some entries report behaviour statement counts (good), others don't. The PLAN.md doesn't mention the doc-page contract at all; it only covers Phase 1 (harness) and Phase 2 (Steps). The whole doc-page concept (DocPage, BehaviourList, PropTable, InstallationTabs) was added in MIGRATION.md without ever being designed in PLAN.md.
- **Why it matters:** PLAN.md is the canonical design doc per the CLAUDE.md plan-mode rule. The doc-page concept arrived after the plan and grew organically through 17 migrations, which is exactly what produced the ARCH-3 (section-order disagreement) and ARCH-4 (no `StandardDocPage` abstraction) issues. Future reviewers reading PLAN.md will not understand what shipped.
- **Suggestion:** Either (a) update PLAN.md to add a Phase 2b / Phase 3 section describing the doc-page contract, primitives, and abstractions; or (b) split it: PLAN.md for the example harness, a new `.plans/component-demo-harness/DOC_PAGES.md` for the doc-page contract. Either way, the design lives in a plan file, not just in CLAUDE.md.

### ✅ ARCH-15
- **Status:** Fixed alongside DOC-16 in an earlier pass — `MIGRATION.md` "Not started" parenthetical notes were flipped to ✅ wherever a DocPage and library export both exist (`KeyComboRecorder`, `CommandPalette`, `ModalHandler`, `LoggingConfig`, `ConsoleManager`, `VideoViewer`, etc.).
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/.plans/component-demo-harness/MIGRATION.md:74-141` (Status section)
- **Issue:** The "Not started" list includes components like `KeyComboRecorder` with the comment `_(only exists in demos.tsx, not yet promoted to lib)_`. Yet `KeyComboRecorder` IS exported from `lib/main.ts:12-14` and lives at `lib/components/actions/keyComboRecorder/KeyComboRecorder.tsx`. Same for `CommandPalette` and `ModalHandler` ("needs tests"): they're already exported from `lib/main.ts:16-18`.
- **Why it matters:** The tracker is out of sync with the codebase. Anyone planning the next migration will believe `KeyComboRecorder` needs to be promoted first when in fact only its doc page is missing.
- **Suggestion:** Sweep MIGRATION.md status section against `lib/main.ts` and the components-react filesystem. Update the not-started parenthetical notes. Add a check (e.g. a vitest test under `examples/harness/registryIntegrity.test.ts`, which already exists) that diffs `lib/main.ts` exports against `MIGRATION.md` claims.

## Findings — Public API surface (lib/main.ts)

### ✅ ARCH-16
- **Status:** Fixed — Added `export { default as VideoViewer, type VideoViewerProps } from "./components/files/fileViewer/formats/VideoViewer";` to the files block in `lib/main.ts` alongside the other format viewers.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/lib/main.ts:97-110` (files block)
- **Issue:** The library has a fully implemented `VideoViewer` at `lib/components/files/fileViewer/formats/VideoViewer.tsx` with a `.test.tsx`, a `videoViewer/` helper folder (`ControlBar.tsx`, `SeekPreview.tsx`), and a registered demo (`VideoViewerDocPage`). It is **not exported from `lib/main.ts`** — only `FileViewer`, `ImageViewer`, `Image360Viewer` are exported under `files/`. Consumers cannot import `VideoViewer` from the package.
- **Why it matters:** The package self-describes its public surface via `lib/main.ts`. A consumer wanting to use the new video viewer either has to reach into a deep path (`mows-components-react/components/files/fileViewer/formats/VideoViewer`) or copy the source. Either breaks the encapsulation the topical groups + main.ts barrels are supposed to provide. This is a forgotten export.
- **Suggestion:** Add `export { default as VideoViewer, type VideoViewerProps } from "./components/files/fileViewer/formats/VideoViewer";` to `lib/main.ts` alongside the other format viewers. Sub-helpers (`ControlBar`, `SeekPreview`) stay internal.

### ✅ ARCH-17
- **Status:** Fixed — `Compass` export moved up into the `navigation/` block alongside `PageIndex` + `SectionHeading`. Block order in `main.ts` now mirrors the taxonomy without trailing one-offs.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/lib/main.ts:165-169` (and entire main.ts structure)
- **Issue:** The exports in `main.ts` cluster by topical group (actions, appShell, code, console, dateTime, files, identity, input, list, navigation, settings) — but `Compass` is in `navigation/` per the file path (line 168: `./components/navigation/compass/Compass`), yet exported at the **bottom** of the file (line 165-169) below the `list` block. The navigation block higher up (lines 142-152) only exports `PageIndex` + `SectionHeading`. So `navigation/compass/Compass` is detached from its taxonomy block, suggesting an ad-hoc append.
- **Why it matters:** Public-API ordering should mirror the taxonomy so readers can find a component by group. Random insertions defeat the convention.
- **Suggestion:** Move the `Compass` export up into the `navigation/` block alongside `PageIndex` + `SectionHeading`. Run a sort-by-path lint pass over main.ts to enforce taxonomy ordering.

## Findings — Cleanup / superseded code

### ✅ ARCH-18
- **Status:** Fixed — Removed `useUi`, `Frame`, `Row`, `UiT` type alias, `useContext`/`useState` imports, plus the dead `// ---- Button ---- // ---- Input / Textarea / Label ----` comment markers from `uiDemos.tsx`. The `example.ui` translation block is now orphaned (zero consumers) and can be deleted in a follow-up — kept the block in place this pass to keep the diff focused.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/uiDemos.tsx:115-134`
- **Issue:** `uiDemos.tsx` keeps three dead declarations from before the DocPage migration:
  - `type UiT = Translation["example"]["ui"]` (line 115)
  - `const useUi = (): UiT => …` (line 117-120) — declared, never called anywhere in the codebase.
  - `const Frame = (...) => …` (line 122-127) — declared, never used (every uiDemo entry now renders a `*DocPage`).
  - `const Row = (...) => …` (line 129-134) — declared, never used.
- **Why it matters:** Dead code paths still pin the old `example.ui.*` translation block (~150 lines in `languages.ts`, paralleled in `en-US.ts` and `de.ts` × 25+ component sub-blocks) as alive — because `useUi` exists, TypeScript treats `Translation['example']['ui']` as reachable. Removing the dead code unlocks deleting the orphaned translation block.
- **Suggestion:** Delete `useUi`, `Frame`, `Row`, and the `UiT` type alias from `uiDemos.tsx`. Then delete the entire `example.ui` block from `languages.ts`, `languages/en-US.ts`, `languages/de.ts` (~450 lines total across the three). The new `example.examples.<component>.*` blocks are the only consumers now.

### ✅ ARCH-19
- **Status:** Fixed — Deleted the orphaned `example.ui` block (~120 lines per file × 3 files = 358 lines removed) from `languages.ts`, `languages/en-US.ts`, `languages/de.ts`. Build still green; 1473 tests still pass.
- **Severity:** Major
- **File:** `/home/paul/projects/mows/components/react/src/languages.ts:51-169` (and the two language files)
- **Issue:** The `example.ui` translation block (lines 51-169 in `languages.ts`) holds ~25 component sub-blocks (button, badge, card, input, textarea, label, checkbox, switch, select, radioGroup, slider, progress, tabs, dialog, popover, hoverCard, dropdownMenu, contextMenu, skeleton, scrollArea, resizable, sonner, inputGroup, calendar) — **none of which are referenced** outside the dead `useUi` hook in `uiDemos.tsx` (see ARCH-18). The actual UI primitive demos now use `example.examples.<component>.*` keys via their DocPages.
- **Why it matters:** ~450 lines of orphaned translations in 3 files. New languages added later will be expected to fill in entries that nothing reads. Maintenance cost without benefit.
- **Suggestion:** Delete the entire `example.ui` block from `languages.ts`, `languages/en-US.ts`, `languages/de.ts`. Verify no other consumers via `grep -rn "example\.ui\|t\.ui" components/react/src/`.

### ✅ ARCH-20
- **Status:** Fixed — Removed dead `DemoFrame`, `useTranslations`, `ExampleT|DemosT|CommonT` declarations + unused imports (`useContext`, `useRef`, `useState`, `KeyComboDisplay`, `Button`, `isMacPlatform`, `MowsContext`) from `demos.tsx`. Comment in place explains the migration retirement.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/components/react/src/demos.tsx:62-72` (`<DemoFrame>` declaration) and `/home/paul/projects/mows/components/react/src/demos.tsx:53-55` (translation type aliases)
- **Issue:** `demos.tsx` still declares `<DemoFrame>` (line 62-67), `useTranslations` (line 69-72), and the `ExampleT`/`DemosT`/`CommonT` type aliases (line 53-55) — but every demo entry now renders `() => <FooDocPage />` so `DemoFrame` and `useTranslations` are never called from inside `demos.tsx`. (Cross-check: `grep -n "DemoFrame\|useTranslations" demos.tsx` would show only the declaration sites.)
- **Why it matters:** Same parasitic-dead-code pattern as ARCH-18. Confuses readers about which scaffolding is still active.
- **Suggestion:** Delete `DemoFrame`, `useTranslations`, and the `ExampleT/DemosT/CommonT` type aliases from `demos.tsx`. If `<DemoFrame>` is genuinely needed (e.g. for the un-migrated demos that still render legacy renderers), surface that — but `demos.tsx`'s entries no longer reference it.

### ✅ ARCH-21
- **Status:** Fixed alongside ARCH-13 — filez CLAUDE.md now explicitly names the integration-test-only convention for `list/ResourceList/` and forbids filez-side source there.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/list/ResourceList/`
- **Issue:** The `list/` group in the new filez tree holds only `ResourceList.test.tsx` and `rowHandlers/Column.test.tsx`. These are integration tests for the mows-side `ResourceList` (matches CLAUDE.md's description). However, no `index.ts` / barrel file documents what this group exists for — and the test files are colocated under `ResourceList/` with the same paths a consumer would use to find a real source file. A future developer scanning the tree will look for `list/ResourceList/ResourceList.tsx` (it doesn't exist; the source lives in `mows-components-react`) and may be tempted to create one.
- **Why it matters:** The integration-tests-only convention is hidden in CLAUDE.md, not in the filesystem. The tests work but the discoverability is poor.
- **Suggestion:** Either (a) add a `list/ResourceList/README.md` (or co-located comment header on the test files) explaining "this folder only holds integration tests for the upstream mows ResourceList — never put filez-side source here", or (b) move the tests to `tests/integration/ResourceList/` to make the folder's purpose obvious from its location.

### ✅ ARCH-22
- **Status:** Verified — `find` confirms `tasks/` has `resetDatabase.ts`, `createAdminStorageQuota.ts`, `createMockFiles.ts`; `apiTests/` has the 9 catalog entries. DevPanel's `tasks`/`tests` lists match the on-disk structure exactly. No dead catalog entries.
- **Severity:** Minor
- **File:** `/home/paul/projects/mows/apis/cloud/filez/components/react/lib/components/development/DevPanel.tsx:45-91` and `:170`
- **Issue:** Two playground tests are missing from the tests catalog vs. the deleted files. The `tests` list contains 9 items (lines 45-91) — `accessPoliciesListFiles`, `allround1`, `doubleOptionUpdate`, `imageJob`, `listTags`, `metadataJob`, `nameValidation`, `storageQuota`, `tags` — but the deleted files listed `createMockFiles` and `createAdminStorageQuota` too (those now live in `tasks` list, lines 93-109). The `apiTests/` folder has 9 files matching the `tests` list; the `tasks/` folder presumably has 3 files matching the `tasks` list. Need to verify `tasks/resetDatabase.ts` actually exists.
- **Why it matters:** A dynamic import on a missing task file throws at runtime, which DevPanel currently surfaces as a generic error. Confirming the on-disk structure matches the in-source catalog is a one-line check.
- **Suggestion:** Verify `find apis/cloud/filez/components/react/lib/components/development/tasks/ -name "*.ts"` returns `createMockFiles.ts`, `createAdminStorageQuota.ts`, `resetDatabase.ts`. If any are missing, restore them or remove the catalog entry.

